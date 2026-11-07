import type { Metadata } from 'next';
import { Onest } from 'next/font/google';
import './globals.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ProtectedRoute from '@/components/ProtectedRoute';

const onest = Onest({
  subsets: ['cyrillic', 'latin'],
  variable: '--font-onest',
});

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
      <body className={`${onest.variable} text-foreground bg-background`}>
        <ProtectedRoute>{children}</ProtectedRoute>

        <ToastContainer
          position="top-right"
          autoClose={4000}
          hideProgressBar={false}
          newestOnTop={true}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
          limit={3}
        />
      </body>
    </html>
  );
}
