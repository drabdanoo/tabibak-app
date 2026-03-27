import React from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../../config/theme';

/**
 * ScreenContainer
 *
 * Wraps screen content with:
 *   - SafeAreaView (respects notch / home indicator)
 *   - Optional ScrollView
 *   - KeyboardAvoidingView on iOS
 *   - Consistent background and horizontal padding
 *
 * Props:
 *   children      ReactNode
 *   scrollable    bool     — wrap in ScrollView (default false)
 *   padded        bool     — apply horizontal padding (default true)
 *   style         object   — extra inner-container styles
 *   edges         array    — SafeAreaView edges (default ['top','bottom'])
 */
const ScreenContainer = ({
  children,
  scrollable = false,
  padded = true,
  style,
  edges = ['top', 'bottom'],
}) => {
  // For a plain View, flex:1 fills the available space (correct).
  // For a ScrollView, flex:1 on contentContainerStyle caps the content to the
  // viewport height and prevents scrolling — use flexGrow:1 instead so the
  // content can expand beyond the screen while still filling it when short.
  const viewStyle       = [styles.inner,       padded && styles.padded, style];
  const scrollableStyle = [styles.scrollable,   padded && styles.padded, style];

  const content = scrollable ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={scrollableStyle}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={viewStyle}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  kav: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  inner: {
    flex: 1,
  },
  // Used as contentContainerStyle on ScrollView — flexGrow instead of flex
  // so the content can scroll past the viewport when tall enough.
  scrollable: {
    flexGrow: 1,
  },
  padded: {
    paddingHorizontal: spacing.md,
  },
});

export default ScreenContainer;
