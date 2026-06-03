import type { Metadata } from 'next';
import { Geist, Geist_Mono, Righteous, Urbanist, DotGothic16 } from 'next/font/google';
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

const urbanist = Urbanist({
  variable: '--font-urbanist',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'seita izaki - Portfolio',
  description: 'about me',
};

export const dotgothic16 = DotGothic16({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dotgothic16",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' className={`${geistSans.variable} ${geistMono.variable} ${righteous.variable} ${urbanist.variable} ${dotgothic16.variable} h-full antialiased`}>
      <body className='min-h-full flex flex-col'>
        <LenisWrapper>{children}</LenisWrapper>
      </body>
    </html>
  );
}
