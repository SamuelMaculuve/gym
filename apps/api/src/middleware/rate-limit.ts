import rateLimit from 'express-rate-limit';

const message = (text: string) => ({ error: { code: 'RATE_LIMITED', message: text } });

/** Limite global por IP. */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: message('Demasiados pedidos. Aguarde um momento.'),
});

/** Protecção contra força bruta no login e recuperação de conta. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: message('Demasiadas tentativas. Tente novamente dentro de 15 minutos.'),
});

/** Endpoints públicos (links de pagamento). */
export const publicLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: message('Demasiados pedidos.'),
});
