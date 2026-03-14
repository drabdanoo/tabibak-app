import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  I18nManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, BorderRadius, spacing, typography } from '../../config/theme';

/**
 * CustomTextField
 *
 * Props:
 *   label         string   — floating label above the input
 *   value         string
 *   onChangeText  fn
 *   placeholder   string
 *   error         string   — error message shown below; also turns border red
 *   secureText    bool     — password field with eye toggle
 *   multiline     bool     — grows vertically; textAlignVertical: 'top'
 *   editable      bool     (default true)
 *   style         object   — extra wrapper styles
 *   inputStyle    object   — extra TextInput styles
 *   [rest]                 — any other TextInput prop
 */
const CustomTextField = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureText = false,
  multiline = false,
  editable = true,
  style,
  inputStyle,
  ...rest
}) => {
  const [hidden, setHidden] = useState(secureText);
  const isRTL = I18nManager.isRTL;

  return (
    <View style={[styles.wrapper, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View
        style={[
          styles.inputRow,
          error   && styles.inputRowError,
          !editable && styles.inputRowDisabled,
        ]}
      >
        <TextInput
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            { textAlign: isRTL ? 'right' : 'left' },
            inputStyle,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.gray}
          secureTextEntry={hidden}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          editable={editable}
          writingDirection={isRTL ? 'rtl' : 'ltr'}
          {...rest}
        />

        {secureText && (
          <TouchableOpacity
            onPress={() => setHidden(h => !h)}
            style={styles.eyeButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={hidden ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.gray}
            />
          </TouchableOpacity>
        )}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },

  label: {
    fontSize: typography.sizes.sm,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.xs,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  inputRowError: {
    borderColor: colors.error,
  },
  inputRowDisabled: {
    backgroundColor: colors.backgroundLight,
    opacity: 0.7,
  },

  input: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  inputMultiline: {
    minHeight: 100,
    paddingTop: spacing.sm,
  },

  eyeButton: {
    marginStart: spacing.sm,
  },

  error: {
    fontSize: typography.sizes.xs,
    color: colors.error,
    marginTop: spacing.xs,
  },
});

export default CustomTextField;
