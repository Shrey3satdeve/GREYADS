import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import functions from '@react-native-firebase/functions';
import appCheck from '@react-native-firebase/app-check';

// Initialize App Check
// Use Play Integrity provider for Android production
const rnAppCheck = appCheck();
rnAppCheck.activate('playIntegrity', true); // true = allow debug token in development

const db = firestore();
const authInstance = auth();
const storageInstance = storage();
const functionsInstance = functions().app.functions('asia-south1');

export { authInstance as auth, db, storageInstance as storage, functionsInstance as functions, rnAppCheck as appCheck };
