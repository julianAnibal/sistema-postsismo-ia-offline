import { CloudUpload, Database, FileCheck2, KeyRound, WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { AppState } from '../domain/types';
import { loadSyncSettings, saveSyncSettings, synchronizeFieldState } from '../sync/fieldSync';
import { colors } from './theme';
import { ActionButton, EmptyState, SectionTitle, StatusTag } from './ui';

export const SyncView = ({ state, onAcknowledged }: { state: AppState; onAcknowledged: (ids: string[]) => void }) => {
  const [endpoint, setEndpoint] = useState('');
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('Los datos permanecen locales hasta confirmar el envío.');
  const [busy, setBusy] = useState(false);

  useEffect(() => { void loadSyncSettings().then((value) => { setEndpoint(value.endpoint); setToken(value.token); }); }, []);
  const sync = async () => {
    setBusy(true);
    try {
      await saveSyncSettings(endpoint, token);
      const result = await synchronizeFieldState(state);
      onAcknowledged(result.acknowledgedEntityIds);
      setMessage(`Lote ${result.batchId} confirmado por el servidor.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No fue posible sincronizar.'); }
    finally { setBusy(false); }
  };

  return <View>
    <SectionTitle title="Sincronización" detail={`${state.outbox.length} cambios pendientes`} />
    <View style={styles.connectionBand}><WifiOff size={22} color={colors.amber} /><View style={styles.connectionBody}><Text style={styles.connectionTitle}>{message}</Text><Text style={styles.connectionText}>Fotos y fichas se reintentan sin borrar la copia local.</Text></View><StatusTag label={state.outbox.length ? 'Pendiente' : 'Al día'} tone={state.outbox.length ? 'warning' : 'good'} /></View>
    <View style={styles.settings}>
      <View style={styles.label}><Database size={16} color={colors.teal} /><Text>Servidor HTTPS</Text></View>
      <TextInput value={endpoint} onChangeText={setEndpoint} autoCapitalize="none" placeholder="https://respuesta.ejemplo.org" style={styles.input} />
      <View style={styles.label}><KeyRound size={16} color={colors.teal} /><Text>Token operativo</Text></View>
      <TextInput value={token} onChangeText={setToken} secureTextEntry autoCapitalize="none" placeholder="Token entregado al dispositivo" style={styles.input} />
    </View>
    <View style={styles.metrics}><View style={styles.metric}><Database size={20} color={colors.teal} /><Text style={styles.metricValue}>{state.inspections.length}</Text><Text style={styles.metricLabel}>Fichas locales</Text></View><View style={styles.metric}><FileCheck2 size={20} color={colors.blue} /><Text style={styles.metricValue}>{state.media.length}</Text><Text style={styles.metricLabel}>Evidencias</Text></View></View>
    <View style={styles.actionLine}><ActionButton label={busy ? 'Enviando…' : 'Guardar y sincronizar'} icon={CloudUpload} onPress={() => void sync()} disabled={busy || !endpoint || !token || state.outbox.length === 0} /></View>
    {state.outbox.length === 0 ? <EmptyState icon={FileCheck2} title="No hay cambios pendientes" detail="El servidor confirmó todos los registros de esta cola." /> : state.outbox.map((item) => <View key={item.id} style={styles.queueRow}><Text style={styles.queueEntity}>{item.entityType} · {item.entityId}</Text><StatusTag label="Pendiente" tone="warning" /></View>)}
  </View>;
};

const styles = StyleSheet.create({
  connectionBand: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line }, connectionBody: { flex: 1 }, connectionTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' }, connectionText: { color: colors.muted, fontSize: 11, marginTop: 3 },
  settings: { paddingVertical: 16, gap: 7, borderBottomWidth: 1, borderColor: colors.line }, label: { flexDirection: 'row', alignItems: 'center', gap: 7 }, input: { minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 5, paddingHorizontal: 11, color: colors.ink, backgroundColor: colors.surface },
  metrics: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.line }, metric: { flex: 1, minHeight: 90, padding: 14, justifyContent: 'center' }, metricValue: { color: colors.ink, fontSize: 22, fontWeight: '800', marginTop: 5 }, metricLabel: { color: colors.muted, fontSize: 12 }, actionLine: { paddingVertical: 16 }, queueRow: { minHeight: 58, borderTopWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, queueEntity: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '700' },
});
