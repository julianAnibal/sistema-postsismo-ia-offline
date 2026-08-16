import { Platform } from 'react-native';

export const colors = {
  ink: '#17201D',
  muted: '#5E6C67',
  surface: '#FFFFFF',
  background: '#F3F5F3',
  line: '#D8DEDB',
  teal: '#147D73',
  tealSoft: '#DDF1ED',
  amber: '#B96B09',
  amberSoft: '#FFF1D6',
  red: '#B42318',
  redSoft: '#FCE8E6',
  blue: '#315A8A',
  blueSoft: '#E7EFF8',
  dark: '#24302C',
  white: '#FFFFFF',
};

export const shadows = {
  card: Platform.select({
    web: { boxShadow: '0 1px 4px rgba(23, 32, 29, 0.08)' },
    default: {
      shadowColor: '#17201D',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 1,
    },
  }),
};
