import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { authenticate } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import { apiLimiter } from './middleware/rate-limit';
import { attendanceRouter } from './modules/attendance/routes';
import { auditRouter } from './modules/audit/routes';
import { authRouter } from './modules/auth/routes';
import { dashboardRouter } from './modules/dashboard/routes';
import { membersRouter } from './modules/members/routes';
import { notificationsRouter } from './modules/notifications/routes';
import { paymentsRouter } from './modules/payments/routes';
import { plansRouter } from './modules/plans/routes';
import { publicRouter } from './modules/public/routes';
import { reportsRouter } from './modules/reports/routes';
import { searchRouter } from './modules/search/routes';
import { settingsRouter } from './modules/settings/routes';
import { subscriptionsRouter } from './modules/subscriptions/routes';
import { usersRouter } from './modules/users/routes';

export function createApp() {
  const app = express();
  if (env.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  const origins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  app.use(cors({ origin: origins, allowedHeaders: ['Content-Type', 'Authorization'], maxAge: 600 }));
  app.use(express.json({ limit: '600kb' }));
  app.use('/api', apiLimiter);

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  // Rotas públicas
  app.use('/api/auth', authRouter);
  app.use('/api', publicRouter);

  // Rotas autenticadas
  const secured = express.Router();
  secured.use(authenticate);
  secured.use('/dashboard', dashboardRouter);
  secured.use('/search', searchRouter);
  secured.use('/members', membersRouter);
  secured.use('/plans', plansRouter);
  secured.use('/subscriptions', subscriptionsRouter);
  secured.use('/payments', paymentsRouter);
  secured.use('/attendance', attendanceRouter);
  secured.use('/notifications', notificationsRouter);
  secured.use('/reports', reportsRouter);
  secured.use('/users', usersRouter);
  secured.use('/settings', settingsRouter);
  secured.use('/audit', auditRouter);
  app.use('/api', secured);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
