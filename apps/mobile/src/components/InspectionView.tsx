import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  CheckSquare,
  ImagePlus,
  Save,
  Square,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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
import {
  AccessLevel,
  DamageLevel,
  EvidenceAnnotation,
  Inspection,
  Infrastructure,
  NeedType,
  ObservationState,
  Observability,
  StructuralElement,
  ViewType,
  VisualCondition,
} from '../domain/types';
import { AssistantPanel } from './AssistantPanel';
import { colors } from './theme';
import {
  ActionButton,
  ChoiceGroup,
  IconButton,
  Label,
  SectionTitle,
  StatusTag,
  TextField,
} from './ui';

const options = <T extends string>(values: T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

export const InspectionView = ({
  infrastructure,
  inspection,
  media,
  onBack,
  onSave,
  onAddEvidence,
}: {
  infrastructure: Infrastructure;
  inspection: Inspection;
  media: Array<{ id: string; uri: string; sha256: string; capturedAt: string }>;
  onBack: () => void;
  onSave: (inspection: Inspection) => void;
  onAddEvidence: (
    inspection: Inspection,
    media: {
      id: string;
      inspectionId: string;
      uri: string;
      sha256: string;
      mimeType: string;
      width: number;
      height: number;
      capturedAt: string;
      provenance: 'camera' | 'library';
      immutable: true;
    },
    annotation: EvidenceAnnotation,
  ) => void;
}) => {
  const [draft, setDraft] = useState(inspection);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => setDraft(inspection), [infrastructure.id]);

  const change = <K extends keyof Inspection>(key: K, value: Inspection[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const toggleNeed = (need: NeedType) =>
    change(
      'needs',
      draft.needs.includes(need)
        ? draft.needs.filter((candidate) => candidate !== need)
        : [...draft.needs, need],
    );

  const save = (review: boolean) => {
    if (review && (draft.access === 'unknown' || draft.observation === 'unknown')) {
      Alert.alert('Faltan datos', 'Defina el acceso y el estado de observación antes de revisar el registro.');
      return;
    }
    const next: Inspection = {
      ...draft,
      status: review ? 'reviewed' : 'draft',
      reviewedAt: review ? new Date().toISOString() : draft.reviewedAt,
    };
    setDraft(next);
    onSave(next);
    Alert.alert(review ? 'Registro revisado' : 'Borrador guardado', 'Los cambios quedaron en el dispositivo y en la cola local.');
  };

  const capture = async (provenance: 'camera' | 'library') => {
    setCapturing(true);
    try {
      if (provenance === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Cámara no disponible', 'Autorice la cámara para registrar evidencia nueva.');
          return;
        }
      }

      const result =
        provenance === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              base64: true,
              quality: 0.55,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              base64: true,
              quality: 0.55,
            });

      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert('No se pudo guardar', 'La imagen no produjo una copia local verificable.');
        return;
      }
      if (asset.base64.length > 3_500_000) {
        Alert.alert('Imagen demasiado grande', 'Seleccione una imagen menor de 2,5 MB para este prototipo.');
        return;
      }

      const timestamp = new Date().toISOString();
      const id = `media-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const uri = `data:${mimeType};base64,${asset.base64}`;
      const sha256 = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        asset.base64,
      );
      const nextDraft = { ...draft, mediaIds: Array.from(new Set([...draft.mediaIds, id])) };
      const annotation: EvidenceAnnotation = {
        id: `annotation-${id}`,
        mediaId: id,
        source: 'manual',
        element: draft.element,
        condition: draft.condition,
        observability: draft.observability,
        viewType: draft.viewType,
        createdAt: timestamp,
      };
      setDraft(nextDraft);
      onAddEvidence(
        nextDraft,
        {
          id,
          inspectionId: draft.id,
          uri,
          sha256,
          mimeType,
          width: asset.width,
          height: asset.height,
          capturedAt: timestamp,
          provenance,
          immutable: true,
        },
        annotation,
      );
    } catch {
      Alert.alert('Captura interrumpida', 'No fue posible incorporar la imagen en este dispositivo.');
    } finally {
      setCapturing(false);
    }
  };

  const useAssistantDraft = (text: string) => {
    Alert.alert('Insertar texto', 'La respuesta quedará como borrador editable en las notas.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Insertar',
        onPress: () => change('notes', draft.notes ? `${draft.notes}\n\n${text}` : text),
      },
    ]);
  };

  return (
    <View>
      <View style={styles.topLine}>
        <IconButton label="Volver a infraestructura" icon={ArrowLeft} onPress={onBack} />
        <View style={styles.headingText}>
          <Text style={styles.code}>{infrastructure.code}</Text>
          <Text style={styles.title}>{infrastructure.name}</Text>
          <Text style={styles.meta}>
            {infrastructureLabels[infrastructure.type]} · {infrastructure.sector} · ubicación sintética
          </Text>
        </View>
        <StatusTag label={draft.status === 'reviewed' ? 'Revisada' : 'Borrador'} tone={draft.status === 'reviewed' ? 'good' : 'warning'} />
      </View>

      <View style={styles.warningBand}>
        <Text style={styles.warningTitle}>Registro de apoyo para revisión humana</Text>
        <Text style={styles.warningText}>No declara habitabilidad, seguridad estructural ni aprobación oficial.</Text>
      </View>

      <View style={styles.section}>
        <SectionTitle title="1. Acceso y observación" />
        <View style={styles.field}>
          <Label>Acceso</Label>
          <ChoiceGroup
            value={draft.access}
            onChange={(value) => change('access', value)}
            options={options<AccessLevel>(['accessible', 'limited', 'inaccessible', 'unknown'], accessLabels)}
          />
        </View>
        <View style={styles.field}>
          <Label>Alcance de lo observado</Label>
          <ChoiceGroup
            value={draft.observation}
            onChange={(value) => change('observation', value)}
            options={options<ObservationState>(
              ['damage_observed', 'no_damage_observed', 'not_observed', 'unknown'],
              observationLabels,
            )}
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionTitle title="2. Clasificación visual" detail="Etiqueta manual" />
        <View style={styles.field}>
          <Label>Nivel preliminar</Label>
          <ChoiceGroup
            value={draft.damageLevel}
            onChange={(value) => change('damageLevel', value)}
            options={options<DamageLevel>(['none', 'light', 'moderate', 'severe', 'unknown'], damageLabels)}
          />
        </View>
        <View style={styles.field}>
          <Label>Elemento</Label>
          <ChoiceGroup
            value={draft.element}
            onChange={(value) => change('element', value)}
            options={options<StructuralElement>(
              ['wall', 'column', 'beam', 'slab', 'roof', 'foundation', 'nonstructural', 'unknown'],
              elementLabels,
            )}
          />
        </View>
        <View style={styles.field}>
          <Label>Condición visible</Label>
          <ChoiceGroup
            value={draft.condition}
            onChange={(value) => change('condition', value)}
            options={options<VisualCondition>(
              ['none', 'crack', 'spalling', 'deformation', 'partial_collapse', 'moisture', 'other'],
              conditionLabels,
            )}
          />
        </View>
        <View style={styles.twoColumns}>
          <View style={styles.column}>
            <Label>Observabilidad</Label>
            <ChoiceGroup
              value={draft.observability}
              onChange={(value) => change('observability', value)}
              options={options<Observability>(['good', 'partial', 'poor'], observabilityLabels)}
            />
          </View>
          <View style={styles.column}>
            <Label>Tipo de vista</Label>
            <ChoiceGroup
              value={draft.viewType}
              onChange={(value) => change('viewType', value)}
              options={options<ViewType>(['context', 'exterior', 'interior', 'detail'], viewLabels)}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <SectionTitle title="3. Evidencia fotográfica" detail={`${media.length} archivos`} />
        <View style={styles.modelRow}>
          <View>
            <Text style={styles.modelTitle}>Visión local</Text>
            <Text style={styles.modelText}>Modelo no instalado. Se conserva únicamente la clasificación manual.</Text>
          </View>
          <StatusTag label="Sin modelo" tone="neutral" />
        </View>
        <View style={styles.photoActions}>
          <ActionButton
            label="Tomar foto"
            icon={Camera}
            onPress={() => void capture('camera')}
            disabled={capturing}
          />
          <ActionButton
            label="Importar"
            icon={ImagePlus}
            variant="secondary"
            onPress={() => void capture('library')}
            disabled={capturing}
          />
        </View>
        {media.length > 0 ? (
          <View style={styles.gallery}>
            {media.map((item) => (
              <View key={item.id} style={styles.photoItem}>
                <Image source={{ uri: item.uri }} style={styles.photo} />
                <Text numberOfLines={1} style={styles.hash}>SHA-256 {item.sha256.slice(0, 16)}…</Text>
                <Text style={styles.photoTime}>{new Date(item.capturedAt).toLocaleString('es-CO')}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyMedia}>
            <ImagePlus size={25} color={colors.muted} />
            <Text style={styles.emptyMediaText}>Sin evidencia fotográfica en esta ficha</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <SectionTitle title="4. Población y necesidades" detail="Solo conteos agregados" />
        <View style={styles.twoColumns}>
          <View style={styles.column}>
            <Label>Ocupantes estimados</Label>
            <TextField
              value={String(draft.estimatedOccupants)}
              onChangeText={(value) => change('estimatedOccupants', Math.max(0, Number(value.replace(/\D/g, '')) || 0))}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.column}>
            <Label>Personas que requieren apoyo</Label>
            <TextField
              value={String(draft.peopleNeedingSupport)}
              onChangeText={(value) => change('peopleNeedingSupport', Math.max(0, Number(value.replace(/\D/g, '')) || 0))}
              keyboardType="numeric"
            />
          </View>
        </View>
        <View style={styles.field}>
          <Label>Necesidades observadas</Label>
          <View style={styles.needList}>
            {(Object.keys(needLabels) as NeedType[]).map((need) => {
              const checked = draft.needs.includes(need);
              const Icon = checked ? CheckSquare : Square;
              return (
                <Pressable key={need} onPress={() => toggleNeed(need)} style={styles.needItem} accessibilityRole="checkbox" accessibilityState={{ checked }}>
                  <Icon size={20} color={checked ? colors.teal : colors.muted} />
                  <Text style={styles.needText}>{needLabels[need]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.field}>
          <Label>Notas de campo</Label>
          <TextField
            value={draft.notes}
            onChangeText={(value) => change('notes', value)}
            placeholder="Describa solo lo observado y las limitaciones de la inspección"
            multiline
          />
        </View>
      </View>

      <View style={styles.section}>
        <AssistantPanel onUseDraft={useAssistantDraft} />
      </View>

      <View style={styles.section}>
        <SectionTitle title="Borrador de informe rápido" detail="Referencia semántica ATC-20" />
        <View style={styles.report}>
          <ReportRow label="Identificación" value={`${infrastructure.code} · ${infrastructure.name}`} />
          <ReportRow label="Uso" value={infrastructureLabels[infrastructure.type]} />
          <ReportRow label="Acceso" value={accessLabels[draft.access]} />
          <ReportRow label="Observación" value={observationLabels[draft.observation]} />
          <ReportRow label="Daño preliminar" value={damageLabels[draft.damageLevel]} />
          <ReportRow label="Evidencias" value={String(media.length)} />
          <ReportRow label="Personas con apoyo" value={`${draft.peopleNeedingSupport}/${draft.estimatedOccupants}`} />
        </View>
      </View>

      <View style={styles.footerActions}>
        <ActionButton label="Guardar borrador" icon={Save} variant="secondary" onPress={() => save(false)} />
        <ActionButton label="Marcar revisada" icon={CheckCircle2} onPress={() => save(true)} />
      </View>
    </View>
  );
};

const ReportRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.reportRow}>
    <Text style={styles.reportLabel}>{label}</Text>
    <Text style={styles.reportValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  topLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headingText: { flex: 1, minWidth: 0 },
  code: { color: colors.teal, fontSize: 12, fontWeight: '800', marginBottom: 2 },
  title: { color: colors.ink, fontSize: 22, lineHeight: 28, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  warningBand: {
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderLeftWidth: 4,
    borderColor: colors.amber,
    backgroundColor: colors.amberSoft,
  },
  warningTitle: { color: colors.amber, fontSize: 13, fontWeight: '800' },
  warningText: { color: colors.dark, fontSize: 12, lineHeight: 18, marginTop: 2 },
  section: { paddingVertical: 22, borderBottomWidth: 1, borderColor: colors.line },
  field: { marginBottom: 18 },
  twoColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  column: { flex: 1, minWidth: 250, marginBottom: 18 },
  modelRow: {
    minHeight: 58,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modelTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  modelText: { color: colors.muted, fontSize: 12, marginTop: 3, lineHeight: 17 },
  photoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 14 },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  photoItem: { width: 172 },
  photo: { width: 172, height: 118, borderRadius: 6, backgroundColor: '#E7EBE9' },
  hash: { fontSize: 10, color: colors.ink, fontWeight: '700', marginTop: 6 },
  photoTime: { fontSize: 10, color: colors.muted, marginTop: 2 },
  emptyMedia: {
    minHeight: 96,
    marginTop: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  emptyMediaText: { color: colors.muted, fontSize: 12 },
  needList: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  needItem: {
    minHeight: 40,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
  },
  needText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  report: { borderTopWidth: 1, borderColor: colors.line },
  reportRow: {
    minHeight: 44,
    borderBottomWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reportLabel: { width: 150, color: colors.muted, fontSize: 12, fontWeight: '700' },
  reportValue: { flex: 1, color: colors.ink, fontSize: 13 },
  footerActions: { paddingVertical: 22, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 9 },
});
