import { NextRequest, NextResponse } from 'next/server';

type RouteHandler = (
  req: NextRequest,
  context?: any
) => Promise<NextResponse> | NextResponse;

/**
 * Wrapper pour les API Routes Next.js qui centralise la gestion d'erreur.
 * Log structuré JSON + réponse sans stack trace en production.
 *
 * @example
 * ```ts
 * export const POST = withErrorHandler(async (req) => {
 *   const body = await req.json();
 *   // ... logique métier
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, context?: any) => {
    try {
      return await handler(req, context);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      const statusCode = (err as any)?.statusCode || 500;
      const message = statusCode < 500 ? error.message : 'Erreur serveur';

      const logEntry = {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.nextUrl.pathname,
        statusCode,
        message: error.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
      };
      console.error(JSON.stringify(logEntry));

      return NextResponse.json({ error: message }, { status: statusCode });
    }
  };
}
