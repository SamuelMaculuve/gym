import { createApiClient, createGymApi, type TokenStorage } from '@gymflow/shared';

const TOKEN_KEY = 'gymflow.session';

/** Armazenamento do token no browser. No Expo será substituído por SecureStore. */
export const tokenStorage: TokenStorage = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token) => {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* armazenamento indisponível */
    }
  },
};

let unauthorizedHandler: (() => void) | null = null;
export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler;
}

export const http = createApiClient({
  // Vazio = mesmo domínio (/api), que é o caso na Netlify e no `npm run dev` (proxy do Vite).
  baseUrl: import.meta.env.VITE_API_URL ?? '',
  storage: tokenStorage,
  onUnauthorized: () => unauthorizedHandler?.(),
});

export const api = createGymApi(http);
