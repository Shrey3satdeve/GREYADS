/**
 * GreyAdz — Firebase Cloud Functions
 * Main Entry Point
 */

'use strict';

// 1. Authentication Handlers
const { sendPasswordReset } = require('./auth_handlers');

// 2. Payment Handlers
const { 
  initiatePayment, 
  verifyPayment, 
  cancelPaymentOrder, 
  getPaymentStatus 
} = require('./payment_handlers');

// 3. Webhook Handlers
const { razorpayWebhook } = require('./webhook_handlers');

// 4. Firestore Triggers
const { onNotificationCreated } = require('./notification_handlers');

// Exports
exports.sendPasswordReset = sendPasswordReset;
exports.initiatePayment = initiatePayment;
exports.verifyPayment = verifyPayment;
exports.cancelPaymentOrder = cancelPaymentOrder;
exports.getPaymentStatus = getPaymentStatus;
exports.razorpayWebhook = razorpayWebhook;
exports.onNotificationCreated = onNotificationCreated;
