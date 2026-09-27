import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Анкеты',
};

/**
 * Заглушка раздела «Анкеты».
 *
 * Список анкет у врача отложен (задача doctor-questionnaires-2026-09-24), а
 * ссылка в шапке уже есть — ей нужно куда-то вести. При возобновлении задачи
 * файл заменяется целиком.
 */
export default function QuestionnairesPage() {
  return (
    <div className="mx-4 mt-4 w-full rounded-2xl bg-white p-8">
      <h1 className="text-xl font-semibold">Анкеты</h1>
      <p className="mt-3 text-[#8B8B8B]">Раздел в разработке.</p>
    </div>
  );
}
