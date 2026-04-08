import type { TemplateGroup, Template, TemplateListResponse } from './';

// Мок-данные для групп
export const mockGroups: TemplateGroup[] = [
  {
    id: '1',
    name: 'ОРВИ и грипп',
    type: 'shared',
    isExpanded: false,
    templates: [
      {
        id: '101',
        name: 'ОРВИ лёгкое течение',
        type: 'shared',
        groupId: '1',
        content: {
          complaints:
            'Жалобы на насморк, заложенность носа, першение в горле, слабость. Жалобы на насморк, заложенность носа, першение в горле, слабость. Жалобы на насморк, заложенность носа, першение в горле, слабость.Жалобы на насморк, заложенность носа, першение в горле, слабость.',
          disease_anamnesis:
            'Заболевание началось 2 дня назад с появления насморка и першения в горле. Заболевание началось 2 дня назад с появления насморка и першения в горле. Заболевание началось 2 дня назад с появления насморка и першения в горле. Заболевание началось 2 дня назад с появления насморка и першения в горле.',
          vital_parameters:
            'Температура 37.2°C, пульс 78 уд/мин, АД 120/80 мм рт.ст.',
          objective_data:
            ' Зев гиперемирован, миндалины не увеличены. Дыхание везикулярное, хрипов нет. Зев гиперемирован, миндалины не увеличены. Дыхание везикулярное, хрипов нет. Зев гиперемирован, миндалины не увеличены. Дыхание везикулярное, хрипов нет.  Зев гиперемирован, миндалины не увеличены. Дыхание везикулярное, хрипов нет. Зев гиперемирован, миндалины не увеличены. Дыхание везикулярное, хрипов нет.',
          main_diagnosis: 'J00 - Острый назофарингит',
          recommendations:
            'Обильное тёплое питьё, полоскание горла раствором соды, симптоматическая терапия. Обильное тёплое питьё, полоскание горла раствором соды, симптоматическая терапия. Обильное тёплое питьё, полоскание горла раствором соды, симптоматическая терапия. Обильное тёплое питьё, полоскание горла раствором соды, симптоматическая терапия.',
        },
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      },
      {
        id: '102',
        name: 'Грипп средней тяжести',
        type: 'shared',
        groupId: '1',
        content: {
          complaints:
            'Жалобы на повышение температуры до 38.5°C, озноб, головную боль, ломоту в теле, сухой кашель.',
          disease_anamnesis:
            'Заболел остро 1 день назад. Температура поднялась до 38.5°C.',
          vital_parameters:
            'Температура 38.5°C, пульс 90 уд/мин, АД 130/85 мм рт.ст.',
          objective_data:
            'Зев гиперемирован. Дыхание жёсткое, единичные сухие хрипы.',
          main_diagnosis: 'J11.1 - Грипп с другими респираторными проявлениями',
          recommendations:
            'Постельный режим, обильное питьё, жаропонижающие при температуре выше 38.5°C.',
        },
        createdAt: '2024-01-20T14:30:00Z',
        updatedAt: '2024-01-20T14:30:00Z',
      },
    ],
  },
  {
    id: '2',
    name: 'COVID-19',
    type: 'shared',
    isExpanded: false,
    templates: [
      {
        id: '201',
        name: 'COVID-19 лёгкая форма',
        type: 'shared',
        groupId: '2',
        content: {
          complaints:
            'Жалобы на сухой кашель, повышение температуры до 37.8°C, слабость, потерю обоняния.',
          disease_anamnesis:
            'Заболевание началось 3 дня назад. Контакт с больным COVID-19.',
          vital_parameters:
            'Температура 37.8°C, пульс 82 уд/мин, сатурация 96%.',
          objective_data: 'Дыхание везикулярное, хрипов нет. Зев спокойный.',
          main_diagnosis: 'U07.1 - COVID-19, вирус идентифицирован',
          recommendations:
            'Самоизоляция 14 дней, симптоматическая терапия, контроль сатурации.',
        },
        createdAt: '2024-02-01T09:15:00Z',
        updatedAt: '2024-02-01T09:15:00Z',
      },
    ],
  },
];

