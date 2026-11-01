import { z } from 'zod';

// --- Shared Sanitization Helpers ---
const stripHtml = (val: string) => val.replace(/<[^>]*>?/gm, '');

// --- User Profile & Auth ---
export const SignupSchema = z.object({
  name: z.string().trim().min(2, "Name too short").max(80, "Name too long").transform(stripHtml),
  email: z.string().trim().email("Invalid email format").toLowerCase(),
  phone: z.string().trim().regex(/^\+?[0-9]{10,15}$/, "Invalid phone format").optional().or(z.literal('')),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const UpdateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name too short").max(80, "Name too long").transform(stripHtml).optional(),
  email: z.string().trim().email("Invalid email format").toLowerCase().optional().or(z.literal('')),
  phone: z.string().trim().regex(/^\+?[0-9]{10,15}$/, "Invalid phone format").optional().or(z.literal('')),
  avatar_url: z.string().url("Invalid avatar URL").optional().or(z.literal('')),
});

// --- Events & Bookings ---
export const EventSchema = z.object({
  title: z.string().trim().min(5, "Title too short").max(200, "Title too long").transform(stripHtml),
  description: z.string().trim().max(2000, "Description too long").transform(stripHtml),
  date: z.string().or(z.date()), // ISO string or Date object
  venue: z.string().trim().min(5, "Venue too short").max(300, "Venue too long").transform(stripHtml),
  price: z.number().min(0, "Price cannot be negative"),
  category: z.enum(["Music", "Technology", "Art", "Business", "Sports", "Other"]),
  total_tickets: z.number().int().min(1, "At least 1 ticket required"),
  cover_image_url: z.string().url("Invalid image URL").optional(),
});

export const BookingSchema = z.object({
  event_id: z.string().min(10),
  amount: z.number().positive(),
  quantity: z.number().int().min(1).max(10), // Limit to 10 tickets per booking
});

export const PaymentVerifySchema = z.object({
  razorpay_payment_id: z.string().min(10),
  razorpay_order_id: z.string().min(10),
  razorpay_signature: z.string().min(30),
});
