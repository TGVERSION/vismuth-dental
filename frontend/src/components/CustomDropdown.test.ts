import { describe, expect, it, vi } from 'vitest';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CustomDropdown } from './CustomDropdown';

vi.stubGlobal('React', React);

describe('CustomDropdown selection', () => {
  it('displays the all-items option when its value is an empty string', () => {
    const html = renderToStaticMarkup(
      createElement(CustomDropdown<string>, {
        value: '',
        options: [{ value: '', label: 'Все клиники' }],
        placeholder: 'Выберите клинику',
        onChange: () => {},
      }),
    );
    expect(html).toContain('Все клиники');
    expect(html).not.toContain('Выберите клинику');
  });

  it('displays a numeric zero option rather than the placeholder', () => {
    const html = renderToStaticMarkup(
      createElement(CustomDropdown<number>, {
        value: 0,
        options: [{ value: 0, label: 'Без ограничения' }],
        placeholder: 'Выберите лимит',
        onChange: () => {},
      }),
    );
    expect(html).toContain('Без ограничения');
    expect(html).not.toContain('Выберите лимит');
  });
});
