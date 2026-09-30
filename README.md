# GymFlow — Gestão de ginásio

Aplicação web para gerir **membros, planos, subscrições, pagamentos, lembretes (WhatsApp/Email/SMS), presenças e relatórios** de um ginásio. A arquitectura está preparada para uma futura app **Expo/React Native**.

- Arquitectura, modelo de dados e fluxos: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend (`apps/web`) | React 19, TypeScript, Vite, Tailwind CSS 4, React Router 7, TanStack Query, React Hook Form + Zod, Recharts, Lucide |
| API (`apps/api`) | Node.js, Express 5, Prisma, Zod, bcrypt, node-cron, Nodemailer |
| Partilhado (`packages/shared`) | Tipos, schemas Zod, regras de negócio puras e cliente HTTP (reutilizável no Expo) |
| Base de dados | SQLite (desenvolvimento) · PostgreSQL (produção) |

## Início rápido

Requisitos: Node.js 20 ou superior.

```bash
npm install
cp .env.example apps/api/.env        # ajuste os valores se necessário
cp apps/web/.env.example apps/web/.env
npm run db:setup                     # cria a base de dados e carrega os dados de demonstração
npm run dev                          # API em :4000 e web em :5173
```

Abra http://localhost:5173.

### Contas de demonstração

| Perfil | Email | Palavra-passe |
|---|---|---|
| Administrador | admin@gymflow.co.mz | Admin@2026 |
| Gestor | gestor@gymflow.co.mz | Gestor@2026 |
| Recepcionista | recepcao@gymflow.co.mz | Recepcao@2026 |
| Contabilista | contabilidade@gymflow.co.mz | Conta@2026 |

O seed cria 20 membros, 4 planos activos (e 1 inactivo), cerca de 90 pagamentos (incluindo um estorno), subscrições activas, a vencer, em atraso, expiradas e suspensas, cerca de 480 presenças e o histórico de notificações. As datas são relativas ao dia actual, por isso o dashboard aparece sempre preenchido.

### Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | API e web em modo de desenvolvimento |
| `npm run build` | Build de produção do frontend (`apps/web/dist`) |
| `npm run build:api` | Bundle de produção da API (`apps/api/dist/server.js`) |
| `npm run db:setup` | Cria o schema e carrega os dados de demonstração |
| `npm run db:reset` | Apaga todos os dados e volta a semear |
| `npm run typecheck` | Verificação de tipos em todos os pacotes |
| `npm test -w @gymflow/shared` | Testes das regras de negócio (estados, lembretes) |
| `npm run reminders:run -w @gymflow/api -- --force` | Executa o motor de lembretes uma vez |

## Funcionalidades

- **Dashboard**: indicadores, receita dos últimos 6/12 meses, estado das subscrições e dos pagamentos, "Acções necessárias", alertas clicáveis e frequência dos membros.
- **Membros** (`/members`): pesquisa, filtros (activos, inactivos, em dia, em atraso, vence hoje, vence em 7 dias, plano), ordenação, exportação e página de detalhe com o histórico de pagamentos, subscrições, notificações e presenças.
- **Inscrição rápida**: novo membro → plano (o vencimento é calculado automaticamente) → pagamento → QR Code, tudo num único painel.
- **Planos** (`/plans`): preço, duração e estado, configuráveis pelo administrador.
- **Subscrições** (`/subscriptions`): estado calculado automaticamente (Activa, A vencer, Em atraso, Expirada, Suspensa, Cancelada). Permite suspender, reactivar, cancelar e pausar lembretes.
- **Pagamentos** (`/payments`): Dinheiro, M-Pesa, e-Mola, transferência, cartão ou outro. Ao registar um pagamento o sistema renova o período, emite o número de recibo, regista quem recebeu e pode enviar confirmação ao membro. Os pagamentos nunca são apagados: cancelam-se ou estornam-se.
- **Lembretes automáticos**: 7, 3 e 1 dia antes do vencimento, no próprio dia, 1, 7 e 14 dias depois e depois semanalmente. Tudo é configurável e não há envios duplicados.
- **Templates** (`/settings/notifications`): editor com variáveis `{{name}}`, `{{plan}}`, `{{amount}}`, `{{due_date}}`, `{{gym_name}}` e `{{payment_link}}`, com pré-visualização.
- **Presenças** (`/attendance`): check-in por QR Code (câmara ou leitor USB), código, telefone ou nome, com verificação da subscrição e opção de autorizar manualmente.
- **Relatórios** (`/reports`): financeiro (por dia, semana, mês, ano, plano e método de pagamento), membros e presenças, com exportação para CSV, Excel e PDF.
- **Pesquisa global** (`⌘K` / `Ctrl+K`): por nome, telefone, email, número de membro ou referência de pagamento.
- **Utilizadores e permissões**: perfis Administrador, Gestor, Recepcionista e Contabilista.
- **Auditoria** (`/audit`): quem fez o quê e quando, com os dados anteriores e os novos.
- **Link "Pagar agora"** (`/pay/:token`): página pública preparada para receber futuramente um gateway de pagamento (M-Pesa ou e-Mola).
- Modo claro e escuro, mobile first (navegação inferior e botão de acções rápidas no mobile).

