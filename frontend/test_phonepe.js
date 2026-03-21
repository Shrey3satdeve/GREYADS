const fetch = require('node-fetch');
const CryptoJS = require('crypto-js');

async function testPhonePe() {
  const mid = 'PGTESTPAYUAT86';
  const salt = '96434309-7796-489d-8924-ab56988a6076';
  const index = '1';
  const url = 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay';

  const payload = {
    merchantId: mid,
    merchantTransactionId: 'TEST12345678',
    merchantUserId: 'USER123',
    amount: 10000,
    redirectUrl: "greyadz-payment://payment-result",
    redirectMode: "REDIRECT",
    callbackUrl: "https://example.com/callback",
    mobileNumber: "9999999999",
    paymentInstrument: { type: 'PAY_PAGE' }
  };

  const base64Request = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(JSON.stringify(payload)));
  const stringToHash = base64Request + "/pg/v1/pay" + salt;
  const sha256Hash = CryptoJS.SHA256(stringToHash).toString();
  const checksum = sha256Hash + "###" + index;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum
      },
      body: JSON.stringify({ request: base64Request })
    });
    
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Body:", text);
  } catch (e) {
    console.error(e);
  }
}

testPhonePe();
