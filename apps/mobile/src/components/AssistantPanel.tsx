import { BookOpen, Check, Search } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { KnowledgeResult, searchKnowledge } from '../data/knowledge';
import { colors } from './theme';
import { ActionButton, Label, StatusTag, TextField } from './ui';

export const AssistantPanel = ({ onUseDraft }: { onUseDraft: (text: string) => void }) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<KnowledgeResult | null>(null);

  const runSearch = () => setResult(searchKnowledge(query));

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <View>
          <Text style={styles.title}>Consulta local</Text>
          <Text style={styles.subtitle}>Biblioteca aprobada disponible sin conexión</Text>
        </View>
        <StatusTag label="Local" tone="good" />
      </View>
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
              {source.title} · {source.section}
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
        <Text style={styles.modelTitle}>Asistencia generativa</Text>
        <Text style={styles.modelText}>Paquete de modelo no instalado. La consulta actual es búsqueda documental, sin predicciones.</Text>
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
  modelState: { borderTopWidth: 1, borderColor: colors.line, paddingTop: 12, marginTop: 8 },
  modelTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  modelText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
});
