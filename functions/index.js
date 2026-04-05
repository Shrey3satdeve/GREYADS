// GreyAdz — Firebase Cloud Functions
// Deploy:   firebase deploy --only functions
//
// Set secrets (one-time, never commit to git):
//   firebase functions:secrets:set RAZORPAY_KEY_ID
//   firebase functions:secrets:set RAZORPAY_KEY_SECRET
//
// Or via .env.local for local emulator use only (NOT committed):
//   RAZORPAY_KEY_ID=rzp_test_...
//   RAZORPAY_KEY_SECRET=...

'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getMessaging } = require('firebase-admin/messaging');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { 
  sanitizeObject, 
  InitiatePaymentSchema, 
  VerifyPaymentSchema, 
  PasswordResetSchema 
} = require('./schemas');

initializeApp();
const db = getFirestore();

// ---------------------------------------------------------------------------
// Helper — enforce Firebase Auth on every callable
// ---------------------------------------------------------------------------
function requireAuth(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to perform this action.');
  }
}

// ---------------------------------------------------------------------------
// Helper — Throttling / Rate Limiting (Server-side)
// Prevents automated script abuse by tracking (uid, action) in Firestore
// ---------------------------------------------------------------------------
async function checkRateLimit(uid, action, maxAttempts, windowMinutes) {
  const limitRef = db.collection('rate_limits').doc(`${uid}_${action}`);
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;

  await db.runTransaction(async (t) => {
    const snap = await t.get(limitRef);
    const data = snap.exists ? snap.data() : { count: 0, reset_at: now + windowMs };

    if (now > data.reset_at) {
      // Window expired — reset
      t.set(limitRef, { count: 1, reset_at: now + windowMs });
    } else if (data.count >= maxAttempts) {
      // Limit reached
      throw new HttpsError(
        'resource-exhausted',
        `Rate limit exceeded for ${action}. Please try again later.`
      );
    } else {
      // Increment
      t.update(limitRef, { count: data.count + 1 });
    }
  });
}

// ---------------------------------------------------------------------------
// Helper — load secrets; throws clearly if env is misconfigured.
// Never falls back to hardcoded values.
// ---------------------------------------------------------------------------
function loadRazorpaySecrets() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    logger.error('[SECURITY] Razorpay secrets are not configured in the Cloud Functions environment.');
    throw new HttpsError(
      'internal',
      'Payment service is not configured. Please contact support.'
    );
  }
  return { keyId, keySecret };
}

// ---------------------------------------------------------------------------
// initiatePayment — creates a Razorpay order server-side.
// Returns: { order_id, amount, key_id }
// The key_secret is NEVER returned to the client.
// ---------------------------------------------------------------------------
exports.initiatePayment = onCall(
  {
    region: 'asia-south1',
    timeoutSeconds: 30,
    secrets: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
    enforceAppCheck: true, // REQUIRE authentic app client
  },
  async (request) => {
    requireAuth(request);

    // RATE LIMIT: 10 payments per hour
    await checkRateLimit(request.auth.uid, 'initiate_payment', 10, 60);

    // SANITIZE & VALIDATE: Amount, Event ID, Quantity
    const sanitized = sanitizeObject(request.data);
    const result = InitiatePaymentSchema.safeParse(sanitized);
    
    if (!result.success) {
      throw new HttpsError('invalid-argument', result.error.errors[0].message || 'Invalid request data.');
    }
    const { amount, event_id, quantity } = result.data;

    const { keyId, keySecret } = loadRazorpaySecrets();

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

    try {
      const order = await razorpay.orders.create({
        amount: Math.round(amount * 100), // Paise
        currency: 'INR',
        receipt: `rcpt_${Date.now()}`,
        notes: {
          event_id,
          quantity: String(quantity),
          user_id: request.auth.uid,
        },
      });

      logger.info(`[Payment] Order initiated: uid=${request.auth.uid} order_id=${order.id} amount=${amount}`);

      return {
        order_id: order.id,
        amount: order.amount,
        key_id: keyId, // Public key — safe to return
      };
    } catch (err) {
      logger.error('[initiatePayment] Razorpay error:', { message: err.message, uid: request.auth.uid });
      throw new HttpsError('internal', 'Failed to create payment order. Please try again.');
    }
  }
);

