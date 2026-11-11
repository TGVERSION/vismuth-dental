import React, { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createPortal } from 'react-dom';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { ModalShell } from './ModalShell';

vi.mock('react-dom', async (original) => ({
  ...(await original<typeof import('react-dom')>()),
  createPortal: vi.fn((node) => node),
}));
vi.stubGlobal('React', React);
vi.stubGlobal('document', { body: {} });
afterAll(() => vi.unstubAllGlobals());

const renderModal = (props = {}) => {
  const onClose = vi.fn();
  const modalProps = {
    title: 'Ссылка готова',
    onClose,
    children: 'Ссылка',
    ...props,
  };
  const html = renderToStaticMarkup(createElement(ModalShell, modalProps));
  const overlay = vi.mocked(createPortal).mock.lastCall![0] as ReactElement<{
    onClick: () => void;
    children: ReactElement<{ children: ReactElement[] }>;
  }>;
  const close = overlay.props.children.props.children[0] as ReactElement<{
    onClick: () => void;
    disabled: boolean;
  }>;
  return { html, overlay, close, onClose };
};

describe('ModalShell closing', () => {
  it('keeps the explicit close button working when accidental dismissal is blocked', () => {
    const { overlay, close, onClose } = renderModal({ dismissDisabled: true });
    overlay.props.onClick();
    expect(onClose).not.toHaveBeenCalled();
    expect(close.props.disabled).toBe(false);
    close.props.onClick();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('blocks the close button and backdrop during a pending request', () => {
    const { html, overlay, close, onClose } = renderModal({
      closeDisabled: true,
    });
    expect(close.props.disabled).toBe(true);
    expect(html).toContain('disabled=""');
    overlay.props.onClick();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('allows backdrop dismissal by default', () => {
    const { overlay, onClose } = renderModal();
    overlay.props.onClick();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
