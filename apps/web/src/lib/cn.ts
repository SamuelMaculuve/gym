type ClassValue = string | false | null | undefined | 0;

/** Junta classes condicionais. */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ');
}
