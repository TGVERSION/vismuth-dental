'use client';

interface Section {
  id: string;
  label: string;
  hasContent: boolean;
}

interface SidebarProps {
  sections: Section[];
  activeSection: string;
  onSectionClick: (id: string) => void;
  sectionStatus: Record<string, { color: string; analysis: string } | null>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sections,
  activeSection,
  onSectionClick,
  sectionStatus,
}) => {
  // Активный раздел проверяется первым: раньше обе последние ветки возвращали
  // одинаковый класс, поэтому активный раздел ничем не отличался от прочих —
  // подсветки в навигации не было вовсе.
  const getSectionColor = (section: Section) => {
    if (section.id === activeSection) {
      return 'text-[var(--ui-color-blue-600)] font-medium hover:text-[var(--ui-color-blue-700)]';
    }
    if (section.hasContent) {
      return 'text-[var(--ui-color-alabaster-dark-800)] hover:text-[var(--ui-color-blue-600)]';
    }

    return 'text-[var(--ui-color-alabaster-950)] hover:text-[var(--ui-color-blue-600)]';
  };

  return (
    <nav
      aria-label="Разделы протокола"
      className="custom-scrollbar flex h-full min-h-0 flex-col overflow-y-auto"
    >
      <div>
        <ul className="flex flex-col gap-4">
          {sections.map((section) => {
            const status = sectionStatus[section.id];
            return (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => onSectionClick(section.id)}
                  className={`text-[length:var(--ui-font-size-15)] transition-colors flex items-center duration-200 text-left cursor-pointer ${getSectionColor(
                    section,
                  )}`}
                >
                  {status && (
                    <span
                      className={`inline-block w-3.5 h-3.5 mr-2 rounded-full transition-all duration-300 fade-in ${
                        status.color === 'green'
                          ? 'bg-[var(--ui-color-green-600)]'
                          : status.color === 'yellow'
                            ? 'bg-[var(--ui-color-yellow-600)]'
                            : 'bg-[var(--ui-color-red-600)]'
                      }`}
                    />
                  )}
                  {section.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};
