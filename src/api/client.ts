import type {
  AnnoncesResponse,
  BackupResponse,
  ClassementResponse,
  CloseSessionResponse,
  CreateMemberResponse,
  CreateRetraitResponse,
  CreateSessionResponse,
  LoginResponse,
  MeResponse,
  MembersResponse,
  PingResponse,
  ReglagesResponse,
  ReleveResponse,
  ResetPasswordResponse,
  RetraitsResponse,
  SaveVersementResponse,
  SessionDetailResponse,
  SessionsResponse,
} from './types';

/**
 * URL de l'API, sans slash final. Vide = mode démonstration (localStorage).
 *
 * Exemple : VITE_API_URL="https://tontine.exemple.tld/api"
 */
export const API_URL = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');

/** `true` dès qu'une API est configurée : le front cesse d'utiliser la démo locale. */
export const isApiMode = API_URL.length > 0;

const TOKEN_KEY = 'tontine-menoje:v1:token';
const REQUEST_TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  readonly status: number;
  readonly details?: Record<string, string>;

  constructor(message: string, status: number, details?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/** Message lisible pour n'importe quelle erreur (réseau, API, inconnue). */
export const errorMessage = (error: unknown): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) {
    return "Impossible de joindre le serveur. Vérifiez votre connexion internet.";
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Une erreur inattendue est survenue.';
};

export const getToken = (): string | null => {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token: string | null): void => {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Stockage indisponible (navigation privée) : la session reste en mémoire.
  }
};

export const clearToken = (): void => setToken(null);

/** Événement émis quand le serveur rejette le jeton (401). */
export const UNAUTHORIZED_EVENT = 'tontine:unauthorized';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
}

const parseFilename = (disposition: string | null, fallback: string): string => {
  if (!disposition) return fallback;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8?.[1]) return decodeURIComponent(utf8[1]);
  const simple = /filename="?([^";]+)"?/i.exec(disposition);
  return simple?.[1] ?? fallback;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
  const token = auth ? getToken() : null;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('Le serveur met trop de temps à répondre. Réessayez.', 0);
    }
    throw new ApiError(
      "Impossible de joindre le serveur. Vérifiez votre connexion internet.",
      0
    );
  } finally {
    window.clearTimeout(timer);
  }

  if (response.status === 401 && auth) {
    clearToken();
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  const payload: unknown = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '');

  if (!response.ok) {
    const record = (payload ?? {}) as { error?: unknown; details?: unknown };
    const message =
      typeof record.error === 'string' && record.error
        ? record.error
        : `Erreur serveur (${response.status}).`;
    const details =
      record.details && typeof record.details === 'object'
        ? (record.details as Record<string, string>)
        : undefined;
    throw new ApiError(message, response.status, details);
  }

  return payload as T;
}

/** Télécharge un fichier protégé par le jeton (export JSON ou CSV). */
async function download(path: string, fallbackName: string): Promise<void> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).catch(() => {
    throw new ApiError("Impossible de joindre le serveur. Vérifiez votre connexion internet.", 0);
  });

  if (response.status === 401) {
    clearToken();
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(payload?.error ?? `Erreur serveur (${response.status}).`, response.status);
  }

  const blob = await response.blob();
  const filename = parseFilename(response.headers.get('content-disposition'), fallbackName);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const today = () => new Date().toISOString().slice(0, 10);

export const api = {
  ping: () => request<PingResponse>('/ping', { auth: false }),

  login: (telephone: string, password: string) =>
    request<LoginResponse>('/login', {
      method: 'POST',
      auth: false,
      body: { telephone, password },
    }),

  logout: () => request<{ ok: boolean }>('/logout', { method: 'POST' }),

  changePassword: (ancien: string, nouveau: string) =>
    request<{ ok: boolean }>('/change-password', {
      method: 'POST',
      body: { ancien, nouveau },
    }),

  me: () => request<MeResponse>('/me'),

  releve: () => request<ReleveResponse>('/me/releve'),

  classement: () => request<ClassementResponse>('/classement'),

  annonces: () => request<AnnoncesResponse>('/annonces'),

  reglages: () => request<ReglagesResponse>('/reglages'),

  updateReglages: (patch: {
    tauxRetenue?: number;
    nomEglise?: string;
    devise?: string;
    afficherMontantsClassement?: boolean;
  }) => request<ReglagesResponse>('/reglages', { method: 'PUT', body: patch }),

  members: () => request<MembersResponse>('/members'),

  createMember: (payload: { nom: string; telephone: string; motDePasse?: string }) =>
    request<CreateMemberResponse>('/members', { method: 'POST', body: payload }),

  updateMember: (id: number, payload: { nom?: string; telephone?: string }) =>
    request<{ member: unknown }>(`/members/${id}`, { method: 'PUT', body: payload }),

  resetMemberPassword: (id: number, motDePasse?: string) =>
    request<ResetPasswordResponse>(`/members/${id}/reset-password`, {
      method: 'POST',
      body: motDePasse ? { motDePasse } : {},
    }),

  setMemberActive: (id: number, actif: boolean) =>
    request<{ member: unknown }>(`/members/${id}/active`, {
      method: 'PATCH',
      body: { actif },
    }),

  sessions: () => request<SessionsResponse>('/sessions'),

  createSession: (date: string) =>
    request<CreateSessionResponse>('/sessions', { method: 'POST', body: { date } }),

  session: (id: number) => request<SessionDetailResponse>(`/sessions/${id}`),

  saveVersement: (sessionId: number, userId: number, montant: number) =>
    request<SaveVersementResponse>(`/sessions/${sessionId}/versements`, {
      method: 'PUT',
      body: { userId, montant },
    }),

  closeSession: (id: number) =>
    request<CloseSessionResponse>(`/sessions/${id}/close`, { method: 'POST', body: {} }),

  reopenSession: (id: number) =>
    request<{ ok: boolean }>(`/sessions/${id}/reopen`, { method: 'POST', body: {} }),

  retraits: () => request<RetraitsResponse>('/retraits'),

  createRetrait: (payload: {
    userId: number;
    montant: number;
    motif?: string;
    date?: string;
  }) => request<CreateRetraitResponse>('/retraits', { method: 'POST', body: payload }),

  deleteRetrait: (id: number) =>
    request<{ ok: boolean }>(`/retraits/${id}`, { method: 'DELETE' }),

  createAnnonce: (payload: { titre: string; contenu: string }) =>
    request<{ annonce: unknown }>('/annonces', { method: 'POST', body: payload }),

  deleteAnnonce: (id: number) =>
    request<{ ok: boolean }>(`/annonces/${id}`, { method: 'DELETE' }),

  backup: () => request<BackupResponse>('/export/backup'),

  downloadBackup: () => download('/export/backup', `tontine-menoje-backup-${today()}.json`),

  downloadCsv: () => download('/export/csv', `tontine-menoje-operations-${today()}.csv`),
};
