/**
 * Portal
 * Lightweight DOM portal (teleport) utility with fully focus management.
 * Designed for accessible dialogs, menus, overlays, popovers.
 *
 * @version 1.2.17
 * @author Yusuke Kamiyamane
 * @license MIT
 * @copyright Copyright (c) Yusuke Kamiyamane
 * @see {@link https://github.com/y14e/portal}
 */

// -----------------------------------------------------------------------------
// Imports
// -----------------------------------------------------------------------------

import { restoreAttributes, saveAttributes } from '@y14e/attributes-utils';
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

class Portal {
  #host: Element;
  #container: Element;
  #entranceSentinel: HTMLElement;
  #exitSentinel: HTMLElement;
  #focusables = new Set<Element>();
  #controller: AbortController | null = null;
  #timer: number | undefined;
  #isDestroyed = false;

  constructor(host: Element, container: Element) {
    this.#host = host;

    if (!(container instanceof Element)) {
      console.warn('Invalid container element. Fallback: <body> element.');
      container = document.body;
    }

    this.#container = container;
    this.#entranceSentinel = this.#createSentinel();
    this.#exitSentinel = this.#createSentinel();
    this.#initialize();
  }

  destroy(): void {
    if (this.#isDestroyed) {
      return;
    }

    this.#isDestroyed = true;
    this.#controller?.abort();
    this.#controller = null;

    if (this.#timer !== undefined) {
      cancelAnimationFrame(this.#timer);
      this.#timer = undefined;
    }

    restoreAttributes([...this.#focusables]);
    this.#focusables.clear();
    this.#exitSentinel.after(this.#host);
    this.#entranceSentinel.remove();
    this.#exitSentinel.remove();
    this.#host.removeAttribute('data-portaled');
  }

  #initialize(): void {
    this.#host.before(this.#entranceSentinel);
    this.#entranceSentinel.after(this.#exitSentinel);
    this.#container.append(this.#host);
    this.#update();
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

  #onFocusIn = (event: FocusEvent): void => {
    const current = event.target;
    const before = event.relatedTarget;

    if (!(before instanceof Element)) {
      return;
    }

    if (current === this.#entranceSentinel) {
      if (this.#host.contains(before)) {
        this.#moveFocus('previous');
        return;
      }

      this.#update();
      const first = [...this.#focusables][0];

      if (first) {
        focusElement(first);
      } else {
        const next = getNextFocusable(document.body, {
          anchor: this.#exitSentinel,
          composed: true,
        });
        next && focusElement(next);
      }
    } else if (current === this.#exitSentinel) {
      if (this.#host.contains(before)) {
        this.#moveFocus('next');
        return;
      }

      this.#update();
      const last = [...this.#focusables].at(-1);

      if (last) {
        focusElement(last);
      } else {
        const previous = getPreviousFocusable(document.body, {
          anchor: this.#entranceSentinel,
          composed: true,
        });
        previous && focusElement(previous);
      }
    }
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    const { key, altKey, ctrlKey, metaKey, shiftKey } = event;

    if (key !== 'Tab' || altKey || ctrlKey || metaKey) {
      return;
    }

    const active = getActiveElement();

    if (!(active instanceof Element)) {
      return;
    }

    if (!this.#host.contains(active)) {
      return;
    }

    this.#update();
    const focusables = this.#getFocusables();

    if (focusables.length) {
      const index = focusables.indexOf(active);

      if (index !== -1) {
        event.preventDefault();
        const focusable = focusables[index + (shiftKey ? -1 : 1)];
        focusable ? focusElement(focusable) : this.#focusSentinel(shiftKey);
      }
    } else {
      event.preventDefault();
      this.#moveFocus(shiftKey ? 'previous' : 'next');
    }
  };

  #update(): void {
    const current = new Set([
      ...this.#getFocusables(),
      ...getFocusables(this.#host, { composed: true }),
    ]);

    // Removed
    for (const focusable of this.#focusables) {
      if (!current.has(focusable)) {
        focusable.isConnected && restoreAttributes([focusable]);
        this.#focusables.delete(focusable);
      }
    }

    // Added
    for (const focusable of current) {
      if (!this.#focusables.has(focusable)) {
        this.#focusables.add(focusable);
        saveAttributes([focusable], ['tabindex']);
        focusable.setAttribute('tabindex', '-1');
      }
    }
  }

  #createSentinel(): HTMLSpanElement {
    const sentinel = document.createElement('span');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.setAttribute('data-portal-sentinel', '');
    sentinel.setAttribute('tabindex', '0');
    sentinel.style.cssText += VISUALLY_HIDDEN_CSS;
    return sentinel;
  }

  #focusSentinel(isPrevious: boolean): void {
    this.#timer && cancelAnimationFrame(this.#timer);
    this.#timer = requestAnimationFrame(() =>
      (isPrevious ? this.#entranceSentinel : this.#exitSentinel).focus(),
    );
  }

  #getFocusables(): Element[] {
    return getFocusables(this.#host, {
      composed: true,
      include: (element: Element) => this.#focusables.has(element),
    });
  }

  #moveFocus(direction: 'previous' | 'next'): void {
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

function containsComposed(container: Node, element: Node): boolean {
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

function focusElement(element: Element): void {
  'focus' in element && typeof element.focus === 'function' && element.focus();
}

function getActiveElement(): Element | null {
  let current = document.activeElement;

  while (current?.shadowRoot?.activeElement) {
    current = current.shadowRoot.activeElement;
  }

  return current;
}