## Regras de negócio principais

Estão em `packages/shared/src/domain` e têm testes:

1. Uma subscrição só fica **paga** quando existem pagamentos válidos que cobrem o seu valor. Chegar à data de vencimento nunca a marca como paga.
2. A partir do dia seguinte ao vencimento, sem pagamento, a subscrição passa a **Em atraso**. Depois de `expireAfterDays` (30 dias por omissão) passa a **Expirada**.
3. Na renovação, o novo período começa no dia seguinte ao fim do anterior. Se a subscrição já estiver expirada, começa no dia do pagamento.
4. Os lembretes são deduplicados pela chave `subscrição:tipo:limiar:canal`, que é única na base de dados.
5. As datas de calendário são sempre calculadas no fuso horário configurado pelo ginásio.

## Deployment

### Frontend na Netlify

O ficheiro `netlify.toml` já define:

- comando de build: `npm ci && npm run build`
- directório publicado: `apps/web/dist`
- redireccionamento SPA (`/*` para `/index.html`) e cabeçalhos de segurança

Nas variáveis de ambiente do site, defina `VITE_API_URL` com o URL público da API, por exemplo `https://api.seuginasio.co.mz`.

### API (Render, Railway, Fly.io, VPS…)

1. Use PostgreSQL: em `apps/api/prisma/schema.prisma` altere `provider = "sqlite"` para `"postgresql"` e defina `DATABASE_URL`.
2. Build: `npm ci && npm run build:api`. Arranque: `npm start -w @gymflow/api`.
3. Crie o schema com `npx prisma migrate deploy` (ou `prisma db push` na primeira instalação).
4. Variáveis obrigatórias:
   - `CORS_ORIGIN`: o domínio da Netlify
   - `PUBLIC_APP_URL`: o mesmo domínio, usado nos links de pagamento e de recuperação de conta
   - `CRON_SECRET`: 24 ou mais caracteres
   - `TRUST_PROXY=true`, se a API estiver atrás de um proxy
5. **Lembretes**: com `REMINDERS_CRON_ENABLED=true` correm dentro do processo, a cada hora. Em plataformas sem processo persistente, chame `POST /api/cron/reminders` com o cabeçalho `x-cron-secret`.

### WhatsApp em produção

Configure `WHATSAPP_PROVIDER=meta`, `WHATSAPP_ACCESS_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID`. A Meta só permite mensagens de texto livre dentro da janela de 24 horas de conversa. Para lembretes enviados por iniciativa do ginásio é preciso ter **templates aprovados** no WhatsApp Manager. Para os usar, adapte `MetaWhatsAppProvider` (em `apps/api/src/services/notifications/providers`) para enviar `type: "template"`. Para trocar de fornecedor (360dialog, Twilio…) basta implementar a interface `NotificationProvider`.

Em desenvolvimento, os três canais usam o fornecedor `console`, que mostra as mensagens no terminal da API e as regista no histórico.

## Segurança

- Palavras-passe guardadas com bcrypt. As sessões usam tokens opacos de 256 bits, dos quais só o hash SHA-256 fica na base de dados, com expiração e revogação.
- Permissões por perfil definidas num único ficheiro (`packages/shared/src/constants/roles.ts`) e aplicadas em cada rota da API.
- Helmet, CORS restrito, limite de pedidos global (300 por minuto) e no login (10 tentativas falhadas em 15 minutos).
- Validação Zod no frontend e na API, com os mesmos schemas.
- Credenciais só em variáveis de ambiente da API. O browser recebe apenas `VITE_API_URL`.
- Os QR Codes contêm apenas um identificador aleatório, que pode ser regenerado.

## Preparação para mobile (Expo)

```ts
import { createApiClient, createGymApi } from '@gymflow/shared';
import * as SecureStore from 'expo-secure-store';

const api = createGymApi(
  createApiClient({
    baseUrl: 'https://api.seuginasio.co.mz',
    storage: {
      get: () => SecureStore.getItemAsync('session'),
      set: (t) => (t ? SecureStore.setItemAsync('session', t) : SecureStore.deleteItemAsync('session')),
    },
  }),
);
```

Os schemas, as regras de negócio, os tipos e o cliente HTTP são os mesmos do web. A app do membro poderá usar novas rotas (`/api/member-app/*`) com autenticação própria.
