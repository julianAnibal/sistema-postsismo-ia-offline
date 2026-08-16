import {
  AccessLevel,
  DamageLevel,
  InfrastructureType,
  NeedType,
  ObservationState,
  Observability,
  Priority,
  StructuralElement,
  ViewType,
  VisualCondition,
} from './types';

export const infrastructureLabels: Record<InfrastructureType, string> = {
  residential: 'Residencial',
  education: 'Educación',
  health: 'Salud',
  bridge: 'Puente',
  community: 'Comunitaria',
  warehouse: 'Bodega',
};

export const priorityLabels: Record<Priority, string> = {
  critical: 'Crítica',
  high: 'Alta',
  normal: 'Normal',
};

export const accessLabels: Record<AccessLevel, string> = {
  accessible: 'Accesible',
  limited: 'Limitado',
  inaccessible: 'Inaccesible',
  unknown: 'Sin definir',
};

export const observationLabels: Record<ObservationState, string> = {
  damage_observed: 'Daño observado',
  no_damage_observed: 'Sin daño visible',
  not_observed: 'No observado',
  unknown: 'Desconocido',
};

export const damageLabels: Record<DamageLevel, string> = {
  none: 'Ninguno visible',
  light: 'Leve',
  moderate: 'Moderado',
  severe: 'Severo',
  unknown: 'Sin clasificar',
};

export const elementLabels: Record<StructuralElement, string> = {
  wall: 'Muro',
  column: 'Columna',
  beam: 'Viga',
  slab: 'Placa',
  roof: 'Cubierta',
  foundation: 'Cimentación',
  nonstructural: 'No estructural',
  unknown: 'Sin definir',
};

export const conditionLabels: Record<VisualCondition, string> = {
  none: 'Sin hallazgo',
  crack: 'Fisura',
  spalling: 'Desprendimiento',
  deformation: 'Deformación',
  partial_collapse: 'Colapso parcial',
  moisture: 'Humedad',
  other: 'Otro',
};

export const observabilityLabels: Record<Observability, string> = {
  good: 'Buena',
  partial: 'Parcial',
  poor: 'Deficiente',
};

export const viewLabels: Record<ViewType, string> = {
  context: 'Contexto',
  exterior: 'Exterior',
  interior: 'Interior',
  detail: 'Detalle',
};

export const needLabels: Record<NeedType, string> = {
  medical: 'Atención médica',
  shelter: 'Alojamiento',
  water: 'Agua',
  accessibility: 'Accesibilidad',
};
