// node_modules/power-focusable/dist/index.js
var FOCUSABLE_SELECTOR = `:is(a[href], area[href], button, embed, iframe, input:not([type="hidden" i]), object, select, details > summary:first-of-type, textarea, [contenteditable]:not([contenteditable="false" i]), [controls], [tabindex]):not(:disabled, [hidden], [inert], [tabindex="-1"])`;
function getFocusables(container = document.body, options = {}) {
  if (!(container instanceof Element)) {
    console.warn("Invalid container element. Fallback: <body> element.");
    container = document.body;
  }
  const { composed = false, filter = () => true } = options;
  const elements = [];
  if (composed) {
    let traverse2 = function(node) {
      if (node instanceof Element) {
        if (isFocusable(node)) {
          elements[elements.length] = node;
        }
      }
      const children = getComposedChildren(node);
      for (let i = 0, l = children.length; i < l; i++) {
        const child = children[i];
        if (!child) {
          continue;
        }
        traverse2(child);
      }
    };
    traverse2(container);
  } else {
    const candidates = container.querySelectorAll(FOCUSABLE_SELECTOR);
    for (let i = 0, l = candidates.length; i < l; i++) {
      const candidate = candidates[i];
      if (!(candidate instanceof Element)) {
        continue;
      }
      if (isFocusable(candidate)) {
        elements[elements.length] = candidate;
      }
    }
  }
  return normalizeRadioGroup(sortByTabIndex(elements)).filter(filter);
}
function getNextFocusable(container = document.body, options = {}) {
  if (!(container instanceof Element)) {
    console.warn("Invalid container element. Fallback: <body> element.");
    container = document.body;
  }
  return getRelativeFocusable(container, 1, options);
}
function getPreviousFocusable(container = document.body, options = {}) {
  if (!(container instanceof Element)) {
    console.warn("Invalid container element. Fallback: <body> element.");
    container = document.body;
  }
  return getRelativeFocusable(container, -1, options);
}
function isFocusable(element) {
  if (!(element instanceof Element)) {
    console.warn("Invalid element");
    return false;
  }
  if (element.hasAttribute("hidden") || isInert(element)) {
    return false;
  }
  if (getTabIndex(element) < 0) {
    return false;
  }
  if (!element.matches(FOCUSABLE_SELECTOR)) {
    return false;
  }
  if (isDisabledDeep(element)) {
    return false;
  }
  if (!element.checkVisibility({
    contentVisibilityAuto: true,
    opacityProperty: true,
    visibilityProperty: true
  })) {
    return false;
  }
  return true;
}
function getRelativeFocusable(container, offset, options) {
  const {
    anchor = getActiveElement(),
    composed = false,
    filter = () => true,
    wrap = false
  } = options;
  const focusables = getFocusables(container, { composed, filter });
  const { length } = focusables;
  if (!length) {
    return null;
  }
  if (!anchor || !containsComposed(container, anchor)) {
    return null;
  }
  if (!(anchor instanceof Element)) {
    return null;
  }
  const currentIndex = focusables.indexOf(anchor);
  if (currentIndex === -1) {
    return null;
  }
  const offsetIndex = currentIndex + offset;
  if ((offsetIndex < 0 || offsetIndex >= length) && !wrap) {
    return null;
  }
  return focusables[(offsetIndex + length) % length] ?? null;
}
function isDisabledDeep(element) {
  let current = element;
  while (current) {
    if (current instanceof ShadowRoot) {
      if (current.mode !== "open") {
        return false;
      }
      current = current.host;
      continue;
    }
    if (!(current instanceof Element)) {
      current = current.parentNode;
      continue;
    }
    if (current === element && isFormControl(current) && isDisabled(current)) {
      return true;
    }
    if (isInert(current)) {
      return true;
    }
    if (isFormControl(element) && current.tagName === "FIELDSET" && isDisabled(current)) {
      if (!current.querySelector(":scope > legend:first-of-type")?.contains(element)) {
        return true;
      }
    }
    current = current.parentNode;
  }
  return false;
}
function normalizeRadioGroup(elements) {
  let map = null;
  for (let i = 0, l = elements.length; i < l; i++) {
    const element = elements[i];
    if (!(element instanceof HTMLInputElement)) {
      continue;
    }
    if (!isUngroupedRadio(element)) {
      continue;
    }
    if (!map) {
      map = /* @__PURE__ */ new Map();
    }
    const key = `${element.form?.id ?? "no-form"}::${element.name}`;
    const group = map.get(key) ?? map.set(key, []).get(key);
    if (group) {
      group[group.length] = element;
    }
  }
  if (!map) {
    return elements;
  }
  const placeholder = /* @__PURE__ */ new Set();
  for (const group of map.values()) {
    placeholder.add(group.find((radio) => radio.checked) ?? group[0]);
  }
  return elements.filter((element) => {
    if (isUngroupedRadio(element)) {
      return placeholder.has(element);
    }
    return true;
  });
}
function sortByTabIndex(elements) {
  const ordered = [];
  const natural = [];
  for (let i = 0, l = elements.length; i < l; i++) {
    const element = elements[i];
    if (!element) {
      continue;
    }
    const target = getTabIndex(element) > 0 ? ordered : natural;
    target[target.length] = element;
  }
  ordered.sort((a, b) => getTabIndex(a) - getTabIndex(b));
  let count = 0;
  const sorted = new Array(ordered.length + natural.length);
  for (let i = 0, l = ordered.length; i < l; i++) {
    sorted[count++] = ordered[i];
  }
  for (let i = 0, l = natural.length; i < l; i++) {
    sorted[count++] = natural[i];
  }
  return sorted;
}
function containsComposed(container, element) {
  let current = element;
  while (current) {
    if (current === container) {
      return true;
    }
    current = current instanceof ShadowRoot ? current.mode === "open" ? current.host : null : current.parentNode;
  }
  return false;
}
function getComposedChildren(node) {
  if (node instanceof ShadowRoot) {
    return getChildren(node);
  }
  if (!(node instanceof Element)) {
    return [];
  }
  if (node instanceof HTMLSlotElement) {
    const assigned = node.assignedElements({ flatten: true });
    if (assigned.length) {
      return assigned;
    }
  }
  if (node instanceof HTMLElement && node.shadowRoot?.mode === "open") {
    return getChildren(node.shadowRoot);
  }
  return getChildren(node);
}
function getActiveElement() {
  let current = document.activeElement;
  while (current?.shadowRoot?.activeElement) {
    current = current.shadowRoot.activeElement;
  }
  return current;
}
function getChildren(node) {
  const elements = [];
  for (let child = node.firstElementChild; child; child = child.nextElementSibling) {
    elements[elements.length] = child;
  }
  return elements;
}
function getTabIndex(element) {
  return "tabIndex" in element ? Number(element.tabIndex) : 0;
}
function isDisabled(element) {
  return "disabled" in element && !!element.disabled;
}
function isFormControl(element) {
  const name = element.tagName;
  return name === "BUTTON" || name === "INPUT" || name === "SELECT" || name === "TEXTAREA";
}
function isInert(element) {
  return "inert" in element && !!element.inert;
}
function isUngroupedRadio(element) {
  return element instanceof HTMLInputElement && element.type === "radio" && !!element.name;
}

