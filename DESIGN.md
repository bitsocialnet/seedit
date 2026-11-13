---
version: alpha
name: Seedit
description: A decentralized community client with a compact old.reddit-inspired interface.
colors:
  light-page: "#ffffff"
  light-header: "#cee3f8"
  light-header-border: "#5f99cf"
  light-link: "#0000ff"
  light-action: "#336699"
  light-muted: "#888888"
  light-visited: "#551a8b"
  dark-page: "#0f0f0f"
  dark-surface: "#1f1f1f"
  dark-muted-surface: "#3e3e3e"
  dark-text: "#bfbfbf"
  dark-link: "#7dafd8"
  sprout-green: "#37bb15"
typography:
  body:
    fontFamily: "Verdana, Arial, Helvetica, sans-serif"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "normal"
  post-title:
    fontFamily: "Arial, Verdana, Helvetica, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "normal"
  community-title:
    fontFamily: "Arial, Verdana, Helvetica, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
rounded:
  legacy: "0"
spacing:
  compact: "2px"
  control: "5px"
  section: "10px"
  sidebar-width: "300px"
components:
  header-tab:
    backgroundColor: "{colors.light-header}"
    textColor: "{colors.light-action}"
    typography: "{typography.body}"
    rounded: "{rounded.legacy}"
    padding: "2px 6px 0"
  post-title:
    textColor: "{colors.light-link}"
    typography: "{typography.post-title}"
    rounded: "{rounded.legacy}"
    padding: "0"
  sidebar-box:
    backgroundColor: "{colors.light-page}"
    textColor: "{colors.light-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.legacy}"
    padding: "5px"
---

## Two interfaces

Seedit ships a modern interface (the default) and the old interface described in most of this file. Both run from one build and origin, so they share accounts, subscriptions, and routes; `src/stores/use-ui-mode-store.ts` holds the choice, and `?ui=old` or `?ui=modern` switches it once (old.seedit.app redirects to `seedit.app/?ui=old`). Routes the modern interface has not built yet render the old interface. The colors, typography, layout, and Do/Don't rules below apply to the old interface; the modern interface follows its own section at the end.

## Overview

**Creative North Star: "The Familiar Community Front Page"**

Seedit should make independently owned Bitsocial communities feel as immediately understandable as old Reddit. Its visual system is compact, browser-native, and content-first: small type, dense rows, familiar voting controls, blue links, narrow metadata, tabs, and a practical sidebar. Decentralized identity and loading state should enter through this established vocabulary instead of turning the product into a crypto dashboard.

Light mode preserves the recognizable old.reddit blue-and-white palette. Dark mode is a careful token-level adaptation of the same hierarchy, with the sprout green used as a restrained identity and status accent. Existing CSS variables in `src/themes.css` are the implementation source of truth.

## Colors

- **Page and content:** `--background`, `--background-markdown`, and `--text`.
- **Header and selected navigation:** `--background-primary`, `--background-secondary`, `--border-primary`, and `--text-primary`.
- **Links:** `--link`, `--link-primary`, and `--link-visited`; do not replace established link semantics with decorative brand color.
- **Metadata and separators:** `--text-info`, `--gray-*`, and `--border-text`.
- **Identity and positive state:** `--green`; in dark mode this resolves to the sprout asset's `#37bb15`.
- **Warnings and moderation state:** use the existing red, orange, and yellow tokens according to their current semantic roles.

### Named Rules

**The Token Rule.** Use an existing theme variable before adding a literal color. If a new semantic role is unavoidable, define it for both light and dark themes in `src/themes.css`.

**The Familiarity Rule.** Routine browsing should look like a community discussion client, not a blockchain explorer, generic SaaS dashboard, or marketing site.

## Typography

Verdana is the compact application font. Arial/Helvetica is used for larger post and community titles where the existing UI does so. Keep browser-native rendering and the established small sizes; do not add web fonts, display type, oversized headings, or spacious editorial typography to product surfaces.

