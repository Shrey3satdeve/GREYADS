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

function createFinalizeFirebaseMock({ orderData, eventData, ticketExists = false, notificationExists = false }) {
  const writes = [];
  const updates = [];
  const orderRef = { id: 'order_123' };
  const eventRef = { id: orderData.event_id };
  const ticketRef = { id: 'pay_abc12345' };
  const notificationRef = { id: `ticket_${ticketRef.id}` };

  const transaction = {
    async get(ref) {
      if (ref === orderRef) {
        return {
          exists: true,
          data: () => orderData,
        };
      }

      if (ref === eventRef) {
        return {
          exists: true,
          data: () => eventData,
        };
      }

      if (ref === ticketRef) {
        return {
          exists: ticketExists,
          data: () => ({ id: ticketRef.id }),
        };
      }

      if (ref === notificationRef) {
        return {
          exists: notificationExists,
          data: () => ({ id: notificationRef.id }),
        };
      }

      throw new Error(`Unexpected get for ref ${ref?.id || 'unknown'}`);
    },
    set(ref, payload, options) {
      writes.push({ ref, payload, options });
    },
    update(ref, payload) {
      updates.push({ ref, payload });
    },
  };

  const db = {
    collection(name) {
      return {
        doc(id) {
          if (name === 'events') {
            return eventRef;
          }
          if (name === 'tickets') {
            return ticketRef;
          }
          if (name === 'notifications') {
            return notificationRef;
          }
          return { id };
        },
      };
    },
    async runTransaction(callback) {
      return callback(transaction);
    },
  };

  const firebaseMock = {
    db,
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

  return { firebaseMock, writes, updates, orderRef, eventRef, ticketRef, notificationRef };
}

test('finalizePaymentOrder creates a ticket, notification, and consumes held reservations', async () => {
  const orderData = {
    event_id: 'event_live',
    event_title: 'GreyCon',
    event_date: '2026-04-20',
    user_id: 'user_1234',
    user_name: 'Asha',
    user_email: 'asha@example.com',
    quantity: '2',
    guests: [{ name: '  Robin  ', age: ' 26 ' }],
    base_amount: 500,
    fee_amount: 25,
    charged_amount: 525,
    expected_amount_paise: 52500,
    currency: 'INR',
    reservation_status: 'held',
  };
  const eventData = {
    title: 'GreyCon',
    date: '2026-04-20',
    venue: 'Main Hall',
    category: 'Tech',
  };
  const { firebaseMock, writes, updates, orderRef, eventRef, ticketRef, notificationRef } = createFinalizeFirebaseMock({
    orderData,
    eventData,
  });
  const { finalizePaymentOrder } = loadPaymentHandlersWithFirebaseMock(firebaseMock);

  const result = await finalizePaymentOrder({
    orderRef,
    orderId: 'order_123',
    paymentId: ticketRef.id,
    verifiedSource: 'verifyPayment',
    gatewayPaymentStatus: 'captured',
  });

  assert.deepEqual(result, {
    success: true,
    ticket_id: ticketRef.id,
    is_duplicate: false,
  });

  assert.equal(writes.length, 4);
  assert.deepEqual(updates, []);

  assert.deepEqual(writes[0], {
    ref: ticketRef,
    payload: {
      event_id: 'event_live',
      user_id: 'user_1234',
      user_name: 'Asha',
      user_email: 'asha@example.com',
      event_title: 'GreyCon',
      event_date: '2026-04-20',
      event_venue: 'Main Hall',
      event_category: 'Tech',
      qr_token: 'GRY-user-pay_abc1',
      booking_ref: 'GRY-RZP-PAY_ABC1',
      status: 'valid',
      quantity: 2,
      guests: [
        { name: 'Robin', age: '26' },
      ],
      total_price: 500,
      base_amount: 500,
      fee_amount: 25,
      charged_amount: 525,
      charged_amount_paise: 52500,
      currency: 'INR',
      razorpay_order_id: 'order_123',
      razorpay_payment_id: 'pay_abc12345',
      payment_status: 'captured',
      created_at: { __op: 'serverTimestamp' },
      updated_at: { __op: 'serverTimestamp' },
    },
    options: undefined,
  });

  assert.deepEqual(writes[1], {
    ref: notificationRef,
    payload: {
      user_id: 'user_1234',
      type: 'ticket',
      title: 'Ticket Confirmed',
      message: 'Your payment was successful and your ticket for GreyCon for 2026-04-20 is ready.',
      is_read: false,
      created_at: { __op: 'serverTimestamp' },
      updated_at: { __op: 'serverTimestamp' },
      ticket_id: 'pay_abc12345',
      order_id: 'order_123',
      payment_id: 'pay_abc12345',
      route: '/ticket/pay_abc12345',
    },
    options: undefined,
  });

  assert.deepEqual(writes[2], {
    ref: eventRef,
    payload: {
      reserved_tickets: { __op: 'increment', value: -2 },
    },
    options: { merge: true },
  });

  assert.deepEqual(writes[3], {
    ref: orderRef,
    payload: {
      status: 'fulfilled',
      ticket_id: 'pay_abc12345',
      razorpay_payment_id: 'pay_abc12345',
      payment_status: 'captured',
      verified_source: 'verifyPayment',
      fulfilled_at: { __op: 'serverTimestamp' },
      updated_at: { __op: 'serverTimestamp' },
      reservation_status: 'consumed',
      reservation_consumed_at: { __op: 'serverTimestamp' },
    },
    options: { merge: true },
  });
});

test('finalizePaymentOrder backfills the order for duplicate tickets without recreating notifications', async () => {
  const orderData = {
    event_id: 'event_live',
    user_id: 'user_1234',
    quantity: 1,
  };
  const eventData = {
    title: 'GreyCon',
    date: '2026-04-20',
    venue: 'Main Hall',
  };
  const { firebaseMock, writes, updates, orderRef, ticketRef } = createFinalizeFirebaseMock({
    orderData,
    eventData,
    ticketExists: true,
    notificationExists: true,
  });
  const { finalizePaymentOrder } = loadPaymentHandlersWithFirebaseMock(firebaseMock);

  const result = await finalizePaymentOrder({
    orderRef,
    orderId: 'order_123',
    paymentId: ticketRef.id,
    verifiedSource: 'status_poll',
    gatewayPaymentStatus: 'captured',
  });

  assert.deepEqual(result, {
    success: true,
    ticket_id: ticketRef.id,
    is_duplicate: true,
  });

  assert.deepEqual(updates, []);
  assert.deepEqual(writes, [
    {
      ref: orderRef,
      payload: {
        ticket_id: 'pay_abc12345',
        status: 'fulfilled',
        razorpay_payment_id: 'pay_abc12345',
        payment_status: 'captured',
        verified_source: 'status_poll',
        fulfilled_at: { __op: 'serverTimestamp' },
        updated_at: { __op: 'serverTimestamp' },
      },
      options: { merge: true },
    },
  ]);
});


test('finalizePaymentOrder backfills a missing notification for duplicate tickets', async () => {
  const orderData = {
    event_id: 'event_live',
    event_title: 'GreyCon',
    event_date: '2026-04-20',
    user_id: 'user_1234',
    quantity: 1,
  };
  const eventData = {
    title: 'GreyCon',
    date: '2026-04-20',
    venue: 'Main Hall',
  };
  const { firebaseMock, writes, updates, orderRef, ticketRef, notificationRef } = createFinalizeFirebaseMock({
    orderData,
    eventData,
    ticketExists: true,
    notificationExists: false,
  });
  const { finalizePaymentOrder } = loadPaymentHandlersWithFirebaseMock(firebaseMock);

  const result = await finalizePaymentOrder({
    orderRef,
    orderId: 'order_123',
    paymentId: ticketRef.id,
    verifiedSource: 'status_poll',
    gatewayPaymentStatus: 'captured',
  });

  assert.deepEqual(result, {
    success: true,
    ticket_id: ticketRef.id,
    is_duplicate: true,
  });

  assert.deepEqual(updates, []);
  assert.deepEqual(writes, [
    {
      ref: orderRef,
      payload: {
        ticket_id: 'pay_abc12345',
        status: 'fulfilled',
        razorpay_payment_id: 'pay_abc12345',
        payment_status: 'captured',
        verified_source: 'status_poll',
        fulfilled_at: { __op: 'serverTimestamp' },
        updated_at: { __op: 'serverTimestamp' },
      },
      options: { merge: true },
    },
    {
      ref: notificationRef,
      payload: {
        user_id: 'user_1234',
        type: 'ticket',
        title: 'Ticket Confirmed',
        message: 'Your payment was successful and your ticket for GreyCon for 2026-04-20 is ready.',
        is_read: false,
        created_at: { __op: 'serverTimestamp' },
        updated_at: { __op: 'serverTimestamp' },
        ticket_id: 'pay_abc12345',
        order_id: 'order_123',
        payment_id: 'pay_abc12345',
        route: '/ticket/pay_abc12345',
      },
      options: undefined,
    },
  ]);
});
