import { describe, expect, it } from 'vitest';

import { createDraftInspection, createSeedState } from '../data/seed';
import { knowledgeSources } from '../data/knowledge';
import { buildDeterministicFieldDraft } from './deterministicAssistant';

describe('deterministic field draft', () => {
  it('creates a useful draft without pretending to make an official decision', () => {
    const infrastructure = createSeedState().infrastructures[0];
    const inspection = {
      ...createDraftInspection(infrastructure.id),
      observation: 'damage_observed' as const,
      condition: 'crack' as const,
      peopleNeedingSupport: 4,
      estimatedOccupants: 2,
    };
    const draft = buildDeterministicFieldDraft({
      infrastructure,
      inspection,
      mediaCount: 0,
      sources: [knowledgeSources[0]],
    });

    expect(draft.engine).toBe('deterministic');
    expect(draft.requiresHumanReview).toBe(true);
    expect(draft.missingFields).toContain('evidencia fotográfica');
    expect(draft.warnings[0]).toContain('superan');
    expect(draft.sourceIds).toEqual(['field-safety']);
    expect(draft.text).toContain('Referencias locales de prototipo');
    expect(draft.text).toContain('no determina habitabilidad');
    expect(draft.text).not.toContain('edificación segura');
  });

  it('flags contradictory manual fields instead of correcting them', () => {
    const infrastructure = createSeedState().infrastructures[0];
    const inspection = {
      ...createDraftInspection(infrastructure.id),
      observation: 'no_damage_observed' as const,
      condition: 'spalling' as const,
      damageLevel: 'moderate' as const,
    };

    const draft = buildDeterministicFieldDraft({ infrastructure, inspection, mediaCount: 1 });
    expect(draft.warnings).toHaveLength(1);
    expect(draft.warnings[0]).toContain('contradice');
    expect(inspection.condition).toBe('spalling');
  });
});
