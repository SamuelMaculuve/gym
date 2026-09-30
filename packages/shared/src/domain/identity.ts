/** `GYM`, 1 → `GYM-000001` */
export function formatMemberCode(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(6, '0')}`;
}

export const MEMBER_CODE_RE = /^[A-Z]{2,6}-\d{6}$/i;

/**
 * Normaliza um número de telefone para E.164 sem "+".
 * Números moçambicanos de 9 dígitos (8X XXX XXXX) recebem o indicativo 258.
 */
export function normalizePhone(input: string, defaultCountryCode = '258'): string {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 9 && digits.startsWith('8')) digits = defaultCountryCode + digits;
  return digits;
}

export function isValidPhone(input: string): boolean {
  const n = normalizePhone(input);
  return n.length >= 9 && n.length <= 15;
}

/** `258841234567` → `+258 84 123 4567` */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const n = normalizePhone(phone);
  if (n.startsWith('258') && n.length === 12) {
    return `+258 ${n.slice(3, 5)} ${n.slice(5, 8)} ${n.slice(8)}`;
  }
  return n.length > 9 ? `+${n}` : n;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}
