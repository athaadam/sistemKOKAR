const KEY = 'sikokar_token';

export const saveToken = (token: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(KEY, token);
  }
};

export const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(KEY);
  }
  return null;
};

export const clearToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(KEY);
  }
};
