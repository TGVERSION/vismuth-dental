import type { Metadata } from 'next';
import { getQuestionnaireLink } from '@/api/server-api';
import { QuestionnaireApp } from '@/components/questionnaire/QuestionnaireApp';

// Страница разная для каждой клиники и зависит от состояния подписки.
// Кэш здесь означал бы показать пациенту брендинг чужой клиники, поэтому
// рендер всегда динамический. generateStaticParams намеренно не объявлен.
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { code } = await params;
  // Тот же вызов, что и в компоненте: загрузчик обёрнут в React.cache,
  // поэтому запрос к backend уходит один на показ страницы, а не два.
  const link = await getQuestionnaireLink(code);

  return { title: link?.clinic_name ?? 'Анкета перед приёмом' };
}

export default async function QuestionnairePage({ params }: PageProps) {
  const { code } = await params;
  const link = await getQuestionnaireLink(code);

  return <QuestionnaireApp slug={code} link={link} />;
}
