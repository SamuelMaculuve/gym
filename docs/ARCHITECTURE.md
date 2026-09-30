# GymFlow — Arquitectura

Documento de referência da arquitectura, do modelo de dados e dos fluxos principais.

## 1. Visão geral

```
┌──────────────────────┐      ┌──────────────────────┐
│  apps/web (Netlify)  │      │ (futuro) apps/mobile │
│  React + Vite + TW   │      │  Expo / React Native │
└──────────┬───────────┘      └──────────┬───────────┘
           │   packages/shared (tipos, Zod, regras, cliente HTTP)
           ▼                             ▼
┌─────────────────────────────────────────────────────┐
│ apps/api — Express + Prisma                          │
│  auth · members · plans · subscriptions · payments   │
│  attendance · notifications · reports · audit        │
│  NotificationService (WhatsApp / Email / SMS)        │
│  ReminderEngine (cron) · PaymentGateway (futuro)     │
└──────────────────────────┬──────────────────────────┘
                           ▼
              Base de dados relacional
      (SQLite em desenvolvimento, PostgreSQL em produção)
```

Princípios:

- **Regras de negócio em `packages/shared/src/domain`** (funções puras): cálculo de estado da
  subscrição, datas no fuso horário do ginásio, dinheiro, templates, calendário de lembretes,
  permissões. A API usa-as como fonte de verdade; o frontend usa-as apenas para apresentação.
- **Schemas Zod partilhados**: o mesmo schema valida o formulário (React Hook Form) e o pedido na API.
- **Cliente HTTP partilhado** (`createApiClient`) baseado em `fetch` com armazenamento de token
  injectável — no web usa `localStorage`, no Expo usará `expo-secure-store`.
- **Nenhum segredo no browser**: tokens do WhatsApp, SMTP, etc. existem apenas na API.
- **Multi-ginásio preparado**: todas as entidades de negócio têm `gymId`; o utilizador pertence a
  um ginásio e todas as consultas são filtradas por ele.

## 2. Estrutura de pastas

```
gym/
├── package.json                 # npm workspaces
├── netlify.toml                 # build, publish, SPA redirects
├── .env.example
├── docs/ARCHITECTURE.md
├── packages/shared/src/
│   ├── constants/               # roles, permissões, estados, métodos de pagamento
│   ├── domain/                  # regras puras (datas, estado, lembretes, templates, dinheiro)
│   ├── schemas/                 # Zod (auth, member, plan, payment, attendance, settings...)
│   ├── types/                   # DTOs devolvidos pela API
│   └── api/                     # cliente HTTP reutilizável (web + Expo)
├── apps/api/
│   ├── prisma/schema.prisma     # modelo relacional
│   ├── prisma/seed.ts           # dados de demonstração
│   └── src/
│       ├── config/env.ts        # validação das variáveis de ambiente
│       ├── lib/                 # prisma, erros HTTP, helpers
│       ├── middleware/          # auth, permissões, validação, rate limit, erros
│       ├── modules/<módulo>/    # routes.ts + service.ts por módulo
│       ├── services/notifications/  # NotificationService + providers
│       ├── services/payments/   # PaymentGateway (preparado para M-Pesa/e-Mola)
│       └── jobs/reminders.ts    # motor de lembretes (cron)
└── apps/web/src/
    ├── app/                     # router, providers, layout (sidebar/bottom nav)
    ├── components/ui/           # Button, Input, Select, Modal, Drawer, DataTable, Badge...
    ├── components/              # componentes transversais (CommandPalette, QuickPay...)
    ├── features/<módulo>/       # páginas, componentes e hooks por módulo
    └── lib/                     # instância da API, auth, tema, formatação, exportação
```

## 3. Entidades e modelo de dados

