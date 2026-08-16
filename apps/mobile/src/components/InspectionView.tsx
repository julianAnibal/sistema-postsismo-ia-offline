import * as Device from 'expo-device';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { DeviceMotion, DeviceMotionMeasurement } from 'expo-sensors';
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
  Platform,
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
  assessCapturePreflight,
  capturePreflightLabels,
} from '../domain/capturePreflight';
import { captureQualitySignalLabels } from '../domain/captureQuality';
import {
  finalizeInspectionRevision,
  reopenInspectionAfterMutation,
} from '../domain/inspectionRevision';
import {
  AccessLevel,
  DamageLevel,
  EvidenceAnnotation,
  EvidenceSensorMetadata,
  Inspection,
  Infrastructure,
  MediaEvidence,
  NeedType,
  ObservationState,
  Observability,
  StructuralElement,
  ViewType,
  VisualCondition,
} from '../domain/types';
import {
  EvidenceFileTooLargeError,
  persistEvidenceAsset,
} from '../storage/evidenceFiles';
import { analyzeCaptureQualityProxy } from '../platform/captureQualityProxy';
import { AssistantPanel } from './AssistantPanel';
import { colors, shadows } from './theme';
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

const formatMegabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const captureLocation = async (): Promise<EvidenceSensorMetadata['location']> => {
  try {
    const available = await Location.hasServicesEnabledAsync();
    if (!available) return { status: 'unavailable' };
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return { status: 'denied' };
    const reading = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return {
      status: 'captured',
      timestamp: reading.timestamp,
      latitude: reading.coords.latitude,
      longitude: reading.coords.longitude,
      accuracyMeters: reading.coords.accuracy,
      altitudeMeters: reading.coords.altitude,
      altitudeAccuracyMeters: reading.coords.altitudeAccuracy,
      headingDegrees: reading.coords.heading,
      speedMetersPerSecond: reading.coords.speed,
      mocked: reading.mocked,
    };
  } catch {
    return { status: 'error' };
  }
};

