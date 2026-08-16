import type { Inspection } from './types';

export const reopenInspectionAfterMutation = (inspection: Inspection): Inspection => {
  const { reviewedAt: _reviewedAt, ...withoutReviewTimestamp } = inspection;
  return { ...withoutReviewTimestamp, status: 'draft' };
};

export const finalizeInspectionRevision = (
  inspection: Inspection,
  markReviewed: boolean,
  reviewedAt = new Date().toISOString(),
): Inspection =>
  markReviewed
    ? { ...inspection, status: 'reviewed', reviewedAt }
    : reopenInspectionAfterMutation(inspection);
