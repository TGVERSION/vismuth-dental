import type { Metadata } from 'next';
import { Onest } from 'next/font/google';
import './globals.css';

const onest = Onest({
  subsets: ['cyrillic', 'latin'],
  // display: "swap", // Опционально
});

export const metadata: Metadata = {
  title: 'Протокол врача',
  description: '',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${onest.className} text-black`}>{children}</body>
    </html>
  );
}
