import { Database, Download, FileCheck2, WifiOff } from 'lucide-react-native';
import { Alert, Platform, Share, StyleSheet, Text, View } from 'react-native';

import { AppState } from '../domain/types';
import { colors } from './theme';
import { ActionButton, EmptyState, SectionTitle, StatusTag } from './ui';

const buildExport = (state: AppState) => ({
  schemaVersion: state.schemaVersion,
  exportedAt: new Date().toISOString(),
  operationName: state.operationName,
  deviceAlias: state.deviceAlias,
  infrastructures: state.infrastructures,
  inspections: state.inspections,
  mediaManifest: state.media.map(({ uri: _uri, ...item }) => ({ ...item, binaryIncluded: false })),
  annotations: state.annotations,
  modelAnalyses: state.modelAnalyses,
  outbox: state.outbox,
});

export const SyncView = ({ state }: { state: AppState }) => {
  const exportManifest = async () => {
    const content = JSON.stringify(buildExport(state), null, 2);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `paquete-${state.deviceAlias.toLowerCase().replace(/\s+/g, '-')}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      return;
    }
    await Share.share({ title: 'Paquete local', message: content });
  };

  return (
    <View>
      <SectionTitle title="Sincronización" detail={`${state.outbox.length} cambios pendientes`} />
      <View style={styles.connectionBand}>
        <View style={styles.connectionIcon}>
          <WifiOff size={22} color={colors.amber} />
        </View>
        <View style={styles.connectionBody}>
          <Text style={styles.connectionTitle}>Servidor de operación no configurado</Text>
          <Text style={styles.connectionText}>Los registros permanecen en este dispositivo.</Text>
        </View>
        <StatusTag label="Solo local" tone="warning" />
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
        <ActionButton label="Exportar manifiesto JSON" icon={Download} onPress={() => void exportManifest()} />
        <Text style={styles.actionNote}>El manifiesto omite los binarios fotográficos y conserva sus huellas.</Text>
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
  metrics: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  metric: { minWidth: 150, flex: 1, minHeight: 96, padding: 14, justifyContent: 'center' },
  metricValue: { color: colors.ink, fontSize: 23, fontWeight: '800', marginTop: 6 },
  metricLabel: { color: colors.muted, fontSize: 12, marginTop: 1 },
  actionLine: { paddingVertical: 18, borderBottomWidth: 1, borderColor: colors.line, alignItems: 'flex-start', gap: 8 },
  actionNote: { color: colors.muted, fontSize: 11 },
  queueTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 22, marginBottom: 10 },
  queue: { borderTopWidth: 1, borderColor: colors.line },
  queueRow: { minHeight: 58, borderBottomWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 10 },
  queueDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber },
  queueBody: { flex: 1 },
  queueEntity: { color: colors.ink, fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  queueMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
});
