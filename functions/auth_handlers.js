const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { auth } = require('./firebase_init');
const { 
  sanitizeObject, 
  PasswordResetSchema 
} = require('./schemas');
const { 
  requireAuth, 
  firstValidationMessage 
} = require('./core_utils');

/**
 * checkRateLimit
 * Simple Firestore-based rate limiter
 */
async function checkRateLimit(uid, action, maxAttempts, windowMinutes) {
  const { db, FieldValue } = require('./firebase_init');
  const now = Date.now();
  const windowStart = new Date(now - windowMinutes * 60 * 1000);
  
  const limitRef = db.collection('rate_limits').doc(`${uid}_${action}`);
  const snap = await limitRef.get();
  
  if (snap.exists) {
    const data = snap.data();
    const attempts = data.attempts.filter(ts => ts.toDate() > windowStart);
    
    if (attempts.length >= maxAttempts) {
      throw new HttpsError('resource-exhausted', `Too many attempts for ${action}. Please try again later.`);
    }
    
    await limitRef.update({
      attempts: [...attempts, FieldValue.serverTimestamp()]
    });
  } else {
    await limitRef.set({
      attempts: [FieldValue.serverTimestamp()]
    });
  }
}

/**
 * sendPasswordReset
 */
const sendPasswordReset = onCall(
  { region: 'asia-south1', timeoutSeconds: 15 },
  async (request) => {
    const sanitized = sanitizeObject(request.data);
    const result = PasswordResetSchema.safeParse(sanitized);

    if (!result.success) {
      throw new HttpsError('invalid-argument', firstValidationMessage(result.error));
    }
    const { email } = result.data;

    const actor = request.auth?.uid || email.replace(/[.@]/g, '_');
    await checkRateLimit(actor, 'password_reset', 3, 60);

    try {
      await auth.generatePasswordResetLink(email.trim().toLowerCase());
      logger.info(`[Auth] Password reset link requested for ${email}`);
      return { success: true };
    } catch (err) {
      logger.warn(`[Auth] sendPasswordReset failed (masked): uid=${request.auth?.uid || 'anon'}`, { error: err.code });
      return { success: true };
    }
  }
);

module.exports = {
  checkRateLimit,
  sendPasswordReset,
};