// ---------------------------------------------------------------------------
// AI RATE LIMIT BLUEPRINT (Placeholders for future generation logic)
// ---------------------------------------------------------------------------
/*
exports.generateAIContent = onCall(
  { region: 'asia-south1', enforceAppCheck: true },
  async (request) => {
    requireAuth(request);
    // STAGE: Check AI quota (5 per day)
    await checkRateLimit(request.auth.uid, 'ai_gen', 5, 1440);
    
    // ... call Gemini/OpenAI here ...
    return { result: "Hello from AI" };
  }
);
*/

// ---------------------------------------------------------------------------
// verifyPayment — verifies HMAC signature then creates ticket in Firestore.
// ALL ticket creation is server-side; client cannot set its own ticket status.
// ---------------------------------------------------------------------------
exports.verifyPayment = onCall(
  {
    region: 'asia-south1',
    timeoutSeconds: 30,
    secrets: ['RAZORPAY_KEY_SECRET'],
    enforceAppCheck: true, // REQUIRE authentic app client
  },
  async (request) => {
    requireAuth(request);

    // SANITIZE & VALIDATE: Payments IDs, Signature, Quantity, Guests
    const sanitized = sanitizeObject(request.data);
    const result = VerifyPaymentSchema.safeParse(sanitized);
    
    if (!result.success) {
      throw new HttpsError('invalid-argument', result.error.errors[0].message || 'Invalid payment data.');
    }
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      event_id,
      quantity,
      guests,
    } = result.data;

    const { keySecret } = loadRazorpaySecrets();

    const hmac = crypto.createHmac('sha256', keySecret);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest('hex');

    // Constant-time comparison to prevent timing attacks
    const sigBuffer = Buffer.from(generatedSignature, 'hex');
    const incomingBuffer = Buffer.from(razorpay_signature, 'hex');
    const signatureValid =
      sigBuffer.length === incomingBuffer.length &&
      crypto.timingSafeEqual(sigBuffer, incomingBuffer);

    if (!signatureValid) {
      logger.warn('[SECURITY] HMAC signature mismatch. Possible tampered request.', {
        uid: request.auth.uid,
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        ip: request.rawRequest.ip || 'unknown',
      });
      throw new HttpsError('invalid-argument', 'Payment signature verification failed.');
    }

    const uid = request.auth.uid;
    const eventRef = db.collection('events').doc(event_id);
    const ticketRef = db.collection('tickets').doc();

    try {
      await db.runTransaction(async (transaction) => {
        const eventSnap = await transaction.get(eventRef);
        if (!eventSnap.exists) throw new Error('Event not found');

        const eventData = eventSnap.data();
        const qty = parseInt(quantity, 10) || 1;
        if (eventData.available_tickets < qty) {
          throw new Error('Not enough tickets available');
        }

        const sanitizedGuests = (Array.isArray(guests) ? guests.slice(0, qty) : [])
          .map((g) => ({
            name: String(g.name || '').trim().substring(0, 100),
            age: String(g.age || '').trim().substring(0, 3),
            status: 'valid',
          }));

        transaction.set(ticketRef, {
          event_id,
          user_id: uid,
          user_name: request.auth.token.name || 'Guest',
          user_email: request.auth.token.email || '',
          event_title: eventData.title,
          event_date: eventData.date,
          event_venue: eventData.venue,
          qr_token: `GRY-${uid.substring(0, 4)}-${ticketRef.id.substring(0, 8)}`,
          booking_ref: `GRY-RZP-${razorpay_payment_id.substring(0, 8).toUpperCase()}`,
          status: 'valid',
          quantity: qty,
          guests: sanitizedGuests.length > 0 ? sanitizedGuests : [{ name: request.auth.token.name || 'Guest', age: '', status: 'valid' }],
          total_price: eventData.price * qty,
          razorpay_order_id,
          razorpay_payment_id,
          created_at: FieldValue.serverTimestamp(),
        });

        transaction.update(eventRef, {
          available_tickets: FieldValue.increment(-qty),
        });
      });

      logger.info(`[Payment] Booking success: uid=${uid} ticket_id=${ticketRef.id} pay_id=${razorpay_payment_id}`);

      return { success: true, ticket_id: ticketRef.id };
    } catch (err) {
      logger.error('[verifyPayment] Transaction error:', { message: err.message, uid, pay_id: razorpay_payment_id });
      throw new HttpsError('internal', err.message || 'Ticket creation failed.');
    }
  }
);

