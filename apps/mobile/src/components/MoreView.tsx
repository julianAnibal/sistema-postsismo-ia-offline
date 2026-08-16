import { Cpu, Database, HardDrive, Info, RotateCcw, ShieldCheck, Smartphone } from 'lucide-react-native';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppState } from '../domain/types';
import { colors } from './theme';
import { ActionButton, SectionTitle, StatusTag } from './ui';

export const MoreView = ({
  state,
  canInstall,
  onInstall,
  onReset,
}: {
  state: AppState;
  canInstall: boolean;
  onInstall: () => void;
  onReset: () => void;
}) => {
  const confirmReset = () =>
    Alert.alert('Restablecer simulacro', 'Se eliminarán los cambios y fotos guardados en este dispositivo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Restablecer', style: 'destructive', onPress: onReset },
    ]);

  return (
    <View>
      <SectionTitle title="Dispositivo" detail={state.deviceAlias} />
      <View style={styles.infoRows}>
        <InfoRow icon={Database} title="Almacén local" detail="Activo · esquema v1" status="Disponible" tone="good" />
        <InfoRow icon={HardDrive} title="Evidencias" detail={`${state.media.length} fotografías · ${state.annotations.length} etiquetas separadas`} status="Local" tone="info" />
        <InfoRow icon={Cpu} title="Visión local" detail="Interfaz ONNX preparada; paquete no instalado" status="Pendiente" tone="warning" />
        <InfoRow icon={Cpu} title="Asistente generativo" detail="Interfaz de modelo local preparada; paquete no instalado" status="Pendiente" tone="warning" />
        <InfoRow icon={ShieldCheck} title="Privacidad" detail="Datos sintéticos y conteos agregados" status="Activa" tone="good" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Instalación</Text>
        <Text style={styles.sectionText}>Abra esta aplicación desde el icono del dispositivo para trabajar sin conexión.</Text>
        <ActionButton
          label={canInstall ? 'Instalar en este dispositivo' : 'Instalación gestionada por el navegador'}
          icon={Smartphone}
          onPress={onInstall}
          disabled={!canInstall}
          style={styles.action}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información técnica</Text>
        <View style={styles.licenseRow}>
          <Info size={19} color={colors.blue} />
          <View style={styles.licenseBody}>
            <Text style={styles.licenseTitle}>Paquetes y licencias</Text>
            <Text style={styles.licenseText}>No hay modelos de IA distribuidos en este prototipo. Los avisos completos se incorporarán con cada paquete firmado.</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Datos del simulacro</Text>
        <ActionButton label="Restablecer datos locales" icon={RotateCcw} variant="danger" onPress={confirmReset} style={styles.action} />
      </View>
    </View>
  );
};

const InfoRow = ({
  icon: Icon,
  title,
  detail,
  status,
  tone,
}: {
  icon: typeof Database;
  title: string;
  detail: string;
  status: string;
  tone: 'good' | 'warning' | 'info';
}) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIcon}><Icon size={20} color={colors.teal} /></View>
    <View style={styles.infoBody}>
      <Text style={styles.infoTitle}>{title}</Text>
      <Text style={styles.infoDetail}>{detail}</Text>
    </View>
    <StatusTag label={status} tone={tone} />
  </View>
);

const styles = StyleSheet.create({
  infoRows: { borderTopWidth: 1, borderColor: colors.line },
  infoRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderColor: colors.line },
  infoIcon: { width: 38, height: 38, borderRadius: 6, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' },
  infoBody: { flex: 1 },
  infoTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  infoDetail: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  section: { paddingVertical: 22, borderBottomWidth: 1, borderColor: colors.line },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  sectionText: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5, maxWidth: 560 },
  action: { alignSelf: 'flex-start', marginTop: 13 },
  licenseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12 },
  licenseBody: { flex: 1 },
  licenseTitle: { color: colors.blue, fontSize: 13, fontWeight: '800' },
  licenseText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
});
