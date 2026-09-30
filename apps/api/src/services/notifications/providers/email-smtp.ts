import nodemailer, { type Transporter } from 'nodemailer';
import type { NotificationProvider, OutgoingMessage, SendResult } from '../types';

interface SmtpConfig {
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
}

export class SmtpEmailProvider implements NotificationProvider {
  readonly name = 'smtp';
  readonly channel = 'EMAIL' as const;
  private transporter: Transporter | null = null;
  constructor(private readonly config: SmtpConfig) {}

  get configured() {
    return Boolean(this.config.host);
  }

  private getTransporter() {
    this.transporter ??= nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: this.config.user ? { user: this.config.user, pass: this.config.password } : undefined,
    });
    return this.transporter;
  }

  async send(message: OutgoingMessage): Promise<SendResult> {
    if (!this.configured) throw new Error('SMTP não configurado (SMTP_HOST)');
    const info = await this.getTransporter().sendMail({
      from: this.config.from,
      to: message.to,
      subject: message.subject ?? '',
      text: message.text,
      html: message.html,
    });
    return { providerMessageId: info.messageId };
  }
}
