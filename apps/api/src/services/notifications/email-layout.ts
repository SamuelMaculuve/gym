const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface EmailLayoutInput {
  gymName: string;
  logoUrl?: string | null;
  subject: string;
  text: string;
  /** URL que, se aparecer sozinha numa linha, é convertida num botão. */
  ctaUrl?: string | null;
  ctaLabel?: string;
  footer?: string;
}

/** Layout HTML profissional e compatível com clientes de email (tabelas + estilos inline). */
export function renderEmailHtml(input: EmailLayoutInput): string {
  const paragraphs = input.text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (input.ctaUrl && block === input.ctaUrl) {
        return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0"><tr><td style="border-radius:10px;background:#16a34a">
<a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-weight:600;text-decoration:none;font-size:15px">${escapeHtml(input.ctaLabel ?? 'Pagar agora')}</a>
</td></tr></table>`;
      }
      return `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(block).replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');

  const logo = input.logoUrl && /^https?:\/\//.test(input.logoUrl)
    ? `<img src="${escapeHtml(input.logoUrl)}" alt="${escapeHtml(input.gymName)}" height="40" style="display:block;height:40px">`
    : `<span style="font-size:20px;font-weight:700;color:#0f172a">${escapeHtml(input.gymName)}</span>`;

  return `<!doctype html>
<html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#334155">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
<tr><td style="padding:24px 32px;border-bottom:1px solid #e2e8f0">${logo}</td></tr>
<tr><td style="padding:32px;font-size:15px">
<h1 style="margin:0 0 20px;font-size:20px;color:#0f172a">${escapeHtml(input.subject)}</h1>
${paragraphs}
</td></tr>
<tr><td style="padding:20px 32px;background:#f8fafc;font-size:12px;color:#64748b">${escapeHtml(input.footer ?? `${input.gymName} — mensagem automática, por favor não responda.`)}</td></tr>
</table></td></tr></table></body></html>`;
}
