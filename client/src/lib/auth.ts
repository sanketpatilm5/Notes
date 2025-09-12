export interface JWTPayload {
  userId: string;
  email: string;
  role: 'admin' | 'member';
  tenantId: string;
  tenantSlug: string;
  exp?: number; // JWT expiration timestamp
}

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};

export const setToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('token', token);
};

export const removeToken = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
};

export const decodeToken = (token: string): JWTPayload | null => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch {
    return null;
  }
};

export const isTokenValid = (token: string): boolean => {
  try {
    const payload = decodeToken(token);
    if (!payload) return false;
    
    const now = Math.floor(Date.now() / 1000);
    return payload.exp ? payload.exp > now : false;
  } catch {
    return false;
  }
};

export const getCurrentUser = (): JWTPayload | null => {
  const token = getToken();
  if (!token || !isTokenValid(token)) {
    removeToken();
    return null;
  }
  return decodeToken(token);
};
