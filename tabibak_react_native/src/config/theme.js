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
  gray: '#9ca3af'
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48
};

export const typography = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 24,
    xxl: 32
  }
};

// Legacy exports for backward compatibility
export const Colors = colors;
export const Spacing = spacing;
export const FontSizes = typography.sizes;

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999
};
