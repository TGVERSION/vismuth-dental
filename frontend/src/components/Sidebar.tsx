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
  const getSectionColor = (section: Section) => {
    if (section.hasContent) {
      return 'text-[#202020] hover:text-[#5D8CF1]';
    }
    if (section.id === activeSection) {
      return 'text-[#909090] hover:text-[#5D8CF1]';
    }

    return 'text-[#909090] hover:text-[#5D8CF1]';
  };

  return (
    <nav className="fixed w-62.5 flex-col ml-6.25 gap-6 hidden lg:flex">
      <div className="sticky top-24">
        <ul className="flex flex-col gap-4">
          {sections.map((section) => {
            const status = sectionStatus[section.id];
            return (
              <li key={section.id}>
                <button
                  onClick={() => onSectionClick(section.id)}
                  className={`text-[15px] transition-colors flex items-center duration-200 text-left cursor-pointer ${getSectionColor(
                    section,
                  )}`}
                >
                  {status && (
                    <span
                      className={`inline-block w-3.5 h-3.5 mr-2 rounded-full transition-all duration-300 fade-in ${
                        status.color === 'green'
                          ? 'bg-[#459F49]'
                          : status.color === 'yellow'
                            ? 'bg-[#F29100]'
                            : 'bg-[#D91528]'
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
