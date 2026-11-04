'use client';

import { createPortal } from 'react-dom';
import type { DentalPaperRow } from '@/api';
import { FIRST_COLUMN_LAST_ROW, type PrintSheet } from '@/lib/registry-print';

interface AnketaPrintSheetProps {
  sheet: PrintSheet;
}

/** Пустое место бланка, куда пишут от руки. */
const Blank = ({ width = '30mm' }: { width?: string }) => (
  <span
    className="inline-block border-b-[0.2mm] border-black align-bottom"
    style={{ width }}
  />
);

/** Вписанный ответ пациента или пустое место под него. */
const Filled = ({ text, width }: { text: string; width?: string }) =>
  text ? (
    <span className="font-semibold [overflow-wrap:anywhere]">{text}</span>
  ) : (
    <Blank width={width} />
  );

/** «ДА» / «НЕТ»: выбранное обведено, как ручкой на бланке. */
const Mark = ({ isOn, children }: { isOn: boolean; children: string }) => (
  <span
    className={`inline-block rounded-full px-[1mm] leading-[2.9mm] ${
      isOn
        ? 'border-[0.3mm] border-black font-bold'
        : 'border-[0.3mm] border-transparent text-[#666]'
    }`}
  >
    {children}
  </span>
);

const YesNo = ({ answer }: { answer: boolean | null }) => (
  <>
    <td className="w-[8mm] border-[0.2mm] border-black text-center">
      {answer === null ? null : <Mark isOn={answer}>ДА</Mark>}
    </td>
    <td className="w-[9mm] border-[0.2mm] border-black text-center">
      {answer === null ? null : <Mark isOn={!answer}>НЕТ</Mark>}
    </td>
  </>
);

const CELL =
  'border-[0.2mm] border-black px-[1mm] py-[0.1mm] align-top [overflow-wrap:anywhere]';

/** «Если да, то когда: …» — вписанный ответ или пустое место под него. */
const Note = ({ row }: { row: DentalPaperRow }) => (
  <span className="block">
    {row.note_label}: <Filled text={row.note} width="35mm" />
  </span>
);

const RowText = ({ row }: { row: DentalPaperRow }) => (
  <>
    {row.text}
    {row.underline.length > 0 ? (
      <>
        {' '}
        {row.underline.map((item, index) => (
          <span key={item.text}>
            <span className={item.selected ? 'font-bold underline' : ''}>
              {item.text}
            </span>
            {index < row.underline.length - 1 ? ', ' : ''}
          </span>
        ))}{' '}
        <i>(нужное подчеркнуть)</i> на:
      </>
    ) : null}
    {/* У строки с подпунктами вписанное идёт после них, как в бланке (33). */}
    {row.note_label && row.subs.length === 0 ? <Note row={row} /> : null}
  </>
);

const FormRows = ({ rows }: { rows: DentalPaperRow[] }) => (
  <table className="w-full table-fixed border-collapse">
    <tbody>
      {rows.flatMap((row) => [
        <tr key={row.number}>
          <td className={`${CELL} w-[6mm] whitespace-nowrap text-right`}>
            {row.number}.
          </td>
          <td className={CELL}>
            <RowText row={row} />
          </td>
          <YesNo answer={row.answer} />
        </tr>,
        ...row.subs.map((sub) => (
          <tr key={`${row.number}-${sub.text}`}>
            <td className={CELL} />
            <td className={`${CELL} pl-[3mm]`}>
              • {sub.text}
              {sub.note ? (
                <>
                  : <span className="font-semibold">{sub.note}</span>
                </>
              ) : null}
            </td>
            <YesNo answer={sub.answer} />
          </tr>
        )),
        ...(row.note_label && row.subs.length > 0
          ? [
              <tr key={`${row.number}-note`}>
                <td className={CELL} />
                <td className={`${CELL} pl-[3mm]`}>
                  <Note row={row} />
                </td>
                <YesNo answer={null} />
              </tr>,
            ]
          : []),
      ])}
    </tbody>
  </table>
);

/**
 * Лист А4 для подписи — бланк «Анкета о здоровье» (МК Дент) с ответами
 * пациента, на одной странице: строки 1–25 слева, 26–43 справа, как на
 * двух страницах бумажного бланка.
 *
 * Прямой потомок `body` (портал): на экране скрыт, при печати с
 * `data-print-mode="anketa"` на `<html>` остаётся единственным видимым
 * элементом (globals.css). Длинные открытые ответы целиком вынесены на
 * отдельное продолжение: уменьшение шрифта не скрывает сведения.
 */
