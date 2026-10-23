// Сравнение двух редакций текста по словам — для подсветки того, что
// помощник «Обоснование для ДМС» или сам врач добавил к тексту раздела.
//
// Сервер возвращает только новый текст раздела целиком, а что в нём нового,
// считается здесь. Библиотеки сравнения в проекте нет, алгоритм короткий:
// наибольшая общая подпоследовательность токенов. Сложность — произведение
// длин, поэтому для больших текстов сравнение переходит на строки.

export interface DiffSegment {
  text: string;
  /**
   * Фрагмента нет в другой редакции: в новом тексте — добавлено, в прежнем —
   * убрано. Пробелы по краям изменённого фрагмента в него не входят.
   */
  changed: boolean;
}

export interface TextDiff {
  /** Прежний текст по фрагментам; `changed` — убранное. */
  before: DiffSegment[];
  /** Новый текст по фрагментам; `changed` — добавленное. */
  after: DiffSegment[];
}

interface DiffOp {
  type: 'same' | 'add' | 'del';
  value: string;
}

/**
 * Предел произведения длин сравниваемых последовательностей. Выше него
 * сравнение по словам заменяется сравнением по строкам, а если и строк
 * слишком много — подсветка не строится. Около 6 МБ памяти на таблицу.
 */
export const MAX_DIFF_CELLS = 1_500_000;

// Слова с числами и разделителями внутри («48–72», «3.1», «С-реактивного») —
// один токен; перевод строки, пробелы и знаки препинания — отдельные.
const TOKEN_RE =
  /\n|[^\S\n]+|[\p{L}\p{N}]+(?:[.,–-][\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu;

export const tokenize = (text: string): string[] => text.match(TOKEN_RE) ?? [];

/** Строки вместе с завершающим переводом строки. */
const splitLines = (text: string): string[] =>
  text.match(/[^\n]*\n|[^\n]+$/g) ?? [];

const fitsLimit = (a: string[], b: string[]): boolean =>
  (a.length + 1) * (b.length + 1) <= MAX_DIFF_CELLS;

/** Наибольшая общая подпоследовательность: что общее, что добавлено, что убрано. */
export const diffTokens = (a: string[], b: string[]): DiffOp[] => {
  const n = a.length;
  const m = b.length;
  const width = m + 1;
  // lcs[i * width + j] — длина общей подпоследовательности хвостов a[i:] и b[j:].
  const lcs = new Int32Array((n + 1) * width);

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * width + j] =
        a[i] === b[j]
          ? lcs[(i + 1) * width + j + 1] + 1
          : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      ops.push({ type: 'same', value: a[i] });
      i++;
      j++;
    } else if (
      j < m &&
      (i === n || lcs[i * width + j + 1] >= lcs[(i + 1) * width + j])
    ) {
      ops.push({ type: 'add', value: b[j] });
      j++;
    } else {
      ops.push({ type: 'del', value: a[i] });
      i++;
    }
  }
  return ops;
};

const pushSegment = (
  segments: DiffSegment[],
  text: string,
  changed: boolean,
) => {
  if (!text) return;
  const last = segments[segments.length - 1];
  if (last && last.changed === changed) last.text += text;
  else segments.push({ text, changed });
};

/** Одна сторона сравнения: `add` — новый текст, `del` — прежний. */
const toSegments = (ops: DiffOp[], kind: 'add' | 'del'): DiffSegment[] => {
  const raw: DiffSegment[] = [];
  ops.forEach((op) => {
    if (op.type === 'same') pushSegment(raw, op.value, false);
    else if (op.type === kind) pushSegment(raw, op.value, true);
  });

  // Изменения, разделённые одним пробелом внутри строки, — одна подсветка:
  // «внутрь 1 раз в сутки» выделяется целиком, а не по словам.
  for (let k = raw.length - 2; k > 0; k--) {
    if (
      !raw[k].changed &&
      raw[k - 1].changed &&
      raw[k + 1].changed &&
      /^[^\S\n]+$/.test(raw[k].text)
    ) {
      raw[k - 1].text += raw[k].text + raw[k + 1].text;
      raw.splice(k, 2);
    }
  }

  // Пробелы и переводы строк по краям выносятся за подсветку.
  const segments: DiffSegment[] = [];
  raw.forEach((segment) => {
    if (!segment.changed) {
      pushSegment(segments, segment.text, false);
      return;
    }
    const [, lead, core, tail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(segment.text)!;
    pushSegment(segments, lead, false);
    pushSegment(segments, core, true);
    pushSegment(segments, tail, false);
  });
  return segments;
};

const unchanged = (text: string): DiffSegment[] =>
  text ? [{ text, changed: false }] : [];

/**
 * Что убрано из прежнего текста и что добавлено в новый. Склеенные фрагменты
 * каждой стороны в точности дают исходную строку этой стороны.
 */
export const diffText = (original: string, next: string): TextDiff => {
  let a = tokenize(original);
  let b = tokenize(next);

  if (!fitsLimit(a, b)) {
    a = splitLines(original);
    b = splitLines(next);
    if (!fitsLimit(a, b)) {
      return { before: unchanged(original), after: unchanged(next) };
    }
  }

  const ops = diffTokens(a, b);
  return { before: toSegments(ops, 'del'), after: toSegments(ops, 'add') };
};
