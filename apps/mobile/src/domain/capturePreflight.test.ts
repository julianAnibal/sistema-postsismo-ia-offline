import { describe, expect, it } from 'vitest';

import { assessCapturePreflight } from './capturePreflight';

describe('capture metadata preflight', () => {
  it('passes a normal inspection photograph without decoding pixels', () => {
    expect(assessCapturePreflight(1920, 1080, 600_000, '2038-01-19T10:00:00.000Z')).toEqual({
      status: 'pass',
      checkedAt: '2038-01-19T10:00:00.000Z',
      scope: 'metadata-only',
      issueIds: [],
    });
  });

  it('requests review when dimensions or file size cannot support useful evidence', () => {
    const result = assessCapturePreflight(640, 360, 20_000);
    expect(result.status).toBe('review');
    expect(result.issueIds).toEqual(['resolution_low', 'file_suspiciously_small']);
  });

  it('does not call the check a blur or exposure assessment', () => {
    const result = assessCapturePreflight(0, 0, 200_000);
    expect(result.scope).toBe('metadata-only');
    expect(result.issueIds).toEqual(['dimensions_unknown']);
  });
});