export const AnketaPrintSheet = ({ sheet }: AnketaPrintSheetProps) => {
  const { form } = sheet;
  const left = form.rows.filter((row) => row.number <= FIRST_COLUMN_LAST_ROW);
  const right = form.rows.filter((row) => row.number > FIRST_COLUMN_LAST_ROW);
  return createPortal(
    <div
      data-print-anketa-sheet
      aria-hidden="true"
      className="text-[7.5pt] leading-[1.15] text-black"
    >
      <section data-print-anketa-main>
        <p className="text-center text-[6.5pt] font-bold">
          По решению Всемирной Организации Здравоохранения во всех медицинских
          учреждениях развитых стран введена анкета о здоровье пациента.
        </p>
        <h1 className="mt-[1mm] text-center text-[12pt] font-bold">
          Анкета о здоровье
        </h1>
        <p className="text-center text-[8.5pt] font-bold">Уважаемый пациент!</p>
        <p className="mt-[0.5mm] text-justify indent-[6mm] text-[7pt]">
          Врачу необходима информация о состоянии Вашего здоровья в целях
          обеспечения успешного и безопасного решения Ваших стоматологических
          проблем, так как процесс лечения и его ближайшие и отдаленные
          результаты могут быть связаны с заболеваниями различных органов и
          систем, приемом лекарств, физиологическими особенностями организма.
          Внимательно заполните предлагаемую анкету. Мы гарантируем, что
          сведения, указанные Вами в анкете, будут использованы только в целях
          лечения и профилактики и не будут доступны посторонним лицам.
        </p>

        <div className="mt-[1.5mm] flex flex-wrap gap-x-[6mm] gap-y-[0.8mm] text-[8.5pt]">
          <span>
            <b>Фамилия</b> <Filled text={sheet.lastName} width="45mm" />
          </span>
          <span>
            <b>Имя, отчество</b>{' '}
            <Filled text={sheet.firstMiddle} width="55mm" />
          </span>
          <span>
            <b>Дата рождения</b> <Filled text={form.birth_date} width="25mm" />
          </span>
        </div>
        <p className="mt-[1mm] text-[8pt]">
          <b>Последнее посещение стоматолога проводилось в</b>{' '}
          <Filled text={form.visit_year} width="15mm" /> <b>году, в клинике</b>{' '}
          <Filled text={form.visit_clinic} width="40mm" />
        </p>
        <p className="mt-[0.5mm] text-[8pt]">
          <b>Какую стоматологическую проблему вы хотели бы решить:</b> (нужное
          подчеркнуть){' '}
          {form.problems.map((problem, index) => (
            <span key={problem.letter}>
              <b>{problem.letter})</b>{' '}
              <span className={problem.selected ? 'font-bold underline' : ''}>
                {problem.text}
              </span>
              {index < form.problems.length - 1 ? ', ' : ''}
            </span>
          ))}
        </p>

        <div className="mt-[1.5mm] grid grid-cols-2 items-start gap-[2mm]">
          <FormRows rows={left} />
          <FormRows rows={right} />
        </div>

        <div className="mt-[2mm] break-inside-avoid text-[8pt]">
          <p>
            Я искренне ответил (а) на все пункты анкеты, хочу дополнительно
            сообщить о состоянии здоровья следующее:{' '}
            <Filled text={form.more} width="60mm" />
          </p>
          <p className="mt-[1mm] font-bold">
            Я знаю, что в случае использования лекарственных препаратов накануне
            стоматологического приема, должен (на) сообщить об этом врачу.
          </p>
          <div className="mt-[4mm] flex justify-between font-bold">
            <span>
              «<Blank width="8mm" />» <Blank width="25mm" /> 20
              <Blank width="6mm" /> г.
            </span>
            <span>
              Подпись пациента <Blank width="40mm" />
            </span>
          </div>
        </div>
      </section>
      {sheet.continuation.length > 0 ? (
        <section className="break-before-page pt-[4mm] text-[10pt] leading-normal">
          <h2 className="text-[14pt] font-bold">
            Анкета о здоровье — продолжение
          </h2>
          <p className="mt-[2mm]">
            Пациент:{' '}
            <b>
              {sheet.lastName} {sheet.firstMiddle}
            </b>
            . Дата рождения: {form.birth_date || 'не указана'}.
          </p>
          <p className="mt-[2mm]">
            Полные ответы к отмеченным на основном листе пунктам:
          </p>
          {sheet.continuation.map((entry, index) => (
            <div key={`${index}-${entry.label}`} className="mt-[4mm]">
              <h3 className="break-after-avoid font-bold">{entry.label}</h3>
              <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                {entry.text}
              </p>
            </div>
          ))}
          <p className="mt-[8mm] break-inside-avoid">
            Сведения на листе продолжения проверены. Подпись пациента{' '}
            <Blank width="45mm" />
          </p>
        </section>
      ) : null}
    </div>,
    document.body,
  );
};
