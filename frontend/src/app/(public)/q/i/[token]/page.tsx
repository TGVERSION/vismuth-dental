import type { Metadata } from 'next';
import { getQuestionnaireInvite } from '@/api/server-api';
import { DentalQuestionnaireApp } from '@/components/dental-questionnaire/DentalQuestionnaireApp';

// В ответе имя пациента и время его приёма: только динамический рендер,
// без кэша. Индексацию закрывает общий layout анкеты.
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const result = await getQuestionnaireInvite(token);

  return {
    title: result.status === 'ok' ? result.invite.clinic_name : 'Анкета перед приёмом',
    // Токен ссылки — в адресе страницы: не отдаём его сторонним сайтам.
    referrer: 'no-referrer',
  };
}

export default async function DentalInvitePage({ params }: PageProps) {
  const { token } = await params;
  const result = await getQuestionnaireInvite(token);

  return <DentalQuestionnaireApp token={token} result={result} />;
}
