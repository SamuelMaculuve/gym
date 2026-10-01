# GymFlow — Gestão de ginásio

Aplicação web para gerir **membros, planos, subscrições, pagamentos, lembretes (WhatsApp/Email/SMS), presenças e relatórios** de um ginásio. A arquitectura está preparada para uma futura app **Expo/React Native**.

- Arquitectura, modelo de dados e fluxos: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend (`apps/web`) | React 19, TypeScript, Vite, Tailwind CSS 4, React Router 7, TanStack Query, React Hook Form + Zod, Recharts, Lucide |
| API (`apps/api`) | Node.js, Express 5, Prisma (driver `pg`), Zod, bcrypt, Nodemailer — corre como Netlify Function |
| Partilhado (`packages/shared`) | Tipos, schemas Zod, regras de negócio puras e cliente HTTP (reutilizável no Expo) |
| Base de dados | Qualquer PostgreSQL (`DATABASE_URL`) · sem ela, **modo demonstração** em memória (PGlite) |

## Início rápido

Requisitos: Node.js 20 ou superior e PostgreSQL. Em alternativa ao PostgreSQL, pode usar o Netlify CLI, que traz uma base de dados local.

### Opção A — Netlify CLI (igual à produção)

```bash
npm install
npm install -g netlify-cli
netlify dev                                   # site + API (função) + Postgres local em http://localhost:8888
netlify database migrations apply             # noutro terminal: cria as tabelas na base local
netlify database connect --json               # mostra a ligação da base local
DATABASE_URL="<ligação acima>" npm run db:seed -w @gymflow/api   # dados de demonstração
```

### Opção B — Qualquer PostgreSQL

```bash
npm install
cp .env.example apps/api/.env                 # ajuste DATABASE_URL
npm run db:setup                              # cria o schema e carrega os dados de demonstração
npm run dev                                   # API em :4000 e web em :5173 (o Vite encaminha /api)
```

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
| `npm run dev` | API (Express) e web em modo de desenvolvimento |
| `npm run dev:netlify` | Igual à produção: `netlify dev` (site, funções e base local) |
| `npm run build:netlify` | Build usado pela Netlify (gera o cliente Prisma e o frontend) |
| `npm run build:api` | Bundle da API como servidor Node (para alojar fora da Netlify) |
| `npm run db:setup` | Cria o schema (`prisma db push`) e carrega os dados de demonstração |
| `npm run db:reset` | Apaga todos os dados e volta a semear |
| `npm run db:schema-sql -w @gymflow/api` | Regenera o SQL do modo demonstração (em memória) a partir do `schema.prisma` |
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

## Deployment na Netlify (site, API e base de dados)

Tudo corre na Netlify:

| Parte | Onde |
|---|---|
| Frontend | `apps/web/dist` (CDN) |
| API | Netlify Function `netlify/functions/api.mts`, servida em `/api/*` no mesmo domínio (sem CORS) |
| Lembretes | Scheduled Function `netlify/functions/reminders.mts` (`@hourly`) |
| Base de dados | `DATABASE_URL` (Postgres externo, ex.: Neon). Sem ela: **modo demonstração**, um Postgres em memória (PGlite) guardado no **Netlify Blobs**: todas as instâncias da função partilham os mesmos dados e estes persistem. Pensado para demonstrações (cada gravação envia a base inteira, ~5 MB). Para repor os dados iniciais, apague o blob `demo-db` no painel da Netlify |

Passos:

1. Crie o site na Netlify a partir do repositório (ou `netlify init`). O `netlify.toml` já define o build, as funções e os redirects.
2. Em **Site configuration → Environment variables** defina:
   - `SETUP_TOKEN`: um código longo e aleatório, pedido no assistente de configuração
   - `CRON_SECRET` (opcional)
   - os fornecedores de notificações (`WHATSAPP_*`, `SMTP_*`, `EMAIL_PROVIDER`…). **Email grátis:** `EMAIL_PROVIDER=smtp`, `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=<o seu gmail>`, `SMTP_PASSWORD=<palavra-passe de aplicação>` e `EMAIL_FROM=<nome> <o seu gmail>` (no Gmail: Conta Google → Segurança → Palavras-passe de aplicação; ~500 emails/dia)
   - `DEMO_CONTACT_PHONE` (opcional, modo demonstração): número real que recebe as mensagens de teste; por omissão 844552968. É o único membro da demo com notificações activas

   - `DATABASE_URL` (opcional): Postgres para dados persistentes. Sem ela, o site funciona em modo demonstração.
