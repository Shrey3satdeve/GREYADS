const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { 
  db, 
  FieldValue, 
  PAYMENT_ORDERS_COLLECTION, 
  CONVENIENCE_FEE_RATE, 
  RESERVATION_WINDOW_MINUTES, 
  PAYMENT_STATUS, 
  RESERVATION_STATUS 
} = require('./firebase_init');
const { 
  sanitizeObject, 
  InitiatePaymentSchema, 
  VerifyPaymentSchema, 
  PaymentStatusSchema 
} = require('./schemas');
const { 
  requireAuth, 
  firstValidationMessage, 
  getPaymentOrderRef, 
  getReservationExpiryDate, 
  toDate, 
  normalizeQuantity, 
  sanitizeGuestsList, 
  loadRazorpaySecrets 
} = require('./core_utils');

/**
 * Razorpay Helpers
 */
async function fetchRazorpayJson(path) {
  const { keyId, keySecret } = loadRazorpaySecrets();
  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/json',
    },
  });

  let payload = {};
  try { payload = await response.json(); } catch { payload = {}; }

  if (!response.ok) {
    logger.error('[Razorpay] GET failed', { path, status: response.status, payload });
    throw new HttpsError('internal', 'Unable to validate payment with gateway.');
  }
  return payload;
}

async function postRazorpayJson(path, payload) {
  const { keyId, keySecret } = loadRazorpaySecrets();
  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload || {}),
  });

  let responseBody = {};
  try { responseBody = await response.json(); } catch { responseBody = {}; }

  if (!response.ok) {
    logger.error('[Razorpay] POST failed', { path, status: response.status, payload, response: responseBody });
    throw new HttpsError('internal', 'Unable to update payment state with gateway.');
  }
  return responseBody;
}

async function captureRazorpayPayment({ paymentId, amount, currency }) {
  return postRazorpayJson(`/payments/${paymentId}/capture`, { amount, currency });
}

function computePricing(eventPrice, quantity) {
  const unitPrice = Math.max(0, Number(eventPrice) || 0);
  const qty = Math.max(1, normalizeQuantity(quantity));
  const baseAmount = Math.round(unitPrice * qty);
  const feeAmount = baseAmount > 0 ? Math.round(baseAmount * CONVENIENCE_FEE_RATE) : 0;
  const chargedAmount = baseAmount + feeAmount;

  return {
    unit_price: unitPrice,
    quantity: qty,
    base_amount: baseAmount,
    fee_amount: feeAmount,
    charged_amount: chargedAmount,
    base_amount_paise: baseAmount * 100,
    fee_amount_paise: feeAmount * 100,
    charged_amount_paise: chargedAmount * 100,
    currency: 'INR',
  };
}

async function checkRateLimit(uid, action, maxAttempts, windowMinutes) {
  const limitRef = db.collection('rate_limits').doc(`${uid}_${action}`);
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;

  await db.runTransaction(async (t) => {
    const snap = await t.get(limitRef);
    const data = snap.exists ? snap.data() : { count: 0, reset_at: now + windowMs };

    if (now > data.reset_at) {
      t.set(limitRef, { count: 1, reset_at: now + windowMs });
    } else if (data.count >= maxAttempts) {
      throw new HttpsError('resource-exhausted', `Rate limit exceeded for ${action}. Please try again later.`);
    } else if (!snap.exists) {
      t.set(limitRef, { count: data.count + 1, reset_at: data.reset_at });
    } else {
      t.update(limitRef, { count: data.count + 1 });
    }
  });
}

async function reserveInventoryForOrder({ orderId, eventId, quantity, orderPayload }) {
  const orderRef = getPaymentOrderRef(orderId);
  const eventRef = db.collection('events').doc(eventId);
  const qty = Math.max(1, normalizeQuantity(quantity));
  const reservationExpiresAt = getReservationExpiryDate();

  await db.runTransaction(async (transaction) => {
    const eventSnap = await transaction.get(eventRef);
    if (!eventSnap.exists) {
      throw new HttpsError('not-found', 'Event not found.');
    }

    const eventData = eventSnap.data();
    if ((eventData.available_tickets || 0) < qty) {
      throw new HttpsError('failed-precondition', 'Not enough tickets available.');
    }

    transaction.update(eventRef, {
      available_tickets: FieldValue.increment(-qty),
      reserved_tickets: FieldValue.increment(qty),
    });

    transaction.set(orderRef, {
      ...orderPayload,
      reservation_status: RESERVATION_STATUS.HELD,
      reservation_quantity: qty,
      reservation_expires_at: reservationExpiresAt,
      reservation_created_at: FieldValue.serverTimestamp(),
    });
  });

  return { orderRef, reservationExpiresAt };
}