| Entidade | Campos principais | Notas |
|---|---|---|
| **Gym** | name, logo, phone, email, address, whatsapp, currency, timezone, openingDays, openingHours, settings (JSON), memberSequence | Raiz multi-ginásio. `settings` contém as regras de lembretes. |
| **User** | name, email, passwordHash, role, active | Roles: ADMIN, MANAGER, RECEPTIONIST, ACCOUNTANT. |
| **Session** | tokenHash, userId, expiresAt, revokedAt | Token opaco; só o hash SHA-256 é guardado. |
| **Member** | code (GYM-000001), qrToken, fullName, phone, email, birthDate, gender, address, emergencyContact, notes, joinedAt, active, notificationsEnabled | `qrToken` é aleatório e não contém dados pessoais. |
| **Plan** | name, description, priceCents, durationDays, active | Valores em cêntimos (inteiros). |
| **Subscription** | memberId, planId, startDate, endDate, amountCents, amountPaidCents, paidAt, state (NORMAL/SUSPENDED/CANCELLED), remindersPaused | Um registo por **período**. Renovar cria um novo período. |
| **Payment** | memberId, subscriptionId, amountCents, paymentDate, method, reference, status (PAID/CANCELLED/REFUNDED), receivedById, cancelledById, cancelReason, source, externalId | Nunca eliminado; cancelamento/estorno preserva histórico. |
| **PaymentLink** | token, subscriptionId, amountCents, status, provider, externalRef, expiresAt | Base para "Pagar agora" (gateway futuro). |
| **Attendance** | memberId, date, checkInAt, checkOutAt, method, subscriptionStatus, overridden, registeredById | |
| **Notification** | memberId, subscriptionId, channel, type, subject, message, status, error, dedupeKey (único), sentAt | `dedupeKey` impede duplicados. |
| **NotificationTemplate** | type, channel, subject, body, active | Variáveis `{{name}}`, `{{plan}}`, `{{amount}}`, `{{due_date}}`, `{{gym_name}}`, `{{payment_link}}`. |
| **AuditLog** | userId, action, entity, entityId, summary, before, after, ip | |

Datas de calendário (início, vencimento, presença) são guardadas como `YYYY-MM-DD` no fuso do
ginásio; instantes (pagamento registado, check-in) como `DateTime` UTC.

## 4. Estado da subscrição (calculado)

`packages/shared/src/domain/subscription-status.ts`

```
paga           = amountPaidCents >= amountCents        (só existe com pagamento válido)
dataDevida     = paga ? endDate : startDate
dias           = dataDevida − hoje (fuso do ginásio)

CANCELLED      se state = CANCELLED
SUSPENDED      se state = SUSPENDED
DUE_SOON       se 0 ≤ dias ≤ dueSoonDays         (inclui "vence hoje")
ACTIVE         se dias > dueSoonDays
OVERDUE        se dias < 0 e atraso ≤ expireAfterDays
EXPIRED        se atraso > expireAfterDays
```

Chegar à data de vencimento **nunca** marca a subscrição como paga; no dia seguinte, sem
pagamento, passa automaticamente a OVERDUE.

## 5. Fluxos principais

**Recepção — novo membro (≤ 3 passos)**
Novo membro → escolher plano (vencimento calculado) → [opcional] registar pagamento → QR Code.

**Registar pagamento** (`POST /api/payments`, numa transacção)
1. Se o período actual não está pago, o pagamento é associado a ele.
2. Se já está pago, cria-se o período seguinte (a partir de `endDate + 1`, ou de hoje se expirado).
3. Actualiza `amountPaidCents`/`paidAt`, regista quem recebeu, cria audit log.
4. Opcionalmente envia confirmação (WhatsApp/Email) ao membro.
5. O frontend invalida as queries (dashboard, membros, pagamentos).

**Check-in** (`POST /api/attendance/check-in`)
QR / código / telefone / nome → localizar membro → calcular estado → permitir ou bloquear
("Subscrição expirada. Renovação necessária.") → registar presença.

**Motor de lembretes** (`apps/api/src/jobs/reminders.ts`, a cada hora + endpoint manual)
Para cada subscrição actual, com notificações activas, calcula o limiar aplicável
(7/3/1 dias antes, no dia, 1/7/14 dias depois e depois semanalmente — tudo configurável),
gera a mensagem a partir do template e envia por cada canal activo. A chave
`subscriptionId:tipo:limiar:canal` é única, garantindo que nada é enviado duas vezes.

## 6. Segurança

- Palavras-passe com bcrypt; sessões com token aleatório (hash na BD), expiração e revogação.
- Autorização por permissões derivadas do role (`shared/constants/permissions.ts`), aplicadas na
  API (`requirePermission`) e reflectidas na UI.
- Helmet, CORS restrito (`CORS_ORIGIN`), rate limiting global e reforçado no login.
- Validação Zod em todas as rotas; audit log das operações importantes.

## 7. Preparação para o futuro

- **Expo**: reutiliza `packages/shared` (schemas, domínio, cliente API). App do membro usará
  rotas `/api/member-app/*` com autenticação própria do membro.
- **Pagamentos online**: `PaymentGateway` + `PaymentLink`; webhooks criam `Payment` com
  `source = ONLINE`, usando o mesmo serviço de registo de pagamento.
- **Novos módulos** (aulas, PTs, avaliação física, loja, fidelização): novos modelos ligados a
  `Member`/`Gym` e novas pastas em `modules/` e `features/`, sem alterar os existentes.
- **Multi-filial**: adicionar `Branch` com `gymId` e `branchId` opcional em Attendance/Payment.
