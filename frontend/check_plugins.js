try {
  console.log('Testing @react-native-google-signin/google-signin/app.plugin.js...');
  require('@react-native-google-signin/google-signin/app.plugin.js');
  console.log('Google Sign-in: OK');
} catch (e) {
  console.error('Google Sign-in: FAILED');
  console.error(e);
}

try {
  console.log('\nTesting @react-native-firebase/messaging/app.plugin.js...');
  require('@react-native-firebase/messaging/app.plugin.js');
  console.log('Firebase Messaging: OK');
} catch (e) {
  console.error('Firebase Messaging: FAILED');
  console.error(e);
}

const otherPlugins = [
  'expo-router',
  'expo-splash-screen',
  'expo-build-properties',
  'expo-web-browser'
];

otherPlugins.forEach(plugin => {
  try {
    console.log(`\nTesting ${plugin}...`);
    require(plugin + '/app.plugin.js');
    console.log(`${plugin}: OK`);
  } catch (e) {
    // Some plugins might not have app.plugin.js at root or follow different patterns
    console.log(`${plugin}: Skipped or failed (checks pattern): ${e.message}`);
  }
});
