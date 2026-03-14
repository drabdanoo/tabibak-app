// Theme and Color Configuration
export const colors = {
  primary: '#10b981',      // Green
  primaryDark: '#059669',
  primaryLight: '#34d399',

  secondary: '#3b82f6',    // Blue
  secondaryDark: '#2563eb',
  secondaryLight: '#60a5fa',

  background: '#f9fafb',
  backgroundLight: '#f9fafb',
  backgroundDark: '#111827',

  text: '#1f2937',
  textSecondary: '#6b7280',
  textLight: '#6b7280',
  textDark: '#111827',

  error: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#3b82f6',

  border: '#e5e7eb',
  borderLight: '#f3f4f6',

  white: '#ffffff',
  black: '#000000',
  gray: '#9ca3af',
};

// ─── Appointment status color map ──────────────────────────────────────────────
// Use: const { bg, text, border } = statusColors[appointment.status] ?? statusColors.pending
export const statusColors = {
  pending: {
    bg:     '#fef3c7',
    text:   '#92400e',
    border: '#f59e0b',
  },
  confirmed: {
    bg:     '#d1fae5',
    text:   '#065f46',
    border: '#10b981',
  },
  waiting: {
    bg:     '#dbeafe',
    text:   '#1e40af',
    border: '#3b82f6',
  },
  in_progress: {
    bg:     '#ede9fe',
    text:   '#5b21b6',
    border: '#8b5cf6',
  },
  completed: {
    bg:     '#f3f4f6',
    text:   '#374151',
    border: '#9ca3af',
  },
  cancelled: {
    bg:     '#fee2e2',
    text:   '#991b1b',
    border: '#ef4444',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 24,
    xxl: 32,
  },
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

// Elevation/shadow presets (iOS shadow + Android elevation)
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
};

// Legacy exports for backward compatibility
export const Colors = colors;
export const Spacing = spacing;
export const FontSizes = typography.sizes;
