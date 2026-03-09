/**
 * MedicalDocumentsScreen.js — Patient Medical Documents (Phase 3/4)
 *
 * ╔══ ARCHITECTURE NOTES ═══════════════════════════════════════════════════════╗
 *
 * 1. DATA — real-time onSnapshot on DOCUMENTS collection
 * ───────────────────────────────────────────────────────
 *   Query: documents where patientId == user.uid, orderBy uploadedAt desc.
 *   Document model: { patientId, title, category, description,
 *                     fileUrl, storagePath, fileType, uploadedAt, uploadedBy }
 *
 * 2. UPLOAD FLOW — expo-image-picker → upload modal → storageService
 * ─────────────────────────────────────────────────────────────────────
 *   a) User taps FAB → ImagePicker opens (camera or gallery)
 *   b) Upload details modal: title + category input
 *   c) storageService.uploadPatientDocument() handles Firebase Storage + Firestore
 *   d) onSnapshot auto-updates the list — no manual state refresh needed
 *
 * 3. DELETE — long-press → Alert → storageService.deletePatientDocument()
 * ──────────────────────────────────────────────────────────────────────
 *   Deletes from Firebase Storage first, then Firestore.
 *
 * 4. VIEW — Linking.openURL(fileUrl) opens the file in the system browser/viewer
 *
 * 5. RTL COMPLIANCE
 *   marginStart / marginEnd → never marginLeft / marginRight
 *   end: 24               → never right: 24  (FAB position)
 *   borderStartWidth      → never borderLeftWidth
 *
 * ╚═════════════════════════════════════════════════════════════════════════════╝
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { useAuth }       from '../../contexts/AuthContext';
import { COLLECTIONS }   from '../../config/firebase';
import storageService    from '../../services/storageService';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSizes,
} from '../../config/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'all',         label: 'الكل',        icon: 'layers-outline'          },
  { id: 'lab',         label: 'مختبر',       icon: 'flask-outline'           },
  { id: 'imaging',     label: 'أشعة',        icon: 'scan-outline'            },
  { id: 'prescription',label: 'روشتة',       icon: 'document-text-outline'   },
  { id: 'report',      label: 'تقرير',       icon: 'clipboard-outline'       },
  { id: 'general',     label: 'عام',         icon: 'folder-outline'          },
];

const CATEGORY_CONFIG = {
  lab:          { color: '#3b82f6', bg: '#dbeafe', icon: 'flask-outline'         },
  imaging:      { color: '#8b5cf6', bg: '#ede9fe', icon: 'scan-outline'          },
  prescription: { color: Colors.primary, bg: '#d1fae5', icon: 'document-text-outline' },
  report:       { color: '#f59e0b', bg: '#fef3c7', icon: 'clipboard-outline'     },
  general:      { color: Colors.gray, bg: Colors.border, icon: 'folder-outline'  },
};

const FILE_TYPE_ICON = {
  pdf:  'document-outline',
  jpg:  'image-outline',
  jpeg: 'image-outline',
  png:  'image-outline',
  heic: 'image-outline',
  heif: 'image-outline',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDocDate(doc) {
  const raw = doc.uploadedAt;
  if (!raw) return '—';
  try {
    const d = raw?.toDate?.() ?? new Date(raw);
    return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return '—'; }
}

function getCategoryConfig(category) {
  return CATEGORY_CONFIG[category?.toLowerCase()] ?? CATEGORY_CONFIG.general;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const CategoryTab = memo(({ cat, isActive, count, onPress }) => (
  <TouchableOpacity
    style={[styles.catTab, isActive && styles.catTabActive]}
    onPress={() => onPress(cat.id)}
    activeOpacity={0.75}
  >
    <Ionicons name={cat.icon} size={14} color={isActive ? Colors.white : Colors.textSecondary} />
    <Text style={[styles.catTabText, isActive && styles.catTabTextActive]}>{cat.label}</Text>
    {count > 0 && (
      <View style={[styles.catBubble, isActive && styles.catBubbleActive]}>
        <Text style={[styles.catBubbleText, isActive && styles.catBubbleTextActive]}>{count}</Text>
      </View>
    )}
  </TouchableOpacity>
));

const DocumentCard = memo(({ doc, onOpen, onDelete }) => {
  const cfg      = getCategoryConfig(doc.category);
  const ext      = (doc.fileType ?? 'general').toLowerCase();
  const fileIcon = FILE_TYPE_ICON[ext] ?? 'document-outline';
  const dateStr  = formatDocDate(doc);

  return (
    <TouchableOpacity
      style={styles.docCard}
      onPress={() => onOpen(doc)}
      onLongPress={() => onDelete(doc)}
      activeOpacity={0.85}
    >
      {/* File type icon */}
      <View style={[styles.docIcon, { backgroundColor: cfg.bg }]}>
        <Ionicons name={fileIcon} size={26} color={cfg.color} />
      </View>

      {/* Info */}
      <View style={styles.docInfo}>
        <Text style={styles.docTitle} numberOfLines={1}>{doc.title || 'وثيقة بلا عنوان'}</Text>
        {doc.description ? (
          <Text style={styles.docDesc} numberOfLines={1}>{doc.description}</Text>
        ) : null}
        <View style={styles.docMeta}>
          <View style={[styles.catPill, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.catPillText, { color: cfg.color }]}>
              {CATEGORIES.find((c) => c.id === doc.category?.toLowerCase())?.label ?? doc.category ?? 'عام'}
            </Text>
          </View>
          <Text style={styles.docDate}>{dateStr}</Text>
        </View>
      </View>

      {/* Chevron */}
      <Ionicons name="open-outline" size={18} color={Colors.gray} />
    </TouchableOpacity>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MedicalDocumentsScreen
