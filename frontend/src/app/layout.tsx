import type { Metadata } from 'next';
import { AuthProvider } from '@/providers/AuthProvider';
import { StoreProvider } from '@/store/StoreProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'MedScribe | Medical Transcription',
  description: 'Real-time medical transcription and SOAP note generation',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-body antialiased">
        <StoreProvider>
          <AuthProvider>{children}</AuthProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
