const fs = require('fs');
const sharp = require('sharp');
const jpgPath = 'd:/GREYADS/frontend/assets/images/razorpay logo.jpg';
const targetPath = 'd:/GREYADS/frontend/assets/images/rzp_logo.png';

async function convert() {
  if (!fs.existsSync(jpgPath)) {
      console.log('User image not found, skipping conversion.');
      return;
  }
  const buf = fs.readFileSync(jpgPath);
  await sharp(buf).png().toFile(targetPath);
  fs.unlinkSync(jpgPath);
  console.log('Conversion of user logo successful!');
}
convert().catch(console.error);
