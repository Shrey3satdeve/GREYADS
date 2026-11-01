# GreyAdz — Event Discovery & Ticketing Platform

> **Industrial Luxury. The Velvet Rope. Digital Noir.**

GreyAdz is a full-stack mobile event ticketing app built for exclusivity. Users discover events, book tickets with Razorpay, and receive QR-based digital tickets — while admins manage events and staff verify tickets via an in-app camera scanner.

---

## ✨ Features

### For Users
- 📅 **Event Discovery** — Browse curated events with a cinematic dark-mode UI
- 🎟️ **Ticket Booking** — Secure seat reservations with real-time inventory locking
- 💳 **Razorpay Payments** — Fully verified end-to-end payment flow (INR)
- 📲 **QR Tickets** — Digital tickets with unique QR codes stored in Firestore
- 🔔 **Push Notifications** — Booking confirmations and event broadcasts via FCM
- 👤 **Profile Management** — Edit name, email, phone, avatar
- ❤️ **Wishlist** — Save events for later

### For Admins
- 🗂️ **Event Management** — Create, edit, and manage events directly in-app
- 👥 **User Management** — View users and manage roles
- 📊 **Admin Dashboard** — Overview of bookings and event stats

### For Staff
- 📷 **QR Scanner** — Camera-based ticket scanner with instant valid/invalid feedback
- 📋 **Scan History** — View all previously scanned tickets

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Mobile App** | React Native 0.76 + Expo SDK 52 |
| **Routing** | Expo Router (file-based) |
| **Auth** | Firebase Auth (Email/Password + Google Sign-In + OTP) |
| **Database** | Cloud Firestore |
| **Backend** | Firebase Cloud Functions v2 (Node.js) |
| **Payments** | Razorpay (INR) |
| **Push Notifications** | Firebase Cloud Messaging (FCM) |
| **Web** | Expo Web + Cloudflare Pages |
| **E2E Tests** | Playwright |
| **Builds** | EAS Build (Expo Application Services) |

---

## 📁 Project Structure

```
GREYADS/
├── frontend/                  # React Native / Expo app
│   ├── app/
│   │   ├── (auth)/            # Login, Signup screens
│   │   ├── (tabs)/            # Home, Tickets, Notifications, Profile
│   │   ├── (admin)/           # Admin dashboard, event management
│   │   ├── (scanner)/         # QR scanner + scan history
│   │   ├── book/[id].tsx      # Ticket booking flow
│   │   ├── event/[id].tsx     # Event detail screen
│   │   ├── ticket/[id].tsx    # Digital ticket view
│   │   ├── payment-result.tsx # Post-payment result screen
│   │   ├── onboarding.tsx     # First-run onboarding
│   │   └── wishlist.tsx       # Saved events
│   ├── components/            # Shared UI components
│   │   ├── AppDialog.tsx
│   │   ├── BrandMark.tsx
│   │   ├── Card3D.tsx
│   │   └── SlidingTabBar.tsx
│   ├── context/
│   │   └── AuthContext.tsx    # Auth state, token management, FCM
│   ├── utils/
│   │   ├── api.ts             # REST API client
│   │   ├── firebase.ts        # Firebase SDK init
│   │   ├── googleSignIn.ts    # Google Sign-In helper
│   │   └── schemas.ts         # Zod validation schemas
│   └── constants/
│       └── theme.ts           # Design tokens
│
├── functions/                 # Firebase Cloud Functions
│   ├── index.js               # Entry point — exports all functions
│   ├── firebase_init.js       # Firestore + constants setup
│   ├── auth_handlers.js       # sendPasswordReset
│   ├── payment_handlers.js    # initiatePayment, verifyPayment, cancelPaymentOrder, getPaymentStatus
│   ├── webhook_handlers.js    # razorpayWebhook (signature-verified)
│   ├── notification_handlers.js # onNotificationCreated (FCM trigger)
│   ├── core_utils.js          # Auth guards, rate limiting, validation helpers
│   ├── schemas.js             # Zod schemas for Cloud Function inputs
│   └── tests/                 # Unit tests for payment logic
│
├── firestore.rules            # Role-based Firestore security rules
├── firebase.json              # Firebase project config
└── design_guidelines.json     # Brand + design system spec
```

