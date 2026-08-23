# Portal

Lightweight DOM portal (teleport) utility with fully focus management. Designed for accessible dialogs, menus, overlays, popovers.

## Install

```bash
npm i @y14e/portal
```

```ts
// npm
import { createPortal } from '@y14e/portal';

// CDNs
import { createPortal } from 'https://esm.sh/@y14e/portal@1.3.2';
// or
import { createPortal } from 'https://cdn.jsdelivr.net/npm/@y14e/portal@1.3.2/+esm';
// or
import { createPortal } from 'https://esm.unpkg.com/@y14e/portal@1.3.2';
```

## 📦 APIs

### `createPortal`

Creates a portal and preserves keyboard focus order between the original DOM and the portal.

```ts
const cleanup = createPortal(host, container, options);
// => () => void
//
// host: Element
// container (optional): Element (default: <body>)
// options (optional): PortalOptions
```

## 🪄 Options

```ts
interface PortalOptions {
  noInlineStyle: boolean; // default: false
}
```

## Demo

https://y14e.github.io/portal/
