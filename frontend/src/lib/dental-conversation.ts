import type { QuestionnaireStep, QuestionnaireStepAnswer } from '@/api';
import { parseGroups, parseChecklist } from './dental-questionnaire';

export const conversationGroup = (step: QuestionnaireStep) =>
  parseGroups({
    ...step,
    groups: step.dental?.question ? [step.dental.question] : step.groups,
  })[0] ?? null;
const normalize = (text: string) =>
  text.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е');
const parts = (text: string) =>
  text
    .split(/[;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
export const toggleReply = (
  value: string,
  label: string,
  multiple: boolean,
): string => {
  if (!multiple) return label;
  const tokens = parts(value);
  return (
    tokens.some((x) => normalize(x) === normalize(label))
      ? tokens.filter((x) => normalize(x) !== normalize(label))
      : [...tokens, label]
  ).join('; ');
};

export const conversationAnswer = (
  step: QuestionnaireStep,
  value: string,
  allowed?: readonly string[],
): QuestionnaireStepAnswer => {
  const health = step.step_type === 'checklist';
  const key = step.dental?.question_key ?? conversationGroup(step)?.key ?? '';
  const base = { step_key: step.step_key, choice: `question:${key}` };
  if (health && ['нет', 'ничего из этого нет'].includes(normalize(value)))
    return { ...base, none: true };
  const options = health
    ? parseChecklist(step)
    : (conversationGroup(step)?.options ?? []);
  const selected: string[] = [],
    unknown: string[] = [],
    text: string[] = [];
  const rawSegments: string[] = [];
  let separator = '';
  // Сохраняем исходные переносы/пунктуацию свободной части ответа.
  for (const segment of value.split(/([;\n])/)) {
    if (segment === ';' || segment === '\n') {
      separator = segment;
      continue;
    }
    const token = segment.trim();
    if (!token) continue;
    const uncertain = health && normalize(token).startsWith('не знаю:');
    const label = uncertain ? token.slice(token.indexOf(':') + 1) : token;
    const option = options.find(
      (x) =>
        normalize(x.label) === normalize(label) &&
        (allowed === undefined ||
          allowed.includes(uncertain ? `unknown:${x.value}` : x.value)),
    );
    if (!option)
      rawSegments.push((rawSegments.length ? separator : '') + segment);
  }
  for (const token of parts(value)) {
    const uncertain = health && normalize(token).startsWith('не знаю:');
    const label = uncertain ? token.slice(token.indexOf(':') + 1) : token;
    const option = options.find(
      (x) =>
        normalize(x.label) === normalize(label) &&
        (allowed === undefined ||
          allowed.includes(uncertain ? `unknown:${x.value}` : x.value)),
    );
    if (option) (uncertain ? unknown : selected).push(option.value);
    else text.push(token);
  }
  if (health && ['не знаю', 'не помню'].includes(normalize(value))) {
    return {
      ...base,
      selections: { health: [], health_unknown: options.map((x) => x.value) },
    };
  }
  return {
    ...base,
    selections: health
      ? {
          health: [...new Set(selected)],
          ...(unknown.length ? { health_unknown: [...new Set(unknown)] } : {}),
        }
      : selected.length
        ? { [key]: [...new Set(selected)] }
        : {},
    ...(text.length ? { texts: { [key]: rawSegments.join('').trim() } } : {}),
  };
};
