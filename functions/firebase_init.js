const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const db = getFirestore();
const auth = getAuth();
const messaging = getMessaging();

const PAYMENT_ORDERS_COLLECTION = 'payment_orders';
const CONVENIENCE_FEE_RATE = 0.05;
const RESERVATION_WINDOW_MINUTES = 15;

const PAYMENT_STATUS = {
  CREATED: 'created',
  PENDING_CAPTURE: 'pending_capture',
  FULFILLED: 'fulfilled',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  INVENTORY_CONFLICT: 'inventory_conflict',
};

const RESERVATION_STATUS = {
  HELD: 'held',
  RELEASED: 'released',
  CONSUMED: 'consumed',
  LEGACY: 'legacy',
};

module.exports = {
  db,
  auth,
  messaging,
  FieldValue,
  PAYMENT_ORDERS_COLLECTION,
  CONVENIENCE_FEE_RATE,
  RESERVATION_WINDOW_MINUTES,
  PAYMENT_STATUS,
  RESERVATION_STATUS,
};
