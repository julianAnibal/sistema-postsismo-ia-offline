import {
  Activity,
  Box,
  Building2,
  GraduationCap,
  HeartPulse,
  Search,
  Users,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { infrastructureLabels, priorityLabels } from '../domain/labels';
import { AppState, Infrastructure, InfrastructureType } from '../domain/types';
import { colors, shadows } from './theme';
import { ChoiceGroup, SectionTitle, StatusTag, TextField } from './ui';

const iconForType: Record<InfrastructureType, typeof Building2> = {
  residential: Building2,
  education: GraduationCap,
  health: HeartPulse,
  bridge: Activity,
  community: Users,
  warehouse: Box,
};

export const InfrastructureList = ({
  state,
  onSelect,
}: {
  state: AppState;
  onSelect: (item: Infrastructure) => void;
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('all');

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return state.infrastructures.filter((item) => {
      const inspection = state.inspections.find(
        (candidate) => candidate.infrastructureId === item.id,
      );
      const matchesQuery =
        !normalized ||
        `${item.name} ${item.code} ${item.sector}`.toLowerCase().includes(normalized);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'reviewed' && inspection?.status === 'reviewed') ||
        (filter === 'pending' && inspection?.status !== 'reviewed');
      return matchesQuery && matchesFilter;
    });
  }, [filter, query, state.infrastructures, state.inspections]);

  const reviewedCount = state.inspections.filter((item) => item.status === 'reviewed').length;

  return (
    <View>
      <SectionTitle title="Infraestructura asignada" detail={`${reviewedCount}/${state.infrastructures.length} revisadas`} />
      <View style={styles.summaryBand}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{state.infrastructures.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.teal }]}>{reviewedCount}</Text>
          <Text style={styles.summaryLabel}>Revisadas</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.amber }]}>
            {state.infrastructures.length - reviewedCount}
          </Text>
          <Text style={styles.summaryLabel}>Pendientes</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.red }]}>
            {state.infrastructures.filter((item) => item.priority === 'critical').length}
          </Text>
          <Text style={styles.summaryLabel}>Críticas</Text>
        </View>
      </View>

      <View style={styles.filters}>
        <View style={styles.searchWrap}>
          <View style={styles.searchIcon}>
            <Search size={18} color={colors.muted} />
          </View>
          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar código, nombre o sector"
            style={styles.searchInput}
          />
        </View>
        <ChoiceGroup
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Todas' },
            { value: 'pending', label: 'Pendientes' },
            { value: 'reviewed', label: 'Revisadas' },
          ]}
        />
      </View>

      <View style={styles.list}>
        {rows.map((item) => {
          const Icon = iconForType[item.type];
          const inspection = state.inspections.find(
            (candidate) => candidate.infrastructureId === item.id,
          );
          const isReviewed = inspection?.status === 'reviewed';
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${item.name}`}
              onPress={() => onSelect(item)}
              style={({ pressed }) => [styles.row, shadows.card, pressed && styles.rowPressed]}
            >
              <View style={styles.iconBox}>
                <Icon size={22} color={colors.teal} />
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTitleLine}>
                  <Text style={styles.code}>{item.code}</Text>
                  <StatusTag
                    label={priorityLabels[item.priority]}
                    tone={item.priority === 'critical' ? 'danger' : item.priority === 'high' ? 'warning' : 'neutral'}
                  />
                </View>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {infrastructureLabels[item.type]} · {item.sector} · Celda {item.gridCell}
                </Text>
              </View>
              <StatusTag label={isReviewed ? 'Revisada' : 'Pendiente'} tone={isReviewed ? 'good' : 'info'} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  summaryBand: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    marginBottom: 18,
  },
  summaryItem: { minWidth: 110, flex: 1, paddingVertical: 14, paddingHorizontal: 16 },
  summaryValue: { fontSize: 22, fontWeight: '800', color: colors.ink },
  summaryLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
  filters: { gap: 12, marginBottom: 16 },
  searchWrap: { position: 'relative', justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 13, zIndex: 1, pointerEvents: 'none' },
  searchInput: { paddingLeft: 40 },
  list: { gap: 9 },
  row: {
    minHeight: 92,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowPressed: { opacity: 0.72 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealSoft,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  code: { fontSize: 12, fontWeight: '800', color: colors.teal },
  name: { fontSize: 16, lineHeight: 21, fontWeight: '700', color: colors.ink },
  meta: { marginTop: 4, fontSize: 12, color: colors.muted, lineHeight: 17 },
});
