const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const logger = require('firebase-functions/logger');
const { db, messaging, FieldValue } = require('./firebase_init');

/**
 * onNotificationCreated
 * Triggers push notifications when a new document is added to the 'notifications' collection.
 */
const onNotificationCreated = onDocumentCreated(
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
      const response = await messaging.sendEachForMulticast(payload);
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

module.exports = {
  onNotificationCreated,
};
