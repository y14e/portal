import type { PortalOptions as Options } from './types';

export function resolveOptions(options: Partial<Options>): Options {
  let { noInlineStyle = false } = options;

  if (typeof noInlineStyle !== 'boolean') {
    console.warn('Invalid noInlineStyle option. Fallback: false.');
    noInlineStyle = false;
  }

  return { noInlineStyle };
}
