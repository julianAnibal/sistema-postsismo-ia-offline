import { Cpu, Database, HardDrive, Info, RotateCcw, ShieldCheck, Smartphone } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';

import { collectDeviceCapabilities } from '../ai/deviceCapabilities';
import { GEMMA_ANDROID_E2B_MODEL, GEMMA_E2B_MODEL } from '../ai/gemmaModel';
import {
  DeviceCapabilities,
  formatDeviceBytes,
  recommendExecutionTier,
} from '../ai/devicePolicy';
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
  const [device, setDevice] = useState<DeviceCapabilities | null>(null);

  useEffect(() => {
    let active = true;
    void collectDeviceCapabilities().then((value) => {
      if (active) setDevice(value);
    });
    return () => {
      active = false;
    };
  }, []);

  const tier = device ? recommendExecutionTier(device) : 'deterministic';
  const evidenceBytes = state.media.reduce((total, item) => total + item.sizeBytes, 0);
  const tierDetail =
    tier === 'language-candidate'
      ? 'Candidato para visión compacta y carga local de Gemma; cada paquete aún debe superar benchmark en este equipo'
      : tier === 'compact-vision-candidate'
        ? `Candidato para visión compacta; Gemma solo debe cargarse si la prueba ${Platform.OS === 'web' ? 'WebGPU del navegador' : 'LiteRT-LM en este equipo'} termina correctamente`
        : 'El modo determinista seguirá disponible; Gemma puede no cargar en este presupuesto de memoria';
  const activeGemmaModel = Platform.OS === 'web' ? GEMMA_E2B_MODEL : GEMMA_ANDROID_E2B_MODEL;

  const confirmReset = () =>
    Alert.alert('Restablecer simulacro', 'Se eliminarán los cambios y fotos guardados en este dispositivo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Restablecer', style: 'destructive', onPress: onReset },
    ]);

  return (
    <View>
      <SectionTitle title="Dispositivo" detail={state.deviceAlias} />
      <View style={styles.infoRows}>
        <InfoRow icon={Database} title="Almacén local" detail="Activo · esquema v2" status="Disponible" tone="good" />
        <InfoRow icon={HardDrive} title="Evidencias" detail={`${state.media.length} fotografías · ${formatDeviceBytes(evidenceBytes)} · ${state.annotations.length} etiquetas separadas`} status="Local" tone="info" />
        <InfoRow
          icon={Smartphone}
          title="Presupuesto del equipo"
          detail={device ? `RAM ${formatDeviceBytes(device.totalMemoryBytes)} · límite app ${formatDeviceBytes(device.maxAppMemoryBytes)} · libres ${formatDeviceBytes(device.availableStorageBytes)}. ${tierDetail}` : 'Midiendo RAM y almacenamiento disponibles…'}
          status={device ? 'Medido' : 'Leyendo'}
          tone="info"
        />
        <InfoRow icon={Cpu} title="Asistente determinista" detail="Borradores, campos faltantes y contradicciones sin cargar un modelo" status="Activo" tone="good" />
        <InfoRow icon={Cpu} title="Visión local" detail={tier === 'deterministic' ? 'Interfaz preparada; este equipo no se preselecciona para un paquete nativo' : 'Equipo candidato; paquete firmado y benchmark todavía requeridos'} status="Sin paquete" tone="warning" />
        <InfoRow
          icon={Cpu}
          title="Asistente generativo"
          detail={Platform.OS === 'web'
            ? `Gemma 4 E2B usa WebGPU y ${formatDeviceBytes(activeGemmaModel.sizeBytes)} de almacenamiento del navegador.`
            : `Gemma 4 E2B usa LiteRT-LM nativo y ${formatDeviceBytes(activeGemmaModel.sizeBytes)} de almacenamiento privado.`}
          status="Gemma E2B"
          tone="info"
        />
        <InfoRow icon={ShieldCheck} title="Privacidad" detail="La evidencia y el GPS exacto permanecen locales; los tableros usan conteos agregados" status="Activa" tone="good" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Instalación</Text>
        <Text style={styles.sectionText}>{Platform.OS === 'web' ? 'Abra esta aplicación desde el icono del dispositivo para trabajar sin conexión.' : 'El APK está instalado. Descargue o importe Gemma dentro del asistente antes de perder conectividad.'}</Text>
        <ActionButton
          label={Platform.OS === 'web' ? (canInstall ? 'Instalar en este dispositivo' : 'Instalación gestionada por el navegador') : 'APK instalado en este dispositivo'}
          icon={Smartphone}
          onPress={onInstall}
          disabled={Platform.OS !== 'web' || !canInstall}
          style={styles.action}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información técnica</Text>
        <View style={styles.licenseRow}>
          <Info size={19} color={colors.blue} />
          <View style={styles.licenseBody}>
            <Text style={styles.licenseTitle}>Paquetes y licencias</Text>
            <Text style={styles.licenseText}>Gemma 4 E2B está fijado a una revisión, tamaño y SHA-256 exactos; en esta plataforma usa {activeGemmaModel.runtime}. Se descarga o importa por separado para no inflar la instalación base. Sigue siendo asistencia de redacción: no emite diagnóstico, habitabilidad ni decisión oficial.</Text>
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
