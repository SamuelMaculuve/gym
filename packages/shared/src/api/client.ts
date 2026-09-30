import type { ApiErrorBody } from '../types';

/**
 * Armazenamento do token de sessão. No web usa localStorage;
 * no Expo pode ser implementado com expo-secure-store.
 */
export interface TokenStorage {
  get(): string | null | Promise<string | null>;
  set(token: string | null): void | Promise<void>;
}

export interface ApiClientOptions {
  baseUrl: string;
  storage: TokenStorage;
  /** Chamado quando a API responde 401 (sessão expirada/revogada). */
  onUnauthorized?: () => void;
  fetch?: typeof fetch;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export interface ApiClient {
  request<T>(method: string, path: string, options?: { body?: unknown; query?: QueryParams; auth?: boolean }): Promise<T>;
  get<T>(path: string, query?: QueryParams): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
  storage: TokenStorage;
}

function buildQuery(query?: QueryParams): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const doFetch = options.fetch ?? fetch.bind(globalThis);
  const baseUrl = options.baseUrl.replace(/\/$/, '');

  async function request<T>(method: string, path: string, opts: { body?: unknown; query?: QueryParams; auth?: boolean } = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.auth !== false) {
      const token = await options.storage.get();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    let res: Response;
    try {
      res = await doFetch(`${baseUrl}${path}${buildQuery(opts.query)}`, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch {
      throw new ApiError(0, 'NETWORK_ERROR', 'Não foi possível contactar o servidor. Verifique a ligação.');
    }

    if (res.status === 204) return undefined as T;
    const data = (await res.json().catch(() => null)) as unknown;

    if (!res.ok) {
      const body = data as ApiErrorBody | null;
      if (res.status === 401 && opts.auth !== false) {
        await options.storage.set(null);
        options.onUnauthorized?.();
      }
      throw new ApiError(
        res.status,
        body?.error?.code ?? 'HTTP_ERROR',
        body?.error?.message ?? `Erro inesperado (${res.status})`,
        body?.error?.details,
      );
    }
    return data as T;
  }

  return {
    request,
    get: (path, query) => request('GET', path, { query }),
    post: (path, body) => request('POST', path, { body: body ?? {} }),
    put: (path, body) => request('PUT', path, { body: body ?? {} }),
    patch: (path, body) => request('PATCH', path, { body: body ?? {} }),
    delete: (path) => request('DELETE', path),
    storage: options.storage,
  };
}
