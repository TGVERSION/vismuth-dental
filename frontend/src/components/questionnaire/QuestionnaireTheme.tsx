'use client';

import { createContext, useContext, type CSSProperties } from 'react';
import './patient-controls.css';

/**
 * Тема клиники для того, что рендерится порталом.
 *
 * CSS-переменные темы стоят на контейнере анкеты и наследуются по DOM.
 * Шторка уходит порталом в `document.body`, то есть из-под контейнера, и без
 * этого контекста получила бы нейтральные цвета из `[data-questionnaire]`
 * вместо цветов клиники.
 */
const QuestionnaireThemeContext = createContext<CSSProperties | undefined>(
  undefined,
);

export const QuestionnaireThemeProvider = QuestionnaireThemeContext;

export const useQuestionnaireTheme = () =>
  useContext(QuestionnaireThemeContext);
