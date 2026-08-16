import { KnowledgeSource } from '../domain/types';

export const knowledgeSources: KnowledgeSource[] = [
  {
    id: 'field-safety',
    title: 'Guía de inspección de edificaciones después de un sismo',
    section: 'Seguridad del equipo',
    url: 'https://www.idiger.gov.co/',
    text: 'Antes de acercarse, observe desde una distancia segura los peligros exteriores, la estabilidad aparente, las redes expuestas y las rutas de salida. Si el acceso no es seguro, registre la condición como inaccesible; no la convierta en ausencia de daño.',
    keywords: ['acceso', 'seguridad', 'peligro', 'inaccesible', 'redes', 'salida'],
  },
  {
    id: 'field-observation',
    title: 'Guía de inspección de edificaciones después de un sismo',
    section: 'Registro de observaciones',
    url: 'https://www.idiger.gov.co/',
    text: 'Diferencie daño observado, ausencia de daño visible en lo observado, zona no observada y condición desconocida. Una fotografía aislada no representa toda la edificación y debe conservar su contexto.',
    keywords: ['daño', 'observado', 'fotografía', 'contexto', 'desconocido', 'visible'],
  },
  {
    id: 'edan-needs',
    title: 'Estandarización de ayuda humanitaria de Colombia',
    section: 'Evaluación de daños y necesidades',
    url: 'https://portal.gestiondelriesgo.gov.co/',
    text: 'Registre necesidades agregadas para orientar prioridades operativas y mantenga separados los conteos de personas, viviendas e infraestructura. Los datos preliminares requieren validación antes de su consolidación.',
    keywords: ['personas', 'necesidades', 'ayuda', 'prioridad', 'conteo', 'población'],
  },
  {
    id: 'atc-rapid',
    title: 'ATC-20 Rapid Evaluation Safety Assessment Form',
    section: 'Alcance de evaluación rápida',
    url: 'https://www.atcouncil.org/pdfs/rapid.pdf',
    text: 'Una evaluación rápida organiza identificación, uso, peligros observados y acciones de seguimiento. La aplicación puede preparar un borrador, pero la clasificación oficial depende de la autoridad y del profesional competente.',
    keywords: ['atc', 'informe', 'evaluación', 'rápida', 'clasificación', 'autoridad'],
  },
  {
    id: 'privacy',
    title: 'Privacidad desde el diseño',
    section: 'Minimización',
    url: 'https://www.sic.gov.co/',
    text: 'Recolecte únicamente los datos necesarios para la finalidad operativa. Para análisis territorial use conteos agregados y evite nombres, rostros y datos sensibles cuando no sean indispensables.',
    keywords: ['privacidad', 'nombres', 'rostros', 'datos', 'agregados', 'minimización'],
  },
];

export interface KnowledgeResult {
  answer: string;
  sources: KnowledgeSource[];
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();

export const searchKnowledge = (query: string): KnowledgeResult | null => {
  const tokens = normalize(query)
    .split(' ')
    .filter((token) => token.length > 2);

  if (tokens.length === 0) return null;

  const ranked = knowledgeSources
    .map((source) => {
      const haystack = normalize(
        `${source.title} ${source.section} ${source.text} ${source.keywords.join(' ')}`,
      );
      const score = tokens.reduce(
        (total, token) => total + (haystack.includes(token) ? 1 : 0),
        0,
      );
      return { source, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  if (ranked.length === 0) {
    return {
      answer:
        'No encontré una coincidencia suficiente en la biblioteca local. Registre la observación manualmente y solicite revisión especializada cuando corresponda.',
      sources: [],
    };
  }

  return {
    answer: ranked.map(({ source }) => source.text).join(' '),
    sources: ranked.map(({ source }) => source),
  };
};
