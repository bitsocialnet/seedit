// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import JsonEditor, { type JsonEditorProps } from './json-editor';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

// Make the lazy react-ace chunk fail to load so the error boundary shows the textarea fallback.
vi.mock('react-ace', () => {
  throw new Error('react-ace failed to load');
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../hooks/use-is-mobile', () => ({
  default: () => false,
}));

vi.mock('../../stores/use-theme-store', () => ({
  default: (selector: (state: { theme: string }) => unknown) => selector({ theme: 'light' }),
}));

let container: HTMLDivElement;
let root: Root;

const renderEditor = async (props: Partial<JsonEditorProps> = {}) => {
  const onChange = vi.fn();
  await act(async () => {
    root.render(createElement(JsonEditor, { name: 'TEST_EDITOR', value: '{"a":1}', onChange, ...props }));
  });
  // The rejected chunk import settles asynchronously before the boundary re-renders with the fallback.
  for (let attempt = 0; attempt < 20 && !container.querySelector('textarea'); attempt++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
  return onChange;
};

describe('JsonEditor', () => {
  beforeAll(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('falls back to a textarea holding the current value when the advanced editor fails to load', async () => {
    await renderEditor();
    const textarea = container.querySelector('textarea');

    expect(textarea).not.toBeNull();
    expect(textarea?.value).toBe('{"a":1}');
    expect(container.textContent).toContain('editor_fallback_warning');
  });

  it('reports fallback edits through onChange', async () => {
    const onChange = await renderEditor();
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;

    await act(async () => {
      // Bypass React's value tracker so the controlled textarea sees a real change.
      setValue?.call(textarea, '{"a":2}');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith('{"a":2}');
  });

  it('disables the fallback textarea while read-only', async () => {
    await renderEditor({ readOnly: true });

    expect(container.querySelector('textarea')?.disabled).toBe(true);
  });
});
