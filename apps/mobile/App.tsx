import { StatusBar } from 'expo-status-bar';
import {
  ClipboardList,
  CloudUpload,
  Map,
  Menu,
  MoreHorizontal,
  ShieldCheck,
  WifiOff,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { InfrastructureList } from './src/components/InfrastructureList';
import { InspectionView } from './src/components/InspectionView';
import { MapDashboard } from './src/components/MapDashboard';
import { MoreView } from './src/components/MoreView';
import { SyncView } from './src/components/SyncView';
import { colors } from './src/components/theme';
import { StatusTag } from './src/components/ui';
import { Infrastructure } from './src/domain/types';
import { registerServiceWorker, useInstallPrompt } from './src/platform/pwa';
import { useFieldStore } from './src/storage/useFieldStore';

type Tab = 'work' | 'map' | 'sync' | 'more';

const navItems: Array<{ id: Tab; label: string; mobileLabel: string; icon: typeof ClipboardList }> = [
  { id: 'work', label: 'Trabajo', mobileLabel: 'Trabajo', icon: ClipboardList },
  { id: 'map', label: 'Mapa', mobileLabel: 'Mapa', icon: Map },
  { id: 'sync', label: 'Sincronizar', mobileLabel: 'Envíos', icon: CloudUpload },
  { id: 'more', label: 'Más', mobileLabel: 'Más', icon: MoreHorizontal },
];

export default function App() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [tab, setTab] = useState<Tab>('work');
  const [selected, setSelected] = useState<Infrastructure | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const { state, ready, getInspection, saveInspection, addEvidence, reset } = useFieldStore();
  const { canInstall, install } = useInstallPrompt();

  useEffect(() => registerServiceWorker(), []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [selected?.id, tab]);

  const selectTab = (next: Tab) => {
    setTab(next);
    if (next !== 'work') setSelected(null);
  };

  if (!ready) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={colors.teal} />
        <Text style={styles.loadingText}>Abriendo datos locales…</Text>
      </SafeAreaView>
    );
  }

  const inspection = selected ? getInspection(selected.id) : null;
  const inspectionMedia = inspection
    ? state.media.filter((item) => item.inspectionId === inspection.id)
    : [];

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.brandMark}>
          <ShieldCheck size={22} color={colors.white} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.brand}>Sierra Clara</Text>
          <Text style={styles.operation} numberOfLines={1}>{state.operationName}</Text>
        </View>
        <View style={styles.headerState}>
          {wide ? <StatusTag label="Datos sintéticos" tone="info" /> : null}
          <View style={styles.offlineState}>
            <WifiOff size={15} color={colors.amber} />
            <Text style={styles.offlineText}>{state.outbox.length} pendientes</Text>
          </View>
        </View>
      </View>

      <View style={styles.shell}>
        {wide ? (
          <View style={styles.sidebar}>
            <View style={styles.deviceBlock}>
              <Text style={styles.deviceLabel}>DISPOSITIVO</Text>
              <Text style={styles.deviceName}>{state.deviceAlias}</Text>
              <Text style={styles.deviceMode}>Operación local</Text>
            </View>
            <View style={styles.desktopNav}>
              {navItems.map((item) => (
                <NavItem key={item.id} item={item} selected={tab === item.id} onPress={() => selectTab(item.id)} wide />
              ))}
            </View>
            <View style={styles.sidebarFooter}>
              <Menu size={16} color={colors.muted} />
              <Text style={styles.sidebarFooterText}>Esquema local v1</Text>
            </View>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.content, !wide && styles.contentMobile]}
          keyboardShouldPersistTaps="handled"
        >
          {tab === 'work' && !selected ? (
            <InfrastructureList state={state} onSelect={setSelected} />
          ) : null}
          {tab === 'work' && selected && inspection ? (
            <InspectionView
              infrastructure={selected}
              inspection={inspection}
              media={inspectionMedia}
              onBack={() => setSelected(null)}
              onSave={saveInspection}
              onAddEvidence={addEvidence}
            />
          ) : null}
          {tab === 'map' ? <MapDashboard state={state} /> : null}
          {tab === 'sync' ? <SyncView state={state} /> : null}
          {tab === 'more' ? (
            <MoreView
              state={state}
              canInstall={canInstall}
              onInstall={() => void install()}
              onReset={() => {
                reset();
                setSelected(null);
              }}
            />
          ) : null}
        </ScrollView>
      </View>

      {!wide ? (
        <View style={styles.mobileNav}>
          {navItems.map((item) => (
            <NavItem key={item.id} item={item} selected={tab === item.id} onPress={() => selectTab(item.id)} />
          ))}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const NavItem = ({
  item,
  selected,
  onPress,
  wide = false,
}: {
  item: (typeof navItems)[number];
  selected: boolean;
  onPress: () => void;
  wide?: boolean;
}) => {
  const Icon = item.icon;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        wide ? styles.desktopNavItem : styles.mobileNavItem,
        selected && (wide ? styles.desktopNavItemSelected : styles.mobileNavItemSelected),
        pressed && styles.navPressed,
      ]}
    >
      <Icon size={wide ? 19 : 21} color={selected ? colors.teal : colors.muted} strokeWidth={2} />
      <Text style={[wide ? styles.desktopNavText : styles.mobileNavText, selected && styles.navTextSelected]}>
        {wide ? item.label : item.mobileLabel}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, color: colors.muted, fontSize: 13 },
  header: {
    height: 66,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    gap: 11,
  },
  brandMark: { width: 38, height: 38, borderRadius: 7, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, minWidth: 0 },
  brand: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  operation: { color: colors.muted, fontSize: 11, marginTop: 1 },
  headerState: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  offlineState: { height: 32, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, backgroundColor: colors.amberSoft, borderRadius: 6 },
  offlineText: { color: colors.amber, fontSize: 11, fontWeight: '800' },
  shell: { flex: 1, flexDirection: 'row' },
  sidebar: { width: 224, borderRightWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 14 },
  deviceBlock: { padding: 10, paddingBottom: 18, borderBottomWidth: 1, borderColor: colors.line },
  deviceLabel: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  deviceName: { color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: 5 },
  deviceMode: { color: colors.teal, fontSize: 11, marginTop: 2 },
  desktopNav: { gap: 5, paddingTop: 16 },
  desktopNavItem: { height: 44, borderRadius: 6, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  desktopNavItemSelected: { backgroundColor: colors.tealSoft },
  desktopNavText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  sidebarFooter: { marginTop: 'auto', minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderTopWidth: 1, borderColor: colors.line },
  sidebarFooterText: { color: colors.muted, fontSize: 11 },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 1080, alignSelf: 'center', padding: 26, paddingBottom: 50 },
  contentMobile: { padding: 16, paddingBottom: 32 },
  mobileNav: { height: 66, flexDirection: 'row', borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  mobileNavItem: { flex: 1, minWidth: 72, alignItems: 'center', justifyContent: 'center', gap: 3 },
  mobileNavItemSelected: { backgroundColor: colors.tealSoft },
  mobileNavText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  navTextSelected: { color: colors.teal },
  navPressed: { opacity: 0.7 },
});
