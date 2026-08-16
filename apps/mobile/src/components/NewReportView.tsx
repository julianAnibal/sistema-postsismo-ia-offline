import { AlertTriangle, FilePlus2, MapPinOff, ShieldCheck } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { createDraftInspection } from '../data/seed';
import { infrastructureLabels, priorityLabels } from '../domain/labels';
import {
  Infrastructure,
  InfrastructureType,
  Inspection,
  Priority,
} from '../domain/types';
import { colors, shadows } from './theme';
import { ActionButton, ChoiceGroup, Label, SectionTitle, TextField } from './ui';

const typeOptions = (Object.entries(infrastructureLabels) as Array<[InfrastructureType, string]>)
  .map(([value, label]) => ({ value, label }));

const priorityOptions = (Object.entries(priorityLabels) as Array<[Priority, string]>)
  .map(([value, label]) => ({ value, label }));

const clean = (value: string, max: number) => value.trim().replace(/\s+/g, ' ').slice(0, max);

const reportSuffix = () => {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${time}-${random}`;
};

export const NewReportView = ({
  onCreate,
}: {
  onCreate: (infrastructure: Infrastructure, inspection: Inspection) => Promise<boolean>;
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [sector, setSector] = useState('');
  const [type, setType] = useState<InfrastructureType>('community');
  const [priority, setPriority] = useState<Priority>('normal');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedName = clean(name, 240);
  const normalizedSector = clean(sector, 160);
  const canCreate = normalizedName.length > 0 && normalizedSector.length > 0 && !saving;
  const previewCode = useMemo(() => clean(code, 80) || 'AUTO', [code]);

  const create = async () => {
    if (!canCreate) {
      setError('Escriba un nombre o referencia y un sector antes de continuar.');
      return;
    }
    setSaving(true);
    setError(null);
    const suffix = reportSuffix();
    const infrastructureId = `field-${suffix}`;
    const infrastructure: Infrastructure = {
      id: infrastructureId,
      code: clean(code, 80) || `CAMPO-${Date.now().toString().slice(-6)}`,
      name: normalizedName,
      type,
      sector: normalizedSector,
      priority,
      gridCell: 'SIN-UBICACION',
      gridX: 0,
      gridY: 0,
      latitude: 0,
      longitude: 0,
      coordinatesAreSynthetic: true,
    };
    const inspection = {
      ...createDraftInspection(infrastructureId),
      id: `inspection-${suffix}`,
    };
    const saved = await onCreate(infrastructure, inspection);
    if (!saved) setError('No fue posible guardar el reporte en el almacenamiento local.');
    setSaving(false);
  };

  return (
    <View style={styles.page}>
      <SectionTitle title="Nuevo reporte" detail="Se guarda primero en este dispositivo" />

      <View style={[styles.hero, shadows.card]}>
        <View style={styles.heroIcon}><FilePlus2 size={25} color={colors.white} /></View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Registrar antes de tener señal</Text>
          <Text style={styles.heroText}>
            Cree la ficha básica ahora. Después agregará observaciones, fotografías y el borrador asistido.
          </Text>
        </View>
      </View>

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.step}>01 · IDENTIFICACIÓN</Text>
        <Label>Nombre o referencia *</Label>
        <TextField value={name} onChangeText={setName} placeholder="Ej. Casa comunal frente a la cancha" />

        <View style={styles.fieldGap}>
          <Label>Código opcional</Label>
          <TextField value={code} onChangeText={setCode} placeholder="Se genera automáticamente si queda vacío" />
        </View>

        <View style={styles.fieldGap}>
          <Label>Sector o referencia territorial *</Label>
          <TextField value={sector} onChangeText={setSector} placeholder="Ej. Barrio Centro, manzana 4" />
        </View>
      </View>

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.step}>02 · CLASIFICACIÓN INICIAL</Text>
        <Label>Tipo de infraestructura</Label>
        <ChoiceGroup value={type} onChange={setType} options={typeOptions} />

        <View style={styles.fieldGap}>
          <Label>Prioridad operativa</Label>
          <ChoiceGroup value={priority} onChange={setPriority} options={priorityOptions} />
        </View>

        <View style={styles.guardrail}>
          <AlertTriangle size={18} color={colors.amber} />
          <Text style={styles.guardrailText}>
            La prioridad organiza el trabajo; no representa diagnóstico, habitabilidad ni triaje oficial.
          </Text>
        </View>
      </View>

      <View style={[styles.locationCard, shadows.card]}>
        <MapPinOff size={21} color={colors.blue} />
        <View style={styles.locationCopy}>
          <Text style={styles.locationTitle}>Ubicación aún no registrada</Text>
          <Text style={styles.locationText}>
            Esta versión crea el reporte sin coordenadas reales. El backend recibirá un marcador sintético explícito.
          </Text>
        </View>
      </View>

      <View style={styles.preview}>
        <View>
          <Text style={styles.previewLabel}>SE CREARÁ</Text>
          <Text style={styles.previewTitle}>{previewCode} · {normalizedName || 'Reporte sin nombre'}</Text>
          <Text style={styles.previewMeta}>{infrastructureLabels[type]} · {normalizedSector || 'Sector pendiente'}</Text>
        </View>
        <ShieldCheck size={22} color={colors.teal} />
      </View>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <ActionButton
        label={saving ? 'Guardando en el dispositivo…' : 'Crear y completar reporte'}
        icon={saving ? undefined : FilePlus2}
        onPress={() => void create()}
        disabled={!canCreate}
        style={styles.createButton}
      />
      {saving ? <ActivityIndicator color={colors.teal} style={styles.spinner} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  page: { gap: 14 },
  hero: {
    backgroundColor: colors.dark,
    borderRadius: 10,
    padding: 18,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  heroIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1 },
  heroTitle: { color: colors.white, fontSize: 17, fontWeight: '800' },
  heroText: { color: '#D7E1DD', fontSize: 12, lineHeight: 18, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 9, padding: 16 },
  step: { color: colors.teal, fontSize: 11, fontWeight: '900', letterSpacing: 0.7, marginBottom: 16 },
  fieldGap: { marginTop: 16 },
  guardrail: { marginTop: 16, padding: 12, backgroundColor: colors.amberSoft, borderRadius: 7, flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  guardrailText: { flex: 1, color: colors.amber, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  locationCard: { backgroundColor: colors.blueSoft, borderWidth: 1, borderColor: '#C5D6E8', borderRadius: 9, padding: 15, flexDirection: 'row', gap: 11 },
  locationCopy: { flex: 1 },
  locationTitle: { color: colors.blue, fontSize: 13, fontWeight: '800' },
  locationText: { color: colors.blue, fontSize: 11, lineHeight: 16, marginTop: 3 },
  preview: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  previewLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  previewTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: 3 },
  previewMeta: { color: colors.muted, fontSize: 11, marginTop: 3 },
  error: { color: colors.red, fontSize: 12, fontWeight: '700' },
  createButton: { minHeight: 52 },
  spinner: { marginTop: -4 },
});
