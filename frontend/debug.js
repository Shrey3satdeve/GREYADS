/**
 * Native Module Diagnostic Script
 * Run this with `node debug.js` or via a custom package.json script
 * to verify if your native modules are correctly available to the JS environment.
 */

const checkModule = (name) => {
    try {
        const path = require.resolve(name, { paths: [__dirname] });
        console.log(`✅ [${name}] is present in node_modules at: ${path}`);
    } catch (e) {
        if (e.code === 'MODULE_NOT_FOUND') {
            console.error(`❌ [${name}] is MISSING from node_modules.`);
        } else {
            console.error(`❌ [${name}] resolution error: ${e.message}`);
        }
    }
};

console.log('--- Starting Native Module Diagnostics ---\n');

checkModule('@react-native-firebase/app');
checkModule('@react-native-firebase/auth');
checkModule('@react-native-firebase/firestore');
checkModule('@react-native-firebase/messaging');
checkModule('react-native-reanimated');
checkModule('react-native-razorpay');
checkModule('expo-sharing');
checkModule('expo-camera');

console.log('\n--- Diagnostics Complete ---');
console.log('Note: Some modules may require a native environment (Simulator/Device) to function fully.');
