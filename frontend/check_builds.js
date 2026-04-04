
const { resolve } = require('path');
const { existsSync } = require('fs');

const packages = ['expo', 'expo-modules-core', 'expo-modules-autolinking'];
console.log('--- Checking for missing JS in build folders ---');

packages.forEach(pkg => {
  const buildDir = resolve('node_modules', pkg, 'build');
  const srcDir = resolve('node_modules', pkg, 'src');
  
  if (existsSync(buildDir)) {
    console.log(`Package: ${pkg}`);
    console.log(`  Build dir exists: YES`);
    // Check if any .js files exist in build
    const hasJs = existsSync(resolve(buildDir, 'index.js')) || existsSync(resolve(buildDir, 'Expo.js'));
    console.log(`  Has index.js/Expo.js in build: ${hasJs ? 'YES' : 'NO'}`);
  } else {
    console.log(`Package: ${pkg}`);
    console.log(`  Build dir exists: NO`);
  }
});
