'use client';

import { createPortal } from 'react-dom';
import type { PrintSheet } from '@/lib/registry-print';

interface AnketaPrintSheetProps {
  sheet: PrintSheet;
}

const Answer = ({ isOn, children }: { isOn: boolean; children: string }) => (
  <span
    className={`inline-flex h-[7mm] w-[11mm] items-center justify-center rounded-full ${
      isOn ? 'border-[0.4mm] border-black font-bold' : 'text-[#777]'
    }`}
  >
    {children}
  </span>
);

/**
 * Лист А4 анкеты для подписи пациента — по макету презентации для клиник.
 *
 * Прямой потомок `body` (портал): на экране скрыт, при печати с
 * `data-print-mode="anketa"` на `<html>` остаётся единственным видимым
 * элементом (globals.css). Размеры — в миллиметрах и пунктах: лист должен
 * уместиться на одну страницу в любом браузере.
 */
export const AnketaPrintSheet = ({ sheet }: AnketaPrintSheetProps) =>
  createPortal(
    <div
      data-print-anketa-sheet
      aria-hidden="true"
      className="text-[10pt] leading-snug text-black"
    >
      {/* Шапка — заголовок внешней таблицы: при длинной анкете браузер
          повторяет его на каждой странице, и на второй странице тоже видно,
          чья это анкета. */}
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <td className="p-0 pb-[3mm]">
              <div className="flex items-baseline justify-between gap-[4mm] border-b-[0.3mm] border-black pb-[2mm]">
                <span>
                  <span className="text-[12pt] font-bold">
                    {sheet.clinicName}
                  </span>
                  <span className="text-[10pt]"> · {sheet.patient}</span>
                </span>
                <span className="shrink-0 text-[9pt] text-[#555]">
                  {sheet.filled}
                </span>
              </div>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-0">
              <h1 className="mt-[2mm] text-[15pt] font-bold">
                Анкета о состоянии здоровья пациента
              </h1>

              <table className="mt-[3mm] w-full border-collapse">
                <tbody>
                  {[
                    ['Пациент', sheet.patient],
                    ['Врач', sheet.doctor],
                    ['Приём', sheet.appointment],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <td className="w-[35mm] py-[0.8mm] text-[#555]">
                        {label}
                      </td>
                      <td className="py-[0.8mm] font-medium">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {sheet.important.length > 0 ? (
                <div className="mt-[4mm] border-[0.4mm] border-[#C62828] px-[3mm] py-[2mm] text-[#8E1F1F]">
                  <span className="font-bold">Самое важное: </span>
                  {sheet.important.join(' · ')}
                </div>
              ) : null}

              <h2 className="mt-[4mm] break-after-avoid text-[11pt] font-bold">
                С чем пришёл пациент
              </h2>
              <p className="mt-[1mm]">{sheet.complaints || '—'}</p>

              <h2 className="mt-[4mm] break-after-avoid text-[11pt] font-bold">
                Здоровье
              </h2>
              <table className="mt-[1mm] w-full border-collapse">
                <tbody>
                  {sheet.health.map((row) => (
                    <tr
                      key={row.label}
                      className="break-inside-avoid border-b-[0.2mm] border-[#999]"
                    >
                      <td className="py-[1.2mm] pr-[3mm]">
                        {row.label}
                        {row.has && row.detail ? (
                          <span className="block text-[9pt] italic">
                            {row.detail}
                          </span>
                        ) : null}
                      </td>
                      <td className="w-[13mm] text-center">
                        <Answer isOn={row.has}>Да</Answer>
                      </td>
                      <td className="w-[13mm] text-center">
                        <Answer isOn={!row.has}>Нет</Answer>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Согласие и подпись — одним блоком: при длинных ответах они не должны
          уехать на вторую страницу порознь. */}
              <div className="break-inside-avoid">
                <p className="mt-[5mm]">{sheet.attestation}</p>

                <div className="mt-[10mm] flex gap-[15mm]">
                  <div className="flex-1">
                    <div className="h-[8mm] border-b-[0.3mm] border-black" />
                    <span className="text-[9pt] text-[#555]">
                      Подпись пациента
                    </span>
                  </div>
                  <div className="w-[45mm]">
                    <div className="h-[8mm] border-b-[0.3mm] border-black" />
                    <span className="text-[9pt] text-[#555]">Дата</span>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>,
    document.body,
  );
