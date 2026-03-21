const sharp = require('sharp');
const fs = require('fs');

async function fixIcon() {
  const iconPath = './assets/images/greyadz-logo-v2.png';
  
  // Create an adaptive icon (padded for Android)
  // Android adaptive icons scale the foreground image. It needs a lot of padding.
  await sharp(iconPath)
    .resize(600, 600, { fit: 'contain', background: { r: 0, g: 0, b:0, alpha: 0 } }) // Shrink it so it's surrounded by padding
    .extend({
      top: 212, bottom: 212, left: 212, right: 212,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }) // Back to 1024x1024
    .toFile('./assets/images/adaptive-icon.png');

  // Create standard icon
  await sharp(iconPath)
    .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } }) // Black background
    .toFile('./assets/images/icon.png');

  console.log('Icons generated successfully.');
}

fixIcon().catch(console.error);
