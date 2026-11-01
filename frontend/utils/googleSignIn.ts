import Constants from 'expo-constants';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

type GoogleSignInResult =
  | { cancelled: true; idToken: null }
  | { cancelled: false; idToken: string };

function readIdToken(response: any): string | null {
  const token = response?.data?.idToken || response?.idToken || response?.user?.idToken;
  return typeof token === 'string' && token.trim() ? token : null;
}

export function getGoogleWebClientId(): string {
  const envClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const extraClientId = Constants.expoConfig?.extra?.googleClientId || Constants.manifest?.extra?.googleClientId;
  return String(envClientId || extraClientId || '').trim();
}

export function configureGoogleSignin() {
  const webClientId = getGoogleWebClientId();

  if (!webClientId) {
    throw new Error('Google Sign-In is not configured for this build.');
  }

  GoogleSignin.configure({
    webClientId,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
}

export async function getGoogleIdToken(): Promise<GoogleSignInResult> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  let response: any;

  if (GoogleSignin.hasPreviousSignIn()) {
    response = await GoogleSignin.signInSilently();
    if (response?.type === 'noSavedCredentialFound') {
      response = await GoogleSignin.signIn();
    }
  } else {
    response = await GoogleSignin.signIn();
  }

  if (response?.type === 'cancelled') {
    return { cancelled: true, idToken: null };
  }

  const inlineToken = readIdToken(response);
  if (inlineToken) {
    return { cancelled: false, idToken: inlineToken };
  }

  const currentUser = GoogleSignin.getCurrentUser();
  const currentUserToken = readIdToken(currentUser);
  if (currentUserToken) {
    return { cancelled: false, idToken: currentUserToken };
  }

  if (currentUser || GoogleSignin.hasPreviousSignIn()) {
    const tokens = await GoogleSignin.getTokens();
    if (tokens?.idToken) {
      return { cancelled: false, idToken: tokens.idToken };
    }
  }

  throw new Error('Google sign-in did not finish correctly. Please choose your Google account again and retry.');
}

export function getGoogleSignInErrorMessage(error: any) {
  const code = String(error?.code || '');
  const message = String(error?.message || 'Could not sign in with Google.');
  const normalizedMessage = message.toLowerCase();

  if (code.includes('SIGN_IN_CANCELLED')) {
    return null;
  }
  if (code.includes('PLAY_SERVICES_NOT_AVAILABLE')) {
    return 'Google Play Services is required for Continue with Google on this device.';
  }
  if (code.includes('IN_PROGRESS')) {
    return 'Google sign-in is already in progress. Please wait a moment and try again.';
  }
  if (
    normalizedMessage.includes('gettokens requires a user to be signed in') ||
    normalizedMessage.includes('sign in required')
  ) {
    return 'Google account selection was interrupted. Please choose your Google account again and retry.';
  }

  return message;
}
