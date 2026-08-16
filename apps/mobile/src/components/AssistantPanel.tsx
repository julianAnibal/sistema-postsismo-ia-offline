import {
  BookOpen,
  Brain,
  Check,
  Download,
  FileText,
  Play,
  Search,
  Square,
  Upload,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

import {
  buildDeterministicFieldDraft,
  DeterministicFieldDraft,
} from '../ai/deterministicAssistant';
import { collectDeviceCapabilities } from '../ai/deviceCapabilities';
import {
  DeviceCapabilities,
  formatDeviceBytes,
  recommendExecutionTier,
} from '../ai/devicePolicy';
import {
  cancelGemma,
  generateWithGemma,
  inspectGemma,
  installGemmaFromNetwork,
  installGemmaFromPicker,
  loadGemma,
} from '../ai/gemmaRuntime';
import {
  formatGemmaBytes,
  GEMMA_ANDROID_E2B_MODEL,
  GEMMA_E2B_MODEL,
} from '../ai/gemmaModel';
import {
  GemmaAvailability,
  GemmaInstallProgress,
} from '../ai/gemmaRuntime.types';
import { KnowledgeResult, searchKnowledge } from '../data/knowledge';
import { Infrastructure, Inspection } from '../domain/types';
import { colors } from './theme';
import { ActionButton, Label, StatusTag, TextField } from './ui';

const activeGemmaModel =
  Platform.OS === 'web' ? GEMMA_E2B_MODEL : GEMMA_ANDROID_E2B_MODEL;

export const AssistantPanel = ({
  infrastructure,
  inspection,
  mediaCount,
  onUseDraft,
}: {
  infrastructure: Infrastructure;
  inspection: Inspection;
  mediaCount: number;
  onUseDraft: (text: string) => void;
}) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<KnowledgeResult | null>(null);
  const [fieldDraft, setFieldDraft] = useState<DeterministicFieldDraft | null>(null);
  const [gemmaAvailability, setGemmaAvailability] = useState<GemmaAvailability | null>(null);
  const [gemmaState, setGemmaState] = useState<
    'checking' | 'absent' | 'installing' | 'ready' | 'loading' | 'loaded' | 'generating' | 'unsupported' | 'error'
  >('checking');
  const [gemmaProgress, setGemmaProgress] = useState<GemmaInstallProgress | null>(null);
  const [gemmaAnswer, setGemmaAnswer] = useState('');
  const [gemmaError, setGemmaError] = useState<string | null>(null);
  const [gemmaElapsed, setGemmaElapsed] = useState<number | null>(null);
  const [gemmaBackend, setGemmaBackend] = useState<string | null>(null);
  const [gemmaDevice, setGemmaDevice] = useState<DeviceCapabilities | null>(null);

  useEffect(() => setFieldDraft(null), [inspection.id]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    void collectDeviceCapabilities().then((capabilities) => {
      if (active) setGemmaDevice(capabilities);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    void inspectGemma()
      .then((availability) => {
        if (!active) return;
        setGemmaAvailability(availability);
        setGemmaState(
          !availability.supported
            ? 'unsupported'
            : availability.installed
              ? 'ready'
              : 'absent',
        );
      })
      .catch((error: unknown) => {
        if (!active) return;
        setGemmaError(error instanceof Error ? error.message : 'No se pudo leer el estado de Gemma.');
        setGemmaState('error');
      });
    return () => {
      active = false;
      cancelGemma();
    };
  }, []);

  const runSearch = () => setResult(searchKnowledge(query));
  const prepareDraft = () =>
    setFieldDraft(
      buildDeterministicFieldDraft({
        infrastructure,
        inspection,
        mediaCount,
        sources: result?.sources ?? [],
      }),
    );

  const gemmaDevicePending = Platform.OS !== 'web' && gemmaDevice === null;
  const gemmaDeviceBlocked =
    gemmaDevice?.isPhysicalDevice === true &&
    recommendExecutionTier(gemmaDevice) !== 'language-candidate';
  const gemmaDeviceReason = gemmaDeviceBlocked && gemmaDevice
    ? `Este teléfono no supera la preselección conservadora para Gemma: RAM ${formatDeviceBytes(gemmaDevice.totalMemoryBytes)} y almacenamiento libre ${formatDeviceBytes(gemmaDevice.availableStorageBytes)}. Use el asistente determinista.`
    : null;
  const canStartGemmaOperation = () => {
    if (gemmaDevicePending) {
      setGemmaError('Espere mientras se verifica la memoria y el almacenamiento del equipo.');
      return false;
    }
    if (gemmaDeviceReason) {
      setGemmaError(gemmaDeviceReason);
      return false;
    }
    return true;
  };

  const installGemma = async (source: 'network' | 'local-file') => {
    if (!canStartGemmaOperation()) return;
    setGemmaError(null);
    setGemmaProgress(null);
    setGemmaState('installing');
    try {
      const availability = await (source === 'network'
        ? installGemmaFromNetwork(setGemmaProgress)
        : installGemmaFromPicker(setGemmaProgress));
      setGemmaAvailability(availability);
      setGemmaState(availability.installed ? 'ready' : 'absent');
    } catch (error) {
      setGemmaError(error instanceof Error ? error.message : 'No se pudo instalar Gemma.');
      setGemmaState('error');
      const availability = await inspectGemma().catch(() => null);
      if (availability) setGemmaAvailability(availability);
    }
  };

  const initializeGemma = async () => {
    if (!canStartGemmaOperation()) return;
    setGemmaError(null);
    setGemmaState('loading');
    try {
      await loadGemma();
      setGemmaState('loaded');
    } catch (error) {
      setGemmaError(error instanceof Error ? error.message : 'No se pudo cargar Gemma.');
      setGemmaState('error');
    }
  };

  const askGemma = async () => {
    setGemmaError(null);
    setGemmaAnswer('');
    setGemmaElapsed(null);
    setGemmaState('generating');
    const contextDraft = buildDeterministicFieldDraft({
      infrastructure,
      inspection,
      mediaCount,
      sources: result?.sources ?? [],
    });
    try {
      const response = await generateWithGemma(
        {
          question: query,
          context: contextDraft.text,
          sources: result?.sources ?? [],
        },
        (text) => setGemmaAnswer(text),
      );
      setGemmaAnswer(response.text);
      setGemmaElapsed(response.elapsedMilliseconds);
      setGemmaBackend(response.backend ?? null);
      setGemmaState('loaded');
    } catch (error) {
      setGemmaError(error instanceof Error ? error.message : 'Gemma no pudo completar el borrador.');
      setGemmaState('loaded');
    }
  };

  const stopGemma = () => {
    cancelGemma();
  };

  const progressPercent = gemmaProgress
    ? Math.min(100, Math.round((gemmaProgress.completedBytes / gemmaProgress.totalBytes) * 100))
    : 0;
  const gemmaBusy = ['installing', 'loading', 'generating'].includes(gemmaState);
  const gemmaTag =
    gemmaState === 'loaded' || gemmaState === 'generating'
      ? { label: 'Cargado', tone: 'good' as const }
      : gemmaState === 'ready'
        ? { label: 'Verificado', tone: 'info' as const }
        : gemmaState === 'unsupported'
          ? { label: 'No compatible', tone: 'warning' as const }
          : gemmaState === 'error'
            ? { label: 'Revisar', tone: 'danger' as const }
            : { label: gemmaBusy ? 'Procesando' : 'Por instalar', tone: 'warning' as const };

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <View>
          <Text style={styles.title}>Asistente local eficiente</Text>
          <Text style={styles.subtitle}>
            Reglas verificables y Gemma 4 E2B offline {Platform.OS === 'web' ? 'con WebGPU' : 'con LiteRT-LM nativo'}
          </Text>
        </View>
        <StatusTag label="Local" tone="good" />
      </View>
      <ActionButton
        label="Preparar borrador sin IA generativa"
        icon={FileText}
        onPress={prepareDraft}
        style={styles.action}
      />

      {fieldDraft ? (
        <View style={styles.result}>
          <View style={styles.resultLabel}>
            <FileText size={17} color={colors.teal} />
            <Text style={styles.resultLabelText}>Borrador determinista · revisión obligatoria</Text>
          </View>
          <Text style={styles.answer}>{fieldDraft.text}</Text>
          <ActionButton
            label="Insertar borrador en notas"
            icon={Check}
            variant="secondary"
            onPress={() => onUseDraft(fieldDraft.text)}
            style={styles.action}
          />
        </View>
      ) : null}

      <Label>Pregunta operativa</Label>
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="Ej. ¿qué registrar si no puedo ingresar?"
        multiline
      />
      <ActionButton
        label="Consultar biblioteca"
        icon={Search}
        onPress={runSearch}
        disabled={query.trim().length < 3}
        style={styles.action}
      />

      {result ? (
        <View style={styles.result}>
          <View style={styles.resultLabel}>
            <BookOpen size={17} color={colors.blue} />
            <Text style={styles.resultLabelText}>Respuesta recuperada</Text>
          </View>
          <Text style={styles.answer}>{result.answer}</Text>
          {result.sources.map((source) => (
            <Text
              key={source.id}
              accessibilityRole="link"
              onPress={() => void Linking.openURL(source.url)}
              style={styles.source}
            >
              {source.title} · {source.section} · {source.version} · {source.corpusStatus === 'approved' ? 'aprobada' : 'referencia de prototipo'}
            </Text>
          ))}
          <ActionButton
            label="Insertar en notas"
            icon={Check}
            variant="secondary"
            onPress={() => onUseDraft(result.answer)}
            style={styles.action}
          />
        </View>
      ) : null}

      <View style={styles.modelState}>
        <View style={styles.modelHeading}>
          <View style={styles.modelHeadingText}>
            <Text style={styles.modelTitle}>{activeGemmaModel.displayName} · LiteRT-LM</Text>
            <Text style={styles.modelText}>
              Paquete {Platform.OS === 'web' ? 'web' : 'Android'} fijado de {formatGemmaBytes(activeGemmaModel.sizeBytes)}. Se descarga o importa una vez, se verifica con SHA-256 y luego funciona desde almacenamiento local.
            </Text>
          </View>
          <StatusTag label={gemmaTag.label} tone={gemmaTag.tone} />
        </View>

        {gemmaAvailability?.supported && !gemmaAvailability.installed && gemmaState !== 'installing' ? (
          <View style={styles.modelActions}>
            <ActionButton
              label="Descargar Gemma verificado"
              icon={Download}
              onPress={() => void installGemma('network')}
              disabled={gemmaBusy || gemmaDevicePending || gemmaDeviceBlocked}
              style={styles.action}
            />
            <ActionButton
              label="Importar .litertlm"
              icon={Upload}
              variant="secondary"
              onPress={() => void installGemma('local-file')}
              disabled={gemmaBusy || gemmaDevicePending || gemmaDeviceBlocked}
              style={styles.action}
            />
          </View>
        ) : null}

        {gemmaState === 'installing' && gemmaProgress ? (
          <View accessibilityRole="progressbar" style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            <Text style={styles.progressText}>
              {gemmaProgress.phase === 'verifying' ? 'Verificando SHA-256' : gemmaProgress.phase === 'importing' ? 'Importando' : 'Descargando'} · {progressPercent}% · {formatGemmaBytes(gemmaProgress.completedBytes)}
            </Text>
          </View>
        ) : null}

        {gemmaState === 'ready' ? (
          <ActionButton
            label="Cargar Gemma en memoria"
            icon={Play}
            onPress={() => void initializeGemma()}
            disabled={gemmaDevicePending || gemmaDeviceBlocked}
            style={styles.action}
          />
        ) : null}

        {gemmaState === 'loading' ? (
          <Text style={styles.modelActivity}>
            {Platform.OS === 'web'
              ? 'Cargando el modelo por streaming en WebGPU…'
              : 'Cargando el modelo con GPU y respaldo CPU…'}
          </Text>
        ) : null}

        {gemmaState === 'loaded' ? (
          <ActionButton
            label="Pedir borrador a Gemma"
            icon={Brain}
            onPress={() => void askGemma()}
            disabled={query.trim().length < 3}
            style={styles.action}
          />
        ) : null}

        {gemmaState === 'generating' ? (
          <ActionButton
            label="Detener generación"
            icon={Square}
            variant="secondary"
            onPress={stopGemma}
            style={styles.action}
          />
        ) : null}

        {gemmaState === 'unsupported' ? (
          <Text style={styles.modelWarning}>{gemmaAvailability?.reason}</Text>
        ) : null}
        {gemmaDeviceReason ? <Text style={styles.modelWarning}>{gemmaDeviceReason}</Text> : null}
        {gemmaAvailability?.supported && gemmaAvailability.persistent === false ? (
          <Text style={styles.modelWarning}>
            El navegador no garantizó almacenamiento persistente; confirme que Gemma siga verificado antes de salir a campo y conserve una copia importable del paquete.
          </Text>
        ) : null}
        {gemmaError ? <Text accessibilityRole="alert" style={styles.modelError}>{gemmaError}</Text> : null}

        {gemmaAnswer ? (
          <View style={styles.gemmaResult}>
            <View style={styles.resultLabel}>
              <Brain size={17} color={colors.teal} />
              <Text style={styles.resultLabelText}>Gemma 4 E2B · borrador local · revisión obligatoria</Text>
            </View>
            <Text style={styles.answer}>{gemmaAnswer}</Text>
            {gemmaElapsed !== null ? (
              <Text style={styles.modelEvidence}>
                Inferencia local en {(gemmaElapsed / 1_000).toFixed(1)} s · modelo {activeGemmaModel.sha256.slice(0, 12)}…{gemmaBackend ? ` · ${gemmaBackend}` : ''}
              </Text>
            ) : null}
            <ActionButton
              label="Insertar borrador de Gemma en notas"
              icon={Check}
              variant="secondary"
              onPress={() => onUseDraft(gemmaAnswer)}
              style={styles.action}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink },
  subtitle: { marginTop: 3, fontSize: 12, color: colors.muted },
  action: { alignSelf: 'flex-start', marginTop: 2 },
  result: {
    marginTop: 6,
    borderLeftWidth: 3,
    borderColor: colors.blue,
    paddingLeft: 14,
    gap: 9,
  },
  resultLabel: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  resultLabelText: { color: colors.blue, fontWeight: '800', fontSize: 13 },
  answer: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  source: { color: colors.blue, fontSize: 12, textDecorationLine: 'underline' },
  modelState: { borderTopWidth: 1, borderColor: colors.line, paddingTop: 14, marginTop: 8, gap: 10 },
  modelHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  modelHeadingText: { flex: 1 },
  modelTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  modelText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  modelActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modelActivity: { color: colors.blue, fontSize: 12, fontWeight: '700' },
  modelWarning: { color: colors.amber, fontSize: 12, lineHeight: 18 },
  modelError: { color: colors.red, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  modelEvidence: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  progressTrack: { height: 44, overflow: 'hidden', borderRadius: 6, backgroundColor: colors.line, justifyContent: 'center' },
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.tealSoft },
  progressText: { color: colors.ink, fontSize: 12, fontWeight: '700', paddingHorizontal: 10 },
  gemmaResult: { borderLeftWidth: 3, borderColor: colors.teal, paddingLeft: 14, gap: 9 },
});
