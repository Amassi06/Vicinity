export type AuthUser = {
  sub: string;
  email: string;
  displayName: string;
  role: string;
  neighbourhoodId: string | null;
  neighbourhoodName: string | null;
};

let accessToken = sessionStorage.getItem('vicinity_access') ?? '';

export function getAccessToken(): string {
  return accessToken;
}

/** Seul point d'accès au refresh token : les clés de stockage restent privées à ce module. */
export function getRefreshToken(): string | null {
  return sessionStorage.getItem('vicinity_refresh');
}

export function setTokens(access: string, refresh?: string): void {
  accessToken = access;
  sessionStorage.setItem('vicinity_access', access);
  if (refresh !== undefined) {
    sessionStorage.setItem('vicinity_refresh', refresh);
  }
}

export function logout(): void {
  accessToken = '';
  sessionStorage.removeItem('vicinity_access');
  sessionStorage.removeItem('vicinity_refresh');
  // Le quartier actif est propre à l'utilisateur connecté : ne pas le faire
  // fuiter vers le prochain compte qui se connecte dans le même onglet.
  sessionStorage.removeItem('vicinity_selected_neighbourhood');
}

/** Télécharge une ressource binaire authentifiée (pièce jointe) en object URL. */
export async function apiFetchObjectUrl(path: string): Promise<string> {
  const res = await fetch(`/api${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`fetch_failed_${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** Upload multipart authentifié (pièce jointe de message). */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const msg =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: string }).error)
        : `${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (init?.json !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`/api${path}`, {
    ...init,
    headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    throw new Error(`Réponse invalide (${res.status})`);
  }
  if (!res.ok) {
    const msg =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: string }).error)
        : `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return data as T;
}

export type AuthTokensResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    displayName?: string;
    role: string;
    mfaEnabled?: boolean;
  };
};

export async function authPostJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const msg =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: string }).error)
        : res.statusText;
    throw new Error(msg);
  }
  return data as T;
}