/**
 * Auth & Order Helpers
 */
async function findPaymentOrderForUser(referenceId, uid) {
  let orderSnap = await getPaymentOrderRef(referenceId).get();
  if (!orderSnap.exists) {
    const byPaymentId = await db.collection(PAYMENT_ORDERS_COLLECTION)
      .where('razorpay_payment_id', '==', referenceId)
      .limit(1)
      .get();
    if (!byPaymentId.empty) orderSnap = byPaymentId.docs[0];
  }

  if (!orderSnap.exists) return null;
  const orderData = orderSnap.data();
  if (orderData.user_id !== uid) {
    throw new HttpsError('permission-denied', 'This payment does not belong to the current user.');
  }
  return { ref: orderSnap.ref, id: orderSnap.id, data: orderData };
}

async function markPaymentOrderFailure(orderRef, fields) {
  await orderRef.set({ ...fields, updated_at: FieldValue.serverTimestamp() }, { merge: true });
}

/**
 * Finalization & Logic
 */
async function finalizePaymentOrder({ orderRef, orderId, paymentId, verifiedSource, gatewayPaymentStatus }) {
  try {
    return await db.runTransaction(async (transaction) => {
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists) throw new HttpsError('not-found', 'Payment order not found.');

      const orderData = orderSnap.data();
      const eventRef = db.collection('events').doc(orderData.event_id);
      const ticketRef = db.collection('tickets').doc(paymentId);
      const notificationRef = db.collection('notifications').doc(`ticket_${paymentId}`);

      // ALL READS MUST HAPPEN AT THE TOP
      const [eventSnap, ticketSnap, notificationSnap] = await Promise.all([
        transaction.get(eventRef),
        transaction.get(ticketRef),
        transaction.get(notificationRef),
      ]);

      if (ticketSnap.exists) {
        transaction.set(orderRef, {
          ticket_id: ticketRef.id,
          status: PAYMENT_STATUS.FULFILLED,
          razorpay_payment_id: paymentId,
          payment_status: gatewayPaymentStatus,
          verified_source: verifiedSource,
          fulfilled_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        }, { merge: true });

        if (!notificationSnap.exists) {
          transaction.set(notificationRef, buildPaymentSuccessNotification({
            orderData,
            ticketId: ticketRef.id,
            orderId,
            paymentId,
          }));
        }

        return { success: true, ticket_id: ticketRef.id, is_duplicate: true };
      }

      if (!eventSnap.exists) throw new HttpsError('not-found', 'Event not found.');
      const eventData = eventSnap.data();
      const qty = Math.max(1, normalizeQuantity(orderData.quantity));
      const reservationStatus = orderData.reservation_status || RESERVATION_STATUS.LEGACY;

      if (reservationStatus === RESERVATION_STATUS.RELEASED) throw new Error('reservation_released');
      if (reservationStatus === RESERVATION_STATUS.LEGACY && (eventData.available_tickets || 0) < qty) {
        throw new Error('inventory_conflict');
      }

      const ticketPayload = {
        event_id: orderData.event_id,
        user_id: orderData.user_id,
        user_name: orderData.user_name || 'Guest',
        user_email: orderData.user_email || '',
        event_title: eventData.title,
        event_date: eventData.date,
        event_venue: eventData.venue,
        event_category: eventData.category || '',
        qr_token: `GRY-${orderData.user_id.substring(0, 4)}-${paymentId.substring(0, 8)}`,
        booking_ref: `GRY-RZP-${paymentId.substring(0, 8).toUpperCase()}`,
        status: 'valid',
        quantity: qty,
        guests: sanitizeGuestsList(orderData.guests, qty, orderData.user_name || 'Guest'),
        total_price: orderData.base_amount,
        base_amount: orderData.base_amount,
        fee_amount: orderData.fee_amount,
        charged_amount: orderData.charged_amount,
        charged_amount_paise: orderData.expected_amount_paise,
        currency: orderData.currency || 'INR',
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        payment_status: gatewayPaymentStatus,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      };

      transaction.set(ticketRef, ticketPayload);
      if (!notificationSnap.exists) {
        transaction.set(notificationRef, buildPaymentSuccessNotification({
          orderData,
          ticketId: ticketRef.id,
          orderId,
          paymentId,
        }));
      }

      if (reservationStatus === RESERVATION_STATUS.HELD) {
        transaction.set(eventRef, { reserved_tickets: FieldValue.increment(-qty) }, { merge: true });
      } else {
        transaction.update(eventRef, { available_tickets: FieldValue.increment(-qty) });
      }

      transaction.set(orderRef, {
        status: PAYMENT_STATUS.FULFILLED,
        ticket_id: ticketRef.id,
        razorpay_payment_id: paymentId,
        payment_status: gatewayPaymentStatus,
        verified_source: verifiedSource,
        fulfilled_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
        ...(reservationStatus === RESERVATION_STATUS.HELD ? {
          reservation_status: RESERVATION_STATUS.CONSUMED,
          reservation_consumed_at: FieldValue.serverTimestamp()
        } : {})
      }, { merge: true });

      return { success: true, ticket_id: ticketRef.id, is_duplicate: false };
    });
  } catch (err) {
    logger.error('[finalizePaymentOrder] Transaction failed:', err);
    throw err;
  }
}

