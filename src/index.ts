/**
 * Portal
 * Lightweight DOM portal (teleport) utility with fully focus management.
 * Designed for accessible dialogs, menus, overlays, popovers, and etc.
 *
 * @version 0.0.4
 * @author Yusuke Kamiyamane
 * @license MIT
 * @copyright Copyright (c) Yusuke Kamiyamane
 * @see {@link https://github.com/y14e/portal}
 */

// -----------------------------------------------------------------------------
// Imports
// -----------------------------------------------------------------------------

import {
  getFocusables,
  getNextFocusable,
  getPreviousFocusable,
} from 'power-focusable';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const VISUALLY_HIDDEN_CSS = `border: 0; clip: rect(0, 0, 0, 0); height: 1px; margin: -1px; overflow: hidden; padding: 0; position: absolute; user-select: none; white-space: nowrap; width: 1px;`;

// -----------------------------------------------------------------------------
// APIs
// -----------------------------------------------------------------------------

export function createPortal(
  source: Element,
  container = document.body,
): { element: Element; cleanup: () => void } {
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
  #source: Element;
  #container: Element;
  #target: HTMLElement;
  #entranceSentinel: HTMLElement;
  #exitSentinel: HTMLElement;
  #tabIndexes = new WeakMap<Element, number | null>();
  #controller: AbortController | null = null;
  #isDestroyed = false;

  constructor(source: Element, container: Element) {
    this.#source = source;
    this.#container = container;
    this.#target = document.createElement('div');
    this.#target.setAttribute('data-portal', '');
    this.#target.setAttribute('tabindex', '-1');
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

    this.#getFocusables().forEach((focusable: Element) => {
      if (!this.#tabIndexes.has(focusable)) {
        return;
      }

      const index = this.#tabIndexes.get(focusable);

      if (index === null) {
        focusable.removeAttribute('tabindex');
      } else {
        focusable.setAttribute('tabindex', String(index));
      }
    });

    this.#exitSentinel.after(this.#source);
    this.#target.remove();
    this.#entranceSentinel.remove();
    this.#exitSentinel.remove();
  }

  getElement() {
    return this.#target;
  }

  #initialize() {
    this.#source.before(this.#entranceSentinel);
    this.#entranceSentinel.after(this.#exitSentinel);
    this.#target.append(this.#source);
    this.#container.append(this.#target);

    this.#getFocusables().forEach((focusable: Element) => {
      const index = focusable.getAttribute('tabindex')?.trim();
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

  #onFocusIn = (event: FocusEvent) => {
    const current = event.target;
    const before = event.relatedTarget;

    if (!(before instanceof Element)) {
      return;
    }

    if (current === this.#entranceSentinel) {
      if (this.#source.contains(before)) {
        this.#focusOutside('backward');
      } else {
        const first = this.#getFocusables()[0];
        first && focus(first);
      }
    } else if (current === this.#exitSentinel) {
      if (this.#source.contains(before)) {
        this.#focusOutside('forward');
      } else {
        const last = this.#getFocusables().at(-1);
        last && focus(last);
      }
    }
  };

  #onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const active = getActiveElement();

    if (!(active instanceof Element)) {
      return;
    }

    if (!this.#source.contains(active)) {
      return;
    }

    if (!this.#getFocusables().length) {
      event.preventDefault();
      (event.shiftKey ? this.#entranceSentinel : this.#exitSentinel).focus();
    }

    const index = this.#getFocusables().indexOf(active);

    if (index === -1) {
      return;
    }

    event.preventDefault();
    const focusable = this.#getFocusables()[index + (event.shiftKey ? -1 : 1)];

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

  #focusOutside(direction: 'backward' | 'forward') {
    const options = {
      anchor:
        direction === 'backward' ? this.#entranceSentinel : this.#exitSentinel,
      composed: true,
    };
    const focusable =
      direction === 'backward'
        ? getPreviousFocusable(document.body, options)
        : getNextFocusable(document.body, options);
    focusable && focus(focusable);
  }

  #getFocusables() {
    return getFocusables(this.#source, {
      composed: true,
      include: (element) => this.#tabIndexes.has(element),
    });
  }
}

// -----------------------------------------------------------------------------
// Utils
// -----------------------------------------------------------------------------

function focus(element: Element) {
  'focus' in element && typeof element.focus === 'function' && element.focus();
}

function getActiveElement() {
  let current = document.activeElement;

  while (current?.shadowRoot?.activeElement) {
    current = current.shadowRoot.activeElement;
  }

  return current;
}
