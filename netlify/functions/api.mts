/**
 * API do GymFlow como Netlify Function. Servida em /api/* (ver redirect em netlify.toml),
 * no mesmo domínio do site — sem CORS nem VITE_API_URL em produção.
 * Base de dados: DATABASE_URL; sem ela, corre em modo demonstração (Postgres em memória, ver lib/prisma.ts).
 */
import serverless from 'serverless-http';
import { createApp } from '../../apps/api/src/app';

export const handler = serverless(createApp());
