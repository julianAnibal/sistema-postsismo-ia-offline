import { describe, expect, it } from 'vitest';

import { searchKnowledge } from './knowledge';

describe('searchKnowledge', () => {
  it('returns a cited local result for inaccessible areas', () => {
    const result = searchKnowledge('¿Qué hago si el acceso es inaccesible?');

    expect(result?.answer).toContain('registre la condición como inaccesible');
    expect(result?.sources[0]?.id).toBe('field-safety');
  });

  it('does not invent a source for an unmatched query', () => {
    const result = searchKnowledge('xilófono cuántico');

    expect(result?.sources).toEqual([]);
    expect(result?.answer).toContain('No encontré');
  });
});
