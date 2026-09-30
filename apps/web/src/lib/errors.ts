import { ApiError } from '@gymflow/shared';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Ocorreu um erro inesperado';
}

/** Mostra nos campos do formulário os erros de validação devolvidos pela API. */
export function applyServerErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>): boolean {
  if (!(err instanceof ApiError)) return false;
  const fields = (err.details as { fields?: Record<string, string> } | undefined)?.fields;
  if (!fields) return false;
  for (const [key, message] of Object.entries(fields)) setError(key as Path<T>, { message });
  return true;
}
