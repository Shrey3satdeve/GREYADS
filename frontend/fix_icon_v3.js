const sharp = require("sharp");
const path = require("path");

const LOGO_SOURCE = "assets/images/greyadz-logo-v2.png";
const ADAPTIVE_ICON = "assets/images/adaptive-icon.png";
const REGULAR_ICON = "assets/images/icon.png";
const SPLASH_IMAGE = "assets/images/splash.png";

async function generateIcons() {
  console.log("Starting icon generation...");

  // 1. Adaptive Icon (Foreground) - Very aggressive padding
  // Android Adaptive icon standard: 108dp x 108dp total, 66-72dp visible safe zone.
  // We'll put the logo in a 512x512 box within a 1024x1024 canvas.
  await sharp(LOGO_SOURCE)
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: 256,
      bottom: 256,
      left: 256,
      right: 256,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toFile(ADAPTIVE_ICON);
  console.log("✓ Generated adaptive-icon.png (50% scale with large padding)");

  // 2. Regular Icon (iOS and General)
  // Scaling to 768px in 1024px canvas (~75% scale)
  await sharp(LOGO_SOURCE)
    .resize(768, 768, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: 128,
      bottom: 128,
      left: 128,
      right: 128,
      background: { r: 0, g: 0, b: 0, alpha: 1 } // Solid black background for iOS icon
    })
    .toFile(REGULAR_ICON);
  console.log("✓ Generated icon.png (75% scale with solid black background)");

  // 3. Splash Screen
  // Centered logo in a large dark canvas
  await sharp(LOGO_SOURCE)
    .resize(800, 800, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFile(SPLASH_IMAGE);
  console.log("✓ Generated splash.png");

  console.log("\nAll assets polished and ready for APK build.");
}

generateIcons().catch(err => {
  console.error("Error generating icons:", err);
  process.exit(1);
});
