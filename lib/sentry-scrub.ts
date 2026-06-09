/**
 * Sécurité (revue V1 — S21) : retire les données potentiellement sensibles des
 * événements Sentry (cookies de session, en-têtes d'authentification) avant leur
 * envoi. Couplé à `sendDefaultPii: false`. Type souple pour rester compatible avec
 * les différentes signatures d'événement Sentry (server / client / edge).
 */
export function scrubSentryEvent(event: any): any {
  if (event?.request) {
    delete event.request.cookies;
    const h = event.request.headers;
    if (h) {
      delete h.cookie;
      delete h.Cookie;
      delete h.authorization;
      delete h.Authorization;
    }
  }
  return event;
}