// Мок-данные для шаблонов без группы
export const mockTemplates: Template[] = [
  {
    id: '301',
    name: 'Профилактический осмотр',
    type: 'personal',
    content: {
      complaints: 'Жалоб нет.',
      disease_anamnesis: 'Хронические заболевания отрицает.',
      life_anamnesis: 'Вредные привычки: не курит, алкоголь умеренно.',
      vital_parameters:
        'Температура 36.6°C, пульс 72 уд/мин, АД 120/80 мм рт.ст.',
      objective_data:
        'Общее состояние удовлетворительное. Кожа чистая. Дыхание везикулярное.',
      recommendations: 'Диспансерное наблюдение. Следующий осмотр через 1 год.',
    },
    createdAt: '2024-02-10T11:00:00Z',
    updatedAt: '2024-02-10T11:00:00Z',
  },
  {
    id: '302',
    name: 'COVID-19 длинный шаблон длинный шаблон длинный шаблон длинный',
    type: 'shared',
    content: {
      complaints:
        'Жалобы на периодические головные боли, головокружение, шум в ушах.',
      disease_anamnesis: 'Страдает АГ около 5 лет. Принимает эналаприл 10 мг.',
      vital_parameters: 'АД 150/95 мм рт.ст., пульс 78 уд/мин.',
      objective_data: 'Тоны сердца приглушены. Акцент II тона над аортой.',
      main_diagnosis: 'I10 - Эссенциальная гипертензия',
      recommendations:
        'Продолжить приём эналаприла. Контроль АД ежедневно. Диета с ограничением соли.',
    },
    createdAt: '2024-02-15T16:45:00Z',
    updatedAt: '2024-02-15T16:45:00Z',
  },
];

// Имитация задержки сети
const delay = (ms: number = 500) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Генерация уникального ID
const generateId = () => Math.random().toString(36).substr(2, 9);

export const mockTemplateApi = {
  // Получить все шаблоны и группы
  getList: async (): Promise<TemplateListResponse> => {
    await delay(800);
    return {
      groups: mockGroups,
      templates: mockTemplates,
    };
  },

  // Создать группу
  createGroup: async (data: {
    name: string;
    type: 'personal' | 'shared';
  }): Promise<TemplateGroup> => {
    await delay(600);
    const newGroup: TemplateGroup = {
      id: generateId(),
      name: data.name,
      type: data.type,
      templates: [],
      isExpanded: false,
    };
    mockGroups.push(newGroup);
    return newGroup;
  },

  // Создать шаблон
  createTemplate: async (data: {
    name: string;
    type: 'personal' | 'shared';
    groupId?: string;
    content: Record<string, string>;
  }): Promise<Template> => {
    await delay(600);
    const newTemplate: Template = {
      id: generateId(),
      name: data.name,
      type: data.type,
      groupId: data.groupId,
      content: data.content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (data.groupId) {
      const group = mockGroups.find((g) => g.id === data.groupId);
      if (group && group.templates) {
        group.templates.push(newTemplate);
      }
    } else {
      mockTemplates.push(newTemplate);
    }

    return newTemplate;
  },

  // Обновить группу
  updateGroup: async (
    id: string,
    data: { name?: string },
  ): Promise<TemplateGroup> => {
    await delay(400);
    const group = mockGroups.find((g) => g.id === id);
    if (!group) throw new Error('Группа не найдена');

    if (data.name) {
      group.name = data.name;
    }
    group.updatedAt = new Date().toISOString();

    return group;
  },

  // Обновить шаблон
  updateTemplate: async (
    id: string,
    data: Partial<Template>,
  ): Promise<Template> => {
    await delay(400);

    // Ищем в группах
    for (const group of mockGroups) {
      const template = group.templates?.find((t) => t.id === id);
      if (template) {
        Object.assign(template, data);
        template.updatedAt = new Date().toISOString();
        return template;
      }
    }

    // Ищем в шаблонах без группы
    const template = mockTemplates.find((t) => t.id === id);
    if (!template) throw new Error('Шаблон не найден');

    Object.assign(template, data);
    template.updatedAt = new Date().toISOString();

    return template;
  },

  // Удалить группу
  deleteGroup: async (id: string): Promise<void> => {
    await delay(400);
    const index = mockGroups.findIndex((g) => g.id === id);
    if (index === -1) throw new Error('Группа не найдена');
    mockGroups.splice(index, 1);
  },

  // Удалить шаблон
  deleteTemplate: async (id: string): Promise<void> => {
    await delay(400);

    // Ищем в группах
    for (const group of mockGroups) {
      if (group.templates) {
        const index = group.templates.findIndex((t) => t.id === id);
        if (index !== -1) {
          group.templates.splice(index, 1);
          return;
        }
      }
    }

    // Ищем в шаблонах без группы
    const index = mockTemplates.findIndex((t) => t.id === id);
    if (index === -1) throw new Error('Шаблон не найден');
    mockTemplates.splice(index, 1);
  },

  // Применить шаблон (получить контент)
  applyTemplate: async (id: string): Promise<Template> => {
    await delay(300);

    // Ищем в группах
    for (const group of mockGroups) {
      const template = group.templates?.find((t) => t.id === id);
      if (template) return template;
    }

    // Ищем в шаблонах без группы
    const template = mockTemplates.find((t) => t.id === id);
    if (!template) throw new Error('Шаблон не найден');

    return template;
  },
};