- **Application chrome and metadata:** generally `10px` to `12px` Verdana/Arial.
- **Post title:** `16px`, normal weight.
- **Community/sidebar title:** about `19px`, bold.
- **Comment content:** small but readable, with the existing markdown line height.

## Layout

Seedit is deliberately dense. Feed rows place rank, vote controls, content, and metadata close together. Desktop reserves a `300px` right sidebar; mobile collapses or reorders existing structures instead of converting them into a card grid.

- Use small increments already common in the codebase: `2px`, `5px`, and `10px`.
- Keep feed and comment hierarchy visible without large whitespace bands.
- Preserve text wrapping for long community names, addresses, titles, and translated labels.
- At mobile widths, protect tap access and prevent horizontal overflow while retaining the compact hierarchy.

## Elevation and Shapes

The product is flat and square. Structure comes from theme backgrounds, 1px borders, dotted reply nesting guides, and legacy image assets. Avoid rounded cards, pills, glass, blur, gradients, soft shadows, and floating dashboard panels. A small radius or transition is acceptable only where it already communicates a specific interaction, such as spoiler reveal behavior; do not generalize it into a new visual language.

## Components

### Navigation

Use compact lowercase tabs, plain text links, and the existing selected-tab border treatment. Keep primary destinations stable and do not replace them with oversized icon navigation.

### Posts and Replies

Preserve the established rank/vote/title/domain/tagline order. Titles are links, metadata stays secondary, moderation state remains explicit, and nested replies keep their dotted hierarchy. New P2P status or identity details should be short, inspectable, and subordinate to the discussion content.

### Buttons and Forms

Prefer the existing browser-native controls, text actions, sprite-backed voting controls, and legacy large sidebar buttons. Keep labels direct. Do not introduce pill buttons or decorative icon-only controls when a familiar text action exists.

### Notices and Empty States

Use inline notices or compact bordered boxes that fit the feed. Explain what happened and what the user can do next without promotional illustration, oversized whitespace, or repeated modal interruption.

## Do's and Don'ts

### Do

- Start with the closest existing Seedit component and its light/dark theme behavior.
- Preserve old.reddit information density and interaction order.
- Keep community addresses, ownership, subscription changes, and moderation boundaries understandable.
- Verify desktop and mobile layouts in light and dark themes.
- Check keyboard access, visible focus, long text, and translated copy.

### Don't

- Do not modernize the interface for taste.
- Do not add generic dashboard cards, rounded pills, glass panels, gradients, or oversized empty layouts.
- Do not make decentralization or crypto styling dominate routine browsing.
- Do not silently change a user's chosen community or hide which address a route or subscription represents.
- Do not rely on color alone for identity, loading, error, moderation, or subscription state.

## Modern interface

The modern interface lives in `modern-*` components and views. It reads like a current community app: a sticky header with search and create, a left navigation with the account's communities, a centered feed of posts, and a right rail for context at wide widths.

- **Tokens:** use the `--m-*` variables defined for light and dark on the shell in `src/components/modern-layout/modern-layout.module.css`. Add a token there, for both themes, before using a literal color. Text on upvote, downvote, and danger fills uses `--m-on-strong`, and the sprout green is the accent.
- **Typography:** the system UI font stack at 14px, 18px semibold post titles, 12px metadata. No web fonts. Translated labels are lowercase in the locale files, so modern labels use the `sentenceCase` class rather than new keys.
- **Shape:** rounded controls, pill buttons, 12–16px media and card radii, and hover backgrounds are part of this interface. Keep decoration functional: no decorative gradients or glass effects.
- **Layout:** the left navigation is static from 1024px and a drawer below it; the right rail shows from 1200px; the header must fit at 375px without horizontal overflow.
- **Identity:** show `s/` and `u/` addresses next to names, as the old interface does, and keep the subscription, community, and moderation boundaries explicit.
- **Accessibility:** every icon-only control has an aria-label, icons are hidden from assistive technology, and focus is visible.

