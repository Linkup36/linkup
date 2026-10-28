/**
 * LinkUp Marketplace Official Brand Design Tokens
 * Primary: #EB7D30 (LinkUp Orange)
 * Background: #FDFEFE (Crisp Clean White)
 */
export const colors = {
  // Brand
  primary: '#EB7D30',
  primaryDark: '#D66A20',
  primaryLight: '#FFF7ED',
  primaryBorder: '#FDBA74',
  primaryGlow: 'rgba(235, 125, 48, 0.25)',

  // Neutral / Backgrounds
  background: '#FDFEFE',
  surface: '#F8FAFC',
  card: '#FFFFFF',
  cardBorder: '#E2E8F0',
  cardBorderLight: '#F1F5F9',

  // Typography
  text: '#0F172A',
  foreground: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  mutedForeground: '#64748B',
  textLight: '#94A3B8',
  textInverse: '#FFFFFF',

  // Status & Accents
  accent: '#F59E0B',      // Rating stars / gold badge
  success: '#10B981',     // Escrow / verified green
  destructive: '#EF4444', // Danger / wishlist heart active
  danger: '#EF4444',
  error: '#EF4444',
  info: '#3B82F6',

  // Overlay
  overlay: 'rgba(15, 23, 42, 0.6)',
  glassBackground: 'rgba(255, 255, 255, 0.85)',
};

export type Colors = typeof colors;
