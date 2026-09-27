// Чистая логика черновика протокола: сборка разделов по структуре, подготовка
// значений для сервера и вычисление того, что реально изменилось.
//
// Вынесено из экрана протокола, чтобы поведение, ценой ошибки в котором
// является потерянная запись врача, можно было покрыть тестами.

import type { ProtocolStructuresFields, StructureProtocolsFields } from '@/api';

export interface DraftSection {
  id: number;
  label: string;
  value: string;
  sectionKey: string;
  fieldMeta?: StructureProtocolsFields;
}

/** Снимок черновика для сравнения «есть ли несохранённые правки». */
export const serializeDraft = (
  title: string,
  sections: DraftSection[],
): string => JSON.stringify({ templateTitle: title, sections });

/**
 * Разделы формы по структуре протокола.
 * Массив копируется перед сортировкой: `structure.fields` приходит из
 * Zustand-стора, и сортировка на месте меняла бы состояние стора.
 */
export const buildSectionsFromStructure = (
  structure: ProtocolStructuresFields,
): DraftSection[] =>
  [...structure.fields]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((field, index) => ({
      id: index + 1,
      label: field.field_label || '',
      value: field.default_value || '',
      sectionKey: field.field_name,
      fieldMeta: field,
    }));

/**
 * Значения полей в виде, который ждёт сервер: ключ — UUID поля структуры.
 * Разделы без метаданных пропускаются: сохранить их некуда.
 */
export const buildFieldValues = (
  sections: DraftSection[],
): Record<string, string> => {
  const fieldValues: Record<string, string> = {};
  sections.forEach((section) => {
    const fieldId = section.fieldMeta?.id;
    if (fieldId) fieldValues[fieldId] = section.value;
  });
  return fieldValues;
};

/**
 * Непустой протокол, из которого не удалось собрать ни одного значения, —
 * это сбой сопоставления со структурой. Отправлять такое нельзя: пустой
 * `field_values` затёр бы данные на сервере.
 */
export const isFieldMappingBroken = (
  sections: DraftSection[],
  fieldValues: Record<string, string>,
): boolean => sections.length > 0 && Object.keys(fieldValues).length === 0;

/**
 * Поля, изменившиеся с последнего подтверждённого сервером состояния.
 * Отправляется только эта дельта: backend валидирует обязательные поля,
 * присутствующие в теле запроса, поэтому пустое обязательное поле, которого
 * врач не касался, не должно попадать в запрос и ронять сохранение.
 */
export const computeChangedValues = (
  current: Record<string, string>,
  lastSaved: Record<string, string>,
): Record<string, string> => {
  const changed: Record<string, string> = {};
  Object.entries(current).forEach(([fieldId, value]) => {
    if (lastSaved[fieldId] !== value) changed[fieldId] = value;
  });
  return changed;
};

/**
 * Есть ли ещё страницы справочника.
 * Страницы нумеруются с единицы, значит после страницы N загружено
 * `page * size` записей.
 */
export const hasMorePages = (
  page: number,
  size: number,
  totalCount: number,
): boolean => page * size < totalCount;
