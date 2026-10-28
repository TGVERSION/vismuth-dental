'use client';

import { createPortal } from 'react-dom';
import type { PrintHealthRow, PrintSheet } from '@/lib/registry-print';

interface AnketaPrintSheetProps {
  sheet: PrintSheet;
}

const Answer = ({ isOn, children }: { isOn: boolean; children: string }) => (
  <span
    className={`inline-flex h-[5.5mm] w-[11mm] items-center justify-center rounded-full ${
      isOn ? 'border-[0.4mm] border-black font-bold' : 'text-[#777]'
    }`}
  >
    {children}
  </span>
);

/** Строки «Да / Нет», как в таблице бумажного бланка. */
const YesNoTable = ({ rows }: { rows: PrintHealthRow[] }) => (
  <table className="mt-[1mm] w-full border-collapse">
    <tbody>
      {rows.map((row) => (
        <tr
          key={row.label}
          className="break-inside-avoid border-b-[0.2mm] border-[#999]"
        >
          {/* Уточнение — в ту же строку: так лист короче. */}
          <td className="py-[0.7mm] pr-[3mm]">
            {row.label}
            {row.has && row.detail ? (
              <span className="text-[9pt] italic">
                {' — '}
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
);

/**
 * Лист А4 анкеты для подписи пациента — по образцу бумажной стоматологической
 * «Анкеты о состоянии здоровья»: без врача и приёма, с датой рождения и подписью.
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
              <p className="mt-[1mm] text-center text-[9pt] text-[#333]">
                Успешность стоматологического лечения зависит от общего
                состояния здоровья, поэтому врачу важны эти сведения. Они
                составляют врачебную тайну.
              </p>
              <h1 className="mt-[2mm] text-center text-[14pt] font-bold uppercase">
                Анкета о состоянии здоровья пациента
              </h1>

              {/* Как в бумажной анкете: ФИО и дата рождения. Дату рождения
                  ссылка не спрашивает — пациент вписывает её при подписи. */}
              <table className="mt-[3mm] w-full border-collapse">
                <tbody>
                  <tr>
                    <td className="w-[38mm] py-[1mm] text-[#555]">
                      Ф. И. О. пациента
                    </td>
                    <td className="py-[1mm] font-medium">{sheet.patient}</td>
                  </tr>
                  <tr>
                    <td className="w-[38mm] py-[1mm] align-bottom text-[#555]">
                      Дата рождения
                    </td>
                    <td className="py-[1mm]">
                      <div className="h-[6mm] w-[45mm] border-b-[0.3mm] border-black" />
                    </td>
                  </tr>
                </tbody>
              </table>

              {sheet.important.length > 0 ? (
                <div className="mt-[4mm] border-[0.4mm] border-[#C62828] px-[3mm] py-[2mm] text-[#8E1F1F]">
                  <span className="font-bold">Самое важное: </span>
                  {sheet.important.join(' · ')}
                </div>
              ) : null}

              <h2 className="mt-[4mm] break-after-avoid text-[11pt] font-bold">
                Жалобы, причина обращения
              </h2>
              <p className="mt-[1mm]">{sheet.complaints || '—'}</p>

              {sheet.clarifications.length > 0 ? (
                <>
                  <h2 className="mt-[4mm] break-after-avoid text-[11pt] font-bold">
                    Уточнения
                  </h2>
                  {sheet.clarifications.map((item) => (
                    <p
                      key={item.question}
                      className="mt-[1mm] break-inside-avoid"
                    >
                      <span className="text-[#555]">{item.question}</span>{' '}
                      {item.answer}
                    </p>
                  ))}
                </>
              ) : null}

              <h2 className="mt-[4mm] break-after-avoid text-[11pt] font-bold">
                Состояние здоровья
              </h2>
              <YesNoTable rows={sheet.health} />

              {/* Раздел короткий — переносится на следующий лист целиком. */}
              {sheet.dentalHistory ? (
                <div className="break-inside-avoid">
                  <h2 className="mt-[4mm] break-after-avoid text-[11pt] font-bold">
                    Стоматологический анамнез
                  </h2>
                  <p className="mt-[1mm]">
                    <span className="text-[#555]">
                      Последнее посещение стоматолога:
                    </span>{' '}
                    {sheet.dentalHistory.lastVisit}
                  </p>
                  <YesNoTable rows={sheet.dentalHistory.signs} />
                  <p className="mt-[1mm] break-inside-avoid">
                    <span className="text-[#555]">
                      Осложнения во время или после лечения у стоматолога:
                    </span>{' '}
                    {sheet.dentalHistory.complications}
                  </p>
                </div>
              ) : null}

              {/* Согласие и подпись — одним блоком: при длинных ответах они не должны
          уехать на вторую страницу порознь. */}
              <div className="break-inside-avoid">
                <div className="mt-[4mm] flex items-end gap-[2mm]">
                  <span className="shrink-0">
                    Дополнительно хочу сообщить о своём здоровье:
                  </span>
                  <div className="h-[5mm] flex-1 border-b-[0.3mm] border-black" />
                </div>
                <ul className="mt-[4mm] flex flex-col gap-[0.8mm] font-semibold">
                  {sheet.attestation.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>

                <div className="mt-[7mm] flex items-end gap-[8mm]">
                  <div className="w-[40mm]">
                    <div className="h-[7mm] border-b-[0.3mm] border-black" />
                    <span className="text-[8pt] text-[#555]">Дата</span>
                  </div>
                  <div className="w-[40mm]">
                    <div className="h-[7mm] border-b-[0.3mm] border-black" />
                    <span className="text-[8pt] text-[#555]">
                      Подпись пациента
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="h-[7mm] border-b-[0.3mm] border-black" />
                    <span className="text-[8pt] text-[#555]">
                      Ф. И. О. полностью
                    </span>
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