function buildPaymentSuccessNotification({ orderData, ticketId, orderId, paymentId }) {
  const eventTitle = orderData.event_title || 'Your booking';
  const datePart = orderData.event_date ? ` for ${orderData.event_date}` : '';
  return {
    user_id: orderData.user_id,
    type: 'ticket',
    title: 'Ticket Confirmed',
    message: `Your payment was successful and your ticket for ${eventTitle}${datePart} is ready.`,
    is_read: false,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
    ticket_id: ticketId,
    order_id: orderId,
    payment_id: paymentId,
    route: `/ticket/${ticketId}`,
  };
}

async function releaseReservation({ orderRef, reason, nextStatus = PAYMENT_STATUS.FAILED, paymentId = null, paymentStatus = null }) {
  return db.runTransaction(async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) return { released: false, reason: 'missing' };
    const orderData = orderSnap.data();
    if (orderData.ticket_id) return { released: false, reason: 'fulfilled' };
    if (orderData.reservation_status !== RESERVATION_STATUS.HELD) return { released: false, reason: 'legacy' };

    const qty = Math.max(1, normalizeQuantity(orderData.reservation_quantity || orderData.quantity));
    const eventRef = db.collection('events').doc(orderData.event_id);
    transaction.set(eventRef, {
      available_tickets: FieldValue.increment(qty),
      reserved_tickets: FieldValue.increment(-qty),
    }, { merge: true });

    transaction.set(orderRef, {
      status: nextStatus,
      failure_reason: reason,
      payment_status: paymentStatus || orderData.payment_status || 'cancelled',
      razorpay_payment_id: paymentId || orderData.razorpay_payment_id || null,
      reservation_status: RESERVATION_STATUS.RELEASED,
      reservation_release_reason: reason,
      reservation_released_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { released: true, orderData };
  });
}

/**
 * Exports
 */
