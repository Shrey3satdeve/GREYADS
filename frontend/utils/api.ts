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
import { db, auth, functions, firebase, functionsAsia } from "./firebase";
import {
  UpdateProfileSchema,
  BookingSchema,
  SignupSchema,
  EventSchema,
  PaymentVerifySchema
} from "./schemas";

const normalizeEmail = (value?: string | null) => String(value || '').trim().toLowerCase();

const parseEmailAllowlist = (value: string | undefined, fallback: string[]) => {
  const raw = value && value.trim().length > 0 ? value : fallback.join(',');
  return new Set(
    raw
      .split(',')
      .map((entry) => normalizeEmail(entry))
      .filter(Boolean)
  );
};

const ADMIN_EMAILS = parseEmailAllowlist(process.env.EXPO_PUBLIC_ADMIN_EMAILS, [
  'greyadz01@gmail.com',
  'admin@greyads.com',
  'admin@greyadz.com',
]);

const STAFF_EMAILS = parseEmailAllowlist(process.env.EXPO_PUBLIC_STAFF_EMAILS, [
  'staff@greyadz.com',
  'staff@greyads.com',
]);

const resolvePrivilegedRoleFromEmail = (email?: string | null): 'admin' | 'staff' | null => {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  if (ADMIN_EMAILS.has(normalized)) return 'admin';
  if (STAFF_EMAILS.has(normalized)) return 'staff';
  return null;
};

