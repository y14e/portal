# portal.ts

Lightweight DOM portal (teleport) utility with fully focus management. Designed for accessible dialogs, menus, overlays, popovers, and etc.

> [!NOTE]
> Focus traversal works across portals using invisible sentinels and composed-tree-aware focus detection powered by [Power Focusable](https://www.npmjs.com/package/power-focusable).

## Usage

```ts
import { createPortal } from '@y14e/portal';

createPortal(source);
// => { element: Element, cleanup: () => void }
//
// source: Element
