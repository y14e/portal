# portal.ts

Simple portal (teleport) implementation in TypeScript.

## Usage

```ts
import { createPortal } from '@y14e/portal';

createPortal(source);
// => { element: Element, cleanup: () => void }
//
// source: Element
