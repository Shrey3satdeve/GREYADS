import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  limit, 
  addDoc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  serverTimestamp, 
  runTransaction 
} from "firebase/firestore";
import CryptoJS from 'crypto-js';
import { db, auth } from "./firebase";

// Helper to format Firestore snapshots as JSON-friendly objects
const fmtDoc = (snap: any) => {
  if (!snap.exists()) return null;
  const data = snap.data();
  // Map timestamps to ISO strings for compatibility with existing components
  Object.keys(data).forEach(key => {
    if (data[key] && typeof data[key].toDate === 'function') {
      data[key] = data[key].toDate().toISOString();
    }
  });
  return { id: snap.id, ...data };
};

export const api = {
  get: async (path: string): Promise<any> => {
    const uid = auth.currentUser?.uid;

    // Events List
    if (path === '/events' || path.startsWith('/events?')) {
      const q = query(collection(db, "events"), orderBy("date", "asc"));
      const snap = await getDocs(q);
      return { events: snap.docs.map(fmtDoc) };
    }

    // Event Details
    if (path.startsWith('/events/')) {
      const eventId = path.split('/')[2].split('?')[0]; // Handle query params if any
      const snap = await getDoc(doc(db, "events", eventId));
      return { event: fmtDoc(snap) };
    }

    // My Tickets
    if (path === '/tickets/my') {
      if (!uid) throw new Error("Not authenticated");
      const q = query(collection(db, "tickets"), where("user_id", "==", uid), orderBy("created_at", "desc"));
      const snap = await getDocs(q);
      return { tickets: snap.docs.map(fmtDoc) };
    }

    // Ticket Details
    if (path.startsWith('/tickets/')) {
      const ticketId = path.split('/')[2].split('?')[0];
      const snap = await getDoc(doc(db, "tickets", ticketId));
      return { ticket: fmtDoc(snap) };
    }

    // Notifications
    if (path === '/notifications/my') {
      if (!uid) throw new Error("Not authenticated");
      const q = query(collection(db, "notifications"), where("user_id", "==", uid), orderBy("created_at", "desc"), limit(30));
      const snap = await getDocs(q);
      const personal = snap.docs.map(fmtDoc);
      
      // Fetch Broadcasts (Marketing/Global)
      const qBroadcast = query(collection(db, "broadcasts"), orderBy("created_at", "desc"), limit(20));
      const snapBroadcast = await getDocs(qBroadcast);
      const broadcasts = snapBroadcast.docs.map(fmtDoc);

      // Merge and Sort
      const all = [...personal, ...broadcasts].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return { notifications: all };
    }

    // Profile (Me)
    if (path === '/auth/me') {
      if (!uid) throw new Error("Not authenticated");
      const snap = await getDoc(doc(db, "users", uid));
      return { user: fmtDoc(snap) };
    }

    // Admin Stats
    if (path === '/admin/stats') {
      const eventsSnap = await getDocs(collection(db, "events"));
      const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "user")));
      const ticketsSnap = await getDocs(collection(db, "tickets"));
      
      return {
        total_events: eventsSnap.size,
        total_users: usersSnap.size,
        total_tickets: ticketsSnap.size,
        total_revenue: ticketsSnap.docs.reduce((acc, d) => acc + (d.data().total_price || 0), 0),
        todays_scans: 0,
        revenue_change_pct: null, // Legacy field
        recent_events: eventsSnap.docs.slice(0, 5).map(fmtDoc)
      };
    }

    // Admin Users List
    if (path === '/admin/users') {
      const snap = await getDocs(collection(db, "users"));
      return { users: snap.docs.map(fmtDoc) };
    }

    // Admin Weekly Stats
    if (path === '/admin/weekly-stats') {
      return { weekly: [0, 0, 0, 0, 0, 0, 0] }; // Placeholder
    }

    // Scanner History
    if (path === '/scanner/history') {
      return { logs: [] }; // Placeholder
    }

    // Payment Status
    if (path.startsWith('/payments/status/')) {
      if (!uid) throw new Error("Not authenticated");
      // For migration, return the most recent ticket ID as 'MOCKED_TICKET' fallback
      const q = query(collection(db, "tickets"), where("user_id", "==", uid), orderBy("created_at", "desc"), limit(1));
      const snap = await getDocs(q);
      const latestId = snap.docs[0]?.id || "NO_TICKET_FOUND";
      return { status: 'COMPLETED', ticket_id: latestId };
    }

    // Event Attendees (Admin)
    if (path.startsWith('/admin/events/') && path.endsWith('/attendees')) {
      const eventId = path.split('/')[3];
      const q = query(collection(db, "tickets"), where("event_id", "==", eventId));
      const snap = await getDocs(q);
      return { attendees: snap.docs.map(fmtDoc) };
    }
    throw new Error(`Endpoint ${path} not implemented for Firestore migration.`);
  },

  post: async (path: string, body?: any, ...rest: any[]): Promise<any> => {
    const uid = auth.currentUser?.uid;

    // Booking Logic (Transaction)
    if (path === '/tickets/book') {
      const { event_id, quantity } = body;
      return await runTransaction(db, async (transaction) => {
        const eventRef = doc(db, "events", event_id);
        const eventSnap = await transaction.get(eventRef);
        if (!eventSnap.exists()) throw new Error("Event not found");
        
        const eventData = eventSnap.data();
        if (eventData.available_tickets < quantity) throw new Error("Not enough tickets");

        const ticketRef = doc(collection(db, "tickets"));
        const ticketData = {
          event_id,
          user_id: uid,
          user_name: auth.currentUser?.displayName || "User",
          user_email: auth.currentUser?.email || "",
          event_title: eventData.title,
          event_date: eventData.date,
          event_venue: eventData.venue,
          qr_token: `GRY-${uid?.substring(0, 4)}-${ticketRef.id.substring(0, 8)}`,
          booking_ref: `GRY-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          status: "valid",
          quantity,
          total_price: eventData.price * quantity,
          created_at: serverTimestamp(),
        };

        transaction.set(ticketRef, ticketData);
        transaction.update(eventRef, {
          available_tickets: eventData.available_tickets - quantity
        });

        // Add notification
        const notifRef = doc(collection(db, "notifications"));
        transaction.set(notifRef, {
          user_id: uid,
          title: "Ticket Booked! 🎫",
          message: `Your ticket for ${eventData.title} is confirmed.`,
          type: "ticket",
          is_read: false,
          created_at: serverTimestamp(),
        });

        const resultTicket = { 
          id: ticketRef.id, 
          ...ticketData, 
          created_at: new Date().toISOString() 
        };
        return { ticket: resultTicket };
      });
    }

    // Create Event (Admin)
    if (path === '/events') {
      const docRef = await addDoc(collection(db, "events"), {
        ...body,
        created_at: serverTimestamp(),
        available_tickets: body.total_tickets,
        status: "upcoming"
      });
      return { event: { id: docRef.id, ...body } };
    }

    // Admin Broadcast (Marketing/Event)
    if (path === '/admin/broadcast') {
      const { title, message, type = 'promo' } = body;
      await addDoc(collection(db, "broadcasts"), {
        title,
        message,
        type,
        created_at: serverTimestamp(),
      });
      return { success: true };
    }

    // Legacy Auth Endpoints (Mocked for now - should use Firebase Auth directly in future)
    if (path === '/auth/login' || path === '/auth/google') {
      // In a real Firebase app, we don't 'login' via internal API POST.
      // But we might have a user record check.
      if (!uid) throw new Error("Not authenticated via Firebase");
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      
      // If the Firestore record doesn't exist yet (new account), create it.
      // This prevents the "Cannot read property 'role' of null" error.
      const isDemoAdmin = auth.currentUser?.email === 'admin@greyads.com';
      const isDemoStaff = auth.currentUser?.email === 'staff@greyads.com';
      let targetRole = isDemoAdmin ? 'admin' : (isDemoStaff ? 'staff' : (body?.role || 'user'));

      if (!snap.exists()) {
        const newUser = {
          email: auth.currentUser?.email || "",
          name: auth.currentUser?.displayName || "User",
          role: targetRole,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        };
        await setDoc(userRef, newUser);
        const freshSnap = await getDoc(userRef);
        return { token: "firebase_token", user: fmtDoc(freshSnap) };
      }

      let docData = fmtDoc(snap);
      if (docData.role !== targetRole && (isDemoAdmin || isDemoStaff)) {
        await updateDoc(userRef, { role: targetRole });
        docData.role = targetRole;
      }

      return { token: "firebase_token", user: docData };
    }

    // Admin Revoke User
    if (path === '/admin/revoke-user') {
      const { user_id } = body;
      if (!user_id) throw new Error("User ID is required");
      const userRef = doc(db, "users", user_id);
      await updateDoc(userRef, { 
        role: 'user', 
        is_revoked: true, 
        revoked_at: serverTimestamp() 
      });
      return { success: true };
    }

    // Payment Initiation
    if (path === '/payments/initiate') {
      const mid = process.env.EXPO_PUBLIC_PHONEPE_MERCHANT_ID;
      const salt = process.env.EXPO_PUBLIC_PHONEPE_SALT_KEY;
      const index = process.env.EXPO_PUBLIC_PHONEPE_SALT_INDEX || '1';
      
      if (!mid || !salt) {
        console.warn('Real PhonePe keys missing in .env! Using Sandbox URL for demonstration.');
        return { 
          payment_url: 'https://merchants-test.phonepe.com/pg/v1/pay/demo', 
          txn_id: 'TEST_' + Date.now(),
          _note: "Please add your Merchant ID and Salt Key in .env to enable production payments."
        };
      }

      const txnId = 'MT' + Date.now();
      const payload = {
        merchantId: mid,
        merchantTransactionId: txnId,
        merchantUserId: uid || "GUEST_USER",
        amount: Math.round(body.amount * 100), // PhonePe Uses Paisa (integer)
        redirectUrl: "greyadz-payment://payment-result",
        redirectMode: "REDIRECT",
        callbackUrl: "https://your-server.com/callback",
        mobileNumber: body.mobile || "9999999999",
        paymentInstrument: { type: 'PAY_PAGE' }
      };

      const base64Request = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(JSON.stringify(payload)));
      const stringToHash = base64Request + "/pg/v1/pay" + salt;
      const sha256Hash = CryptoJS.SHA256(stringToHash).toString();
      const checksum = sha256Hash + "###" + index;

      const isSandbox = mid.includes('TEST') || salt.includes('TEST');
      const endpoint = isSandbox 
         ? 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay'
         : 'https://api.phonepe.com/apis/hermes/pg/v1/pay';

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': checksum
          },
          body: JSON.stringify({ request: base64Request })
        });
        
        const json = await response.json();
        if (json.success && json.data?.instrumentResponse?.redirectInfo?.url) {
          return {
            payment_url: json.data.instrumentResponse.redirectInfo.url,
            txn_id: txnId,
            _is_real: false // Prevents the frontend from trying to append query params later
          };
        } else {
          throw new Error(`[${json.code || 'REJECTED'}] ${json.message || 'Payment initiation failed'}`);
        }
      } catch (e: any) {
        if (e.message.includes('[REJECTED]') || e.message.includes('[')) {
          throw e; // Bubble up exact PhonePe error formatting
        }
        throw new Error('PhonePe Gateway Error: ' + e.message);
      }
    }

    // Event Attendees (Admin)
    if (path.startsWith('/admin/events/') && path.endsWith('/attendees')) {
      const eventId = path.split('/')[3];
      const q = query(collection(db, "tickets"), where("event_id", "==", eventId));
      const snap = await getDocs(q);
      return { attendees: snap.docs.map(fmtDoc) };
    }
    throw new Error(`Endpoint ${path} not implemented for Firestore migration.`);
  },

  patch: async (path: string, body?: any): Promise<any> => {
    const uid = auth.currentUser?.uid;

    // Update Profile
    if (path === '/auth/me') {
      if (!uid) throw new Error("Not authenticated");
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      
      if (!snap.exists()) {
        // Create user if they don't exist yet (Signup flow)
        await setDoc(userRef, {
          name: body?.name || auth.currentUser?.displayName || "User",
          email: auth.currentUser?.email || "",
          role: 'user', 
          ...body,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        });
      } else {
        await updateDoc(userRef, { ...body, updated_at: serverTimestamp() });
      }
      
      const updatedSnap = await getDoc(userRef);
      return { user: fmtDoc(updatedSnap) };
    }

    // Mark Notification Read
    if (path.startsWith('/notifications/') && path.endsWith('/read')) {
      const notifId = path.split('/')[2];
      await updateDoc(doc(db, "notifications", notifId), { is_read: true });
      return { success: true };
    }


    // Event Attendees (Admin)
    if (path.startsWith('/admin/events/') && path.endsWith('/attendees')) {
      const eventId = path.split('/')[3];
      const q = query(collection(db, "tickets"), where("event_id", "==", eventId));
      const snap = await getDocs(q);
      return { attendees: snap.docs.map(fmtDoc) };
    }
    throw new Error(`Endpoint ${path} not implemented for Firestore migration.`);
  },

  delete: async (path: string): Promise<any> => {
    // Event Deletion
    if (path.startsWith('/events/')) {
      const eventId = path.split('/')[2];
      await deleteDoc(doc(db, "events", eventId));
      return { success: true };
    }
    // Event Attendees (Admin)
    if (path.startsWith('/admin/events/') && path.endsWith('/attendees')) {
      const eventId = path.split('/')[3];
      const q = query(collection(db, "tickets"), where("event_id", "==", eventId));
      const snap = await getDocs(q);
      return { attendees: snap.docs.map(fmtDoc) };
    }
    throw new Error(`Endpoint ${path} not implemented for Firestore migration.`);
  },
};
