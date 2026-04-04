require('./polyfill');
const messaging = require('@react-native-firebase/messaging').default;

// Add background messaging handler early in the app lifecycle
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Message handled in the background!', remoteMessage);
});

require('expo-router/entry');

