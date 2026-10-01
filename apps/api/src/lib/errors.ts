export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Sessão inválida ou expirada') => new HttpError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Não tem permissão para esta operação') => new HttpError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Registo não encontrado') => new HttpError(404, 'NOT_FOUND', message);
export const conflict = (message: string) => new HttpError(409, 'CONFLICT', message);

/** Membros arquivados não podem pagar, fazer check-in nem receber mensagens até serem restaurados. */
export function assertNotArchived(member: { archivedAt: Date | null; fullName: string }) {
  if (member.archivedAt) throw badRequest(`${member.fullName} está arquivado. Restaure-o em Membros → Arquivados para continuar.`);
}
