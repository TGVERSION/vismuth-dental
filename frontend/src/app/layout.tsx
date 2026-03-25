import type { Metadata } from 'next';
import { Onest } from 'next/font/google';
import './globals.css';

const onest = Onest({ subsets: ['cyrillic', 'latin'] });

export const metadata: Metadata = {
  title: 'Протокол врача',
  description: '',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className={`${onest.className} text-black bg-[#F3F4F8]`}>
        {children}
      </body>
    </html>
  );
}
