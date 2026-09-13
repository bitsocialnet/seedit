// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FAQ from './faq';

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAccount: () => undefined,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

let root: Root;
let container: HTMLDivElement;

const renderFaq = (footer?: React.ReactNode) =>
  act(() => {
    root.render(createElement(HashRouter, null, createElement(FAQ, { footer })));
  });

describe('FAQ', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('omits the useful links section and its table of contents entry without a footer', () => {
    renderFaq();

    expect(container.querySelector('#usefulLinks')).toBeNull();
    expect(container.querySelector('a[href$="#usefulLinks"]')).toBeNull();
    expect(container.textContent).not.toContain('Useful links');
  });

  it('renders the footer slot inside the useful links section with a matching table of contents entry', () => {
    renderFaq(createElement('span', null, 'footer-slot'));

    const usefulLinks = container.querySelector('#usefulLinks');
    expect(usefulLinks).not.toBeNull();
    expect(usefulLinks!.textContent).toContain('footer-slot');

    const tocLink = container.querySelector<HTMLAnchorElement>('a[href$="#usefulLinks"]');
    expect(tocLink).not.toBeNull();
    expect(tocLink!.textContent).toBe('Useful links');
  });
});
