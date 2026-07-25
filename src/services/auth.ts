import { API_URL, LOGIN_URL } from '@/lib/config';
import type { User } from '@/lib/types';

interface MeResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

// Returns the logged-in user, or null when the session cookie is missing/expired.
// Runs from the side panel: host_permissions on the API origin exempts the
// request from CORS and includes the Access_Token cookie.
export async function getMe(): Promise<User | null> {
  const res = await fetch(`${API_URL}/me`, { credentials: 'include' });
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new Error(`GET /me failed: ${res.status}`);
  const user = (await res.json()) as MeResponse;
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

export function openLogin(): void {
  browser.tabs.create({ url: LOGIN_URL });
}
