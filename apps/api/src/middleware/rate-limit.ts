import type { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const message = (text: string) => ({ error: { code: 'RATE_LIMITED', message: text } });

/**
 * IP do cliente. Na Netlify vem no cabeçalho x-nf-client-connection-ip (definido pelo CDN,
 * não pelo cliente). Nota: em serverless o contador é por instância da função — para limites
 * globais estritos use um armazenamento partilhado (ex.: Netlify Blobs ou Redis).
 */
function clientKey(req: Request): string {
  const netlifyIp = req.get('x-nf-client-connection-ip');
  return ipKeyGenerator(netlifyIp || req.ip || 'unknown');
}

const common = {
  standardHeaders: 'draft-8' as const,
  legacyHeaders: false,
  keyGenerator: clientKey,
  // A chave é calculada acima; desactiva a validação de "trust proxy" permissivo.
  validate: { trustProxy: false, xForwardedForHeader: false },
};

/** Limite global por IP. */
export const apiLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 300, message: message('Demasiados pedidos. Aguarde um momento.') });

/** Protecção contra força bruta no login, recuperação e configuração inicial. */
export const authLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60_000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: message('Demasiadas tentativas. Tente novamente dentro de 15 minutos.'),
});

/** Endpoints públicos (links de pagamento). */
export const publicLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 30, message: message('Demasiados pedidos.') });
