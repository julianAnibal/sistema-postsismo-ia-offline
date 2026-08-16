import { Layers3, MapPinned } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon, Text as SvgText } from 'react-native-svg';

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

const hexPoints = (cx: number, cy: number, radius: number) =>
  Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 180) * (60 * index - 30);
    return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
  }).join(' ');

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
        <Svg width="100%" height="100%" viewBox="0 0 720 390">
          {metrics.map((metric) => {
            const cx = 145 + metric.x * 185 + (metric.y % 2) * 92;
            const cy = 112 + metric.y * 150;
            const selectedNow = metric.cellId === selectedCell;
            return (
              <Polygon
                key={metric.cellId}
                points={hexPoints(cx, cy, 91)}
                fill={colorFor(layer, metric.value)}
                stroke={selectedNow ? colors.ink : colors.white}
                strokeWidth={selectedNow ? 5 : 3}
              />
            );
          })}
          {metrics.map((metric) => {
            const cx = 145 + metric.x * 185 + (metric.y % 2) * 92;
            const cy = 112 + metric.y * 150;
            const darkText = metric.value === null || metric.value < 0.4;
            return (
              <SvgText
                key={`label-${metric.cellId}`}
                x={cx}
                y={cy - 7}
                textAnchor="middle"
                fontSize="22"
                fontWeight="700"
                fill={darkText ? colors.ink : colors.white}
              >
                {metric.cellId}
              </SvgText>
            );
          })}
          {metrics.map((metric) => {
            const cx = 145 + metric.x * 185 + (metric.y % 2) * 92;
            const cy = 112 + metric.y * 150;
            const darkText = metric.value === null || metric.value < 0.4;
            return (
              <SvgText
                key={`value-${metric.cellId}`}
                x={cx}
                y={cy + 22}
                textAnchor="middle"
                fontSize="15"
                fontWeight="600"
                fill={darkText ? colors.dark : colors.white}
              >
                {metric.denominator === 0 ? 'sin datos' : `${Math.round((metric.value ?? 0) * 100)}%`}
              </SvgText>
            );
          })}
        </Svg>
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
    aspectRatio: 1.75,
    minHeight: 300,
    maxHeight: 520,
    marginTop: 18,
    backgroundColor: '#EDF1EF',
    overflow: 'hidden',
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
