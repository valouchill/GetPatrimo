import type { Metadata } from "next";
import "./globals.css";
import SessionProvider from "./providers/SessionProvider";

export const metadata: Metadata = {
  title: "GetPatrimo - Gestion locative sécurisée par IA",
  description: "Votre patrimoine mérite une gestion d'exception.",
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&family=Playfair+Display:ital,wght@0,700;1,400&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased bg-slate-50 text-navy">
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
