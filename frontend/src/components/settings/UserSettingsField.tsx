import type { ReactNode } from 'react';

export function UserSettingsField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 items-start gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(210px,34%)] sm:gap-6">
      <div className="min-w-0 py-2">
        <p className="text-sm text-[#202020]">{label}</p>
        {hint && (
          <p className="mt-1 text-sm leading-snug text-[#8B8B8B]">{hint}</p>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
