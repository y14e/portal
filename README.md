# portal.ts

Lightweight DOM portal (teleport) utility with fully focus management. Designed for accessible dialogs, menus, overlays, popovers, and etc.

> [!NOTE]
> Focus traversal works across portals using invisible sentinels and composed-tree-aware focus detection powered by [Power Focusable](https://github.com/y14e/power-focusable).

## Install

```bash
npm i y14e@portal
```

```ts
// npm
import { createPortal } from 'y14e@portal';

// CDNs
import { createPortal } from 'https://esm.sh/y14e@portal'
// or
import { createPortal } from 'https://cdn.jsdelivr.net/npm/y14e@portal/dist/index.js';
// or
import { createPortal } from 'https://unpkg.com/y14e@portal/dist/index.js';
```

## Usage

```ts
import { createPortal } from '@y14e/portal';

createPortal(source);
// => { element: Element, cleanup: () => void }
//
// source: Element