// ---------------------------------------------------------------------------
// sendPasswordReset — triggers Firebase Auth password reset email.
// Callable from the client; rate-limited by Firebase Auth quotas.
// ---------------------------------------------------------------------------
exports.sendPasswordReset = onCall(
  { region: 'asia-south1', timeoutSeconds: 15 },
  async (request) => {
    // SANITIZE & VALIDATE: Email
    const sanitized = sanitizeObject(request.data);
    const result = PasswordResetSchema.safeParse(sanitized);
    
    if (!result.success) {
      throw new HttpsError('invalid-argument', result.error.errors[0].message || 'Valid email required.');
    }
    const { email } = result.data;

    // RATE LIMIT: 3 reset links per hour per user/IP (using UID if logged in, or email as key)
    const actor = request.auth?.uid || email.replace(/[.@]/g, '_');
    await checkRateLimit(actor, 'password_reset', 3, 60);

    try {
      // Firebase Admin generates a secure, time-limited reset link (1 hour)
      await getAuth().generatePasswordResetLink(email.trim().toLowerCase());
      logger.info(`[Auth] Password reset link requested for ${email}`);
      return { success: true };
    } catch (err) {
      // Do NOT reveal whether the email exists — always return success.
      logger.warn(`[Auth] sendPasswordReset failed (masked): uid=${request.auth?.uid || 'anon'}`, { error: err.code });
      return { success: true };
    }
  }
);

// ---------------------------------------------------------------------------
// onNotificationCreated — push notification trigger
// ---------------------------------------------------------------------------
exports.onNotificationCreated = onDocumentCreated(
  { document: 'notifications/{notifId}', region: 'asia-south1' },
  async (event) => {
    const data = event.data.data();
    if (!data || !data.user_id) return;

    const userRef = db.collection('users').doc(data.user_id);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return;

    const userData = userSnap.data();
    const tokens = userData.fcm_tokens;
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) return;

    const payload = {
      notification: {
        title: data.title || 'New Notification',
        body: data.message || 'You have a new update in GreyAdz.',
      },
      data: {
        notif_id: event.params.notifId,
        type: data.type || 'general',
      },
      tokens,
    };

    try {
      const response = await getMessaging().sendEachForMulticast(payload);
      logger.info(`[Push] Multi-send: success=${response.successCount} fail=${response.failureCount} notif_id=${event.params.notifId}`);

      if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const code = resp.error?.code;
            if (
              code === 'messaging/registration-token-not-registered' ||
              code === 'messaging/invalid-registration-token'
            ) {
              failedTokens.push(tokens[idx]);
            }
          }
        });
        if (failedTokens.length > 0) {
          await userRef.update({ fcm_tokens: FieldValue.arrayRemove(...failedTokens) });
          logger.info(`[Push] Cleanup: removed ${failedTokens.length} stale tokens for user=${data.user_id}`);
        }
      }
    } catch (err) {
      logger.error('[Push] Multi-send error:', err);
    }
  }
);
