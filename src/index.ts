/**
 * Portal
 * Lightweight DOM portal (teleport) utility with fully focus management.
 * Designed for accessible dialogs, menus, overlays, popovers.
 *
 * @version 1.0.5
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
  host: Element,
  container = document.body,
): () => void {
  if (!(host instanceof Element)) {
    console.warn('Invalid host element');
    return () => {};
  }

  if (host.hasAttribute('data-portaled')) {
    console.warn('Already portaled');
    return () => {};
  }

  if (!(container instanceof Element)) {
    console.warn('Invalid container element. Fallback: <body> element.');
    container = document.body;
  }

  if (containsComposed(host, container)) {
    console.warn('Host element cannot contain the container element');
    return () => {};
  }

  const portal = new Portal(host, container);
  return () => portal.destroy();
}

// -----------------------------------------------------------------------------
// Core
// -----------------------------------------------------------------------------

export class Portal {
  #host!: Element;
  #container!: Element;
  #entranceSentinel!: HTMLElement;
  #exitSentinel!: HTMLElement;
  #tabIndexes = new WeakMap<Element, string | null>();
  #controller: AbortController | null = null;
  #isDestroyed = false;

  constructor(host: Element, container: Element) {
    this.#host = host;
    this.#container = container;
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

      if (index == null) {
        focusable.removeAttribute('tabindex');
      } else {
        focusable.setAttribute('tabindex', index);
      }
    });

    this.#exitSentinel.after(this.#host);
    this.#entranceSentinel.remove();
    this.#exitSentinel.remove();
    this.#host.removeAttribute('data-portaled');
  }

  #initialize() {
    this.#host.before(this.#entranceSentinel);
    this.#entranceSentinel.after(this.#exitSentinel);
    this.#container.append(this.#host);

    this.#getFocusables().forEach((focusable: Element) => {
      this.#tabIndexes.set(focusable, focusable.getAttribute('tabindex'));
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
    this.#host.setAttribute('data-portaled', '');
  }

  #onFocusIn = (event: FocusEvent) => {
    const current = event.target;
    const before = event.relatedTarget;

    if (!(before instanceof Element)) {
      return;
    }

    if (current === this.#entranceSentinel) {
      if (this.#host.contains(before)) {
        this.#moveFocus('previous');
      } else {
        const first = this.#getFocusables()[0];
        first && focusElement(first);
      }
    } else if (current === this.#exitSentinel) {
      if (this.#host.contains(before)) {
        this.#moveFocus('next');
      } else {
        const last = this.#getFocusables().at(-1);
        last && focusElement(last);
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

    if (!this.#host.contains(active)) {
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
      focusElement(focusable);
    } else {
      (event.shiftKey ? this.#entranceSentinel : this.#exitSentinel).focus();
    }
  };

  #createSentinel() {
    const sentinel = document.createElement('span');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.setAttribute('data-portal-sentinel', '');
    sentinel.setAttribute('tabindex', '0');
    sentinel.style.cssText += VISUALLY_HIDDEN_CSS;
    return sentinel;
  }

  #getFocusables() {
    return getFocusables(this.#host, {
      composed: true,
      include: (element) => this.#tabIndexes.has(element),
    });
  }

  #moveFocus(direction: 'previous' | 'next') {
    const options = {
      anchor:
        direction === 'previous' ? this.#entranceSentinel : this.#exitSentinel,
      composed: true,
    };
    const focusable =
      direction === 'previous'
        ? getPreviousFocusable(document.body, options)
        : getNextFocusable(document.body, options);
    focusable && focusElement(focusable);
  }
}

// -----------------------------------------------------------------------------
// Utils
// -----------------------------------------------------------------------------

function containsComposed(container: Node, element: Node) {
  let current: Node | null = element;

  while (current) {
    if (current === container) {
      return true;
    }

    current =
      current instanceof ShadowRoot
        ? current.mode === 'open'
          ? current.host
          : null
        : current.parentNode;
  }

  return false;
}

function focusElement(element: Element) {
  'focus' in element && typeof element.focus === 'function' && element.focus();
}

function getActiveElement() {
  let current = document.activeElement;

  while (current?.shadowRoot?.activeElement) {
    current = current.shadowRoot.activeElement;
  }

  return current;
}
