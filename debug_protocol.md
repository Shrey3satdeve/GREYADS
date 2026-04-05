# Debug Protocol Configuration

## Environment Diagnostics
- React Native Version: 0.81.5
- Expo Version: 54.0.33
- Platform: Android (API 34 focus)
- Build System: Gradle 8.2.1

## Critical Native Modules Checked
- [ ] @react-native-firebase/app
- [ ] @react-native-firebase/auth
- [ ] @react-native-firebase/firestore
- [ ] @react-native-firebase/messaging
- [ ] react-native-reanimated (Fixed IDE linting)
- [ ] react-native-razorpay
- [ ] expo-sharing

## Recent Fixes Applied
- VS Code `settings.json` schema validation for resource filters.
- Native module linting suppression for `node_modules` via `plaintext` association.

## Debug Commands
- Run build with logging: `npx expo run:android > build_debug.log 2>&1`
- Check native module linking: `npx expo config --type public`
- Clear all caches: `watchman watch-del-all && rm -rf node_modules && yarn install && npx expo start --clear`
