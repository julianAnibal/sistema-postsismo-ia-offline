import { LucideIcon } from 'lucide-react-native';
import { ReactNode } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { colors } from './theme';

export const SectionTitle = ({ title, detail }: { title: string; detail?: string }) => (
  <View style={styles.sectionTitleRow}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
  </View>
);

export const Label = ({ children }: { children: ReactNode }) => (
  <Text style={styles.label}>{children}</Text>
);

export const StatusTag = ({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'good' | 'warning' | 'danger' | 'info';
}) => (
  <View style={[styles.tag, tagStyles[tone]]}>
    <Text style={[styles.tagText, tagTextStyles[tone]]}>{label}</Text>
  </View>
);

export const ActionButton = ({
  label,
  icon: Icon,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: {
  label: string;
  icon?: LucideIcon;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.button,
      buttonStyles[variant],
      pressed && !disabled && styles.buttonPressed,
      disabled && styles.buttonDisabled,
      style,
    ]}
  >
    {Icon ? <Icon size={18} color={buttonTextStyles[variant].color} strokeWidth={2} /> : null}
    <Text style={[styles.buttonText, buttonTextStyles[variant]]}>{label}</Text>
  </Pressable>
);

export const IconButton = ({
  label,
  icon: Icon,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed]}
  >
    <Icon size={20} color={colors.ink} />
  </Pressable>
);

export const ChoiceGroup = <T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) => (
  <View style={styles.choiceWrap}>
    {options.map((option) => {
      const selected = option.value === value;
      return (
        <Pressable
          key={option.value}
          accessibilityRole="radio"
          accessibilityState={{ checked: selected }}
          onPress={() => onChange(option.value)}
          style={({ pressed }) => [
            styles.choice,
            selected && styles.choiceSelected,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
            {option.label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

export const TextField = ({
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType,
  style,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
  style?: StyleProp<TextStyle>;
}) => (
  <TextInput
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor="#87938F"
    multiline={multiline}
    keyboardType={keyboardType}
    style={[styles.input, multiline && styles.inputMultiline, style]}
  />
);

export const EmptyState = ({
  icon: Icon,
  title,
  detail,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
}) => (
  <View style={styles.empty}>
    <Icon size={28} color={colors.muted} />
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyDetail}>{detail}</Text>
  </View>
);

const tagStyles = StyleSheet.create({
  neutral: { backgroundColor: '#E9ECEA' },
  good: { backgroundColor: colors.tealSoft },
  warning: { backgroundColor: colors.amberSoft },
  danger: { backgroundColor: colors.redSoft },
  info: { backgroundColor: colors.blueSoft },
});

const tagTextStyles = StyleSheet.create({
  neutral: { color: colors.dark },
  good: { color: colors.teal },
  warning: { color: colors.amber },
  danger: { color: colors.red },
  info: { color: colors.blue },
});

const buttonStyles = StyleSheet.create({
  primary: { backgroundColor: colors.teal, borderColor: colors.teal },
  secondary: { backgroundColor: colors.surface, borderColor: colors.line },
  danger: { backgroundColor: colors.surface, borderColor: colors.redSoft },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
});

const buttonTextStyles = StyleSheet.create({
  primary: { color: colors.white },
  secondary: { color: colors.ink },
  danger: { color: colors.red },
  ghost: { color: colors.teal },
});

const styles = StyleSheet.create({
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  sectionDetail: { fontSize: 12, color: colors.muted },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  tag: { minHeight: 26, paddingHorizontal: 9, justifyContent: 'center', borderRadius: 8 },
  tagText: { fontSize: 12, fontWeight: '700' },
  button: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: { fontSize: 14, fontWeight: '700' },
  buttonPressed: { opacity: 0.72 },
  buttonDisabled: { opacity: 0.42 },
  iconButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choice: {
    minHeight: 38,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  choiceSelected: { backgroundColor: colors.tealSoft, borderColor: colors.teal },
  choiceText: { color: colors.dark, fontSize: 13, fontWeight: '600' },
  choiceTextSelected: { color: colors.teal },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 15,
  },
  inputMultiline: { minHeight: 96, paddingTop: 11, textAlignVertical: 'top' },
  empty: {
    paddingVertical: 38,
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  emptyTitle: { marginTop: 10, color: colors.ink, fontSize: 16, fontWeight: '700' },
  emptyDetail: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 420,
  },
});