const initiatePayment = onCall({ region: 'asia-south1', timeoutSeconds: 30, secrets: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'] }, async (request) => {
  requireAuth(request);
  await checkRateLimit(request.auth.uid, 'initiate_payment', 10, 60);
  const sanitized = sanitizeObject(request.data);
  const result = InitiatePaymentSchema.safeParse(sanitized);
  if (!result.success) throw new HttpsError('invalid-argument', firstValidationMessage(result.error));
  const { event_id, quantity, guests } = result.data;
  const uid = request.auth.uid;

  const eventSnap = await db.collection('events').doc(event_id).get();
  if (!eventSnap.exists) throw new HttpsError('not-found', 'Event not found.');
  const eventData = eventSnap.data();

  const pricing = computePricing(eventData.price, quantity);
  const qty = pricing.quantity;
  const guestsList = sanitizeGuestsList(guests, qty, request.auth?.token?.name || 'Guest');
  const { keyId, keySecret } = loadRazorpaySecrets();
  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

  const gatewayOrder = await razorpay.orders.create({
    amount: pricing.charged_amount_paise,
    currency: pricing.currency,
    receipt: `rcpt_${Date.now()}`,
    notes: {
      event_id,
      quantity: String(qty),
      user_id: uid,
    },
  });

  const orderPayload = {
    user_id: uid,
    event_id,
    event_title: eventData.title,
    event_venue: eventData.venue,
    event_category: eventData.category || '',
    event_date: eventData.date,
    quantity: qty,
    guests: guestsList,
    base_amount: pricing.base_amount,
    fee_amount: pricing.fee_amount,
    charged_amount: pricing.charged_amount,
    expected_amount_paise: pricing.charged_amount_paise,
    currency: pricing.currency,
    payment_status: 'created',
    status: PAYMENT_STATUS.CREATED,
    created_source: 'initiatePayment',
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };

  await reserveInventoryForOrder({
    orderId: gatewayOrder.id,
    eventId: event_id,
    quantity: qty,
    orderPayload,
  });

  return {
    success: true,
    order_id: gatewayOrder.id,
    amount: gatewayOrder.amount,
    currency: gatewayOrder.currency || pricing.currency,
    key_id: keyId,
    reservation_expires_at: new Date(Date.now() + RESERVATION_WINDOW_MINUTES * 60 * 1000).toISOString(),
  };
});

const verifyPayment = onCall({ region: 'asia-south1', timeoutSeconds: 30, secrets: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'] }, async (request) => {
  requireAuth(request);
  const sanitized = sanitizeObject(request.data);
  const result = VerifyPaymentSchema.safeParse(sanitized);
  if (!result.success) throw new HttpsError('invalid-argument', firstValidationMessage(result.error));
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = result.data;

  const { keySecret } = loadRazorpaySecrets();
  const uid = request.auth.uid;
  const paymentOrder = await findPaymentOrderForUser(razorpay_order_id, uid);
  if (!paymentOrder) throw new HttpsError('not-found', 'Payment order not found.');

  const hmac = crypto.createHmac('sha256', keySecret);
  hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
  const generatedSignature = hmac.digest('hex');

  const sigBuffer = Buffer.from(generatedSignature, 'hex');
  const incomingBuffer = Buffer.from(razorpay_signature, 'hex');
  const signatureValid =
    sigBuffer.length === incomingBuffer.length &&
    crypto.timingSafeEqual(sigBuffer, incomingBuffer);

  if (!signatureValid) {
    throw new HttpsError('invalid-argument', 'Payment signature verification failed.');
  }

  const [gatewayOrder, rawGatewayPayment] = await Promise.all([
    fetchRazorpayJson(`/orders/${razorpay_order_id}`),
    fetchRazorpayJson(`/payments/${razorpay_payment_id}`),
  ]);

  let gatewayPayment = rawGatewayPayment;
  if (gatewayPayment.status === 'authorized') {
    gatewayPayment = await captureRazorpayPayment({
      paymentId: gatewayPayment.id,
      amount: paymentOrder.data.expected_amount_paise,
      currency: paymentOrder.data.currency || 'INR',
    });
  }

  if (gatewayOrder.id !== razorpay_order_id) {
    throw new HttpsError('invalid-argument', 'Gateway order mismatch.');
  }
  if (gatewayPayment.id !== razorpay_payment_id || gatewayPayment.order_id !== razorpay_order_id) {
    throw new HttpsError('invalid-argument', 'Gateway payment mismatch.');
  }
  if (gatewayPayment.amount !== paymentOrder.data.expected_amount_paise) {
    throw new HttpsError('failed-precondition', 'Payment amount mismatch.');
  }
  if (gatewayPayment.currency !== (paymentOrder.data.currency || 'INR')) {
    throw new HttpsError('failed-precondition', 'Payment currency mismatch.');
  }

  await paymentOrder.ref.set({
    razorpay_payment_id,
    payment_status: gatewayPayment.status || 'unknown',
    signature_verified: true,
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });

  if (gatewayPayment.status !== 'captured') {
    await markPaymentOrderFailure(paymentOrder.ref, {
      status: PAYMENT_STATUS.PENDING_CAPTURE,
      razorpay_payment_id,
      payment_status: gatewayPayment.status || 'unknown',
      signature_verified: true,
    });
    return {
      success: false,
      status: 'PENDING',
      order_id: razorpay_order_id,
    };
  }

  const finalized = await finalizePaymentOrder({
    orderRef: paymentOrder.ref,
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    verifiedSource: 'verifyPayment',
    gatewayPaymentStatus: gatewayPayment.status || 'captured',
  });

  return {
    success: true,
    status: 'COMPLETED',
    ticket_id: finalized.ticket_id,
    order_id: razorpay_order_id,
    is_duplicate: finalized.is_duplicate,
  };
});

