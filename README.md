# Portal

Lightweight DOM portal (teleport) utility with fully focus management. Designed for accessible dialogs, menus, overlays, popovers.

## Install

```bash
npm i @y14e/portal
```

```ts
// npm
import { createPortal } from '@y14e/portal@1.2.9';

// CDNs
import { createPortal } from 'https://esm.sh/@y14e/portal@1.2.9';
// or
import { createPortal } from 'https://cdn.jsdelivr.net/npm/@y14e/portal@1.2.9/+esm';
// or
import { createPortal } from 'https://esm.unpkg.com/@y14e/portal@1.2.9';
```

## 📦 APIs

### `createPortal`

Creates a portal and preserves keyboard focus order between the original DOM and the portal.

```ts
const cleanup = createPortal(host, container);
// => () => void
//
// host: Element
// container (optional): Element (default: <body>)
```

## Demo

https://y14e.github.io/portal/
