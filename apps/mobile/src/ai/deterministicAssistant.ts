import {
  accessLabels,
  conditionLabels,
  damageLabels,
  elementLabels,
  infrastructureLabels,
  needLabels,
  observationLabels,
  observabilityLabels,
  viewLabels,
} from '../domain/labels';
import { Infrastructure, Inspection, KnowledgeSource } from '../domain/types';

export interface DeterministicFieldDraft {
  engine: 'deterministic';
  artifactId: 'field-draft-rules';
  artifactVersion: '1.0.0';
  text: string;
  missingFields: string[];
  warnings: string[];
  sourceIds: string[];
  requiresHumanReview: true;
}

export interface DeterministicDraftInput {
  infrastructure: Infrastructure;
  inspection: Inspection;
  mediaCount: number;
  sources?: KnowledgeSource[];
}

const collectMissingFields = (inspection: Inspection, mediaCount: number): string[] => {
  const missing: string[] = [];
  if (inspection.access === 'unknown') missing.push('acceso');
  if (inspection.observation === 'unknown') missing.push('alcance de la observación');
  if (inspection.observation === 'damage_observed' && inspection.element === 'unknown') {
    missing.push('elemento observado');
  }
  if (mediaCount === 0) missing.push('evidencia fotográfica');
  if (inspection.notes.trim().length === 0) missing.push('notas de campo');
  return missing;
};

const collectWarnings = (inspection: Inspection): string[] => {
  const warnings: string[] = [];
  if (inspection.peopleNeedingSupport > inspection.estimatedOccupants) {
    warnings.push('Las personas que requieren apoyo superan el total estimado de ocupantes.');
  }
  if (
    inspection.observation === 'no_damage_observed' &&
    (inspection.condition !== 'none' || !['none', 'unknown'].includes(inspection.damageLevel))
  ) {
    warnings.push('“Sin daño visible” contradice la condición o el nivel manual registrado.');
  }
  if (inspection.observation === 'not_observed' && inspection.damageLevel !== 'unknown') {
    warnings.push('Una zona no observada no debe conservar un nivel de daño concluyente.');
  }
  if (inspection.observability === 'poor') {
    warnings.push('La observabilidad es deficiente; documente la limitación o repita la captura si es seguro.');
  }
  return warnings;
};

export const buildDeterministicFieldDraft = ({
  infrastructure,
  inspection,
  mediaCount,
  sources = [],
}: DeterministicDraftInput): DeterministicFieldDraft => {
  const missingFields = collectMissingFields(inspection, mediaCount);
  const warnings = collectWarnings(inspection);
  const needs = inspection.needs.length
    ? inspection.needs.map((need) => needLabels[need]).join(', ')
    : 'ninguna registrada';
  const lines = [
    'Borrador estructurado para revisión humana',
    `Infraestructura: ${infrastructure.code} · ${infrastructure.name} (${infrastructureLabels[infrastructure.type]}).`,
    `Acceso registrado: ${accessLabels[inspection.access]}.`,
    `Alcance observado: ${observationLabels[inspection.observation]}.`,
    `Etiqueta manual: ${elementLabels[inspection.element]} · ${conditionLabels[inspection.condition]} · nivel ${damageLabels[inspection.damageLevel]}.`,
    `Calidad de observación: ${observabilityLabels[inspection.observability]}; vista ${viewLabels[inspection.viewType]}.`,
    `Evidencia vinculada: ${mediaCount} fotografía(s).`,
    `Población: ${inspection.peopleNeedingSupport} de ${inspection.estimatedOccupants} personas estimadas requieren apoyo; necesidades: ${needs}.`,
  ];

  if (inspection.notes.trim()) lines.push(`Notas del inspector: ${inspection.notes.trim()}`);
  if (missingFields.length) lines.push(`Pendiente de completar: ${missingFields.join(', ')}.`);
  if (warnings.length) lines.push(`Controles deterministas: ${warnings.join(' ')}`);
  if (sources.length) {
    lines.push(
      `Referencias locales ${sources.every((source) => source.corpusStatus === 'approved') ? 'aprobadas' : 'de prototipo'}: ${sources.map((source) => `${source.title} — ${source.section} (${source.version})`).join('; ')}.`,
    );
  }
  lines.push('Límite: este borrador no determina habitabilidad, estabilidad ni una decisión oficial.');

  return {
    engine: 'deterministic',
    artifactId: 'field-draft-rules',
    artifactVersion: '1.0.0',
    text: lines.join('\n'),
    missingFields,
    warnings,
    sourceIds: sources.map((source) => source.id),
    requiresHumanReview: true,
  };
};
