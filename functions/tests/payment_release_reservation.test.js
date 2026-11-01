const test = require('node:test');
const assert = require('node:assert/strict');

function clearModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function loadPaymentHandlersWithFirebaseMock(firebaseMock) {
  const firebaseInitPath = require.resolve('../firebase_init');
  require.cache[firebaseInitPath] = {
    id: firebaseInitPath,
    filename: firebaseInitPath,
    loaded: true,
    exports: firebaseMock,
  };

  clearModule('../core_utils');
  clearModule('../payment_handlers');

  return require('../payment_handlers');
}

function createFirebaseMock({ orderData, orderExists = true }) {
  const writes = [];
  const orderRef = { id: 'order_123' };
  const eventRef = { id: orderData?.event_id || 'event_123' };

  const transaction = {
    async get(ref) {
      if (ref === orderRef) {
        return {
          exists: orderExists,
          data: () => orderData,
        };
      }
      throw new Error(`Unexpected get for ref ${ref?.id || 'unknown'}`);
    },
    set(ref, payload, options) {
      writes.push({ ref, payload, options });
    },
  };

  const firebaseMock = {
    db: {
      collection(name) {
        return {
          doc(id) {
            if (name === 'events') {
              return eventRef;
            }
            return { id };
          },
        };
      },
      async runTransaction(callback) {
        return callback(transaction);
      },
    },
    FieldValue: {
      increment(value) {
        return { __op: 'increment', value };
      },
      serverTimestamp() {
        return { __op: 'serverTimestamp' };
      },
    },
    PAYMENT_ORDERS_COLLECTION: 'payment_orders',
    CONVENIENCE_FEE_RATE: 0.05,
    RESERVATION_WINDOW_MINUTES: 15,
    PAYMENT_STATUS: {
      CREATED: 'created',
      PENDING_CAPTURE: 'pending_capture',
      FULFILLED: 'fulfilled',
      FAILED: 'failed',
      REFUNDED: 'refunded',
      INVENTORY_CONFLICT: 'inventory_conflict',
    },
    RESERVATION_STATUS: {
      HELD: 'held',
      RELEASED: 'released',
      CONSUMED: 'consumed',
      LEGACY: 'legacy',
    },
  };

  return { firebaseMock, orderRef, eventRef, writes };
}

test('releaseReservation skips missing orders without writes', async () => {
  const { firebaseMock, orderRef, writes } = createFirebaseMock({
    orderData: null,
    orderExists: false,
  });
  const { releaseReservation } = loadPaymentHandlersWithFirebaseMock(firebaseMock);

  const result = await releaseReservation({ orderRef, reason: 'user_cancelled' });

  assert.deepEqual(result, { released: false, reason: 'missing' });
  assert.equal(writes.length, 0);
});

test('releaseReservation skips non-held legacy reservations without writes', async () => {
  const { firebaseMock, orderRef, writes } = createFirebaseMock({
    orderData: {
      event_id: 'event_legacy',
      reservation_status: 'legacy',
      quantity: 2,
    },
  });
  const { releaseReservation } = loadPaymentHandlersWithFirebaseMock(firebaseMock);

  const result = await releaseReservation({ orderRef, reason: 'user_cancelled' });

  assert.deepEqual(result, { released: false, reason: 'legacy' });
  assert.equal(writes.length, 0);
});

test('releaseReservation restores held inventory and marks the order released', async () => {
  const orderData = {
    event_id: 'event_live',
    reservation_status: 'held',
    reservation_quantity: '03',
    payment_status: 'created',
    razorpay_payment_id: 'pay_existing',
  };
  const { firebaseMock, orderRef, eventRef, writes } = createFirebaseMock({ orderData });
  const { releaseReservation } = loadPaymentHandlersWithFirebaseMock(firebaseMock);

  const result = await releaseReservation({
    orderRef,
    reason: 'gateway_failed',
    nextStatus: 'failed',
    paymentStatus: 'failed',
  });

  assert.equal(result.released, true);
  assert.equal(result.orderData, orderData);
  assert.equal(writes.length, 2);

  assert.deepEqual(writes[0], {
    ref: eventRef,
    payload: {
      available_tickets: { __op: 'increment', value: 3 },
      reserved_tickets: { __op: 'increment', value: -3 },
    },
    options: { merge: true },
  });

  assert.deepEqual(writes[1], {
    ref: orderRef,
    payload: {
      status: 'failed',
      failure_reason: 'gateway_failed',
      payment_status: 'failed',
      razorpay_payment_id: 'pay_existing',
      reservation_status: 'released',
      reservation_release_reason: 'gateway_failed',
      reservation_released_at: { __op: 'serverTimestamp' },
      updated_at: { __op: 'serverTimestamp' },
    },
    options: { merge: true },
  });
});