3. Faça o deploy.
4. Abra o site:
   - **Modo demonstração:** entre com uma das contas mostradas no login (ex.: `admin@gymflow.co.mz` / `Admin@2026`).
   - **Com `DATABASE_URL`:** crie as tabelas uma vez (`DATABASE_URL=… npm run db:push -w @gymflow/api`). Com a base vazia aparece o assistente **/setup**: indique o `SETUP_TOKEN`, o nome do ginásio e os dados do administrador.

### Alterar o modelo de dados

1. Edite `apps/api/prisma/schema.prisma`.
2. Corra `npm run db:schema-sql -w @gymflow/api` (actualiza o SQL do modo demonstração) e faça commit.
3. Numa base real, aplique com `DATABASE_URL=… npm run db:push -w @gymflow/api`. Prefira alterações compatíveis com a versão anterior ("expand and contract").

### Alojar a API fora da Netlify (opcional)

O servidor Express continua disponível: `npm run build:api` e depois `npm start -w @gymflow/api`, com `DATABASE_URL` (qualquer PostgreSQL), `CORS_ORIGIN`, `PUBLIC_APP_URL` e `REMINDERS_CRON_ENABLED=true`. No frontend, defina `VITE_API_URL` com o URL dessa API.

### WhatsApp via webhook (integração actual)

O envio de WhatsApp está integrado com um webhook de automação (Basic Auth). Configure na Netlify (ou em `apps/api/.env`):

```
WHATSAPP_PROVIDER=webhook
WHATSAPP_WEBHOOK_URL=https://workflow.mazedeve.com/webhook/gym
WHATSAPP_WEBHOOK_USERNAME=…
WHATSAPP_WEBHOOK_PASSWORD=…
```

O webhook recebe dados estruturados e usa os seus próprios templates:

| Situação no GymFlow | `notification_type` |
|---|---|
| Lembrete antes do vencimento / vence hoje | `gym_reminder` |
| Pagamento em atraso / subscrição expirada | `gym_warning` |

```json
{ "notification_type": "gym_reminder", "name": "Nome do membro", "phone": "+2588…", "gym_name": "…", "expire_date": "15/10/2026" }
```

Os outros tipos de mensagem (boas-vindas, confirmação de pagamento, mensagens personalizadas) não têm template no webhook. Ficam registados no histórico como "Ignorada" no canal WhatsApp e continuam a ser enviados por email, se estiver activo.

**Envio manual individual:** o botão **Enviar lembrete** (sino) aparece na lista de membros, na lista de subscrições e no perfil do membro. Envia de imediato um lembrete de vencimento, antes de a subscrição vencer, ou um aviso de atraso, depois de vencer.

**Números de teste:** com `NOTIFICATIONS_ALLOWLIST=258844552968` só esse número recebe mensagens reais; todos os outros ficam "Ignorados" sem chamar o webhook. Use sempre em desenvolvimento e deixe vazio em produção. Os dados de demonstração criados pelo `/setup` têm as notificações desactivadas, para não contactar números fictícios.

### WhatsApp Cloud API (Meta, alternativa)

Configure `WHATSAPP_PROVIDER=meta`, `WHATSAPP_ACCESS_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID`. A Meta só permite mensagens de texto livre dentro da janela de 24 horas de conversa. Para lembretes enviados por iniciativa do ginásio é preciso ter **templates aprovados** no WhatsApp Manager. Para os usar, adapte `MetaWhatsAppProvider` (em `apps/api/src/services/notifications/providers`) para enviar `type: "template"`. Para trocar de fornecedor (360dialog, Twilio…) basta implementar a interface `NotificationProvider`.

Em desenvolvimento, os três canais usam o fornecedor `console`, que mostra as mensagens no terminal da API e as regista no histórico.

## Segurança

- Palavras-passe guardadas com bcrypt. As sessões usam tokens opacos de 256 bits, dos quais só o hash SHA-256 fica na base de dados, com expiração e revogação.
- Permissões por perfil definidas num único ficheiro (`packages/shared/src/constants/roles.ts`) e aplicadas em cada rota da API.
- Helmet, limite de pedidos global (300 por minuto) e no login e no /setup (10 tentativas falhadas em 15 minutos). Em serverless o contador é por instância da função.
- Assistente /setup só funciona com a base vazia e, na Netlify, apenas com o `SETUP_TOKEN` correcto.
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
