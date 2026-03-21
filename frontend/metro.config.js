// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);

// Use a stable on-disk store (shared across web/android)
const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, '.metro-cache');
config.cacheStores = [
  new FileStore({ root: path.join(root, 'cache') }),
];


// Exclude unnecessary directories from file watching
config.resolver.blockList = [
  /.*\/(__tests__|android|ios|build|dist|\.git)(\/.*)?$/
];

// Reduce the number of workers to decrease resource usage
config.maxWorkers = 2;

// Support .mjs for libraries that publish ES module entrypoints.
if (!config.resolver.sourceExts.includes('mjs')) {
  config.resolver.sourceExts.push('mjs');
}

// Enable package exports for modern libraries that rely on them.
config.resolver.unstable_enablePackageExports = true;

// Ensure we prioritize browser over main for web bundles, but avoid 'module' 
// which breaks CommonJS CJS-loading (e.g. punycode in whatwg-url)
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// module.exports = config;
module.exports = config;
