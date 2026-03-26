import { NextResponse } from 'next/server';
import type { ZodType, ZodError } from 'zod';

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; response: NextResponse };

/**
 * Valide un body avec un schéma Zod. Retourne les données parsées ou une NextResponse 400.
 *
 * @example
 * ```ts
 * const result = validateRequest(schema, body);
 * if (!result.success) return result.response;
 * const { data } = result;
 * ```
 */
export function validateRequest<T>(schema: ZodType<T>, body: unknown): ValidationResult<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issues = (parsed.error as ZodError).issues || [];
    const details = issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Données invalides', details },
        { status: 400 }
      ),
    };
  }
  return { success: true, data: parsed.data };
}
