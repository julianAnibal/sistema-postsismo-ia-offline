import { AppState, GridMetric, MapLayer } from './types';

const safeMetric = (numerator: number, denominator: number) =>
  denominator === 0 ? null : numerator / denominator;

export const computeGridMetrics = (state: AppState, layer: MapLayer): GridMetric[] => {
  const cells = Array.from(new Set(state.infrastructures.map((item) => item.gridCell)));

  return cells.map((cellId) => {
    const infrastructures = state.infrastructures.filter((item) => item.gridCell === cellId);
    const ids = new Set(infrastructures.map((item) => item.id));
    const inspections = state.inspections.filter((item) => ids.has(item.infrastructureId));
    const reviewed = inspections.filter((item) => item.status === 'reviewed');
    const media = state.media.filter((item) =>
      inspections.some((inspection) => inspection.id === item.inspectionId),
    );
    const analyzedIds = new Set(state.modelAnalyses.map((item) => item.mediaId));
    const origin = infrastructures[0];

    if (layer === 'coverage') {
      const numerator = reviewed.length;
      const denominator = infrastructures.length;
      return {
        cellId,
        x: origin.gridX,
        y: origin.gridY,
        infrastructureCount: infrastructures.length,
        numerator,
        denominator,
        value: safeMetric(numerator, denominator),
        label: `${numerator}/${denominator} revisadas`,
      };
    }

    if (layer === 'reviewed_damage') {
      const eligible = reviewed.filter((item) => item.observation !== 'not_observed');
      const numerator = eligible.filter(
        (item) => item.damageLevel === 'moderate' || item.damageLevel === 'severe',
      ).length;
      const denominator = eligible.length;
      return {
        cellId,
        x: origin.gridX,
        y: origin.gridY,
        infrastructureCount: infrastructures.length,
        numerator,
        denominator,
        value: safeMetric(numerator, denominator),
        label: denominator === 0 ? 'Sin revisión' : `${numerator}/${denominator} con daño`,
      };
    }

    if (layer === 'pending_ai') {
      const numerator = media.filter((item) => !analyzedIds.has(item.id)).length;
      const denominator = media.length;
      return {
        cellId,
        x: origin.gridX,
        y: origin.gridY,
        infrastructureCount: infrastructures.length,
        numerator,
        denominator,
        value: safeMetric(numerator, denominator),
        label: denominator === 0 ? 'Sin evidencias' : `${numerator}/${denominator} pendientes`,
      };
    }

    const numerator = reviewed.reduce((total, item) => total + item.peopleNeedingSupport, 0);
    const denominator = reviewed.reduce((total, item) => total + item.estimatedOccupants, 0);
    return {
      cellId,
      x: origin.gridX,
      y: origin.gridY,
      infrastructureCount: infrastructures.length,
      numerator,
      denominator,
      value: safeMetric(numerator, denominator),
      label: denominator === 0 ? 'Sin población' : `${numerator}/${denominator} con apoyo`,
    };
  });
};