const cancelPaymentOrder = onCall({ region: 'asia-south1', timeoutSeconds: 30, secrets: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'] }, async (request) => {
  requireAuth(request);
  const sanitized = sanitizeObject(request.data);
  const result = PaymentStatusSchema.safeParse(sanitized);
  if (!result.success) throw new HttpsError('invalid-argument', firstValidationMessage(result.error));
  const { reference_id } = result.data;
  const paymentOrder = await findPaymentOrderForUser(reference_id, request.auth.uid);
  if (!paymentOrder) return { success: false, status: 'NOT_FOUND' };

  if (paymentOrder.data.ticket_id) {
    return {
      success: true,
      status: 'COMPLETED',
      ticket_id: paymentOrder.data.ticket_id,
      order_id: paymentOrder.id,
    };
  }

  try {
    const gatewayPayments = await fetchRazorpayJson(`/orders/${paymentOrder.id}/payments`);
    const items = Array.isArray(gatewayPayments.items) ? gatewayPayments.items : [];
    const capturedPayment = items.find((item) => item.status === 'captured');
    const failedPayment = items.find((item) => item.status === 'failed');

    if (capturedPayment) {
      const finalized = await finalizePaymentOrder({
        orderRef: paymentOrder.ref,
        orderId: paymentOrder.id,
        paymentId: capturedPayment.id,
        verifiedSource: 'cancel_check',
        gatewayPaymentStatus: capturedPayment.status,
      });

      return {
        success: true,
        status: 'COMPLETED',
        ticket_id: finalized.ticket_id,
        order_id: paymentOrder.id,
      };
    }

    if (failedPayment) {
      await releaseReservation({
        orderRef: paymentOrder.ref,
        reason: 'gateway_failed',
        nextStatus: PAYMENT_STATUS.FAILED,
        paymentId: failedPayment.id,
        paymentStatus: failedPayment.status,
      });
      return { success: false, status: 'FAILED', order_id: paymentOrder.id, reason: 'gateway_failed' };
    }
  } catch (error) {
    logger.warn('[cancelPaymentOrder] Gateway lookup failed', {
      order_id: paymentOrder.id,
      uid: request.auth.uid,
      message: error.message,
    });
  }

  await releaseReservation({ orderRef: paymentOrder.ref, reason: 'user_cancelled' });
  return { success: false, status: 'FAILED', order_id: paymentOrder.id, reason: 'user_cancelled' };
});