// ─────────────────────────────────────────────────────────────────────────────

const MedicalDocumentsScreen = () => {
  const { user } = useAuth();

  // ── State ─────────────────────────────────────────────────────────────────
  const [documents, setDocuments]           = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [isLoading, setIsLoading]           = useState(true);
  const [error, setError]                   = useState(null);

  // Upload modal
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [pendingFileUri, setPendingFileUri]         = useState(null);
  const [uploadTitle, setUploadTitle]               = useState('');
  const [uploadCategory, setUploadCategory]         = useState('general');
  const [uploadDesc, setUploadDesc]                 = useState('');
  const [isUploading, setIsUploading]               = useState(false);

  // Delete
  const [isDeletingId, setIsDeletingId] = useState(null);

  const isMountedRef = useRef(true);
  const db           = useRef(getFirestore()).current;

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ── Real-time listener ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) { setIsLoading(false); return; }

    const q = query(
      collection(db, COLLECTIONS.DOCUMENTS),
      where('patientId', '==', user.uid),
      orderBy('uploadedAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!isMountedRef.current) return;
        setDocuments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[MedicalDocuments] snapshot error:', err);
        if (!isMountedRef.current) return;
        setError('تعذّر تحميل الوثائق');
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, [user?.uid, db]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const filteredDocs = useMemo(() => {
    if (activeCategory === 'all') return documents;
    return documents.filter((d) => d.category?.toLowerCase() === activeCategory);
  }, [documents, activeCategory]);

  const catCounts = useMemo(() => {
    const counts = { all: documents.length };
    for (const d of documents) {
      const cat = d.category?.toLowerCase() ?? 'general';
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  }, [documents]);

  // ── Open document ─────────────────────────────────────────────────────────
  const handleOpen = useCallback(async (doc) => {
    if (!doc.fileUrl) {
      Alert.alert('خطأ', 'رابط الملف غير متاح.');
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(doc.fileUrl);
      if (canOpen) {
        await Linking.openURL(doc.fileUrl);
      } else {
        Alert.alert('تعذّر الفتح', 'لا يمكن فتح هذا الملف على هذا الجهاز.');
      }
    } catch (err) {
      Alert.alert('خطأ', 'حدث خطأ أثناء فتح الملف.');
    }
  }, []);

  // ── Delete document ───────────────────────────────────────────────────────
  const handleDeletePress = useCallback((doc) => {
    Alert.alert(
      'حذف الوثيقة',
      `هل تريد حذف "${doc.title || 'هذه الوثيقة'}"؟ هذا الإجراء لا يمكن التراجع عنه.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text:  'حذف',
          style: 'destructive',
          onPress: async () => {
            setIsDeletingId(doc.id);
            try {
              const success = await storageService.deletePatientDocument(doc.id, doc.storagePath);
              if (!success) Alert.alert('خطأ', 'تعذّر حذف الوثيقة. حاول مرة أخرى.');
            } catch {
              Alert.alert('خطأ', 'تعذّر حذف الوثيقة.');
            } finally {
              if (isMountedRef.current) setIsDeletingId(null);
            }
          },
        },
      ],
    );
  }, []);

  // ── Upload flow ───────────────────────────────────────────────────────────
  const handleFABPress = useCallback(() => {
    Alert.alert(
      'إضافة وثيقة',
      'اختر مصدر الصورة',
      [
        {
          text: 'الكاميرا',
          onPress: async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) { Alert.alert('إذن مرفوض', 'يجب السماح بالوصول للكاميرا.'); return; }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.85,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              setPendingFileUri(result.assets[0].uri);
              setUploadTitle('');
              setUploadCategory('general');
              setUploadDesc('');
              setUploadModalVisible(true);
            }
          },
        },
        {
          text: 'المعرض',
          onPress: async () => {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) { Alert.alert('إذن مرفوض', 'يجب السماح بالوصول للصور.'); return; }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.85,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              setPendingFileUri(result.assets[0].uri);
              setUploadTitle('');
              setUploadCategory('general');
              setUploadDesc('');
              setUploadModalVisible(true);
            }
          },
        },
        { text: 'إلغاء', style: 'cancel' },
      ],
    );
  }, []);

  const handleUploadConfirm = useCallback(async () => {
    if (!uploadTitle.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال عنوان للوثيقة.');
      return;
    }
    if (!pendingFileUri || !user?.uid) return;

    setIsUploading(true);
    try {
      const result = await storageService.uploadPatientDocument(
        user.uid,
        pendingFileUri,
        {
          title:       uploadTitle.trim(),
          category:    uploadCategory,
          description: uploadDesc.trim(),
          uploadedBy:  user.uid,
        },
      );

      if (result.success) {
        setUploadModalVisible(false);
        setPendingFileUri(null);
      } else {
        Alert.alert('خطأ في الرفع', result.error ?? 'تعذّر رفع الوثيقة. حاول مرة أخرى.');
      }
    } catch (err) {
      Alert.alert('خطأ', 'حدث خطأ أثناء رفع الوثيقة.');
    } finally {
      if (isMountedRef.current) setIsUploading(false);
    }
  }, [pendingFileUri, uploadTitle, uploadCategory, uploadDesc, user?.uid]);

  const handleCategoryPress = useCallback((id) => setActiveCategory(id), []);
  const keyExtractor         = useCallback((item) => item.id, []);

  const renderItem = useCallback(({ item }) => (
    <DocumentCard
      doc={item}
      onOpen={handleOpen}
      onDelete={handleDeletePress}
    />
  ), [handleOpen, handleDeletePress]);

  const renderCatTab = useCallback(({ item: cat }) => (
    <CategoryTab
      cat={cat}
      isActive={activeCategory === cat.id}
      count={catCounts[cat.id] ?? 0}
      onPress={handleCategoryPress}
    />
  ), [activeCategory, catCounts, handleCategoryPress]);

  const ListEmpty = useMemo(() => {
    if (isLoading) return null;
    return (
      <View style={styles.centeredState}>
        <Ionicons name="document-text-outline" size={64} color={Colors.border} />
        <Text style={styles.emptyTitle}>لا توجد وثائق</Text>
        <Text style={styles.emptySubtitle}>
          {activeCategory !== 'all'
            ? 'لا توجد وثائق في هذه الفئة'
            : 'اضغط على + لإضافة وثيقتك الطبية الأولى'}
        </Text>
      </View>
    );
  }, [isLoading, activeCategory]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* ══ Header ══ */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>وثائقي الطبية</Text>
        <Text style={styles.headerSub}>{documents.length} وثيقة</Text>
      </View>

      {/* ══ Category tabs ══ */}
      <View style={styles.catRail}>
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(c) => c.id}
          renderItem={renderCatTab}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRailContent}
        />
      </View>

      {/* ══ Content ══ */}
      {isLoading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      ) : error ? (
        <View style={styles.centeredState}>
          <Ionicons name="cloud-offline-outline" size={44} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredDocs}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListEmptyComponent={ListEmpty}
          contentContainerStyle={[
            styles.listContent,
            filteredDocs.length === 0 && styles.listContentGrow,
          ]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}

      {/* ══ FAB — end: 24 is the RTL-safe logical property ══ */}
      <TouchableOpacity style={styles.fab} onPress={handleFABPress} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color={Colors.white} />
      </TouchableOpacity>

      {/* ══ Upload Modal ══ */}
      <Modal
        visible={uploadModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { if (!isUploading) setUploadModalVisible(false); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.uploadOverlay}
        >
          <View style={styles.uploadSheet}>
            {/* Handle */}
            <View style={styles.uploadHandle} />

            <Text style={styles.uploadSheetTitle}>تفاصيل الوثيقة</Text>

            {/* Title */}
            <View style={styles.uploadField}>
              <Text style={styles.uploadFieldLabel}>عنوان الوثيقة *</Text>
              <TextInput
                style={styles.uploadInput}
                placeholder="مثال: نتيجة تحليل الدم"
                placeholderTextColor={Colors.gray}
                value={uploadTitle}
                onChangeText={setUploadTitle}
                textAlign="right"
              />
            </View>

            {/* Category */}
            <View style={styles.uploadField}>
              <Text style={styles.uploadFieldLabel}>الفئة</Text>
              <FlatList
                horizontal
                data={CATEGORIES.filter((c) => c.id !== 'all')}
                keyExtractor={(c) => c.id}
                renderItem={({ item: cat }) => (
                  <TouchableOpacity
                    style={[styles.catPicker, uploadCategory === cat.id && styles.catPickerActive]}
                    onPress={() => setUploadCategory(cat.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.catPickerText, uploadCategory === cat.id && styles.catPickerTextActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                )}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: Spacing.xs }}
              />
            </View>

            {/* Description */}
            <View style={styles.uploadField}>
              <Text style={styles.uploadFieldLabel}>وصف (اختياري)</Text>
              <TextInput
                style={[styles.uploadInput, { minHeight: 60, textAlignVertical: 'top' }]}
                placeholder="أضف وصفاً للوثيقة..."
                placeholderTextColor={Colors.gray}
                value={uploadDesc}
                onChangeText={setUploadDesc}
                multiline
                textAlign="right"
              />
            </View>

            {/* Buttons */}
            <View style={styles.uploadBtns}>
              <TouchableOpacity
                style={[styles.uploadBtn, styles.uploadBtnCancel]}
                onPress={() => setUploadModalVisible(false)}
                disabled={isUploading}
              >
                <Text style={styles.uploadBtnCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.uploadBtn, styles.uploadBtnConfirm]}
                onPress={handleUploadConfirm}
                disabled={isUploading}
              >
                {isUploading
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={16} color={Colors.white} />
                      <Text style={styles.uploadBtnConfirmText}>رفع الوثيقة</Text>
                    </>
                  )
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
//
// RTL compliance:
//   ✓ No marginLeft / marginRight
//   ✓ No paddingLeft / paddingRight
//   ✓ No borderLeftWidth
//   ✓ FAB uses end: 24 (not right: 24)
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  screen: { flex: 1, backgroundColor: Colors.background },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    backgroundColor:  Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical:  Spacing.md,
    gap:              2,
  },
  headerTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.white },
  headerSub:   { fontSize: FontSizes.sm, color: 'rgba(255,255,255,0.8)' },

  // ── Category rail ────────────────────────────────────────────────────────
  catRail: {
    backgroundColor:  Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  catRailContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical:  Spacing.sm,
    gap:              Spacing.xs,
  },
  catTab: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical:  6,
    borderRadius:     BorderRadius.full,
    borderWidth:      1,
    borderColor:      Colors.border,
    gap:              4,
  },
  catTabActive:       { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catTabText:         { fontSize: FontSizes.xs, color: Colors.textSecondary, fontWeight: '500' },
  catTabTextActive:   { color: Colors.white, fontWeight: '700' },
  catBubble: {
    backgroundColor:  Colors.border,
    borderRadius:     BorderRadius.full,
    minWidth:         16,
    height:           16,
    alignItems:       'center',
    justifyContent:   'center',
    paddingHorizontal: 3,
  },
  catBubbleActive:     { backgroundColor: 'rgba(255,255,255,0.3)' },
  catBubbleText:       { fontSize: 9, color: Colors.textSecondary, fontWeight: '700' },
  catBubbleTextActive: { color: Colors.white },

  // ── List ─────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingTop:        Spacing.sm,
    paddingBottom:     100, // room for FAB
  },
  listContentGrow: { flexGrow: 1 },
  sep:             { height: Spacing.xs },

  // ── Document card ─────────────────────────────────────────────────────────
  docCard: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  Colors.white,
    borderRadius:     BorderRadius.lg,
    padding:          Spacing.md,
    gap:              Spacing.sm,
    elevation:        1,
    shadowColor:      Colors.black,
    shadowOffset:     { width: 0, height: 1 },
    shadowOpacity:    0.06,
    shadowRadius:     2,
  },
  docIcon: {
    width:          56,
    height:         56,
    borderRadius:   BorderRadius.lg,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  docInfo: { flex: 1, gap: 4 },
  docTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text },
  docDesc:  { fontSize: FontSizes.xs, color: Colors.textSecondary },
  docMeta:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  catPill: {
    borderRadius:     BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical:  2,
  },
  catPillText: { fontSize: 10, fontWeight: '600' },
  docDate:     { fontSize: FontSizes.xs, color: Colors.gray },

  // ── FAB — end: 24 is the RTL-safe logical property (not right: 24) ────────
  fab: {
    position:        'absolute',
    bottom:          24,
    end:             24,                 // ← logical end, RTL-safe
    width:           56,
    height:          56,
    borderRadius:    BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
    elevation:       8,
    shadowColor:     Colors.primaryDark,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.35,
    shadowRadius:    6,
  },

  // ── Upload modal ──────────────────────────────────────────────────────────
  uploadOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent:  'flex-end',
  },
  uploadSheet: {
    backgroundColor:      Colors.white,
    borderTopStartRadius: BorderRadius.xl,
    borderTopEndRadius:   BorderRadius.xl,
    padding:              Spacing.lg,
    gap:                  Spacing.md,
    paddingBottom:        Spacing.xxl,
  },
  uploadHandle: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: Colors.border,
    alignSelf:       'center',
  },
  uploadSheetTitle: {
    fontSize:   FontSizes.lg,
    fontWeight: '700',
    color:      Colors.text,
    textAlign:  'center',
  },
  uploadField:      { gap: 6 },
  uploadFieldLabel: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text, textAlign: 'right' },
  uploadInput: {
    borderWidth:      1,
    borderColor:      Colors.border,
    borderRadius:     BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical:  Platform.OS === 'ios' ? 10 : 6,
    fontSize:         FontSizes.sm,
    color:            Colors.text,
  },
  catPicker: {
    paddingHorizontal: Spacing.sm,
    paddingVertical:  6,
    borderRadius:     BorderRadius.full,
    borderWidth:      1,
    borderColor:      Colors.border,
  },
  catPickerActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catPickerText:       { fontSize: FontSizes.xs, color: Colors.textSecondary, fontWeight: '500' },
  catPickerTextActive: { color: Colors.white, fontWeight: '700' },
  uploadBtns: { flexDirection: 'row', gap: Spacing.sm },
  uploadBtn: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   BorderRadius.md,
    paddingVertical: Spacing.sm,
    minHeight:      44,
    gap:            6,
  },
  uploadBtnCancel:       { backgroundColor: Colors.border },
  uploadBtnCancelText:   { color: Colors.text, fontWeight: '700', fontSize: FontSizes.sm },
  uploadBtnConfirm:      { backgroundColor: Colors.primary },
  uploadBtnConfirmText:  { color: Colors.white, fontWeight: '700', fontSize: FontSizes.sm },

  // ── Shared states ─────────────────────────────────────────────────────────
  centeredState: {
    flex:             1,
    alignItems:       'center',
    justifyContent:   'center',
    gap:              Spacing.md,
    paddingHorizontal: Spacing.xl,
    minHeight:        200,
  },
  loadingText:   { color: Colors.textSecondary, fontSize: FontSizes.sm },
  errorText:     { color: Colors.error, fontSize: FontSizes.md, textAlign: 'center' },
  emptyTitle:    { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },
  emptySubtitle: { fontSize: FontSizes.sm, color: Colors.textSecondary, textAlign: 'center' },
});

export default MedicalDocumentsScreen;
