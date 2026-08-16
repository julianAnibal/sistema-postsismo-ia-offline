import { Layers3, MapPinned } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { computeGridMetrics } from '../domain/analytics';
import { AppState, MapLayer } from '../domain/types';
import { colors } from './theme';
import { ChoiceGroup, SectionTitle, StatusTag } from './ui';

const layerLabels: Record<MapLayer, string> = {
  coverage: 'Cobertura',
  reviewed_damage: 'Daño revisado',
  pending_ai: 'IA pendiente',
  needs: 'Necesidades',
};

const colorFor = (layer: MapLayer, value: number | null) => {
  if (value === null) return '#E4E8E6';
  const strong = value >= 0.66;
  const medium = value >= 0.33;
  if (layer === 'coverage') return strong ? '#147D73' : medium ? '#65ADA5' : '#B9DCD7';
  if (layer === 'reviewed_damage') return strong ? '#B42318' : medium ? '#DE766D' : '#F2B9B4';
  if (layer === 'pending_ai') return strong ? '#B96B09' : medium ? '#E0A54C' : '#F3D69C';
  return strong ? '#315A8A' : medium ? '#7C9FC5' : '#BFD0E2';
};

export const MapDashboard = ({ state }: { state: AppState }) => {
  const [layer, setLayer] = useState<MapLayer>('coverage');
  const [selectedCell, setSelectedCell] = useState('A1');
  const metrics = useMemo(() => computeGridMetrics(state, layer), [layer, state]);
  const selected = metrics.find((item) => item.cellId === selectedCell) ?? metrics[0];
  const reviewed = state.inspections.filter((item) => item.status === 'reviewed').length;

  return (
    <View>
      <SectionTitle title="Mapa operativo" detail="Celdas sintéticas del simulacro" />
      <View style={styles.layerHeading}>
        <View style={styles.headingIcon}>
          <Layers3 size={20} color={colors.teal} />
        </View>
        <View style={styles.headingBody}>
          <Text style={styles.headingTitle}>Seleccione una capa</Text>
          <Text style={styles.headingText}>Cada valor muestra su numerador y denominador.</Text>
        </View>
        <StatusTag label={`${reviewed}/${state.infrastructures.length} revisadas`} tone="good" />
      </View>
      <ChoiceGroup
        value={layer}
        onChange={setLayer}
        options={(Object.keys(layerLabels) as MapLayer[]).map((value) => ({
          value,
          label: layerLabels[value],
        }))}
      />

      <View style={styles.mapBand}>
        <View style={styles.mapGrid}>
          {metrics.map((metric) => {
            const selectedNow = metric.cellId === selectedCell;
            const darkText = metric.value === null || metric.value < 0.4;
            return (
              <Pressable
                key={metric.cellId}
                accessibilityRole="button"
                accessibilityLabel={`Celda ${metric.cellId}, ${metric.label}`}
                onPress={() => setSelectedCell(metric.cellId)}
                style={({ pressed }) => [
                  styles.mapCell,
                  { backgroundColor: colorFor(layer, metric.value) },
                  selectedNow && styles.mapCellSelected,
                  pressed && styles.mapCellPressed,
                ]}
              >
                <Text style={[styles.mapCellName, { color: darkText ? colors.ink : colors.white }]}>
                  {metric.cellId}
                </Text>
                <Text style={[styles.mapCellValue, { color: darkText ? colors.dark : colors.white }]}>
                  {metric.denominator === 0 ? 'sin datos' : `${Math.round((metric.value ?? 0) * 100)}%`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {selected ? (
        <View style={styles.selectedBand}>
          <View style={styles.selectedIcon}>
            <MapPinned size={23} color={colors.blue} />
          </View>
          <View style={styles.selectedBody}>
            <Text style={styles.selectedTitle}>Celda {selected.cellId} · {layerLabels[layer]}</Text>
            <Text style={styles.selectedValue}>{selected.label}</Text>
            <Text style={styles.selectedMeta}>{selected.infrastructureCount} infraestructura registrada</Text>
          </View>
          <Text style={styles.percent}>
            {selected.value === null ? 'N/D' : `${Math.round(selected.value * 100)}%`}
          </Text>
        </View>
      ) : null}

      <View style={styles.cellList}>
        {metrics.map((metric) => (
          <Pressable
            key={metric.cellId}
            accessibilityRole="button"
            accessibilityLabel={`Seleccionar celda ${metric.cellId}: ${metric.label}`}
            onPress={() => setSelectedCell(metric.cellId)}
            style={[styles.cellRow, selectedCell === metric.cellId && styles.cellRowSelected]}
          >
            <View style={[styles.swatch, { backgroundColor: colorFor(layer, metric.value) }]} />
            <Text style={styles.cellName}>Celda {metric.cellId}</Text>
            <Text style={styles.cellMetric}>{metric.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.mapFootnote}>
        Las celdas son agregadas y sintéticas. No se publican puntos de personas ni se interpreta “sin datos” como “sin daño”.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  layerHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    marginBottom: 14,
  },
  headingIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tealSoft, borderRadius: 6 },
  headingBody: { flex: 1 },
  headingTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  headingText: { color: colors.muted, fontSize: 12, marginTop: 2 },
  mapBand: {
    width: '100%',
    marginTop: 18,
    backgroundColor: '#EDF1EF',
    padding: 18,
  },
  mapGrid: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  mapCell: {
    width: '31%',
    minWidth: 92,
    aspectRatio: 1.25,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapCellSelected: {
    borderColor: colors.ink,
  },
  mapCellPressed: {
    opacity: 0.78,
  },
  mapCellName: {
    fontSize: 21,
    fontWeight: '800',
  },
  mapCellValue: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
  },
  selectedBand: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  selectedIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blueSoft, borderRadius: 6 },
  selectedBody: { flex: 1 },
  selectedTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  selectedValue: { color: colors.blue, fontSize: 13, fontWeight: '700', marginTop: 3 },
  selectedMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  percent: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  cellList: { marginTop: 15, borderTopWidth: 1, borderColor: colors.line },
  cellRow: { minHeight: 46, borderBottomWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  cellRowSelected: { backgroundColor: colors.blueSoft },
  swatch: { width: 16, height: 16, borderRadius: 3 },
  cellName: { color: colors.ink, fontSize: 13, fontWeight: '700', width: 76 },
  cellMetric: { flex: 1, color: colors.muted, fontSize: 12, textAlign: 'right' },
  mapFootnote: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 14 },
});
