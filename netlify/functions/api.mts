/**
 * API do GymFlow como Netlify Function. Servida em /api/* (ver redirect em netlify.toml),
 * no mesmo domínio do site — sem CORS nem VITE_API_URL em produção.
 * A base de dados é a Netlify Database (NETLIFY_DB_URL, injectada automaticamente).
 */
import serverless from 'serverless-http';
import { createApp } from '../../apps/api/src/app';

export const handler = serverless(createApp());
