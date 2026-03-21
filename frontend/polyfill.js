// Remove any incomplete native TextEncoder/TextDecoder (e.g. Hermes partial implementation)
// so that fast-text-encoding installs its full, working versions instead of skipping.
delete global.TextDecoder;
delete global.TextEncoder;

// Load the full fast-text-encoding polyfill implementation
require('fast-text-encoding');

// Require the URL polyfill AFTER TextEncoder/TextDecoder are fully polyfilled
require('react-native-url-polyfill/auto');
