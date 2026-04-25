import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  I18nManager,
} from 'react-native';
import { colors, BorderRadius, spacing, typography } from '../../config/theme';

/**
 * PrimaryButton
 *
 * Props:
 *   label       string   — button text
 *   onPress     fn       — tap handler
 *   variant     'filled' | 'outline' | 'text'   (default: 'filled')
 *   loading     bool     — show spinner, disable tap
 *   disabled    bool     — dim and disable tap
 *   style       object   — extra container styles
 *   textStyle   object   — extra label styles
 */
const PrimaryButton = ({
  label,
  onPress,
  variant = 'filled',
  loading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  const isDisabled = disabled || loading;

  const containerStyle = [
    styles.base,
    variant === 'filled'  && styles.filled,
    variant === 'outline' && styles.outline,
    variant === 'text'    && styles.textVariant,
    isDisabled            && styles.disabled,
    style,
  ];

  const labelStyle = [
    styles.label,
    variant === 'filled'  && styles.labelFilled,
    variant === 'outline' && styles.labelOutline,
    variant === 'text'    && styles.labelText,
    isDisabled            && styles.labelDisabled,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'filled' ? colors.white : colors.primary}
          size="small"
        />
      ) : (
        <Text style={labelStyle}>{label}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
  },

  // Variants
  filled: {
    backgroundColor: colors.primary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  textVariant: {
    backgroundColor: 'transparent',
  },

  // Disabled overlay
  disabled: {
    opacity: 0.45,
  },

  // Label variants
  label: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
  },
  labelFilled: {
    color: colors.white,
  },
  labelOutline: {
    color: colors.primary,
  },
  labelText: {
    color: colors.primary,
  },
  labelDisabled: {
    // opacity already applied on container; keep colour for readability
  },
});

export default PrimaryButton;
