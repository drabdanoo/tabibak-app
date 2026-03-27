/**
 * LabResultModal — Chat-style bottom sheet
 *
 * Shows the doctor's lab order as a left bubble.
 * If results already sent, shows patient's response as a right bubble.
 * Input area lets patient add a note + attach an image and send results.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import ImageViewing from 'react-native-image-viewing';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import storageService from '../../services/storageService';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../config/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(ts) {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function LabResultModal({ visible, order, onClose, doctorView = false }) {
  const { user } = useAuth();
  const [note,         setNote]         = useState('');
  const [pickedImage,  setPickedImage]  = useState(null);
  const [sending,      setSending]      = useState(false);
  const [viewingImage, setViewingImage] = useState(null);
  const scrollRef = useRef(null);

  if (!order) return null;

  const alreadySent = !!order.patientNote || !!order.resultImageURL;

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handlePickImage() {
    const result = await storageService.openGallery({ allowsEditing: false });
    if (result.success) setPickedImage(result.uri);
  }

  async function handleSend() {
    if (!note.trim() && !pickedImage) {
      Alert.alert('Empty', 'Please add a note or attach an image before sending.');
      return;
    }
    setSending(true);
    try {
      let resultImageURL = null;

      if (pickedImage) {
        const uploadResult = await storageService.uploadFile(
          pickedImage,
          `labResults/${user.uid}/${order.id}_${Date.now()}.jpg`,
        );
        if (uploadResult.success) {
          resultImageURL = uploadResult.downloadURL;
        } else {
          throw new Error(uploadResult.error || 'Image upload failed');
        }
      }

      await updateDoc(doc(db, 'labOrders', order.id), {
        patientNote:    note.trim() || null,
        resultImageURL: resultImageURL,
        resultSentAt:   serverTimestamp(),
        status:         'results_submitted',
      });

      setNote('');
      setPickedImage(null);
      onClose();
    } catch (err) {
      console.error('[LabResultModal] send:', err);
      Alert.alert('Error', 'Failed to send results. Please try again.');
    } finally {
      setSending(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <ImageViewing
        images={viewingImage ? [{ uri: viewingImage }] : []}
        imageIndex={0}
        visible={!!viewingImage}
        onRequestClose={() => setViewingImage(null)}
        swipeToCloseEnabled
        doubleTapToZoomEnabled
      />

    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={S.overlay}>
        <View style={S.sheet}>

          {/* ── Header ── */}
          <View style={S.header}>
            <View style={S.headerLeft}>
              <Ionicons name="flask" size={20} color={Colors.primary} />
              <Text style={S.headerTitle}>Lab Results</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={80}
          >
            {/* ── Chat area ── */}
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={S.chatArea}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >

              {/* Doctor's order bubble — LEFT */}
              <View style={S.bubbleRowLeft}>
                <View style={S.doctorAvatar}>
                  <Ionicons name="medkit-outline" size={16} color={Colors.primary} />
                </View>
                <View style={[S.bubble, S.bubbleLeft]}>
                  <Text style={S.bubbleSender}>
                    Dr. {order.doctorName || 'Doctor'}
                  </Text>
                  {order.diagnosis ? (
                    <Text style={S.bubbleDiag}>
                      Diagnosis: {order.diagnosis}
                    </Text>
                  ) : null}
                  <Text style={S.bubbleLabel}>Tests ordered:</Text>
                  <View style={S.testsWrap}>
                    {(order.tests ?? []).map((t, i) => (
                      <View key={i} style={S.testChip}>
                        <Text style={S.testChipText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={S.bubbleTime}>{formatDate(order.createdAt)}</Text>
                </View>
              </View>

              {/* Patient's result bubble — RIGHT (only if already sent) */}
              {alreadySent && (
                <View style={S.bubbleRowRight}>
                  <View style={[S.bubble, S.bubbleRight]}>
                    <Text style={S.bubbleSenderRight}>You</Text>
                    {order.patientNote ? (
                      <Text style={S.bubbleNoteRight}>{order.patientNote}</Text>
                    ) : null}
                    {order.resultImageURL ? (
                      <TouchableOpacity
                        onPress={() => setViewingImage(order.resultImageURL)}
                        activeOpacity={0.85}
                      >
                        <Image
                          source={{ uri: order.resultImageURL }}
                          style={S.resultImage}
                          resizeMode="cover"
                        />
                        <View style={S.imageZoomHint}>
                          <Ionicons name="expand-outline" size={14} color="#FFF" />
                          <Text style={S.imageZoomHintText}>Tap to expand</Text>
                        </View>
                      </TouchableOpacity>
                    ) : null}
                    <Text style={S.bubbleTimeRight}>{formatDate(order.resultSentAt)}</Text>
                  </View>
                  <View style={S.patientAvatar}>
                    <Ionicons name="person-outline" size={16} color={Colors.white} />
                  </View>
                </View>
              )}

              {/* Sent confirmation */}
              {alreadySent && (
                <View style={S.sentNotice}>
                  <Ionicons name="checkmark-done" size={14} color="#22C55E" />
                  <Text style={S.sentNoticeText}>Results sent to doctor</Text>
                </View>
              )}

            </ScrollView>

            {/* Doctor view: waiting notice when no results yet */}
            {doctorView && !alreadySent && (
              <View style={S.doctorNotice}>
                <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
                <Text style={S.doctorNoticeText}>Patient has not sent results yet</Text>
              </View>
            )}

            {/* ── Input area — hidden once results are sent or in doctor view ── */}
            {!alreadySent && !doctorView && (
              <View style={S.inputArea}>

                {/* Image preview */}
                {pickedImage && (
                  <View style={S.imagePreviewWrap}>
                    <Image
                      source={{ uri: pickedImage }}
                      style={S.imagePreview}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      style={S.removeImageBtn}
                      onPress={() => setPickedImage(null)}
                    >
                      <Ionicons name="close-circle" size={22} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                )}

                <View style={S.inputRow}>
                  {/* Attach image */}
                  <TouchableOpacity style={S.attachBtn} onPress={handlePickImage}>
                    <Ionicons name="image-outline" size={22} color={Colors.primary} />
                  </TouchableOpacity>

                  {/* Note input */}
                  <TextInput
                    style={S.input}
                    placeholder="Add a note about your results…"
                    placeholderTextColor={Colors.textSecondary}
                    value={note}
                    onChangeText={setNote}
                    multiline
                    maxLength={500}
                  />

                  {/* Send button */}
                  <TouchableOpacity
                    style={[
                      S.sendBtn,
                      (!note.trim() && !pickedImage) && S.sendBtnDisabled,
                    ]}
                    onPress={handleSend}
                    disabled={sending || (!note.trim() && !pickedImage)}
                  >
                    {sending
                      ? <ActivityIndicator size="small" color={Colors.white} />
                      : <Ionicons name="send" size={18} color={Colors.white} />
                    }
                  </TouchableOpacity>
                </View>

              </View>
            )}
          </KeyboardAvoidingView>

        </View>
      </View>
    </Modal>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
    overflow: 'hidden',
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
  },

  // ── Chat ──
  chatArea: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },

  // Left bubble (doctor)
  bubbleRowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.xs,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  doctorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleLeft: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },

  // Right bubble (patient)
  bubbleRowRight: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.xs,
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  patientAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleRight: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    borderBottomRightRadius: 4,
  },

  // Shared bubble
  bubble: {
    padding: Spacing.sm,
    gap: 4,
    flex: 1,
  },
  bubbleSender: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 2,
  },
  bubbleSenderRight: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.white + 'CC',
    marginBottom: 2,
  },
  bubbleDiag: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  bubbleLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 4,
  },
  bubbleTime: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'right',
  },
  bubbleNoteRight: {
    fontSize: FontSizes.sm,
    color: Colors.white,
    lineHeight: 20,
  },
  bubbleTimeRight: {
    fontSize: 10,
    color: Colors.white + 'AA',
    marginTop: 4,
    textAlign: 'right',
  },

  // Tests
  testsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 4,
  },
  testChip: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  testChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Result image
  resultImage: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginTop: 6,
  },
  imageZoomHint: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  imageZoomHintText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '600',
  },

  // Sent notice
  sentNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: Spacing.xs,
  },
  sentNoticeText: {
    fontSize: FontSizes.xs,
    color: '#22C55E',
    fontWeight: '600',
  },

  // ── Doctor view notice ──
  doctorNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: Spacing.md,
    backgroundColor: Colors.border + '60',
    borderRadius: BorderRadius.md,
    margin: Spacing.md,
  },
  doctorNoticeText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },

  // ── Input area ──
  inputArea: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  imagePreviewWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    fontSize: FontSizes.sm,
    color: Colors.text,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.border,
  },
});
