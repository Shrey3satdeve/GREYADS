const { z } = require('zod');

// --- Sanitization Helper ---
// Strips all HTML tags from a string to prevent XSS/Script Injection
const stripHtml = (val) => {
  if (typeof val !== 'string') return val;
  return val.replace(/<[^>]*>?/gm, '');
};

// --- Recursive Sanitizer for Objects ---
const sanitizeObject = (obj) => {
  if (typeof obj !== 'object' || obj === null) return obj;
  const newObj = Array.isArray(obj) ? [] : {};
  for (const key in obj) {
    const val = obj[key];
    if (typeof val === 'string') {
      newObj[key] = stripHtml(val).trim();
    } else if (typeof val === 'object') {
      newObj[key] = sanitizeObject(val);
    } else {
      newObj[key] = val;
    }
  }
  return newObj;
};

// --- Authentication & Identity ---
const PasswordResetSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
});

// --- Payments & Bookings ---
const InitiatePaymentSchema = z.object({
  amount: z.number().positive(),
  event_id: z.string().min(10),
  quantity: z.number().int().min(1).max(10),
});

const VerifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(10),
  razorpay_payment_id: z.string().min(10),
  razorpay_signature: z.string().min(30),
  event_id: z.string().min(10),
  quantity: z.number().int().min(1).max(10),
  guests: z.array(z.object({
    name: z.string().trim().min(2).max(100).transform(stripHtml),
    age: z.string().trim().max(3).optional(),
  })).optional(),
});

module.exports = {
  sanitizeObject,
  InitiatePaymentSchema,
  VerifyPaymentSchema,
  PasswordResetSchema,
};
