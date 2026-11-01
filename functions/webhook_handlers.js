const { onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const crypto = require('crypto');
const { 
  db, 
  PAYMENT_ORDERS_COLLECTION, 
  PAYMENT_STATUS, 
  FieldValue 
} = require('./firebase_init');
const { 
  loadRazorpayWebhookSecret, 
  getPaymentOrderRef 
} = require('./core_utils');

/**
 * razorpayWebhook
 * gateway recovery path for orphaned payments
 */
const razorpayWebhook = onRequest(
  {
    region: 'asia-south1',
    timeoutSeconds: 30,
    secrets: ['RAZORPAY_WEBHOOK_SECRET'],
  },
  async (request, response) => {
    // We import these dynamically to avoid circular dependencies if any
    const { 
      finalizePaymentOrder, 
      releaseReservation, 
      captureRazorpayPayment, 
      markPaymentOrderFailure 
    } = require('./payment_handlers');

    if (request.method !== 'POST') {
      response.status(405).send('Method Not Allowed');
      return;
    }

    const webhookSecret = loadRazorpayWebhookSecret();
    if (!webhookSecret) {
      logger.error('[razorpayWebhook] Missing RAZORPAY_WEBHOOK_SECRET');
      response.status(503).send('Webhook not configured');
      return;
    }

    const signature = request.get('x-razorpay-signature') || '';
    if (!signature) {
      response.status(400).send('Missing signature');
      return;
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(request.rawBody || Buffer.from(''))
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const incomingBuffer = Buffer.from(signature, 'hex');
    const signatureValid =
      expectedBuffer.length === incomingBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, incomingBuffer);

    if (!signatureValid) {
      logger.warn('[razorpayWebhook] Invalid signature');
      response.status(401).send('Invalid signature');
      return;
    }

    const eventName = request.body?.event || '';
    let paymentEntity = request.body?.payload?.payment?.entity;
    const refundEntity = request.body?.payload?.refund?.entity;
    let orderId = paymentEntity?.order_id || refundEntity?.notes?.razorpay_order_id || '';

    if (!orderId && refundEntity?.payment_id) {
      const orderByPayment = await db.collection(PAYMENT_ORDERS_COLLECTION)
        .where('razorpay_payment_id', '==', refundEntity.payment_id)
        .limit(1)
        .get();
      if (!orderByPayment.empty) {
        orderId = orderByPayment.docs[0].id;
      }
    }

    if (!orderId) {
      response.status(200).json({ received: true, ignored: true });
      return;
    }

    const orderRef = getPaymentOrderRef(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      logger.warn('[razorpayWebhook] Unknown order_id', { order_id: orderId, event: eventName });
      response.status(200).json({ received: true, ignored: true });
      return;
    }

    try {
      if ((eventName === 'payment.captured' || eventName === 'payment.authorized') && paymentEntity?.id) {
        let gatewayPayment = paymentEntity;
        if (gatewayPayment.status === 'authorized') {
          try {
            gatewayPayment = await captureRazorpayPayment({
              paymentId: gatewayPayment.id,
              amount: orderSnap.data().expected_amount_paise,
              currency: orderSnap.data().currency || 'INR',
            });
          } catch (captureError) {
            logger.warn('[razorpayWebhook] Capture attempt failed', {
              order_id: orderId,
              payment_id: gatewayPayment.id,
              message: captureError.message,
            });
            response.status(200).json({ received: true, handled: true, capture_pending: true });
            return;
          }
        }

        paymentEntity = gatewayPayment;
        if (
          paymentEntity.amount !== orderSnap.data().expected_amount_paise ||
          paymentEntity.currency !== (orderSnap.data().currency || 'INR')
        ) {
          await markPaymentOrderFailure(orderRef, {
            status: PAYMENT_STATUS.FAILED,
            razorpay_payment_id: paymentEntity.id,
            payment_status: paymentEntity.status || 'captured',
            mismatch_reason: 'webhook_amount_or_currency_mismatch',
          });
          response.status(200).json({ received: true, handled: true });
          return;
        }

        await finalizePaymentOrder({
          orderRef,
          orderId,
          paymentId: paymentEntity.id,
          verifiedSource: 'webhook',
          gatewayPaymentStatus: paymentEntity.status || 'captured',
        });
      } else if (eventName === 'payment.failed' && paymentEntity?.id) {
        await releaseReservation({
          orderRef,
          reason: 'gateway_failed',
          nextStatus: PAYMENT_STATUS.FAILED,
          paymentId: paymentEntity.id,
          paymentStatus: paymentEntity.status || 'failed',
        });
      } else if (eventName.startsWith('refund.') && refundEntity) {
        const orderData = orderSnap.data();
        await markPaymentOrderFailure(orderRef, {
          status: PAYMENT_STATUS.REFUNDED,
          refund_id: refundEntity.id || '',
          refund_status: refundEntity.status || 'processed',
        });
        if (orderData.ticket_id) {
          await db.collection('tickets').doc(orderData.ticket_id).set({
            status: 'refunded',
            refund_id: refundEntity.id || '',
            updated_at: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
      }
    } catch (error) {
      logger.error('[razorpayWebhook] Processing failure', {
        order_id: orderId,
        event: eventName,
        message: error.message,
      });
      response.status(500).send('Webhook processing failed');
      return;
    }

    response.status(200).json({ received: true, handled: true });
  }
);

module.exports = {
  razorpayWebhook,
};