// src/index.ts
var VISUALLY_HIDDEN_CSS = `border: 0; clip: rect(0, 0, 0, 0); height: 1px; margin: -1px; overflow: hidden; padding: 0; position: absolute; user-select: none; white-space: nowrap; width: 1px;`;
function createPortal(source, container = document.body) {
  if (!(source instanceof Element)) {
    throw new Error("Invalid source element");
  }
  if (!(container instanceof Element)) {
    console.warn("Invalid container element. Fallback: <body> element.");
    container = document.body;
  }
  const portal = new Portal(source, container);
  return {
    element: portal.getElement(),
    cleanup: () => portal.destroy()
  };
}
var Portal = class {
  #source;
  #container;
  #portal;
  #entranceSentinel;
  #exitSentinel;
  #focusables = [];
  #tabIndexes = /* @__PURE__ */ new WeakMap();
  #controller = null;
  #isDestroyed = false;
  constructor(source, container = document.body) {
    this.#source = source;
    this.#container = container;
    this.#portal = document.createElement("div");
    this.#portal.setAttribute("data-portal", "");
    this.#portal.setAttribute("tabindex", "-1");
    this.#entranceSentinel = this.#createSentinel();
    this.#exitSentinel = this.#createSentinel();
    this.#focusables = getFocusables(this.#source, { composed: true });
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
        focusable.removeAttribute("tabindex");
      } else {
        focusable.setAttribute("tabindex", String(index));
      }
    });
    this.#focusables.length = 0;
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
    this.#focusables.forEach((focusable) => {
      const index = focusable.getAttribute("tabindex")?.trim();
      this.#tabIndexes.set(focusable, index === null ? null : Number(index));
      focusable.setAttribute("tabindex", "-1");
    });
    this.#controller = new AbortController();
    const { signal } = this.#controller;
    document.addEventListener("focusin", this.#onFocusIn, {
      capture: true,
      signal
    });
    document.addEventListener("keydown", this.#onKeyDown, {
      capture: true,
      signal
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
        this.#focusOutside("backward");
      } else {
        const first = this.#focusables[0];
        first && focus(first);
      }
    } else if (current === this.#exitSentinel) {
      if (this.#source.contains(before)) {
        this.#focusOutside("forward");
      } else {
        const last = this.#focusables.at(-1);
        last && focus(last);
      }
    }
  };
  #onKeyDown = (event) => {
    if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const active = getActiveElement2();
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
    const sentinel = document.createElement("span");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.setAttribute("tabindex", "0");
    sentinel.style.cssText += VISUALLY_HIDDEN_CSS;
    return sentinel;
  }
  #focusOutside(direction) {
    const options = {
      anchor: direction === "backward" ? this.#entranceSentinel : this.#exitSentinel,
      composed: true
    };
    const focusable = direction === "backward" ? getPreviousFocusable(document.body, options) : getNextFocusable(document.body, options);
    focusable && focus(focusable);
  }
};
function focus(element) {
  "focus" in element && typeof element.focus === "function" && element.focus();
}
function getActiveElement2() {
  let current = document.activeElement;
  while (current?.shadowRoot?.activeElement) {
    current = current.shadowRoot.activeElement;
  }
  return current;
}
/**
 * Portal
 * Lightweight DOM portal (teleport) utility with fully focus management.
 * Designed for accessible dialogs, menus, overlays, popovers, and etc.
 *
 * @version 0.0.3
 * @author Yusuke Kamiyamane
 * @license MIT
 * @copyright Copyright (c) Yusuke Kamiyamane
 * @see {@link https://github.com/y14e/portal}
 */
/*! Bundled license information:

power-focusable/dist/index.js:
  (**
   * Power Focusable
   * High-precision focus management utility with full composed tree support.
   * Handles complex focus rules including tabindex ordering, radio groups, inert,
   * and shadow DOM.
   *
   * @version 4.0.2
   * @author Yusuke Kamiyamane
   * @license MIT
   * @copyright Copyright (c) Yusuke Kamiyamane
   * @see {@link https://github.com/y14e/power-focusable}
   *)
*/

export { Portal, createPortal };
