import type { Metadata } from 'next';
import { Onest } from 'next/font/google';
import './globals.css';
import Image from 'next/image';

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
      <body className={`${onest.className} text-black`}>
        <div className="flex min-h-screen items-center justify-center w-full bg-[#F3F4F8]">
          <header className="header">
            <div className="header__container">
              <Image
                alt="logo"
                className="logo cursor-pointer"
                src="./logo.svg"
                width={206}
                height={26}
              />
              <Image
                alt="profile"
                className="profile cursor-pointer"
                src="./profile.svg"
                width={23}
                height={23}
              />
            </div>
          </header>
          <main className="flex min-h-screen w-full gap-5 mx-auto py-20">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
