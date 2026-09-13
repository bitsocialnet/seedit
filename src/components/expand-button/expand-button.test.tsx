// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ExpandButton from './expand-button';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

let container: HTMLDivElement;
let root: Root;

describe('ExpandButton', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const renderCrosspostButton = async (expanded: boolean, toggleExpanded = vi.fn()) => {
    await act(async () => {
      root.render(createElement(ExpandButton, { crosspost: true, expanded, hasThumbnail: false, toggleExpanded }));
    });
    return toggleExpanded;
  };

  it('uses old Reddit crosspost classes while collapsed', async () => {
    const toggleExpanded = await renderCrosspostButton(false);
    const button = container.querySelector('.expando-button.collapsed.crosspost');

    expect(button).not.toBeNull();
    await act(async () => {
      button?.parentElement?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(toggleExpanded).toHaveBeenCalledOnce();
  });

  it('uses the shared expanded state when open', async () => {
    await renderCrosspostButton(true);

    expect(container.querySelector('.expando-button.expanded.crosspost')).not.toBeNull();
  });
});
