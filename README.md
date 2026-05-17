# Portal

Lightweight DOM portal (teleport) utility with fully focus management. Designed for accessible dialogs, menus, overlays, popovers, and etc.

> [!NOTE]
> Focus traversal works across portals using invisible sentinels and composed-tree-aware focus detection powered by [Power Focusable](https://github.com/y14e/power-focusable).

## Install

```bash
npm i @y14e/portal
```

```ts
// npm
import { createPortal } from '@y14e/portal';

// CDNs
import { createPortal } from 'https://esm.sh/@y14e/portal'
// or
import { createPortal } from 'https://cdn.jsdelivr.net/npm/@y14e/portal/+esm';
// or
import { createPortal } from 'https://unpkg.com/@y14e/portal/dist/index.js';
```

## 📦 APIs

### `createPortal`

Creates a portal and preserves keyboard focus order between the original DOM position and the portal.

```ts
const portal = createPortal(source, container);
// => { element: Element; cleanup: () => void }
//
// source: Element
// container (optional): Element (default: <body>)

// Element
console.log(portal.element);

// Cleanup
portal.cleanup();
```
