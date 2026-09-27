// Иконки анкеты.
//
// Иконки из макета лежат файлами в public и подключаются через next/image —
// как в остальном проекте. Оставшиеся две (шеврон и стрелка «назад») сделаны
// инлайновыми SVG: файлов для них нет, а `currentColor` позволяет им
// следовать теме клиники.

import Image from 'next/image';

interface IconProps {
  className?: string;
}

/** Иконка из public. Размер задаётся классом, а не атрибутами. */
const FileIcon = ({ src, className = '' }: IconProps & { src: string }) => (
  <Image src={src} alt="" width={24} height={24} className={className} />
);

export const SearchIcon = ({ className = '' }: IconProps) => (
  <FileIcon src="/search.svg" className={className} />
);

export const CalendarIcon = ({ className = '' }: IconProps) => (
  <FileIcon src="/calendar.svg" className={className} />
);

export const ClockIcon = ({ className = '' }: IconProps) => (
  <FileIcon src="/timeColor.svg" className={className} />
);

export const SendIcon = ({ className = '' }: IconProps) => (
  <FileIcon src="/send.svg" className={className} />
);

export const ChevronDownIcon = ({ className = '' }: IconProps) => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
    <path
      d="m5 8 5 5 5-5"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const BackIcon = ({ className = '' }: IconProps) => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
    <path
      d="m12 4-5 6 5 6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
