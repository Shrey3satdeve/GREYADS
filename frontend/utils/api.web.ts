import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_USER_KEY = 'greyads_user';

type EventRecord = {
  id: string;
  title: string;
  description: string;
  date: string;
  venue: string;
  cover_image_url: string;
  category: string;
  price: number;
  total_tickets: number;
  available_tickets: number;
  status: string;
  is_recommended?: boolean;
};

type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'staff' | 'admin';
  phone?: string;
  created_at: string;
};

type TicketRecord = {
  id: string;
  user_id: string;
  user_name: string;
  event_id: string;
  event_title: string;
  event_category: string;
  quantity: number;
  total_price: number;
  status: string;
  booking_ref: string;
  qr_token: string;
  created_at: string;
};

type BroadcastRecord = {
  id: string;
  title: string;
  message: string;
  created_at: string;
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const nowIso = () => new Date().toISOString();

let events: EventRecord[] = [
  {
    id: 'test-event-id',
    title: 'Neon Dreams Music Festival',
    description: 'A high-energy night of live music, visuals, and curated performances.',
    date: '2026-05-16T19:30:00.000Z',
    venue: 'BKC Grounds, Mumbai',
    cover_image_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&q=80',
    category: 'Music',
    price: 999,
    total_tickets: 500,
    available_tickets: 173,
    status: 'upcoming',
    is_recommended: true,
  },
  {
    id: 'tech-summit-2026',
    title: 'Tech Summit 2026',
    description: 'Founder talks, product showcases, and future-of-AI panels.',
    date: '2026-05-24T09:00:00.000Z',
    venue: 'Jio Convention Centre, Mumbai',
    cover_image_url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&q=80',
    category: 'Technology',
    price: 1499,
    total_tickets: 320,
    available_tickets: 114,
    status: 'upcoming',
  },
  {
    id: 'business-forum-2026',
    title: 'Business Growth Forum',
    description: 'Operator-led sessions on scaling, marketing, and partnerships.',
    date: '2026-06-02T10:00:00.000Z',
    venue: 'The St. Regis, Mumbai',
    cover_image_url: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&q=80',
    category: 'Business',
    price: 799,
    total_tickets: 220,
    available_tickets: 91,
    status: 'upcoming',
  },
];

let users: UserRecord[] = [
  { id: 'admin-1', name: 'Sarah Admin', email: 'admin@greyads.com', role: 'admin', created_at: nowIso() },
  { id: 'staff-1', name: 'Rohan Staff', email: 'staff@greyads.com', role: 'staff', created_at: nowIso() },
  { id: 'user-1', name: 'Aarav User', email: 'aarav@example.com', role: 'user', created_at: nowIso() },
  { id: 'user-2', name: 'Naina User', email: 'naina@example.com', role: 'user', created_at: nowIso() },
];

let tickets: TicketRecord[] = [
  {
    id: 'ticket-1001',
    user_id: 'user-1',
    user_name: 'Aarav User',
    event_id: 'test-event-id',
    event_title: 'Neon Dreams Music Festival',
    event_category: 'Music',
    quantity: 2,
    total_price: 1998,
    status: 'valid',
    booking_ref: 'GA-1001',
    qr_token: 'qr-ticket-1001',
    created_at: nowIso(),
  },
  {
    id: 'ticket-1002',
    user_id: 'user-2',
    user_name: 'Naina User',
    event_id: 'tech-summit-2026',
    event_title: 'Tech Summit 2026',
    event_category: 'Technology',
    quantity: 1,
    total_price: 1499,
    status: 'inside',
    booking_ref: 'GA-1002',
    qr_token: 'qr-ticket-1002',
    created_at: nowIso(),
  },
];

let broadcasts: BroadcastRecord[] = [
  {
    id: 'broadcast-1',
    title: 'Weekend Drop',
    message: 'New premium events are live for booking.',
    created_at: nowIso(),
  },
];

const subscribers = new Map<string, Set<(items: any[]) => void>>();

function getCollectionSnapshot(collectionName: string) {
  if (collectionName === 'events') return clone(events);
  if (collectionName === 'users') return clone(users);
  if (collectionName === 'tickets') return clone(tickets);
  if (collectionName === 'broadcasts') return clone(broadcasts);
  return [];
}

function notify(collectionName: string) {
  const listeners = subscribers.get(collectionName);
  if (!listeners?.size) return;
  const payload = getCollectionSnapshot(collectionName);
  listeners.forEach((listener) => listener(payload));
}

async function getStoredUser() {
  const raw = await AsyncStorage.getItem(STORAGE_USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

function filterEvents(path: string) {
  const [, queryString = ''] = path.split('?');
  const params = new URLSearchParams(queryString);
  const category = params.get('category');
  const search = params.get('search')?.toLowerCase();

  return events.filter((event) => {
    if (category && category !== 'All' && event.category !== category) return false;
    if (!search) return true;
    return [event.title, event.venue, event.category].some((value) =>
      value.toLowerCase().includes(search)
    );
  });
}

export const api = {
  get: async (path: string): Promise<any> => {
    if (path === '/events' || path.startsWith('/events?')) {
      return { events: clone(filterEvents(path)) };
    }

    if (path.startsWith('/events/')) {
      const eventId = path.split('/')[2].split('?')[0];
      const event = events.find((item) => item.id === eventId) || events[0];
      return { event: clone(event) };
    }

    if (path === '/admin/users') {
      return { users: clone(users) };
    }

    if (path === '/tickets/my') {
      const currentUser = await getStoredUser();
      const myTickets = tickets.filter((ticket) => ticket.user_id === currentUser?.id);
      return { tickets: clone(myTickets) };
    }

    if (path === '/notifications/my') {
      return { notifications: [] };
    }

    if (path === '/auth/me') {
      return { user: await getStoredUser() };
    }

    if (path.startsWith('/payments/status/')) {
      return { status: 'COMPLETED', ticket_id: 'ticket-web-demo' };
    }

    if (path.startsWith('/admin/events/') && path.endsWith('/attendees')) {
      const eventId = path.split('/')[3];
      const attendees = tickets.filter((ticket) => ticket.event_id === eventId);
      return { attendees: clone(attendees) };
    }

    throw new Error(`Endpoint ${path} not implemented in web mock API.`);
  },

  post: async (path: string, body?: any): Promise<any> => {
    if (path === '/admin/broadcast') {
      const record: BroadcastRecord = {
        id: `broadcast-${Date.now()}`,
        title: body?.title || 'Untitled Broadcast',
        message: body?.message || '',
        created_at: nowIso(),
      };
      broadcasts = [record, ...broadcasts];
      notify('broadcasts');
      return { success: true };
    }

    if (path === '/events') {
      const record: EventRecord = {
        id: `event-${Date.now()}`,
        title: body?.title || 'Untitled Event',
        description: body?.description || '',
        date: body?.date || nowIso(),
        venue: body?.venue || 'TBD',
        cover_image_url: body?.cover_image_url || events[0].cover_image_url,
        category: body?.category || 'Music',
        price: Number(body?.price || 0),
        total_tickets: Number(body?.total_tickets || 100),
        available_tickets: Number(body?.total_tickets || 100),
        status: body?.status || 'upcoming',
      };
      events = [record, ...events];
      notify('events');
      return { event: clone(record) };
    }

    if (path === '/tickets/book') {
      const currentUser = await getStoredUser();
      const bookedEvent = events.find((item) => item.id === body?.event_id) || events[0];
      const quantity = Math.max(1, Number(body?.quantity || 1));
      const ticket: TicketRecord = {
        id: `ticket-${Date.now()}`,
        user_id: currentUser?.id || 'web-user',
        user_name: currentUser?.name || 'Web User',
        event_id: bookedEvent.id,
        event_title: bookedEvent.title,
        event_category: bookedEvent.category,
        quantity,
        total_price: bookedEvent.price * quantity,
        status: 'valid',
        booking_ref: `GA-${Date.now().toString().slice(-6)}`,
        qr_token: `qr-${Date.now()}`,
        created_at: nowIso(),
      };
      tickets = [ticket, ...tickets];
      notify('tickets');
      return { ticket: clone(ticket) };
    }

    throw new Error(`Endpoint ${path} not implemented in web mock API.`);
  },

  patch: async (path: string, body?: any): Promise<any> => {
    if (path === '/auth/me') {
      const currentUser = await getStoredUser();
      const nextUser = { ...currentUser, ...body };
      await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(nextUser));
      users = users.map((user) => (user.id === nextUser.id ? { ...user, ...body } : user));
      notify('users');
      return { user: clone(nextUser) };
    }

    if (path.startsWith('/events/')) {
      const eventId = path.split('/')[2];
      events = events.map((event) => (event.id === eventId ? { ...event, ...body } : event));
      notify('events');
      const updated = events.find((event) => event.id === eventId);
      return { event: clone(updated) };
    }

    if (path.startsWith('/notifications/') && path.endsWith('/read')) {
      return { success: true };
    }

    throw new Error(`Endpoint ${path} not implemented in web mock API.`);
  },

  delete: async (path: string): Promise<any> => {
    if (path.startsWith('/events/')) {
      const eventId = path.split('/')[2];
      events = events.filter((event) => event.id !== eventId);
      notify('events');
      return { success: true };
    }

    if (path.startsWith('/notifications/')) {
      return { success: true };
    }

    throw new Error(`Endpoint ${path} not implemented in web mock API.`);
  },

  subscribe: (collectionName: string, callback: (items: any[]) => void) => {
    const current = subscribers.get(collectionName) ?? new Set();
    current.add(callback);
    subscribers.set(collectionName, current);

    setTimeout(() => {
      callback(getCollectionSnapshot(collectionName));
    }, 0);

    return () => {
      const listeners = subscribers.get(collectionName);
      listeners?.delete(callback);
      if (listeners && listeners.size === 0) {
        subscribers.delete(collectionName);
      }
    };
  },
};
