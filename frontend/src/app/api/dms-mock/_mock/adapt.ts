// Ответ заглушки помощника «Обоснование для ДМС»: детерминированные правила
// вместо модели, чтобы интерфейс можно было проверить без backend и ML.
//
// Правила по строкам раздела:
//   - препарат с дозой в начале строки («Лизиноприл 10 мг утром»): если нет
//     кратности, после дозы вставляется «внутрь 1 раз в сутки»; если нет
//     длительности — в конце «, постоянно.»;
//   - обследование или контроль («Общий анализ крови», «Контроль АД»): в
//     конце — цель и ссылка на раздел КР;
//   - витамины, БАД, гимнастика: «— обоснование в клинических рекомендациях
//     не найдено»;
//   - остальное не меняется. Раздел без изменений в ответ не попадает.
// Квадратных скобок в ответе нет: в поле протокола они стали бы шаблонными
// маркерами.
//
// Сценарии отказа — по коду МКБ в начале диагноза:
//   - кода нет            → 422 mkb_required;
//   - код на R или Z      → 422 guideline_not_found;
//   - код на Y            → 502, имитация сбоя ML.

import type {
  DmsJustifiedSection,
  DmsJustifyRequest,
  DmsJustifyResponse,
} from '@/api';
import { extractMkbCode } from '@/lib/dms-justification';

const NOT_FOUND_NOTE = 'обоснование в клинических рекомендациях не найдено';

/** Название препарата, затем доза в начале строки. */
const DRUG_DOSE_RE =
  /^[\p{L}\- ]+?\s\d+(?:[.,]\d+)?\s?(?:мг|мкг|г|мл|МЕ|ЕД)(?=\s|$|,)/iu;
const FREQUENCY_RE = /раз|р\/д|кажд|ежедневн|через \d/i;
const DURATION_RE = /дн|недел|месяц|постоянно|курс|длительно/i;
const NO_JUSTIFICATION_RE =
  /витамин|колекальциферол|омега|пробиотик|бад\b|гимнастик/i;
const EXAMINATION_RE =
  /^(общий|клинический|биохимический|анализ|исследование|определение|рентгенография|узи|экг|кт|мрт|контроль|консультация|осмотр|повторный)/i;

const appendBeforePeriod = (line: string, addition: string): string => {
  const trimmed = line.trimEnd();
  return trimmed.endsWith('.')
    ? `${trimmed.slice(0, -1)}${addition}.`
    : `${trimmed}${addition}`;
};

export const adaptLine = (line: string): string => {
  if (!line.trim()) return line;
  if (line.includes(NOT_FOUND_NOTE)) return line;

  if (NO_JUSTIFICATION_RE.test(line)) {
    return `${line.trimEnd()} — ${NOT_FOUND_NOTE}`;
  }

  const dose = DRUG_DOSE_RE.exec(line);
  if (dose) {
    let result = line;
    if (!FREQUENCY_RE.test(line)) {
      const end = dose[0].length;
      result = `${line.slice(0, end)} внутрь 1 раз в сутки${line.slice(end)}`;
    }
    if (!DURATION_RE.test(result)) {
      result = `${result.trimEnd().replace(/\.$/, '')}, постоянно.`;
    }
    return result;
  }

  if (EXAMINATION_RE.test(line.trim())) {
    return appendBeforePeriod(
      line,
      ' для оценки течения заболевания (КР, разд. 2.3)',
    );
  }

  return line;
};

export const adaptText = (text: string): string =>
  text.split('\n').map(adaptLine).join('\n');

export type MockReply =
  | { status: 200; body: DmsJustifyResponse }
  | { status: number; body: { detail: unknown } };

export const buildMockReply = (request: DmsJustifyRequest): MockReply => {
  const code = extractMkbCode(request.main_diagnosis);
  if (!code) {
    return {
      status: 422,
      body: {
        detail: {
          code: 'mkb_required',
          message: 'Provide main_diagnosis with a leading MKB code',
        },
      },
    };
  }

  const letter = code[0];
  if (letter === 'R' || letter === 'Z') {
    return {
      status: 422,
      body: {
        detail: {
          code: 'guideline_not_found',
          message: `No active guideline for ${code} (заглушка)`,
        },
      },
    };
  }
  if (letter === 'Y') {
    return {
      status: 502,
      body: { detail: 'ML service error (демо-сбой заглушки)' },
    };
  }

  const sections: DmsJustifiedSection[] = [];
  let itemsTotal = 0;
  let itemsJustified = 0;

  request.sections.forEach((section) => {
    const adapted = adaptText(section.value);
    adapted.split('\n').forEach((line) => {
      if (!line.trim()) return;
      itemsTotal += 1;
      if (!line.includes(NOT_FOUND_NOTE)) itemsJustified += 1;
    });
    if (adapted !== section.value) {
      sections.push({ key: section.key, adapted_text: adapted });
    }
  });

  return {
    status: 200,
    body: {
      guideline_code: `mock-${code}`,
      guideline_title: `Клинические рекомендации по ${code} (заглушка)`,
      sections,
      items_total: itemsTotal,
      items_justified: itemsJustified,
      error: null,
    },
  };
};
