import type { PortalOptions } from './types';

export function resolveOptions(options: Partial<PortalOptions>): PortalOptions {
  let { noInlineStyle = false } = options;

  if (typeof noInlineStyle !== 'boolean') {
    console.warn('Invalid noInlineStyle option. Fallback: false.');
    noInlineStyle = false;
  }

  return { noInlineStyle };
}