// Helper to format Firestore snapshots as JSON-friendly objects
const fmtDoc = (snap: any) => {
  if (!snap.exists()) return null;
  const data = { ...(snap.data() || {}) };
  // Map timestamps to ISO strings for compatibility with existing components
  Object.keys(data).forEach(key => {
    if (data[key] && typeof data[key].toDate === 'function') {
      data[key] = data[key].toDate().toISOString();
    }
  });
  // Keep Firestore document id authoritative for routing/navigation.
  return { ...data, id: snap.id };
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

const deriveTicketNotifications = (tickets: any[]) =>
  tickets.map((ticket: any) => ({
    id: `ticket-${ticket.id}`,
    type: 'ticket',
    title: 'Ticket booked successfully',
    message: `${ticket.event_title || 'Your event'} ticket is ready. Booking ref: ${ticket.booking_ref || ticket.id}.`,
    created_at: ticket.created_at || new Date().toISOString(),
    is_read: ticket.status !== 'pending',
    source: 'ticket',
  }));

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
        const personalSnap = await getDocs(query(collection(db, "notifications"), where("user_id", "==", uid)));
        let personal = personalSnap.docs.map(fmtDoc);
        personal.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        personal = personal.slice(0, 30);

        const qBroadcast = query(collection(db, "broadcasts"), orderBy("created_at", "desc"), limit(20));
        const snapBroadcast = await getDocs(qBroadcast);
        const broadcasts = snapBroadcast.docs.map(fmtDoc);

        const ticketSnap = await getDocs(query(collection(db, "tickets"), where("user_id", "==", uid)));
        const ticketNotifications = deriveTicketNotifications(ticketSnap.docs.map(fmtDoc)).slice(0, 20);

        const all = [...personal, ...broadcasts, ...ticketNotifications]
          .reduce((acc: any[], curr: any) => {
            if (!acc.find((item) => item.id === curr.id)) {
              acc.push(curr);
            }
            return acc;
          }, [])
          .sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        return { notifications: all };
      }

      // Wishlist list
      if (path === '/wishlist/my') {
        if (!uid) throw new Error("Not authenticated");
        const snap = await getDocs(query(collection(db, "wishlists"), where("user_id", "==", uid)));
        const entries = snap.docs.map(fmtDoc).sort((a: any, b: any) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );

        const events = await Promise.all(
          entries.map(async (entry: any) => {
            const eventSnap = await getDoc(doc(db, "events", entry.event_id));
            const event = fmtDoc(eventSnap);
            if (!event) return null;
            return { ...event, wishlist_id: entry.id, wishlisted_at: entry.created_at };
          }),
        );

        return { events: events.filter(Boolean) };
      }

      if (path.startsWith('/wishlist/check/')) {
        if (!uid) throw new Error("Not authenticated");
        const eventId = path.split('/')[3];
        const snap = await getDoc(doc(db, "wishlists", `${uid}_${eventId}`));
        return { liked: snap.exists(), item: fmtDoc(snap) };
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
          total_revenue: ticketsSnap.docs.reduce((acc: number, d: any) => acc + (d.data().charged_amount || d.data().total_price || 0), 0),
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
          return cats.sort((a, b) => cats.filter(v => v === a).length - cats.filter(v => v === b).length).pop();
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

      // Payment Status — backend-authoritative Cloud Function
      if (path.startsWith('/payments/status/')) {
        if (!uid) throw new Error("Not authenticated");
        const txnId = path.split('/')[3];
        const fn = firebase.app().functions('asia-south1').httpsCallable('getPaymentStatus');
        try {
          const result: any = await fn({ reference_id: txnId });
          return result.data;
        } catch (e: any) {
          const msg = e?.message || 'Payment status lookup failed';
          throw new Error(msg);
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
        const result = PaymentVerifySchema.safeParse(body);
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

      if (path === '/wishlist') {
        if (!uid) throw new Error("Not authenticated");
        if (!body?.event_id) throw new Error("Event ID is required");
        const wishlistId = `${uid}_${body.event_id}`;
        await setDoc(doc(db, "wishlists", wishlistId), {
          user_id: uid,
          event_id: body.event_id,
          created_at: serverTimestamp(),
        }, { merge: true });
        return { success: true, id: wishlistId };
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

      // Firebase-backed Auth Bootstrap
      if (path === '/auth/login' || path === '/auth/google') {
        if (!uid) throw new Error("Not authenticated via Firebase");
        const userRef = doc(db, "users", uid);
        const snap = await getDoc(userRef);

        const email = normalizeEmail(auth.currentUser?.email);
        const privilegedRole = resolvePrivilegedRoleFromEmail(email);
        const requestedRole = body?.role || 'user';
        const firebaseToken = await auth.currentUser?.getIdToken(true);

        if (!snap.exists()) {
          const initialRole = privilegedRole || 'user';

          if (requestedRole !== 'user' && requestedRole !== initialRole) {
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
          return { token: firebaseToken || '', user: fmtDoc(freshSnap) };
        }

        let userData = fmtDoc(snap);
        let actualRole = userData.role;

        if (privilegedRole && actualRole !== privilegedRole) {
          await updateDoc(userRef, {
            role: privilegedRole,
            updated_at: serverTimestamp(),
          });
          const refreshedSnap = await getDoc(userRef);
          userData = fmtDoc(refreshedSnap);
          actualRole = userData.role;
        }

        if (requestedRole !== actualRole) {
          throw new Error("Access denied. Your account is not authorized for this section.");
        }

        return { token: firebaseToken || '', user: userData };
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
        const fn = functionsAsia.httpsCallable('initiatePayment');
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
        const fn = functionsAsia.httpsCallable('verifyPayment');
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
        const snap = await getDoc(userRef);

        // SECURITY: Allowlist — only these fields may be written by the client.
        // Role, is_revoked, fcm_tokens are immutable from the client.
        const SAFE_FIELDS: string[] = ['name', 'email', 'phone', 'avatar_url'];
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
            name: auth.currentUser?.displayName || 'User',
            email: auth.currentUser?.email || '',
            role: 'user',
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

    if (path.startsWith('/wishlist/')) {
      const eventId = path.split('/')[2];
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Not authenticated");
      await deleteDoc(doc(db, "wishlists", `${uid}_${eventId}`));
      return { success: true };
    }

    throw new Error(`Endpoint ${path} not implemented for Firestore migration.`);
  },

  subscribe: (
    collectionName: string,
    callback: (data: any[]) => void,
    options?: {
      filters?: Array<[string, any, any]>;
      orderByField?: string;
      orderDirection?: 'asc' | 'desc';
      maxItems?: number;
      disableOrderBy?: boolean;
    },
  ) => {
    const constraints: any[] = [];

    if (options?.filters?.length) {
      for (const [field, operator, value] of options.filters) {
        constraints.push(where(field, operator, value));
      }
    }

    if (!options?.disableOrderBy) {
      const orderByField = options?.orderByField || (collectionName === 'events' ? 'date' : 'created_at');
      const orderDirection = options?.orderDirection || (collectionName === 'events' ? 'asc' : 'desc');
      constraints.push(orderBy(orderByField, orderDirection));
    }

    if (options?.maxItems) {
      constraints.push(limit(options.maxItems));
    }

    const q = query(collection(db, collectionName), ...constraints);

    return onSnapshot(q, (snap: any) => {
      const data = snap.docs.map(fmtDoc);
      callback(data);
    }, (err: any) => {
      console.error(`Subscription error for ${collectionName}:`, err);
    });
  }
};
