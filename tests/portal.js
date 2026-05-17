/**
 * portal.ts
 *
 * @version 0.0.1
 * @author Yusuke Kamiyamane
 * @license MIT
 * @copyright Copyright (c) Yusuke Kamiyamane
 * @see {@link https://github.com/y14e/portal-ts}
 */
// -----------------------------------------------------------------------------
// Imports
// -----------------------------------------------------------------------------
import {
  getFocusables,
  getNextFocusable,
  getPreviousFocusable,
} from 'https://esm.sh/power-focusable';
// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------
const VISUALLY_HIDDEN_CSS = `border: 0; clip: rect(0, 0, 0, 0); height: 1px; margin: -1px; overflow: hidden; padding: 0; position: absolute; user-select: none; white-space: nowrap; width: 1px;`;
// -----------------------------------------------------------------------------
// APIs
// -----------------------------------------------------------------------------
export function createPortal(source, container = document.body) {
  if (!(source instanceof Element)) {
    throw new Error('Invalid source element');
  }
  if (!(container instanceof Element)) {
    console.warn('Invalid container element. Fallback: <body> element.');
    container = document.body;
  }
  const portal = new Portal(source, container);
  return {
    element: portal.getElement(),
    cleanup: () => portal.destroy(),
  };
}
// -----------------------------------------------------------------------------
// Core
// -----------------------------------------------------------------------------
export class Portal {
  #source;
  #container;
  #portal;
  #entranceSentinel;
  #exitSentinel;
  #focusables = [];
  #tabIndexes = new WeakMap();
  #controller = null;
  #isDestroyed = false;
  constructor(source, container = document.body) {
    this.#source = source;
    this.#container = container;
    this.#portal = document.createElement('div');
    this.#portal.setAttribute('data-portal', '');
    this.#portal.setAttribute('tabindex', '-1');
    this.#entranceSentinel = this.#createSentinel();
    this.#exitSentinel = this.#createSentinel();
    this.#initialize();
  }
  destroy() {
    if (this.#isDestroyed) {
      return;
    }
    this.#isDestroyed = true;
    this.#controller?.abort();
    this.#controller = null;
    this.#focusables.forEach((focusable) => {
      const index = this.#tabIndexes.get(focusable);
      if (index === null) {
        focusable.removeAttribute('tabindex');
      } else {
        focusable.setAttribute('tabindex', String(index));
      }
    });
    this.#exitSentinel.after(this.#source);
    this.#portal.remove();
    this.#entranceSentinel.remove();
    this.#exitSentinel.remove();
  }
  getElement() {
    return this.#portal;
  }
  #initialize() {
    this.#source.before(this.#entranceSentinel);
    this.#entranceSentinel.after(this.#exitSentinel);
    this.#portal.append(this.#source);
    this.#container.append(this.#portal);
    this.#focusables = getFocusables(this.#source, { composed: true });
    this.#focusables.forEach((focusable) => {
      const index = focusable.getAttribute('tabindex');
      this.#tabIndexes.set(focusable, index === null ? null : Number(index));
      focusable.setAttribute('tabindex', '-1');
    });
    this.#controller = new AbortController();
    const { signal } = this.#controller;
    document.addEventListener('focusin', this.#onFocusIn, {
      capture: true,
      signal,
    });
    document.addEventListener('keydown', this.#onKeyDown, {
      capture: true,
      signal,
    });
  }
  #onFocusIn = (event) => {
    const current = event.target;
    const before = event.relatedTarget;
    if (!(before instanceof Element)) {
      return;
    }
    if (current === this.#entranceSentinel) {
      if (this.#source.contains(before)) {
        this.#moveFocus('backward');
      } else {
        const first = this.#focusables[0];
        first && focus(first);
      }
    } else if (current === this.#exitSentinel) {
      if (this.#source.contains(before)) {
        this.#moveFocus('forward');
      } else {
        const last = this.#focusables.at(-1);
        last && focus(last);
      }
    }
  };
  #onKeyDown = (event) => {
    if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const active = document.activeElement;
    if (!(active instanceof Element)) {
      return;
    }
    if (!this.#source.contains(active)) {
      return;
    }
    if (!this.#focusables.length) {
      event.preventDefault();
      (event.shiftKey ? this.#entranceSentinel : this.#exitSentinel).focus();
    }
    const index = this.#focusables.indexOf(active);
    if (index === -1) {
      return;
    }
    event.preventDefault();
    const focusable = this.#focusables[index + (event.shiftKey ? -1 : 1)];
    if (focusable) {
      focus(focusable);
    } else {
      (event.shiftKey ? this.#entranceSentinel : this.#exitSentinel).focus();
    }
  };
  #createSentinel() {
    const sentinel = document.createElement('span');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.setAttribute('tabindex', '0');
    sentinel.style.cssText += VISUALLY_HIDDEN_CSS;
    return sentinel;
  }
  async #moveFocus(direction) {
    const options = {
      anchor:
        direction === 'backward' ? this.#entranceSentinel : this.#exitSentinel,
      composed: true,
    };
    (direction === 'backward'
      ? getPreviousFocusable(document.body, options)
      : getNextFocusable(document.body, options)
    )?.focus();
  }
}
// -----------------------------------------------------------------------------
// Utils
// -----------------------------------------------------------------------------
function focus(element) {
  'focus' in element && typeof element.focus === 'function' && element.focus();
}
