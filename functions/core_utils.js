const { HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { db, PAYMENT_ORDERS_COLLECTION, RESERVATION_WINDOW_MINUTES } = require('./firebase_init');

function requireAuth(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to perform this action.');
  }
}

function firstValidationMessage(error) {
  return error?.issues?.[0]?.message || error?.errors?.[0]?.message || 'Invalid request data.';
}

function getPaymentOrderRef(orderId) {
  return db.collection(PAYMENT_ORDERS_COLLECTION).doc(orderId);
}

function getReservationExpiryDate() {
  return new Date(Date.now() + RESERVATION_WINDOW_MINUTES * 60 * 1000);
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeQuantity(quantity) {
  const parsed = Number.parseInt(String(quantity), 10);
  return Number.isFinite(parsed) ? parsed : 1;
}

function sanitizeGuestsList(guests, quantity, fallbackName = 'Guest') {
  const qty = Math.max(1, normalizeQuantity(quantity));
  const sanitizedGuests = (Array.isArray(guests) ? guests : [])
    .slice(0, qty)
    .map((guest) => ({
      name: String(guest?.name || fallbackName).trim().substring(0, 100),
      age: String(guest?.age || 'N/A').trim().substring(0, 3),
    }));

  if (sanitizedGuests.length > 0) {
    return sanitizedGuests;
  }

  return [
    {
      name: String(fallbackName || 'Guest').trim().substring(0, 100) || 'Guest',
      age: 'N/A',
    },
  ];
}

function loadRazorpaySecrets() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new HttpsError('failed-precondition', 'Razorpay secrets not configured.');
  }
  return { keyId, keySecret };
}

function loadRazorpayWebhookSecret() {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return null;
  return secret;
}

module.exports = {
  requireAuth,
  firstValidationMessage,
  getPaymentOrderRef,
  getReservationExpiryDate,
  toDate,
  normalizeQuantity,
  sanitizeGuestsList,
  loadRazorpaySecrets,
  loadRazorpayWebhookSecret,
};
