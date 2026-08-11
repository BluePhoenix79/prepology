/**
 * Google sign-in via Google Identity Services (GIS).
 *
 * SCOPE AND LIMITS — read before relying on this for anything protective.
 * Prepology is a static client-side app with no backend, so the ID token
 * Google returns is decoded in the browser and never verified against
 * Google's public keys. Anyone can forge the stored session by editing
 * localStorage. That is acceptable here because the identity is used only to
 * label the profile and to namespace locally-stored progress — it is NOT an
 * authorisation boundary and must not become one. The moment real data lives
 * server-side, the token has to be sent to a server and verified there.
 *
 * Configure with VITE_GOOGLE_CLIENT_ID (see .env.example). With no client ID
 * the app runs exactly as before and the UI explains what is missing rather
 * than showing a button that cannot work.
 */

const SESSION_KEY = 'prepology_auth';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

export interface AuthUser {
  sub: string;      // Google's stable account id
  name: string;
  email: string;
  picture: string;
}

type AuthListener = (user: AuthUser | null) => void;

const listeners: AuthListener[] = [];
let cachedUser: AuthUser | null | undefined;
let gisPromise: Promise<boolean> | null = null;

export function getClientId(): string {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || '';
}

export function isConfigured(): boolean {
  return getClientId().length > 0;
}

/* ── Session ───────────────────────────────────────────────── */

export function getUser(): AuthUser | null {
  if (cachedUser !== undefined) return cachedUser;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const parsed = raw ? (JSON.parse(raw) as AuthUser) : null;
    cachedUser = parsed && typeof parsed.sub === 'string' ? parsed : null;
  } catch {
    cachedUser = null;
  }
  return cachedUser;
}

function setUser(user: AuthUser | null) {
  cachedUser = user;
  try {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable — session lasts for this page only */
  }
  listeners.forEach(fn => fn(user));
}

export function onAuthChange(fn: AuthListener): () => void {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export function signOut() {
  const id = (window as any).google?.accounts?.id;
  id?.disableAutoSelect?.();
  setUser(null);
}

/**
 * Storage keys are namespaced per account so two people sharing a browser
 * don't read each other's progress. Signed out keeps the original key, which
 * is what makes this backwards compatible with existing saved state.
 */
export function scopedKey(base: string): string {
  const user = getUser();
  return user ? `${base}__u_${user.sub}` : base;
}

/**
 * On a first sign-in, carry whatever was practised anonymously into the new
 * account rather than presenting an empty dashboard. Only fills namespaces
 * that are still empty, so signing back in later never overwrites real
 * account progress with whatever a guest did in the meantime.
 */
export function adoptAnonymousData(baseKeys: string[]): void {
  const user = getUser();
  if (!user) return;
  for (const base of baseKeys) {
    try {
      const target = `${base}__u_${user.sub}`;
      if (localStorage.getItem(target) !== null) continue;
      const anon = localStorage.getItem(base);
      if (anon !== null) localStorage.setItem(target, anon);
    } catch {
      /* quota or unavailable — skip this key */
    }
  }
}

/** Storage bases that follow the signed-in account. */
export const SCOPED_KEYS = [
  'prepology_state',
  'prepology_vocab_bookmarks',
  'prepology_vocab_srs',
];

/* ── Token handling ────────────────────────────────────────── */

/** Decode a JWT payload. Presentation only — this proves nothing about authenticity. */
function decodeIdToken(token: string): AuthUser | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    const claims = JSON.parse(json);
    if (!claims.sub) return null;
    return {
      sub: String(claims.sub),
      name: String(claims.name || claims.email || 'Student'),
      email: String(claims.email || ''),
      picture: String(claims.picture || ''),
    };
  } catch {
    return null;
  }
}

/** Exposed so the decoder can be exercised without loading Google's script. */
export const __testing = { decodeIdToken };

/* ── Google Identity Services ──────────────────────────────── */

function loadGisScript(): Promise<boolean> {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<boolean>(resolve => {
    if ((window as any).google?.accounts?.id) return resolve(true);
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(!!(window as any).google?.accounts?.id);
    script.onerror = () => resolve(false); // offline or blocked — stay signed out
    document.head.appendChild(script);
  });
  return gisPromise;
}

let initialised = false;

/** Load and initialise GIS. Resolves false when unconfigured or unreachable. */
export async function initGoogleAuth(): Promise<boolean> {
  if (!isConfigured()) return false;
  const ok = await loadGisScript();
  if (!ok) return false;
  if (initialised) return true;

  (window as any).google.accounts.id.initialize({
    client_id: getClientId(),
    callback: (response: { credential?: string }) => {
      const user = response.credential ? decodeIdToken(response.credential) : null;
      if (user) setUser(user);
    },
    auto_select: false,
    cancel_on_tap_outside: true,
  });
  initialised = true;
  return true;
}

/** Draw Google's own sign-in button into `container`. */
export async function renderGoogleButton(container: HTMLElement): Promise<boolean> {
  const ready = await initGoogleAuth();
  if (!ready) return false;
  container.innerHTML = '';
  (window as any).google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'outline' : 'filled_black',
    size: 'large',
    text: 'signin_with',
    shape: 'pill',
    logo_alignment: 'left',
    width: 240,
  });
  return true;
}
