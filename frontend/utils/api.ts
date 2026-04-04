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
  runTransaction,
  onSnapshot
} from "@react-native-firebase/firestore";
import functions from '@react-native-firebase/functions';
import firebase from '@react-native-firebase/app';
import { db, auth } from "./firebase";
import { 
  UpdateProfileSchema, 
  BookingSchema,
  SignupSchema,
  EventSchema
} from "./schemas";

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

// Internal audit logger for suspicious frontend errors
const reportAuditInfo = async (action: string, path: string, error: any) => {
  try {
    const uid = auth.currentUser?.uid || 'anonymous';
    // Only log "suspicious" patterns: unauthorized or permission denied
    if (error?.message?.includes('unauthenticated') || error?.code?.includes('permission-denied')) {
      await addDoc(collection(db, "audit_logs"), {
        uid,
        action,
        path,
        error_code: error?.code || 'unknown',
        error_message: error?.message || 'N/A',
        timestamp: serverTimestamp(),
        severity: 'warn'
      });
    }
  } catch (e) { /* silent fail for audit itself */ }
};

export const api = {
  get: async (path: string): Promise<any> => {
    try {
      const uid = auth.currentUser?.uid;

    // Events List
    if (path === '/events' || path.startsWith('/events?')) {
      const urlParams = new URLSearchParams(path.includes('?') ? path.split('?')[1] : '');
      const categoryFilter = urlParams.get('category');
      const searchFilter = urlParams.get('search')?.toLowerCase();

      // When a category filter is active, avoid combining where() + orderBy() which
      // requires a Firestore composite index that may not exist — sort client-side instead.
      let q;
      if (categoryFilter) {
        q = query(collection(db, "events"), where("category", "==", categoryFilter));
      } else {
        q = query(collection(db, "events"), orderBy("date", "asc"));
      }

      const snap = await getDocs(q);
      let events = snap.docs.map(fmtDoc);

      // Client-side sort when category filter is applied
      if (categoryFilter) {
        events = events.sort((a: any, b: any) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
      }

      // Client-side search filter (Firestore doesn't support full-text search)
      if (searchFilter) {
        events = events.filter((e: any) =>
          e.title?.toLowerCase().includes(searchFilter) ||
          e.venue?.toLowerCase().includes(searchFilter) ||
          e.category?.toLowerCase().includes(searchFilter)
        );
      }

      return { events };
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
      const q = query(collection(db, "tickets"), where("user_id", "==", uid));
      const snap = await getDocs(q);
      const tickets = snap.docs.map(fmtDoc);
      tickets.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      return { tickets };
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
      const q = query(collection(db, "notifications"), where("user_id", "==", uid));
      const snap = await getDocs(q);
      let personal = snap.docs.map(fmtDoc);
      personal.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      personal = personal.slice(0, 30);
      
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
      
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const scansSnap = await getDocs(query(collection(db, "scan_logs"), where("timestamp", ">=", todayStart)));
      
      return {
        total_events: eventsSnap.size,
        total_users: usersSnap.size,
        total_tickets: ticketsSnap.size,
        total_revenue: ticketsSnap.docs.reduce((acc: number, d: any) => acc + (d.data().total_price || 0), 0),
        todays_scans: scansSnap.size,
        revenue_change_pct: null, // Legacy field
        recent_events: eventsSnap.docs.slice(0, 5).map(fmtDoc)
      };
    }

    // Admin Detailed Scans (Today)
    if (path === '/admin/detailed-scans') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const q = query(collection(db, "scan_logs"), where("timestamp", ">=", todayStart), orderBy("timestamp", "desc"));
      const snap = await getDocs(q);
      return { scans: snap.docs.map(fmtDoc) };
    }

    // Admin Detailed Revenue (Recent Transactions)
    if (path === '/admin/detailed-revenue') {
      const q = query(collection(db, "tickets"), orderBy("created_at", "desc"), limit(50));
      const snap = await getDocs(q);
      return { transactions: snap.docs.map(fmtDoc) };
    }

    // Admin Users List
    if (path === '/admin/users') {
      const snap = await getDocs(collection(db, "users"));
      return { users: snap.docs.map(fmtDoc) };
    }

    // Admin Weekly Stats
    if (path === '/admin/weekly-stats') {
      const now = new Date();
      // Calculate Monday of current week
      const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
      const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
      const monday = new Date(new Date(now).setDate(diff));
      monday.setHours(0, 0, 0, 0);

      const q = query(collection(db, "tickets"), where("created_at", ">=", monday));
      const snap = await getDocs(q);
      
      const counts = [0, 0, 0, 0, 0, 0, 0]; // Mon-Sun
      const dayCategories: string[][] = [[], [], [], [], [], [], []];
      
      snap.docs.forEach((d: any) => {
        const data = d.data();
        const created = data.created_at?.toDate();
        if (created) {
          const day = created.getDay(); // 0-6 (Sun-Sat)
          const index = day === 0 ? 6 : day - 1; // Map to 0-6 (Mon-Sun)
          counts[index] += (data.quantity || 1);
          if (data.event_category) dayCategories[index].push(data.event_category);
        }
      });

      // Best-guess primary category for each day to determine color
      const primaryCategories = dayCategories.map(cats => {
        if (cats.length === 0) return null;
        return cats.sort((a,b) => cats.filter(v => v===a).length - cats.filter(v => v===b).length).pop();
      });

      return { weekly: counts, categories: primaryCategories };
    }

    // Scanner History — real scan_logs from Firestore (optionally filtered by event_id)
    if (path === '/scanner/history' || path.startsWith('/scanner/history?')) {
      if (!uid) return { logs: [] };
      const urlParams = new URLSearchParams(path.includes('?') ? path.split('?')[1] : '');
      const eventIdFilter = urlParams.get('event_id');
      
      let q;
      if (eventIdFilter) {
        q = query(collection(db, "scan_logs"), where("event_id", "==", eventIdFilter), orderBy("timestamp", "desc"), limit(100));
      } else {
        q = query(collection(db, "scan_logs"), orderBy("timestamp", "desc"), limit(50));
      }
      
      const snap = await getDocs(q);
      return { logs: snap.docs.map(fmtDoc) };
    }

    // Admin Guest Count (Currently Inside)
    if (path === '/admin/inside-count') {
      const q = query(collection(db, "tickets"), where("status", "==", "inside"));
      const snap = await getDocs(q);
      return { count: snap.size };
    }

    // Payment Status — check Firestore for ticket with this txn_id
    if (path.startsWith('/payments/status/')) {
      if (!uid) throw new Error("Not authenticated");
      const txnId = path.split('/')[3];
      // First try to find a ticket linked to this exact txn_id
      const q1 = query(collection(db, "tickets"), where("txn_id", "==", txnId), where("user_id", "==", uid), limit(1));
      const snap1 = await getDocs(q1);
      if (!snap1.empty) return { status: 'COMPLETED', ticket_id: snap1.docs[0].id };
      // Fallback: return the most recent ticket for this user (handles legacy bookings)
      const q2 = query(collection(db, "tickets"), where("user_id", "==", uid), orderBy("created_at", "desc"), limit(1));
      const snap2 = await getDocs(q2);
      if (!snap2.empty) return { status: 'COMPLETED', ticket_id: snap2.docs[0].id };
      return { status: 'PENDING' };
    }

    // Event Attendees (Admin)
    if (path.startsWith('/admin/events/') && path.endsWith('/attendees')) {
      const eventId = path.split('/')[3];
      const q = query(collection(db, "tickets"), where("event_id", "==", eventId));
      const snap = await getDocs(q);
      return { attendees: snap.docs.map(fmtDoc) };
    }
      throw new Error(`Endpoint ${path} not implemented for Firestore migration.`);
    } catch (err: any) {
      await reportAuditInfo('GET', path, err);
      throw err;
    }
  },

  post: async (path: string, body?: any, ...rest: any[]): Promise<any> => {
    try {
      const uid = auth.currentUser?.uid;

      // VALIDATE: Payments (Verification)
      if (path === '/payments/verify') {
        const result = BookingSchema.safeParse(body);
        if (!result.success) throw new Error(result.error.issues[0].message);
      }

    // Booking Logic: REMOVED (SECURITY: Always use /payments/initiate -> /payments/verify)


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
      if (!uid) throw new Error("Not authenticated via Firebase");
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      
      const email = auth.currentUser?.email || "";
      const isDemoAdmin = email === 'admin@greyads.com';
      const isDemoStaff = email === 'staff@greyads.com';
      
      // Determine what the user's role SHOULD be if they are a demo account
      const demoRole = isDemoAdmin ? 'admin' : (isDemoStaff ? 'staff' : null);
      const requestedRole = body?.role || 'user';

      if (!snap.exists()) {
        // NEW USER: Only demo accounts can be anything other than 'user'
        const initialRole = demoRole || 'user';
        
        // If they requested a restricted role but aren't a demo account, reject early
        if (requestedRole !== 'user' && !demoRole) {
          throw new Error("Access denied. Your account is not authorized for this section.");
        }

        const newUser = {
          email: email,
          name: auth.currentUser?.displayName || "User",
          phone: auth.currentUser?.phoneNumber || undefined,
          role: initialRole,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        };
        await setDoc(userRef, newUser);
        const freshSnap = await getDoc(userRef);
        return { token: "firebase_token", user: fmtDoc(freshSnap) };
      }

      // EXISTING USER: We MUST NOT update their role based on body.role
      const userData = fmtDoc(snap);
      const actualRole = userData.role;

      // STRICT CHECK: If they are trying to log into a section they don't belong to
      if (requestedRole !== actualRole) {
        throw new Error("Access denied. Your account is not authorized for this section.");
      }

      return { token: "firebase_token", user: userData };
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

    // Payment Initiation — proxied via Firebase Cloud Function (salt key never in client)
    if (path === '/payments/initiate') {
      // Function is deployed to asia-south1 (Mumbai) — must match here or calls hit us-central1 and return NOT_FOUND
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — RNFB types may lag; runtime accepts (app, region) to target non-default region
      const fn = firebase.app().functions('asia-south1').httpsCallable('initiatePayment');
      try {
        const result: any = await fn(body);
        // Cloud Function returns { order_id, amount, key_id }
        return result.data;
      } catch (e: any) {
        const msg = e?.message || 'Payment initiation failed';
        throw new Error(msg);
      }
    }

    // Verify Razorpay Payment — proxied via Firebase Cloud Function
    if (path === '/payments/verify') {
      const fn = firebase.app().functions('asia-south1').httpsCallable('verifyPayment');
      try {
        const result: any = await fn(body);
        return result.data;
      } catch (e: any) {
        const msg = e?.message || 'Payment verification failed';
        throw new Error(msg);
      }
    }

    // Scanner Verification (Multi-Mode: Entrance/Exit)
    if (path === '/scanner/verify') {
      const { qr_token, mode = 'entry', guest_indices } = body; // mode: 'entry' or 'exit', guest_indices: number[]
      const q = query(collection(db, "tickets"), where("qr_token", "==", qr_token), limit(1));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        return { status: 'invalid', message: 'Ticket not recognized' };
      }
      
      const ticketDoc = snap.docs[0];
      const ticketData = ticketDoc.data();

      // Ensure ticket belongs to the selected event (if staff has one selected)
      if (body.event_id && ticketData.event_id !== body.event_id) {
        return { 
          status: 'wrong_event', 
          message: 'Ticket is for a different event!',
          ticket: { event_title: ticketData.event_title }
        };
      }

      const guests = ticketData.guests || [{ name: ticketData.user_name, age: "N/A", status: ticketData.status || 'valid' }];

      // If group ticket and no guest selection provided, tell UI to show selection modal
      if (guests.length > 1 && !guest_indices) {
        return { 
          status: 'requires_selection', 
          message: 'Group ticket detected', 
          ticket: { ...ticketData, id: ticketDoc.id, guests } 
        };
      }

      const nextStatus = mode === 'entry' ? 'inside' : 'exited';
      const targets = guest_indices || [0];
      const updatedGuests = [...guests];
      
      // Perform status transitions for selected guests
      targets.forEach((idx: number) => {
        if (updatedGuests[idx]) {
          updatedGuests[idx].status = nextStatus;
        }
      });

      // Update main status (Any one inside = inside, all out = exited)
      const anyoneInside = updatedGuests.some((g: any) => g.status === 'inside');
      const mainStatus = anyoneInside ? 'inside' : 'exited';

      await updateDoc(ticketDoc.ref, { 
        guests: updatedGuests,
        status: mainStatus,
        last_scan: serverTimestamp()
      });
      
      // Log the scan
      await addDoc(collection(db, "scan_logs"), {
        ticket_id: ticketDoc.id,
        user_id: ticketData.user_id,
        user_name: ticketData.user_name || "Guest",
        booking_ref: ticketData.booking_ref || "N/A",
        staff_id: auth.currentUser?.uid,
        staff_name: auth.currentUser?.displayName || "Staff",
        event_id: ticketData.event_id,
        event_title: ticketData.event_title,
        status: 'success',
        type: mode === 'entry' ? 'Entrance' : 'Exit',
        guest_count: targets.length,
        timestamp: serverTimestamp()
      });

      return { 
        status: 'success', 
        message: mode === 'entry' ? `${targets.length} Guest(s) Entered` : `${targets.length} Guest(s) Exited`, 
        ticket: { ...ticketData, guests: updatedGuests } 
      };
    }

    // Event Attendees (Admin)
    if (path.startsWith('/admin/events/') && path.endsWith('/attendees')) {
      const eventId = path.split('/')[3];
      const q = query(collection(db, "tickets"), where("event_id", "==", eventId));
      const snap = await getDocs(q);
      return { attendees: snap.docs.map(fmtDoc) };
    }
      throw new Error(`Endpoint ${path} not implemented for Firestore migration.`);
    } catch (err: any) {
      await reportAuditInfo('POST', path, err);
      throw err;
    }
  },

  patch: async (path: string, body?: any): Promise<any> => {
    try {
      const uid = auth.currentUser?.uid;

      // VALIDATE: Profile Update
      if (path === '/auth/me') {
        const result = UpdateProfileSchema.safeParse(body);
        if (!result.success) throw new Error(result.error.issues[0].message);
      }

    // Update Profile
    if (path === '/auth/me') {
      if (!uid) throw new Error('Not authenticated');
      const userRef = doc(db, 'users', uid);
      const snap    = await getDoc(userRef);

      // SECURITY: Allowlist — only these fields may be written by the client.
      // Role, is_revoked, fcm_tokens are immutable from the client.
      const SAFE_FIELDS: string[] = ['name', 'phone', 'avatar_url'];
      const safeBody: Record<string, any> = {};
      for (const key of SAFE_FIELDS) {
        if (body && key in body && body[key] !== undefined) {
          safeBody[key] = body[key];
        }
      }

      if (!snap.exists()) {
        // Create user if they don't exist yet (Signup flow)
        // Always provision as 'user' — role is never sourced from body
        await setDoc(userRef, {
          name:  auth.currentUser?.displayName || 'User',
          email: auth.currentUser?.email       || '',
          role:  'user',
          ...safeBody,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      } else {
        if (Object.keys(safeBody).length > 0) {
          await updateDoc(userRef, { ...safeBody, updated_at: serverTimestamp() });
        }
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




    // Update Event fields (Admin) — e.g. is_recommended, status, price
    if (path.startsWith('/events/')) {
      const eventId = path.split('/')[2];
      if (!eventId || !body || typeof body !== 'object') throw new Error("Invalid event update request.");
      const eventRef = doc(db, "events", eventId);
      await updateDoc(eventRef, { ...body, updated_at: serverTimestamp() });
      const updatedSnap = await getDoc(eventRef);
      return { event: fmtDoc(updatedSnap) };
    }
    throw new Error(`Endpoint ${path} not implemented for Firestore migration.`);
    } catch (err: any) {
      await reportAuditInfo('PATCH', path, err);
      throw err;
    }
  },

  delete: async (path: string): Promise<any> => {
    // Notification Deletion (User dismissing apps)
    if (path.startsWith('/notifications/')) {
      const notifId = path.split('/')[2];
      await deleteDoc(doc(db, "notifications", notifId));
      return { success: true };
    }

    // Event Deletion
    if (path.startsWith('/events/')) {
      const eventId = path.split('/')[2];
      await deleteDoc(doc(db, "events", eventId));
      return { success: true };
    }

    throw new Error(`Endpoint ${path} not implemented for Firestore migration.`);
  },
  
  subscribe: (collectionName: string, callback: (data: any[]) => void) => {
    let q;
    if (collectionName === 'events') {
      q = query(collection(db, collectionName), orderBy("date", "asc"));
    } else {
      q = query(collection(db, collectionName), orderBy("created_at", "desc"));
    }
    
    return onSnapshot(q, (snap: any) => {
      const data = snap.docs.map(fmtDoc);
      callback(data);
    }, (err: any) => {
      console.error(`Subscription error for ${collectionName}:`, err);
    });
  }
};
