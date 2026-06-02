import type { Metadata } from 'next';
import { Geist, Geist_Mono, Righteous } from 'next/font/google';
import './globals.css';
import LenisWrapper from './components/LenisWrapper';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const righteous = Righteous({
  variable: '--font-righteous',
  subsets: ['latin'],
  weight: '400',
});

export const metadata: Metadata = {
  title: 'seita izaki - Portfolio',
  description: 'about me',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' className={`${geistSans.variable} ${geistMono.variable} ${righteous.variable} h-full antialiased`}>
      <body className='min-h-full flex flex-col'>
        <LenisWrapper>{children}</LenisWrapper>
      </body>
    </html>
  );
}
