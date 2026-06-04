import type { Metadata } from "next";
import "./globals.css";
import SessionProvider from "./providers/SessionProvider";
import { NotificationProvider } from "./hooks/useNotification";

export const metadata: Metadata = {
  title: "GetPatrimo - Gestion locative sécurisée par IA",
  description: "Votre patrimoine mérite une gestion d'exception.",
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

// i18n: Application en français uniquement pour le lancement (marché France).
// Pour ajouter d'autres langues : installer next-intl, créer /messages/{locale}.json,
// wraper le layout avec NextIntlClientProvider, et ajouter le middleware de détection locale.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- chargement global des polices via <link>, volontaire (app router) */}
        <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;1,400&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased bg-slate-50 text-navy">
        <SessionProvider>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