const getPaymentStatus = onCall({ region: 'asia-south1', timeoutSeconds: 30, secrets: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'] }, async (request) => {
  requireAuth(request);
  const sanitized = sanitizeObject(request.data);
  const result = PaymentStatusSchema.safeParse(sanitized);
  if (!result.success) throw new HttpsError('invalid-argument', firstValidationMessage(result.error));
  const { reference_id } = result.data;
  const uid = request.auth.uid;
  const paymentOrder = await findPaymentOrderForUser(reference_id, uid);
  if (!paymentOrder) return { status: 'PENDING' };

  const orderData = paymentOrder.data;
  if (orderData.status === PAYMENT_STATUS.FULFILLED && orderData.ticket_id) {
    return {
      status: 'COMPLETED',
      ticket_id: orderData.ticket_id,
      order_id: paymentOrder.id,
      payment_id: orderData.razorpay_payment_id || null,
    };
  }

  if (
    orderData.status === PAYMENT_STATUS.FAILED ||
    orderData.status === PAYMENT_STATUS.REFUNDED ||
    orderData.status === PAYMENT_STATUS.INVENTORY_CONFLICT
  ) {
    return {
      status: 'FAILED',
      order_id: paymentOrder.id,
      reason: orderData.failure_reason || orderData.refund_reason || orderData.status,
    };
  }

  try {
    const gatewayPayments = await fetchRazorpayJson(`/orders/${paymentOrder.id}/payments`);
    const items = Array.isArray(gatewayPayments.items) ? gatewayPayments.items : [];
    let capturedPayment = items.find((item) => item.status === 'captured');
    const authorizedPayment = items.find((item) => item.status === 'authorized');
    const failedPayment = items.find((item) => item.status === 'failed');

    if (!capturedPayment && authorizedPayment) {
      try {
        capturedPayment = await captureRazorpayPayment({
          paymentId: authorizedPayment.id,
          amount: orderData.expected_amount_paise,
          currency: orderData.currency || 'INR',
        });
      } catch (captureError) {
        logger.warn('[getPaymentStatus] Capture attempt failed', {
          uid,
          order_id: paymentOrder.id,
          payment_id: authorizedPayment.id,
          message: captureError.message,
        });
      }
    }

    if (capturedPayment) {
      if (
        capturedPayment.amount !== orderData.expected_amount_paise ||
        capturedPayment.currency !== (orderData.currency || 'INR')
      ) {
        await markPaymentOrderFailure(paymentOrder.ref, {
          status: PAYMENT_STATUS.FAILED,
          razorpay_payment_id: capturedPayment.id,
          payment_status: capturedPayment.status,
          mismatch_reason: 'amount_or_currency_mismatch',
        });
        return {
          status: 'FAILED',
          order_id: paymentOrder.id,
          reason: 'amount_or_currency_mismatch',
        };
      }

      const finalized = await finalizePaymentOrder({
        orderRef: paymentOrder.ref,
        orderId: paymentOrder.id,
        paymentId: capturedPayment.id,
        verifiedSource: 'status_poll',
        gatewayPaymentStatus: capturedPayment.status,
      });

      return {
        status: 'COMPLETED',
        ticket_id: finalized.ticket_id,
        order_id: paymentOrder.id,
        payment_id: capturedPayment.id,
      };
    }

    if (failedPayment) {
      await releaseReservation({
        orderRef: paymentOrder.ref,
        reason: 'gateway_failed',
        nextStatus: PAYMENT_STATUS.FAILED,
        paymentId: failedPayment.id,
        paymentStatus: failedPayment.status,
      });
      return { status: 'FAILED', order_id: paymentOrder.id, reason: 'gateway_failed' };
    }
  } catch (error) {
    logger.warn('[getPaymentStatus] Gateway poll failed', {
      uid,
      reference_id,
      message: error.message,
    });
  }

  const expiresAt = toDate(orderData.reservation_expires_at);
  if (
    orderData.reservation_status === RESERVATION_STATUS.HELD &&
    expiresAt &&
    expiresAt.getTime() <= Date.now()
  ) {
    await releaseReservation({
      orderRef: paymentOrder.ref,
      reason: 'reservation_expired',
      nextStatus: PAYMENT_STATUS.FAILED,
      paymentStatus: orderData.payment_status || 'expired',
    });
    return {
      status: 'FAILED',
      order_id: paymentOrder.id,
      reason: 'reservation_expired',
    };
  }

  return {
    status: 'PENDING',
    order_id: paymentOrder.id,
    payment_id: orderData.razorpay_payment_id || null,
  };
});

module.exports = {
  computePricing,
  finalizePaymentOrder,
  releaseReservation,
  captureRazorpayPayment,
  markPaymentOrderFailure,
  initiatePayment,
  verifyPayment,
  cancelPaymentOrder,
  getPaymentStatus,
};
