'use client';

import type { ClinicBranding, QuestionnaireBlock } from '@/lib/questionnaire';

interface QuestionnaireStubProps {
  state: QuestionnaireBlock;
  clinic: ClinicBranding | null;
  /** Список врачей показывается, когда по ссылке врач больше не ведёт приём. */
  children?: React.ReactNode;
}

/** Тексты заглушек заданы ТЗ — менять их произвольно нельзя. */
const stubText = (
  state: QuestionnaireBlock,
  phone: string | null,
): { title: string; description: string } => {
  switch (state) {
    case 'doctor_inactive':
      return {
        title: 'Врач не ведёт приём',
        description: 'Выберите другого врача клиники.',
      };
    case 'device_limit':
      return {
        title: 'Вы уже заполнили анкету',
        description: 'Если нужно ещё — обратитесь в клинику.',
      };
    case 'ip_limit':
      return {
        title: 'Попробуйте позже',
        description: 'Сейчас анкету заполнить не получится.',
      };
    case 'invite_only':
      return {
        title: 'Анкета приходит по ссылке',
        description: phone
          ? `Клиника присылает ссылку при записи. Если её нет — позвоните по телефону ${phone}`
          : 'Клиника присылает ссылку при записи. Если её нет — позвоните в клинику.',
      };
    case 'invite_expired':
      return {
        title: 'Ссылка устарела',
        description: phone
          ? `Попросите новую ссылку в клинике по телефону ${phone}`
          : 'Попросите новую ссылку в клинике.',
      };
    case 'invite_not_found':
      return {
        title: 'Ссылка не найдена',
        description:
          'Возможно, клиника прислала новую. Проверьте последнее сообщение или позвоните в клинику.',
      };
    // Завершённая подписка и суточный лимит клиники показывают
    // один и тот же текст — так задано в ТЗ.
    case 'subscription_expired':
    case 'clinic_daily_limit':
    default:
      return {
        title: 'Сервис временно недоступен',
        description: phone
          ? `По вопросам записи обращайтесь в клинику по телефону ${phone}`
          : 'По вопросам записи обращайтесь в клинику.',
      };
  }
};

export const QuestionnaireStub = ({
  state,
  clinic,
  children,
}: QuestionnaireStubProps) => {
  const { title, description } = stubText(state, clinic?.phone ?? null);

  return (
    <div className="q-screen flex flex-col px-4 pt-16">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-4 text-[var(--q-muted)]">{description}</p>
      {children ? <div className="mt-8 flex-1">{children}</div> : null}
    </div>
  );
};
