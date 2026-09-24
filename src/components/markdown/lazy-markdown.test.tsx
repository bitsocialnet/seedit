// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import LazyMarkdown from './lazy-markdown';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Simulates the markdown chunk failing to load (for example a dropped network request).
vi.mock('./markdown', () => {
  throw new Error('chunk failed');
});

describe('LazyMarkdown', () => {
  it('shows plain text when the markdown chunk cannot load', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(LazyMarkdown, { content: '**still readable**' }));
    });
    await act(async () => {
      await vi.dynamicImportSettled();
    });
    expect(container.textContent).toBe('**still readable**');
    // A re-render keeps the settled failure instead of suspending on a new request.
    await act(async () => {
      root.render(createElement(LazyMarkdown, { content: 'next render' }));
    });
    expect(container.textContent).toBe('next render');
    act(() => root.unmount());
  });
});
