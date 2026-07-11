import './globals.css';

export const metadata = {
  title: 'Percer — Gestion FTTH',
  description: 'Plateforme de gestion des interventions fibre optique — Percer, partenaire Orange Maroc',
  manifest: '/manifest.json',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#ff7900',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
