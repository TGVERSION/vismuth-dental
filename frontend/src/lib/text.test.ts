import { describe, it, expect } from 'vitest';
import { escapeHtml, formatTextWithPlaceholders } from './text';

describe('escapeHtml', () => {
  it('экранирует символы, значимые для разметки', () => {
    expect(escapeHtml('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&#39;');
  });

  it('не трогает обычный текст', () => {
    expect(escapeHtml('Жалобы на головную боль')).toBe(
      'Жалобы на головную боль',
    );
  });
});

describe('formatTextWithPlaceholders', () => {
  // Регрессия на находку H1: текст поля вставляется через innerHTML, поэтому
  // разметка из значения не должна доживать до DOM.
  it('не пропускает тег из текста врача в разметку', () => {
    const result = formatTextWithPlaceholders('<img src=x onerror=alert(1)>');

    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
  });

  it('размечает маркеры вида [что-то]', () => {
    const result = formatTextWithPlaceholders('Осмотр [дата]');

    expect(result).toContain('class="placeholder-bracket"');
    expect(result).toContain('data-placeholder="дата"');
    expect(result).toContain('[дата]');
  });

  it('размечает несколько маркеров', () => {
    const result = formatTextWithPlaceholders('[а] и [б]');

    expect(result.match(/placeholder-bracket/g)).toHaveLength(2);
  });

  it('экранирует разметку внутри маркера', () => {
    const result = formatTextWithPlaceholders('[<script>]');

    expect(result).not.toContain('<script>');
  });

  it('оставляет текст без маркеров нетронутым', () => {
    expect(formatTextWithPlaceholders('Просто текст')).toBe('Просто текст');
  });
});