---

## 🔐 Roles & Permissions

| Role | Capabilities |
|---|---|
| `user` | Browse events, book tickets, view own tickets & notifications |
| `staff` | All user capabilities + scan QR tickets, view scan logs |
| `admin` | All staff capabilities + create/edit events, manage users |

Roles are enforced both in **Firestore security rules** and **Cloud Functions** — client-side role checks are never trusted alone.

---

## 💸 Payment Flow

```
User taps "Book" → initiatePayment (Cloud Fn)
  → Inventory reserved (Firestore transaction)
  → Razorpay order created
  → Client opens Razorpay SDK

User pays → verifyPayment (Cloud Fn)
  → HMAC signature verified (timing-safe)
  → Payment captured via Razorpay API
  → Ticket created in Firestore (idempotent)
  → Reservation consumed, inventory finalized
  → Push notification sent to user

If user cancels → cancelPaymentOrder (Cloud Fn)
  → Inventory reservation released

Webhook → razorpayWebhook (HTTPS endpoint)
  → Fallback verification path for missed client callbacks
```

Reservation windows prevent overselling during payment. All financial operations run inside Firestore **transactions**.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- A Firebase project with Firestore, Auth, Functions, and FCM enabled
- A Razorpay account (Test or Live mode)

### 1. Clone & Install

```bash
git clone https://github.com/Shrey3satdeve/GREYADS.git
cd GREYADS/frontend
npm install
```

### 2. Environment Setup

Create `frontend/.env`:

```env
EXPO_PUBLIC_API_URL=https://your-firebase-region-project.cloudfunctions.net
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_GOOGLE_CLIENT_ID=...
```

Place `google-services.json` in `frontend/` (Android — from Firebase Console).

### 3. Run the App

```bash
# Start Metro + Expo Go
cd frontend
npm start

# Android (with USB / emulator)
npm run android

# Web
npm run web
```

### 4. Deploy Cloud Functions

```bash
cd functions
npm install
firebase deploy --only functions
```

### 5. Set Razorpay Secrets

```bash
firebase functions:secrets:set RAZORPAY_KEY_ID
firebase functions:secrets:set RAZORPAY_KEY_SECRET
```

---

## 📦 Building a Release APK

```bash
cd frontend

# Preview build (internal testing)
eas build --platform android --profile preview

# Production build
eas build --platform android --profile production
```

---

## 🧪 Testing

```bash
# Unit tests (Cloud Functions)
cd functions
npm test

# E2E tests (Playwright — web)
cd frontend
npm run test:e2e

# E2E with UI
npm run test:e2e:ui
```

---

## 🎨 Design System

GreyAdz uses a strict **dark mode** design language:

- **Colors**: Matte black background (`#000000`), pure white primary actions, zinc grays for hierarchy
- **Typography**: `Outfit` for headings, `Inter` for body text
- **Animations**: `react-native-reanimated` + `react-native-gesture-handler`
- **Icons**: `lucide-react-native`
- **Blur**: `expo-blur` for glassmorphic panels and tab bar
- **Tab Bar**: Floating pill-shaped blur tab bar

Full spec: [`design_guidelines.json`](./design_guidelines.json)

---

## 🔒 Security Notes

- **Never commit** `google-services.json`, `.env`, or `firebase-users-export.json`
- Razorpay secrets are stored in **Firebase Secret Manager** — never in code
- All payment verification uses **HMAC SHA-256 timing-safe comparison**
- Firestore rules enforce **server-side role checks** for every write
- Ticket writes are **server-only** (client writes to `/tickets` are denied)
- Rate limiting is applied on `initiatePayment` (10 attempts / 60 min per user)

---

## 📄 License

Private — All rights reserved © 2026 GreyAdz
