import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  // Страница публичная и содержит название клиники и имена врачей —
  // в поисковой выдаче ей не место.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Без viewport-fit=cover не работает env(safe-area-inset-*), и на
  // телефонах с вырезом контент уезжает под неё.
  viewportFit: 'cover',
  // Экранная клавиатура должна уменьшать высоту страницы, а не наезжать на
  // неё: иначе поле ввода чата остаётся под клавиатурой и пациент не видит,
  // что печатает. Это поведение Chrome на Android; Safari на iOS так не
  // умеет, там высоту и положение экрана чата приходится считать через
  // Visual Viewport — см. src/hooks/useVisualViewport.ts.
  interactiveWidget: 'resizes-content',
};

export default function QuestionnaireLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
