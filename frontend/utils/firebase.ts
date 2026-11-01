import appModule from '@react-native-firebase/app';
import authModule from '@react-native-firebase/auth';
import firestoreModule from '@react-native-firebase/firestore';
import functionsModule from '@react-native-firebase/functions';
import storageModule from '@react-native-firebase/storage';
import appCheckModule from '@react-native-firebase/app-check';
import { Platform } from 'react-native';

type ProtectedFirebaseOptions = {
  allowAppCheckFailure?: boolean;
};

const appCheckProvider = String(process.env.EXPO_PUBLIC_FIREBASE_APP_CHECK_ANDROID_PROVIDER || '').trim().toLowerCase();
const appCheckDebugToken = String(process.env.EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN || '').trim();

let didAttemptAppCheckActivation = false;

export const firebase = appModule;
export const auth = authModule();
export const db = firestoreModule();
export const storage = storageModule();
export const functions = functionsModule();
export const functionsAsia = appModule.app().functions('asia-south1');
export const appCheck = appCheckModule();

export async function ensureProtectedFirebaseServicesReady(
  options: ProtectedFirebaseOptions = {},
) {
  if (Platform.OS !== 'android') {
    return;
  }

  if (didAttemptAppCheckActivation) {
    return;
  }

  didAttemptAppCheckActivation = true;

  try {
    if (appCheckProvider === 'debug') {
      // Debug App Check is only used for local QA builds.
      console.log('[firebase] Android App Check debug mode enabled.', appCheckDebugToken ? 'Debug token present.' : 'No explicit debug token provided.');
      await appCheck.activate('debug', true);
      return;
    }

    if (appCheckProvider === 'playintegrity' || appCheckProvider === 'play_integrity') {
      await appCheck.activate('playIntegrity', true);
      return;
    }
  } catch (error) {
    if (!options.allowAppCheckFailure) {
      throw error;
    }

    console.warn('[firebase] App Check activation skipped:', error);
  }
}
