import { Platform } from 'react-native';

export const colors = {
  ink: '#102A26',
  muted: '#62716B',
  surface: '#FFFFFF',
  background: '#F2F5F3',
  line: '#CBD6D1',
  teal: '#147D73',
  tealSoft: '#DDF1ED',
  amber: '#B96B09',
  amberSoft: '#FFF1D6',
  red: '#B42318',
  redSoft: '#FCE8E6',
  blue: '#315A8A',
  blueSoft: '#E7EFF8',
  dark: '#20302B',
  white: '#FFFFFF',
};

export const shadows = {
  card: Platform.select({
    web: { boxShadow: '0 8px 24px rgba(16, 42, 38, 0.08)' },
    default: {
      shadowColor: '#102A26',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 1,
    },
  }),
};
