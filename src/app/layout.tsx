import './bauhaus.css';
import './malayalam.css';
import React from 'react';
import { LanguageProvider } from './LanguageContext';
import { TauriProvider } from './TauriProvider';

export const metadata = {
  title: 'SafeDesk',
  description: 'Forensically Secure Ephemeral Kiosk Application',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;500;700;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <TauriProvider>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </TauriProvider>
      </body>
    </html>
  );
}