const captureMotion = async (): Promise<EvidenceSensorMetadata['motion']> => {
  try {
    if (!(await DeviceMotion.isAvailableAsync())) return { status: 'unavailable' };
    const permission = await DeviceMotion.requestPermissionsAsync();
    if (!permission.granted) return { status: 'denied' };
    DeviceMotion.setUpdateInterval(100);
    return await new Promise((resolve) => {
      let settled = false;
      const finish = (reading?: DeviceMotionMeasurement) => {
        if (settled) return;
        settled = true;
        subscription.remove();
        if (!reading) {
          resolve({ status: 'unavailable' });
          return;
        }
        resolve({
          status: 'captured',
          intervalMs: reading.interval,
          orientationDegrees: reading.orientation,
          acceleration: reading.acceleration,
          accelerationIncludingGravity: reading.accelerationIncludingGravity,
          rotation: reading.rotation,
          rotationRate: reading.rotationRate,
        });
      };
      const subscription = DeviceMotion.addListener((reading) => finish(reading));
      setTimeout(() => finish(), 1200);
    });
  } catch {
    return { status: 'error' };
  }
};

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
  media: MediaEvidence[];
  onBack: () => void;
  onSave: (inspection: Inspection, markReviewed: boolean) => Promise<boolean>;
  onAddEvidence: (
    inspection: Inspection,
    media: MediaEvidence,
    annotation: EvidenceAnnotation,
  ) => Promise<boolean>;
}) => {
  const [draft, setDraft] = useState(inspection);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => setDraft(inspection), [infrastructure.id]);

  const change = <K extends keyof Inspection>(key: K, value: Inspection[K]) =>
    setDraft((current) => reopenInspectionAfterMutation({ ...current, [key]: value }));

  const toggleNeed = (need: NeedType) =>
    change(
      'needs',
      draft.needs.includes(need)
        ? draft.needs.filter((candidate) => candidate !== need)
        : [...draft.needs, need],
    );

  const save = async (review: boolean) => {
    if (review && (draft.access === 'unknown' || draft.observation === 'unknown')) {
      Alert.alert('Faltan datos', 'Defina el acceso y el estado de observación antes de revisar el registro.');
      return;
    }
    const next = finalizeInspectionRevision(draft, review);
    setDraft(next);
    const persisted = await onSave(next, review);
    Alert.alert(
      persisted ? (review ? 'Registro revisado' : 'Borrador guardado') : 'Guardado interrumpido',
      persisted
        ? 'Los cambios quedaron en el dispositivo y en la cola local.'
        : 'Los cambios no pudieron confirmarse en el almacenamiento local.',
    );
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
              base64: Platform.OS === 'web',
              exif: true,
              quality: 0.72,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              base64: Platform.OS === 'web',
              exif: true,
              quality: 0.72,
            });

      if (result.canceled) return;
      const asset = result.assets[0];
      const timestamp = new Date().toISOString();
      const id = `media-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const locationPromise = provenance === 'camera'
        ? captureLocation()
        : Promise.resolve<EvidenceSensorMetadata['location']>({ status: 'unavailable' });
      const motionPromise = provenance === 'camera'
        ? captureMotion()
        : Promise.resolve<EvidenceSensorMetadata['motion']>({ status: 'unavailable' });
      const [storedFile, location, motion] = await Promise.all([
        persistEvidenceAsset(asset, mimeType),
        locationPromise,
        motionPromise,
      ]);
      const sensorMetadata: EvidenceSensorMetadata = {
        recordedAt: new Date().toISOString(),
        location,
        motion,
        device: {
          manufacturer: Device.manufacturer,
          modelName: Device.modelName,
          osName: Device.osName,
          osVersion: Device.osVersion,
          isDevice: Device.isDevice,
          totalMemoryBytes: Device.totalMemory,
          supportedCpuArchitectures: Device.supportedCpuArchitectures ?? [],
        },
        exif: asset.exif ?? null,
      };
      const capturePreflight = assessCapturePreflight(
        asset.width,
        asset.height,
        storedFile.sizeBytes,
        timestamp,
      );
      const captureQuality = await analyzeCaptureQualityProxy(
        storedFile.uri,
        asset.width,
        asset.height,
      );
      const nextDraft = reopenInspectionAfterMutation({
        ...draft,
        mediaIds: Array.from(new Set([...draft.mediaIds, id])),
      });
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
      const persisted = await onAddEvidence(
        nextDraft,
        {
          id,
          inspectionId: draft.id,
          uri: storedFile.uri,
          sha256: storedFile.sha256,
          sizeBytes: storedFile.sizeBytes,
          storage: storedFile.storage,
          capturePreflight,
          captureQuality,
          mimeType,
          width: asset.width,
          height: asset.height,
          capturedAt: timestamp,
          provenance,
          sensorMetadata,
          integrity: storedFile.integrity,
          immutable: true,
        },
        annotation,
      );
      if (!persisted) throw new Error('evidence manifest persistence failed');
      if (capturePreflight.status === 'review') {
        Alert.alert(
          'Foto guardada con observaciones',
          `${capturePreflight.issueIds.map((issue) => capturePreflightLabels[issue]).join('; ')}. Este prechequeo no evalúa enfoque, iluminación ni contenido. Repita la captura solo si es seguro.`,
        );
      } else if (captureQuality.status === 'measured' && captureQuality.signalIds.length > 0) {
        Alert.alert(
          'Foto guardada · medición experimental',
          `${captureQuality.signalIds.map((signal) => captureQualitySignalLabels[signal]).join('; ')}. Esta medición extrema usa un proxy pequeño, no evalúa daño ni confirma calidad. Revise la vista y repita solo si es seguro.`,
        );
      }
    } catch (error) {
      if (error instanceof EvidenceFileTooLargeError) {
        Alert.alert(
          'Imagen demasiado grande',
          `La imagen ocupa ${formatMegabytes(error.actualBytes)}. El límite de esta modalidad es ${formatMegabytes(error.maximumBytes)}.`,
        );
        return;
      }
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

      <View style={[styles.photoFirstCard, shadows.card]}>
        <View style={styles.photoFirstHeader}>
          <View style={styles.photoFirstNumber}><Text style={styles.photoFirstNumberText}>01</Text></View>
          <View style={styles.photoFirstCopy}>
            <Text style={styles.photoFirstTitle}>Empiece por la evidencia</Text>
            <Text style={styles.photoFirstText}>
              Capture una vista segura antes de completar la clasificación. El análisis local comprueba archivo, metadatos y extremos de imagen; no interpreta daño.
            </Text>
          </View>
        </View>
        <View style={styles.photoActions}>
          <ActionButton
            label={media.length ? 'Tomar otra foto' : 'Tomar primera fotografía'}
            icon={Camera}
            onPress={() => void capture('camera')}
            disabled={capturing}
            style={styles.photoFirstAction}
          />
          <ActionButton
            label="Importar evidencia"
            icon={ImagePlus}
            variant="secondary"
            onPress={() => void capture('library')}
            disabled={capturing}
          />
        </View>
        <View style={styles.localChecks}>
          <StatusTag label={`${media.length} evidencia${media.length === 1 ? '' : 's'}`} tone={media.length ? 'good' : 'neutral'} />
          <StatusTag label="SHA-256" tone="info" />
          <StatusTag label="Proxy local" tone="warning" />
          <StatusTag label="Sin VLM" tone="neutral" />
        </View>
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
            <Text style={styles.modelTitle}>Calidad de captura local</Text>
            <Text style={styles.modelText}>Sin modelo. Un proxy pequeño registra métricas y señales extremas en shadow mode; no analiza daño.</Text>
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
                <View style={styles.analysisStrip}>
                  <Text style={styles.analysisTitle}>ANÁLISIS LOCAL DE CAPTURA</Text>
                  <Text style={styles.analysisLine}>
                    {item.integrity.status === 'verified' ? '✓ Archivo íntegro' : '! Integridad pendiente'}
                  </Text>
                  <Text style={styles.analysisLine}>
                    {item.capturePreflight.status === 'pass' ? '✓ Metadatos suficientes' : '! Revisar metadatos'}
                  </Text>
                  <Text style={styles.analysisLine}>
                    {item.captureQuality.status === 'measured' && item.captureQuality.signalIds.length === 0
                      ? '✓ Sin extremo visual detectado'
                      : item.captureQuality.status === 'measured'
                        ? '! Señal visual extrema'
                        : '· Proxy no disponible'}
                  </Text>
                  <Text style={styles.analysisDisclaimer}>No detecta fisuras, severidad ni habitabilidad.</Text>
                </View>
                <Text numberOfLines={1} style={styles.hash}>SHA-256 {item.sha256.slice(0, 16)}…</Text>
                <Text style={styles.photoTime}>
                  Integridad:{' '}
                  {item.integrity.status === 'verified'
                    ? 'verificada localmente'
                    : item.integrity.status === 'missing'
                      ? 'archivo faltante'
                      : item.integrity.status === 'tampered'
                        ? 'no coincide con su huella'
                        : 'pendiente de verificar'}
                </Text>
                <Text style={styles.photoTime}>
                  {formatMegabytes(item.sizeBytes)} · {item.storage === 'app-file' ? 'archivo de app' : 'copia web'}
                </Text>
                <Text style={styles.photoTime}>
                  Prechequeo: {item.capturePreflight.status === 'pass' ? 'metadatos suficientes' : 'revisar captura'}
                </Text>
                <Text style={styles.photoTime}>
                  Proxy local:{' '}
                  {item.captureQuality.status === 'measured'
                    ? item.captureQuality.signalIds.length
                      ? item.captureQuality.signalIds.map((signal) => captureQualitySignalLabels[signal]).join('; ')
                      : 'medido sin señal extrema · no equivale a calidad aprobada'
                    : item.captureQuality.reason === 'web_memory_guard'
                      ? 'no ejecutado en web por límite de memoria'
                      : item.captureQuality.reason === 'native_proxy_unavailable'
                        ? 'módulo nativo no disponible en esta plataforma'
                        : item.captureQuality.reason === 'out_of_memory'
                          ? 'detenido por memoria insuficiente'
                          : item.captureQuality.reason === 'input_rejected'
                            ? 'entrada rechazada por límites de seguridad'
                            : 'medición no disponible'}
                </Text>
                <Text style={styles.photoTime}>{new Date(item.capturedAt).toLocaleString('es-CO')}</Text>
                <Text style={styles.photoTime}>
                  {item.sensorMetadata.location.status === 'captured'
                    ? `GPS ±${Math.round(item.sensorMetadata.location.accuracyMeters ?? 0)} m`
                    : `GPS ${item.sensorMetadata.location.status}`}
                </Text>
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
                <Pressable
                  key={need}
                  onPress={() => toggleNeed(need)}
                  style={styles.needItem}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  aria-checked={checked}
                >
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
        <AssistantPanel
          infrastructure={infrastructure}
          inspection={draft}
          mediaCount={media.length}
          onUseDraft={useAssistantDraft}
        />
      </View>

      <View style={styles.section}>
        <SectionTitle title="Borrador de informe rápido" detail="Plantilla local · revisión humana" />
        <View style={styles.report}>
          <ReportRow label="Identificación" value={`${infrastructure.code} · ${infrastructure.name}`} />
          <ReportRow label="Uso" value={infrastructureLabels[infrastructure.type]} />
          <ReportRow label="Acceso" value={accessLabels[draft.access]} />
          <ReportRow label="Observación" value={observationLabels[draft.observation]} />
          <ReportRow label="Nivel manual" value={damageLabels[draft.damageLevel]} />
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
  photoFirstCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#BFD8D2',
    backgroundColor: '#F0F8F6',
  },
  photoFirstHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  photoFirstNumber: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
  photoFirstNumberText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  photoFirstCopy: { flex: 1 },
  photoFirstTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  photoFirstText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  photoFirstAction: { minWidth: 210 },
  localChecks: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
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
  analysisStrip: { marginTop: 6, padding: 8, borderRadius: 6, backgroundColor: colors.tealSoft },
  analysisTitle: { color: colors.teal, fontSize: 8, fontWeight: '900', letterSpacing: 0.5, marginBottom: 4 },
  analysisLine: { color: colors.dark, fontSize: 9, lineHeight: 14, fontWeight: '700' },
  analysisDisclaimer: { color: colors.muted, fontSize: 8, lineHeight: 12, marginTop: 4 },
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
