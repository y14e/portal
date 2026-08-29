/**
 * Portal
 * Lightweight DOM portal (teleport) utility with fully focus management.
 * Designed for accessible dialogs, menus, overlays, popovers.
 *
 * @version 1.3.3
 * @author Yusuke Kamiyamane
 * @license MIT
 * @copyright Copyright (c) Yusuke Kamiyamane
 * @see {@link https://github.com/y14e/portal}
 */

// -----------------------------------------------------------------------------
// Imports
// -----------------------------------------------------------------------------

import * as utils from '@y14e/attribute-utils';
import * as pf from 'power-focusable';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface PortalOptions {
  noInlineStyle: boolean;
}

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
  options: Partial<PortalOptions> = {},
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

  const portal = new Portal(host, container, options);
  return () => portal.destroy();
}

// -----------------------------------------------------------------------------
// Core
// -----------------------------------------------------------------------------

class Portal {
  #host: Element;
  #container: Element;
  #settings: PortalOptions;
  #entranceSentinel: HTMLSpanElement;
  #exitSentinel: HTMLSpanElement;
  #focusables = new Set<Element>();
  #controller: AbortController | null = null;
  #isDestroyed = false;

  constructor(
    host: Element,
    container: Element,
    options: Partial<PortalOptions> = {},
  ) {
    this.#host = host;

    if (!(container instanceof Element)) {
      console.warn('Invalid container element. Fallback: <body> element.');
      container = document.body;
    }

    this.#container = container;
    let { noInlineStyle = false } = options;

    if (typeof noInlineStyle !== 'boolean') {
      console.warn('Invalid noInlineStyle option. Fallback: false.');
      noInlineStyle = false;
    }

    this.#settings = { noInlineStyle };
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
    utils.restoreAttributes([...this.#focusables]);
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

    [this.#entranceSentinel, this.#exitSentinel].forEach((sentinel) => {
      sentinel.addEventListener('focus', this.#onFocus, { signal });
    });

    this.#host.addEventListener('keydown', this.#onKeyDown, { signal });
    this.#host.setAttribute('data-portaled', '');
  }

  #onFocus = (event: FocusEvent): void => {
    const { currentTarget: sentinel, relatedTarget: previous } = event;

    if (!(previous instanceof Element)) {
      return;
    }

    if (sentinel === this.#entranceSentinel) {
      if (this.#host.contains(previous)) {
        this.#moveFocus('previous');
        return;
      }

      this.#update();
      const first = [...this.#focusables][0];
      first ? pf.focusElement(first) : this.#moveFocus('next');
    } else {
      if (this.#host.contains(previous)) {
        this.#moveFocus('next');
        return;
      }

      this.#update();
      const last = [...this.#focusables].at(-1);
      last ? pf.focusElement(last) : this.#moveFocus('previous');
    }
  };

  #onKeyDown = (event: Event): void => {
    if (!(event instanceof KeyboardEvent)) {
      return;
    }

    const { key, altKey, ctrlKey, metaKey, shiftKey } = event;

    if (key !== 'Tab' || altKey || ctrlKey || metaKey) {
      return;
    }

    const active = pf.getActiveElement();

    if (!(active instanceof Element)) {
      return;
    }

    this.#update();
    const focusables = this.#getFocusables();

    if (focusables.length) {
      const index = focusables.indexOf(active);

      if (index >= 0) {
        event.preventDefault();
        const focusable = focusables[index + (shiftKey ? -1 : 1)];
        focusable ? pf.focusElement(focusable) : this.#focusSentinel(shiftKey);
      }
    } else {
      event.preventDefault();
      this.#moveFocus(shiftKey ? 'previous' : 'next');
    }
  };

  #update(): void {
    const current = new Set([
      ...this.#getFocusables(),
      ...pf.getFocusables(this.#host, { composed: true }),
    ]);

    // Removed
    for (const focusable of this.#focusables) {
      if (!current.has(focusable)) {
        utils.restoreAttributes(focusable);
        this.#focusables.delete(focusable);
      }
    }

    // Added
    for (const focusable of current) {
      if (!this.#focusables.has(focusable)) {
        this.#focusables.add(focusable);
        utils.saveAttributes(focusable, 'tabindex');
        focusable.setAttribute('tabindex', '-1');
      }
    }
  }

  #createSentinel(): HTMLSpanElement {
    const sentinel = document.createElement('span');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.setAttribute('data-portal-sentinel', '');
    sentinel.setAttribute('tabindex', '0');

    if (!this.#settings.noInlineStyle) {
      sentinel.style.cssText += VISUALLY_HIDDEN_CSS;
    }

    return sentinel;
  }

  #focusSentinel(isPrevious: boolean): void {
    (isPrevious ? this.#entranceSentinel : this.#exitSentinel).focus();
  }

  #getFocusables(): Element[] {
    return pf.getFocusables(this.#host, {
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
        ? pf.getPreviousFocusable(document.body, options)
        : pf.getNextFocusable(document.body, options);
    focusable && pf.focusElement(focusable);
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
