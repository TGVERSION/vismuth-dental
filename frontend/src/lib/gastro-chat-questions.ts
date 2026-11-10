// Данные демонстрационного сценария; рабочий чат получает вопросы от backend.
export interface GastroChatFollowup {
  text: string;
  next: string;
  heading: string;
  section: string;
  negative_label?: string;
  negative_text?: string;
  choices?: { value: string; label: string }[];
  next_by_choice?: Record<string, string>;
}
export const GASTRO_CHAT_FOLLOWUPS: Record<
  | 'stool_frequency'
  | 'stool_form'
  | 'stool_recent_changes'
  | 'stool_change_onset'
  | 'stool_changes'
  | 'weight_changes'
  | 'family_history',
  GastroChatFollowup
> = {
  stool_frequency: {
    text: 'Как часто у вас обычно бывает стул?\n\nВыберите подходящий вариант или напишите своими словами, например: раз в три дня или несколько раз в день.',
    choices: [
      {
        value: 'less_daily',
        label: 'Реже раза в день',
      },
      {
        value: 'daily',
        label: 'Раз в день',
      },
      {
        value: 'two_three',
        label: '2–3 раза в день',
      },
      {
        value: 'four_more',
        label: '4 раза в день и чаще',
      },
      {
        value: 'unknown',
        label: 'Не знаю',
      },
    ],
    heading: 'Частота стула',
    section: 'complaints',
    next: 'stool_form',
  },
  stool_form: {
    text: 'Какой стул бывает у вас обычно?\n\nМожно выбрать вариант или описать своими словами. Если бывает по-разному, расскажите об этом.',
    choices: [
      {
        value: 'hard',
        label: 'Твёрдый, комочками',
      },
      {
        value: 'formed',
        label: 'Оформленный',
      },
      {
        value: 'mushy',
        label: 'Кашицеобразный',
      },
      {
        value: 'watery',
        label: 'Водянистый',
      },
      {
        value: 'alternating',
        label: 'Бывает по-разному',
      },
      {
        value: 'unknown',
        label: 'Не знаю',
      },
    ],
    heading: 'Вид стула',
    section: 'complaints',
    next: 'stool_recent_changes',
  },
  stool_recent_changes: {
    text: 'Менялся ли ваш привычный стул в последнее время?\n\nНапример, стал чаще или реже, твёрже или более жидким.',
    choices: [
      {
        value: 'yes',
        label: 'Да, изменился',
      },
      {
        value: 'none',
        label: 'Без изменений',
      },
      {
        value: 'unknown',
        label: 'Не знаю',
      },
    ],
    negative_text: 'Недавних изменений привычного стула не отмечает',
    heading: 'Недавние изменения стула',
    section: 'complaints',
    next: 'stool_change_onset',
    next_by_choice: {
      none: 'weight_changes',
      unknown: 'weight_changes',
    },
  },
  stool_change_onset: {
    text: 'Когда вы заметили изменения стула?\n\nВыберите примерный срок или напишите свою дату или период.',
    choices: [
      {
        value: 'days',
        label: 'В течение последней недели',
      },
      {
        value: 'weeks',
        label: 'От недели до месяца назад',
      },
      {
        value: 'months',
        label: 'От месяца до полугода назад',
      },
      {
        value: 'longer',
        label: 'Более полугода назад',
      },
      {
        value: 'unknown',
        label: 'Не помню',
      },
    ],
    heading: 'Начало изменений стула',
    section: 'complaints',
    next: 'weight_changes',
  },
  stool_changes: {
    text: 'Изменился ли стул: как часто вы ходите в туалет и каким он стал? Если да — как давно?',
    negative_label: 'Без изменений',
    negative_text: 'Изменений стула не отмечает',
    heading: 'Изменения стула',
    section: 'complaints',
    next: 'weight_changes',
  },
  weight_changes: {
    text: 'Менялся ли вес за последние 6 месяцев без намерения его менять? Если да — на сколько килограммов и за какой срок?',
    negative_label: 'Без изменений',
    negative_text: 'Непреднамеренного изменения веса не отмечает',
    heading: 'Изменение веса',
    section: 'complaints',
    next: 'family_history',
  },
  family_history: {
    text: 'Известны ли у кровных родственников рак желудка или кишечника, болезнь Крона, язвенный колит или целиакия? Если да — у кого и что именно?',
    negative_label: 'Нет',
    negative_text: 'Такие заболевания у родственников не известны',
    heading: 'Болезни родственников',
    section: 'life_anamnesis',
    next: 'patient_info',
  },
};
export const gastroFollowupChoices = (question: GastroChatFollowup) =>
  question.choices ?? [
    { value: 'none', label: question.negative_label ?? 'Нет' },
    { value: 'unknown', label: 'Не знаю' },
  ];
