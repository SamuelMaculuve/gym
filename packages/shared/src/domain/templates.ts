import type { NotificationChannel, NotificationType } from '../constants';

export const TEMPLATE_VARIABLES = [
  { key: 'name', description: 'Nome do membro' },
  { key: 'plan', description: 'Nome do plano' },
  { key: 'amount', description: 'Valor a pagar' },
  { key: 'due_date', description: 'Data de vencimento' },
  { key: 'gym_name', description: 'Nome do ginásio' },
  { key: 'payment_link', description: 'Link "Pagar agora"' },
  { key: 'member_code', description: 'Número de membro' },
  { key: 'gym_phone', description: 'Telefone do ginásio' },
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number]['key'];
export type TemplateVariables = Partial<Record<TemplateVariable | (string & {}), string | number | null | undefined>>;

/** Substitui `{{variavel}}` pelos valores. Variáveis desconhecidas ficam vazias. */
export function renderTemplate(template: string, vars: TemplateVariables): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => {
    const value = vars[key];
    return value === null || value === undefined ? '' : String(value);
  });
}

/** Variáveis usadas num template que não são suportadas (para validação no editor). */
export function unknownTemplateVariables(template: string): string[] {
  const known = new Set<string>(TEMPLATE_VARIABLES.map((v) => v.key));
  const found = [...template.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)].map((m) => m[1]);
  return [...new Set(found.filter((k) => !known.has(k)))];
}

export interface DefaultTemplate {
  type: NotificationType;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
}

type Texts = { subject: string; email: string; short: string };

const TEXTS: Record<Exclude<NotificationType, 'CUSTOM'>, Texts> = {
  WELCOME: {
    subject: 'Bem-vindo(a) ao {{gym_name}}',
    email:
      'Olá, {{name}}.\n\nSeja bem-vindo(a) ao {{gym_name}}! A sua inscrição no plano {{plan}} foi concluída.\n\nO seu número de membro é {{member_code}}. Apresente o seu QR Code na recepção para registar a entrada.\n\nBons treinos!',
    short:
      'Olá {{name}}, bem-vindo(a) ao {{gym_name}}! 💪 O seu número de membro é {{member_code}} e o plano {{plan}} está activo. Bons treinos!',
  },
  PAYMENT_CONFIRMATION: {
    subject: 'Pagamento recebido — {{gym_name}}',
    email:
      'Olá, {{name}}.\n\nConfirmamos a recepção do seu pagamento de {{amount}} referente ao plano {{plan}}.\n\nA sua subscrição é válida até {{due_date}}.\n\nObrigado pela preferência.',
    short: 'Olá {{name}}, recebemos o seu pagamento de {{amount}} ({{plan}}). Subscrição válida até {{due_date}}. Obrigado! — {{gym_name}}',
  },
  DUE_REMINDER: {
    subject: 'A sua subscrição vence a {{due_date}}',
    email:
      'Olá, {{name}}.\n\nA sua subscrição {{plan}} vence no dia {{due_date}}.\n\nValor da renovação: {{amount}}.\n\nPrepare a renovação para continuar a treinar sem interrupções.\n\n{{payment_link}}',
    short:
      'Olá {{name}}. A sua subscrição {{plan}} vence no dia {{due_date}}. Prepare a renovação ({{amount}}) para continuar a treinar sem interrupções. {{payment_link}}',
  },
  DUE_TODAY: {
    subject: 'A sua subscrição vence hoje',
    email:
      'Olá, {{name}}.\n\nA sua subscrição do ginásio vence hoje.\n\nValor: {{amount}}\n\nPara continuar a utilizar os nossos serviços, efectue o pagamento.\n\n{{payment_link}}\n\nObrigado.',
    short:
      'Olá {{name}}, a sua subscrição {{plan}} no {{gym_name}} vence hoje. Valor: {{amount}}. Efectue o pagamento para continuar a treinar. {{payment_link}}',
  },
  OVERDUE: {
    subject: 'Pagamento em atraso — {{gym_name}}',
    email:
      'Olá, {{name}}.\n\nA sua subscrição {{plan}} venceu no dia {{due_date}} e ainda não registámos o pagamento.\n\nValor em dívida: {{amount}}.\n\nRegularize a sua situação para continuar a treinar connosco.\n\n{{payment_link}}\n\nSe já efectuou o pagamento, por favor ignore esta mensagem.',
    short:
      'Olá {{name}}, a sua subscrição {{plan}} venceu a {{due_date}} e o pagamento de {{amount}} está em atraso. Regularize para continuar a treinar. {{payment_link}}',
  },
  EXPIRED: {
    subject: 'A sua subscrição expirou',
    email:
      'Olá, {{name}}.\n\nA sua subscrição {{plan}} expirou. Sentimos a sua falta!\n\nRenove agora por {{amount}} e volte a treinar.\n\n{{payment_link}}',
    short: 'Olá {{name}}, a sua subscrição no {{gym_name}} expirou. Renove por {{amount}} e volte a treinar! {{payment_link}}',
  },
  RENEWAL: {
    subject: 'Subscrição renovada — {{gym_name}}',
    email: 'Olá, {{name}}.\n\nA sua subscrição {{plan}} foi renovada com sucesso e é válida até {{due_date}}.\n\nBons treinos!',
    short: 'Olá {{name}}, a sua subscrição {{plan}} foi renovada até {{due_date}}. Bons treinos! — {{gym_name}}',
  },
  PASSWORD_RESET: {
    subject: 'Recuperação de conta — {{gym_name}}',
    email:
      'Olá, {{name}}.\n\nRecebemos um pedido para redefinir a sua palavra-passe.\n\nUtilize o link abaixo (válido durante 1 hora):\n\n{{reset_link}}\n\nSe não fez este pedido, ignore esta mensagem.',
    short: 'Recuperação de conta {{gym_name}}: {{reset_link}}',
  },
};

export const DEFAULT_TEMPLATES: DefaultTemplate[] = (Object.keys(TEXTS) as (keyof typeof TEXTS)[]).flatMap((type) => {
  const t = TEXTS[type];
  return [
    { type, channel: 'EMAIL' as const, subject: t.subject, body: t.email },
    { type, channel: 'WHATSAPP' as const, subject: null, body: t.short },
    { type, channel: 'SMS' as const, subject: null, body: t.short },
  ];
});

export function defaultTemplate(type: NotificationType, channel: NotificationChannel): DefaultTemplate | undefined {
  return DEFAULT_TEMPLATES.find((t) => t.type === type && t.channel === channel);
}
