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
}

export const Sidebar: React.FC<SidebarProps> = ({
  sections,
  activeSection,
  onSectionClick,
}) => {
  const getSectionColor = (section: Section) => {
    if (section.id === activeSection) {
      return 'text-[#5D8CF1] hover:text-[#769CEF]';
    }
    if (section.hasContent) {
      return 'text-[#202020] hover:text-[#769CEF]';
    }
    return 'text-[#909090] hover:text-[#769CEF]';
  };

  return (
    <nav className="fixed w-62.5 flex flex-col ml-5 gap-6">
      <div className="sticky top-24">
        <ul className="flex flex-col gap-4">
          {sections.map((section) => (
            <li key={section.id}>
              <button
                onClick={() => onSectionClick(section.id)}
                className={`text-sm font-medium transition-colors duration-200 text-left cursor-pointer ${getSectionColor(
                  section,
                )}`}
              >
                {section.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};
