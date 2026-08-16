import {
  CloudUpload,
  Database,
  Download,
  FileCheck2,
  KeyRound,
  WifiOff,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Platform, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import type { AppState, OutboxAcknowledgement } from '../domain/types';
import { buildRestrictedReducedExport } from '../domain/exportManifest';
import { verifyEvidenceFiles } from '../storage/evidenceFiles';
import {
  loadSyncSettings,
  saveSyncSettings,
  synchronizeFieldState,
} from '../sync/fieldSync';
import { colors } from './theme';
import { ActionButton, EmptyState, SectionTitle, StatusTag } from './ui';

export const SyncView = ({
  state,
  onAcknowledged,
}: {
  state: AppState;
  onAcknowledged: (items: OutboxAcknowledgement[]) => Promise<boolean>;
}) => {
  const [endpoint, setEndpoint] = useState('');
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('Los datos permanecen locales hasta confirmar el envío.');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void loadSyncSettings()
      .then((settings) => {
        if (!active) return;
        setEndpoint(settings.endpoint);
        setToken(settings.token);
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'No fue posible leer la configuración.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const sync = async () => {
    setBusy(true);
    try {
      await saveSyncSettings(endpoint, token);
      const result = await synchronizeFieldState(state);
      const persisted = await onAcknowledged(result.acknowledgedOutboxItems);
      setMessage(
        persisted
          ? `Lote ${result.batchId} confirmado por el servidor.`
          : `El servidor confirmó ${result.batchId}, pero la cola local no pudo guardarse; el reintento es seguro.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible sincronizar.');
    } finally {
      setBusy(false);
    }
  };

  const performExport = async () => {
    try {
      const verifiedMedia = await verifyEvidenceFiles(state.media);
      const unsafeEvidence = verifiedMedia.filter((item) => item.integrity.status !== 'verified');
      if (unsafeEvidence.length > 0) {
        const missing = unsafeEvidence.filter((item) => item.integrity.status === 'missing').length;
        const tampered = unsafeEvidence.length - missing;
        Alert.alert(
          'Exportación bloqueada por integridad',
          `La reverificación encontró ${missing} archivo(s) faltante(s) y ${tampered} archivo(s) que no coinciden con su huella o ubicación permitida. No se generó ninguna copia.`,
        );
        return;
      }
      const content = JSON.stringify(
        buildRestrictedReducedExport({ ...state, media: verifiedMedia }),
        null,
        2,
      );
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `manifiesto-restringido-${state.deviceAlias.toLowerCase().replace(/\s+/g, '-')}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
        return;
      }
      await Share.share({ title: 'Manifiesto restringido', message: content });
    } catch {
      Alert.alert('Exportación interrumpida', 'No fue posible preparar o compartir la copia reducida.');
    }
  };

  const exportManifest = () => {
    if (Platform.OS === 'web') {
      void performExport();
      return;
    }
    Alert.alert(
      'Compartir datos restringidos',
      'La copia omite fotos, URI, coordenadas, notas, EXIF y huella del teléfono, pero conserva IDs, horas, hashes, conteos, necesidades, anotaciones y cola. Continúe solo hacia un receptor y canal autorizados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Continuar', onPress: () => void performExport() },
      ],
    );
  };

  return (
    <View>
      <SectionTitle title="Sincronización" detail={`${state.outbox.length} cambios pendientes`} />
      <View style={styles.connectionBand}>
        <View style={styles.connectionIcon}>
          <WifiOff size={22} color={colors.amber} />
        </View>
        <View style={styles.connectionBody}>
          <Text accessibilityRole="alert" style={styles.connectionTitle}>{message}</Text>
          <Text style={styles.connectionText}>Fotos y fichas se reintentan sin borrar la copia local.</Text>
        </View>
        <StatusTag
          label={state.outbox.length > 0 ? 'Pendiente' : 'Al día'}
          tone={state.outbox.length > 0 ? 'warning' : 'good'}
        />
      </View>

      <View style={styles.settings}>
        <View style={styles.label}>
          <Database size={16} color={colors.teal} />
          <Text style={styles.labelText}>Servidor HTTPS</Text>
        </View>
        <TextInput
          accessibilityLabel="Servidor HTTPS"
          value={endpoint}
          onChangeText={setEndpoint}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://respuesta.ejemplo.org"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <View style={styles.label}>
          <KeyRound size={16} color={colors.teal} />
          <Text style={styles.labelText}>Token operativo</Text>
        </View>
        <TextInput
          accessibilityLabel="Token operativo"
          value={token}
          onChangeText={setToken}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Token entregado al dispositivo"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Text style={styles.settingsNote}>
          El token no se incorpora al paquete: permanece en la sesión web o en almacenamiento seguro nativo.
        </Text>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Database size={20} color={colors.teal} />
          <Text style={styles.metricValue}>{state.inspections.length}</Text>
          <Text style={styles.metricLabel}>Fichas locales</Text>
        </View>
        <View style={styles.metric}>
          <FileCheck2 size={20} color={colors.blue} />
          <Text style={styles.metricValue}>{state.media.length}</Text>
          <Text style={styles.metricLabel}>Evidencias</Text>
        </View>
        <View style={styles.metric}>
          <WifiOff size={20} color={colors.amber} />
          <Text style={styles.metricValue}>{state.outbox.length}</Text>
          <Text style={styles.metricLabel}>En cola</Text>
        </View>
      </View>

      <View style={styles.actionLine}>
        <ActionButton
          label={busy ? 'Enviando…' : 'Guardar y sincronizar'}
          icon={CloudUpload}
          onPress={() => void sync()}
          disabled={busy || !endpoint.trim() || !token.trim() || state.outbox.length === 0}
        />
        <Text style={styles.actionNote}>
          La app reverifica huella y tamaño antes de aceptar el lote y envía primero metadatos, después bytes.
        </Text>
        <ActionButton
          label="Exportar datos restringidos"
          icon={Download}
          onPress={exportManifest}
          variant="secondary"
        />
        <Text style={styles.actionNote}>Conserva IDs, horas, hashes, conteos, necesidades, anotaciones y cola. Requiere receptor autorizado y canal cifrado aprobado.</Text>
      </View>

      <Text style={styles.queueTitle}>Cola local</Text>
      {state.outbox.length === 0 ? (
        <EmptyState icon={FileCheck2} title="No hay cambios pendientes" detail="Los datos de ejemplo aún no han sido modificados." />
      ) : (
        <View style={styles.queue}>
          {state.outbox.map((item) => (
            <View key={item.id} style={styles.queueRow}>
              <View style={styles.queueDot} />
              <View style={styles.queueBody}>
                <Text style={styles.queueEntity}>{item.entityType} · {item.entityId}</Text>
                <Text style={styles.queueMeta}>{new Date(item.createdAt).toLocaleString('es-CO')}</Text>
              </View>
              <StatusTag label="Pendiente" tone="warning" />
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  connectionBand: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  connectionIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: colors.amberSoft },
  connectionBody: { flex: 1 },
  connectionTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  connectionText: { color: colors.muted, fontSize: 12, marginTop: 3 },
  settings: { paddingVertical: 16, gap: 8, borderBottomWidth: 1, borderColor: colors.line },
  label: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  labelText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  input: { minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 11, color: colors.ink, backgroundColor: colors.surface },
  settingsNote: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  metrics: { flexDirection: 'row', marginTop: 18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  metric: { minWidth: 0, flex: 1, minHeight: 96, padding: 12, justifyContent: 'center' },
  metricValue: { color: colors.ink, fontSize: 23, fontWeight: '800', marginTop: 6 },
  metricLabel: { color: colors.muted, fontSize: 12, marginTop: 1 },
  actionLine: { paddingVertical: 18, borderBottomWidth: 1, borderColor: colors.line, alignItems: 'flex-start', gap: 9 },
  actionNote: { color: colors.muted, fontSize: 11 },
  queueTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 22, marginBottom: 10 },
  queue: { borderTopWidth: 1, borderColor: colors.line },
  queueRow: { minHeight: 58, borderBottomWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 10 },
  queueDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber },
  queueBody: { flex: 1 },
  queueEntity: { color: colors.ink, fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  queueMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
});
