import { describe, expect, it } from 'vitest';

import { createSeedState } from '../data/seed';
import { finalizeInspectionRevision, reopenInspectionAfterMutation } from './inspectionRevision';

describe('inspection revision safety', () => {
  it('reopens a reviewed inspection and removes its review timestamp after mutation', () => {
    const reviewed = createSeedState().inspections[0];

    expect(reopenInspectionAfterMutation({ ...reviewed, notes: 'Cambio observado' })).toMatchObject({
      status: 'draft',
      notes: 'Cambio observado',
    });
    expect(reopenInspectionAfterMutation(reviewed)).not.toHaveProperty('reviewedAt');
  });

  it('also removes a stale review timestamp from a draft', () => {
    const reviewed = createSeedState().inspections[0];
    const reopened = reopenInspectionAfterMutation({ ...reviewed, status: 'draft' });

    expect(reopened.status).toBe('draft');
    expect(reopened.reviewedAt).toBeUndefined();
  });

  it('requires an explicit review operation to restore reviewed status', () => {
    const reviewed = createSeedState().inspections[0];
    const changed = reopenInspectionAfterMutation({ ...reviewed, damageLevel: 'moderate' });
    const timestamp = '2038-01-19T12:00:00.000Z';

    expect(finalizeInspectionRevision(changed, false, timestamp).status).toBe('draft');
    expect(finalizeInspectionRevision(changed, true, timestamp)).toMatchObject({
      status: 'reviewed',
      reviewedAt: timestamp,
      damageLevel: 'moderate',
    });
  });
});
