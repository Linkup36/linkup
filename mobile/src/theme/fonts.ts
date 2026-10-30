import { Platform } from 'react-native';

export const fonts = {
  display: Platform.select({
    web: "'Syne', -apple-system, BlinkMacSystemFont, sans-serif",
    ios: 'Syne',
    android: 'Syne',
    default: 'sans-serif',
  }),
  body: Platform.select({
    web: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    ios: 'System',
    android: 'Roboto',
    default: 'sans-serif',
  }),
};
