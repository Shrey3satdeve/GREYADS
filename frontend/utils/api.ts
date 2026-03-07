import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || '') + '/api';

async function getHeaders(withToken = true): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (withToken) {
    const token = await AsyncStorage.getItem('greyads_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse(res: Response) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Request failed (${res.status})` }));
    throw new Error(err.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  get: async (path: string) => {
    const headers = await getHeaders();
    const res = await fetch(`${BASE_URL}${path}`, { headers });
    return handleResponse(res);
  },
  post: async (path: string, body?: unknown, withToken = true) => {
    const headers = await getHeaders(withToken);
    const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
    return handleResponse(res);
  },
  delete: async (path: string) => {
    const headers = await getHeaders();
    const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE', headers });
    return handleResponse(res);
  },
};
