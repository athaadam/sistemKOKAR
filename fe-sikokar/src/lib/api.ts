import { getToken, saveToken, clearToken } from './auth';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

export type ApiResult<T = unknown> = {
  success?: boolean;
  ok?: boolean;
  message?: string;
  data?: T;
  user?: User;
  token?: string;
  [key: string]: unknown;
};

export type User = {
  id: string;
  username: string;
  name: string;
  role: string;
  nip?: string;
  lokasi_id?: string | null;
  custom_menus?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers = { Accept: 'application/json', ...(init?.headers || {}) };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API}${path}`, {
    headers,
    ...init,
  });
  const json = (await res.json().catch(() => ({}))) as ApiResult<T>;

  if (res.status === 401) {
    clearToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error(json.message || 'Session expired');
  }

  if (!res.ok) {
    throw new Error(json.message || `HTTP ${res.status}`);
  }
  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', body: form }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  exportUrl: (path: string) => `${API}${path}`,
};

export async function getMe(): Promise<User | null> {
  try {
    const r = await api.get<ApiResult & { user: User }>('/auth/me');
    return r.user || null;
  } catch {
    return null;
  }
}

export async function login(username: string, password: string) {
  const result = await api.post<ApiResult & { user: User; token: string }>('/auth/login', { username, password });
  if (result.token) {
    saveToken(result.token);
  }
  return result;
}

export async function logout() {
  try {
    await api.post('/auth/logout');
  } catch {
    // ignore error on logout
  } finally {
    clearToken();
  }
}
