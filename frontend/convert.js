const fs = require('fs');
const sharp = require('sharp');
const jpgPath = 'd:/GREYADS/frontend/assets/images/rzp_logo.png';
const oldPath = 'd:/GREYADS/frontend/assets/images/razorpay-logo.png';

async function convert() {
  const buf = fs.readFileSync(jpgPath);
  await sharp(buf).png().toFile('d:/GREYADS/frontend/assets/images/rzp_logo_fixed.png');
  fs.unlinkSync(jpgPath);
  if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  fs.renameSync('d:/GREYADS/frontend/assets/images/rzp_logo_fixed.png', jpgPath);
  console.log('Conversion successful!');
}
convert().catch(console.error);
