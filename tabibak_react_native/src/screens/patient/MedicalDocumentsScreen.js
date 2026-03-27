/**
 * MedicalDocumentsScreen.js — Patient Medical Documents Vault (Phase 4 + Consent Privacy Model)
 *
 * ╔══ ARCHITECTURE ════════════════════════════════════════════════════════════╗
 *
 * VIEWER FLOW
 * ────────────
 *   Tap card → DocumentViewerModal (full-screen, no external browser)
 *     → Image with resizeMode="contain" for image/* files
 *     → PDF placeholder + "Open in browser" fallback for application/pdf
 *
 * UPLOAD FLOW  (zero Alert.alert)
 * ──────────────────────────────
 *   FAB → uploadModal ('source' step) → 'details' step
 *   → storageService.uploadDocument() dual-write
 *   New documents are created with authorizedDoctors: [] by default.
 *
 * MANAGE ACCESS FLOW  (Consent-Based Privacy Model)
 * ──────────────────────────────────────────────────
 *   Key icon on card → ManageAccessModal (bottom sheet)
 *   → Patient's doctors fetched from their appointment history
 *   → Switch per doctor — ON means authorized, OFF means revoked
 *   → storageService.grantDoctorAccess(docId, doctorId) on toggle ON
 *   → storageService.revokeDoctorAccess(docId, doctorId) on toggle OFF
 *   → Firestore real-time listener propagates updated authorizedDoctors back
 *     through subscribePatientDocuments, so the switch reflects live state.
 *
 * DELETE FLOW  (zero Alert.alert)
 * ────────────────────────────────
 *   Long-press card → DeleteModal → storageService.deletePatientDocument()
 *
 * CONTRACTS
 *   ✅ ScreenContainer scrollable=false padded=false edges=['bottom']
 *   ✅ RTL logical properties throughout
 *   ✅ All strings via t()
 *   ✅ theme.js only for colors / spacing / typography / BorderRadius
 *   ✅ Zero Firebase imports — all via service layer
 *   ✅ Zero Alert.alert
 *
 * ╚════════════════════════════════════════════════════════════════════════════╝
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
  Image,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Switch,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import * as ImagePicker      from 'expo-image-picker';
import { useTranslation }    from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ScreenContainer  from '../../components/ui/ScreenContainer';
import storageService   from '../../services/storageService';
import firestoreService from '../../services/firestoreService';
import { useAuth }      from '../../contexts/AuthContext';
import {
  colors,
  spacing,
  typography,
  BorderRadius,
  shadows,
} from '../../config/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'all',          icon: 'layers-outline'       },
  { id: 'lab',          icon: 'flask-outline'         },
  { id: 'imaging',      icon: 'scan-outline'          },
  { id: 'prescription', icon: 'document-text-outline' },
  { id: 'report',       icon: 'clipboard-outline'     },
  { id: 'general',      icon: 'folder-outline'        },
];

const CATEGORY_CFG = {
  lab:          { color: '#3b82f6', bg: '#dbeafe', icon: 'flask-outline'          },
  imaging:      { color: '#8b5cf6', bg: '#ede9fe', icon: 'scan-outline'           },
  prescription: { color: colors.primary, bg: '#d1fae5', icon: 'document-text-outline' },
  report:       { color: '#f59e0b', bg: '#fef3c7', icon: 'clipboard-outline'      },
  general:      { color: colors.gray,    bg: colors.borderLight, icon: 'folder-outline' },
};

const FILE_ICON = {
  pdf:  'document-outline',
  jpg:  'image-outline',
  jpeg: 'image-outline',
  png:  'image-outline',
  heic: 'image-outline',
  heif: 'image-outline',
};

const CAT_LABEL_KEY = {
  all:          'documents.catAll',
  lab:          'documents.catLab',
  imaging:      'documents.catImaging',
  prescription: 'documents.catPrescription',
  report:       'documents.catReport',
  general:      'documents.catGeneral',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const getCategoryCfg = (cat) =>
  CATEGORY_CFG[(cat ?? '').toLowerCase()] ?? CATEGORY_CFG.general;

const getFileIcon = (mimeType = '', fileName = '') => {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (mimeType.startsWith('image/')) return 'image-outline';
  if (mimeType === 'application/pdf') return 'document-outline';
  return FILE_ICON[ext] ?? 'document-outline';
};

const formatDocDate = (doc) => {
  const raw = doc.createdAt ?? doc.uploadedAt;
  if (!raw) return '—';
  try {
    const d = raw?.toDate?.() ?? new Date(raw);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return '—'; }
};

const resolveFileName = (asset) => {
  if (asset.fileName) return asset.fileName;
  return asset.uri.split('/').pop() ?? `doc_${Date.now()}.jpg`;
};

const MIME_MAP = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf',
};

const resolveMimeType = (asset) => {
  if (asset.mimeType) return asset.mimeType;
  const ext = (asset.uri.split('.').pop() ?? '').toLowerCase();
  return MIME_MAP[ext] ?? 'image/jpeg';
};

const isImageMime = (mimeType = '') => mimeType.startsWith('image/');

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const CategoryTab = memo(({ id, icon, isActive, count, onPress, label }) => (
  <TouchableOpacity
    style={[styles.catTab, isActive && styles.catTabActive]}
    onPress={() => onPress(id)}
    activeOpacity={0.75}
  >
    <Ionicons name={icon} size={13} color={isActive ? colors.white : colors.textSecondary} />
    <Text style={[styles.catTabText, isActive && styles.catTabTextActive]}>{label}</Text>
    {count > 0 && (
      <View style={[styles.catBubble, isActive && styles.catBubbleActive]}>
        <Text style={[styles.catBubbleText, isActive && styles.catBubbleTextActive]}>{count}</Text>
      </View>
    )}
  </TouchableOpacity>
));

/**
 * DocumentCard
 *
 * Shows a key-lock icon to open the Manage Access sheet.
 * A green dot badge on the key icon indicates at least one doctor has been granted access.
 */
const DocumentCard = memo(({ doc, onOpen, onManageAccess, onLongPress }) => {
  const cfg         = getCategoryCfg(doc.category);
  const fileIcon    = getFileIcon(doc.mimeType, doc.fileName ?? '');
  const hasAccess   = Array.isArray(doc.authorizedDoctors) && doc.authorizedDoctors.length > 0;

  return (
    <TouchableOpacity
      style={styles.docCard}
      onPress={() => onOpen(doc)}
      onLongPress={() => onLongPress(doc)}
      activeOpacity={0.82}
      delayLongPress={450}
    >
      <View style={[styles.docIconBadge, { backgroundColor: cfg.bg }]}>
        <Ionicons name={fileIcon} size={22} color={cfg.color} />
      </View>

      <View style={styles.docInfo}>
        <Text style={styles.docTitle} numberOfLines={1}>
          {doc.title ?? doc.fileName ?? '—'}
        </Text>
        <Text style={styles.docMeta} numberOfLines={1}>
          {formatDocDate(doc)}{doc.category ? `  ·  ${doc.category}` : ''}
        </Text>
      </View>

      {/* Manage-access key icon — green dot when at least one doctor has access */}
      <TouchableOpacity
        style={styles.accessIconBtn}
        onPress={() => onManageAccess(doc)}
        hitSlop={{ top: 8, bottom: 8, start: 8, end: 8 }}
      >
        <Ionicons name="key-outline" size={20} color={hasAccess ? colors.primary : colors.gray} />
        {hasAccess && <View style={styles.accessDot} />}
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

const ErrorBanner = memo(({ message }) => (
  <View style={styles.errorBanner}>
    <Ionicons name="alert-circle-outline" size={16} color={colors.error} style={{ marginEnd: 6 }} />
    <Text style={styles.errorBannerText}>{message}</Text>
  </View>
));

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function MedicalDocumentsScreen({ navigation }) {
  const { t }                 = useTranslation();
  const { user }              = useAuth();
  const insets                = useSafeAreaInsets();

  // ── Document list ─────────────────────────────────────────────────────────
  const [documents,      setDocuments]      = useState([]);
  const [isFetching,     setIsFetching]     = useState(true);
  const [fetchError,     setFetchError]     = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');

  // ── Viewer ────────────────────────────────────────────────────────────────
  const [viewerDoc, setViewerDoc] = useState(null);

  // ── Manage Access ─────────────────────────────────────────────────────────
  // accessDoc: the document whose access is being managed (id used as key)
  // accessDoctors: unique doctors derived from this patient's appointment history
  // togglingDoctorId: which doctor row is showing a spinner right now
  const [accessDoc,              setAccessDoc]              = useState(null);
  const [accessDoctors,          setAccessDoctors]          = useState([]);
  const [isLoadingAccessDoctors, setIsLoadingAccessDoctors] = useState(false);
  const [togglingDoctorId,       setTogglingDoctorId]       = useState(null);
  const [accessError,            setAccessError]            = useState(null);
  const [loadAccessDoctorsError, setLoadAccessDoctorsError] = useState(null);

  // ── Upload ────────────────────────────────────────────────────────────────
  const [uploadVisible,  setUploadVisible]  = useState(false);
  const [uploadStep,     setUploadStep]     = useState('source');
  const [pendingAsset,   setPendingAsset]   = useState(null);
  const [uploadTitle,    setUploadTitle]    = useState('');
  const [uploadCategory, setUploadCategory] = useState('general');
  const [uploadDesc,     setUploadDesc]     = useState('');
  const [isUploading,    setIsUploading]    = useState(false);
  const [uploadError,    setUploadError]    = useState(null);
  const [permError,      setPermError]      = useState(null);

  // ── Delete ────────────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting,   setIsDeleting]   = useState(false);
  const [deleteError,  setDeleteError]  = useState(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ── Real-time listener ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) { setIsFetching(false); return; }
    const unsub = storageService.subscribePatientDocuments(
      user.uid,
      (docs) => {
        if (!isMountedRef.current) return;
        setDocuments(docs);
        setIsFetching(false);
        setFetchError(null);
      },
      (err) => {
        console.error('[MedicalDocuments] snapshot error:', err);
        if (!isMountedRef.current) return;
        setFetchError(t('documents.loadError'));
        setIsFetching(false);
      },
    );
    return unsub;
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredDocs = useMemo(() => {
    if (activeCategory === 'all') return documents;
    return documents.filter((d) => (d.category ?? 'general').toLowerCase() === activeCategory);
  }, [documents, activeCategory]);

  const catCounts = useMemo(() => {
    const counts = { all: documents.length };
    for (const d of documents) {
      const cat = (d.category ?? 'general').toLowerCase();
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  }, [documents]);

  /**
   * The live version of the document currently open in the Manage Access sheet.
   * This picks up real-time authorizedDoctors updates as Firestore pushes them.
   */
  const liveAccessDoc = useMemo(
    () => (accessDoc ? documents.find((d) => d.id === accessDoc.id) ?? accessDoc : null),
    [accessDoc, documents],
  );

  // ── Viewer handlers ───────────────────────────────────────────────────────
  const handleOpenViewer  = useCallback((doc) => setViewerDoc(doc), []);
  const handleCloseViewer = useCallback(() => setViewerDoc(null), []);

  // ── Manage Access handlers ────────────────────────────────────────────────

  /**
   * Open the Manage Access sheet for a document.
   * Fetches unique doctors from this patient's appointment history.
   * Using appointments (not all-doctors query) so the list is contextually relevant.
   */
  const handleManageAccess = useCallback(async (doc) => {
    setAccessDoc(doc);
    setAccessError(null);
    setLoadAccessDoctorsError(null);
    setIsLoadingAccessDoctors(true);

    try {
      const result = await firestoreService.getAppointments(user?.uid ?? '', 'patient', {});
      if (!isMountedRef.current) return;

      if (!result.success) {
        setLoadAccessDoctorsError(t('documents.accessError'));
        return;
      }

      // Extract unique doctors from appointment history
      const seen = new Set();
      const uniqueDoctors = [];
      for (const appt of (result.appointments ?? [])) {
        if (appt.doctorId && !seen.has(appt.doctorId)) {
          seen.add(appt.doctorId);
          uniqueDoctors.push({
            id:        appt.doctorId,
            name:      appt.doctorName  ?? appt.doctorFullName ?? t('common.noResults'),
            specialty: appt.specialty   ?? '',
          });
        }
      }
      setAccessDoctors(uniqueDoctors);
    } catch (err) {
      console.error('[MedicalDocuments] load access doctors error:', err);
      if (isMountedRef.current) setLoadAccessDoctorsError(t('documents.accessError'));
    } finally {
      if (isMountedRef.current) setIsLoadingAccessDoctors(false);
    }
  }, [user?.uid, t]);

  /**
   * Toggle a doctor's access to the current document.
   * Reads the current authorizedDoctors state from the live Firestore snapshot
   * so the toggle is always accurate even if another device changed access.
   */
  const handleToggleDoctorAccess = useCallback(async (doctor) => {
    if (!accessDoc?.id || togglingDoctorId) return;

    // Derive current state from the live document snapshot
    const currentDoc = documents.find((d) => d.id === accessDoc.id);
    const isGranted  = currentDoc?.authorizedDoctors?.includes(doctor.id) ?? false;

    setTogglingDoctorId(doctor.id);
    setAccessError(null);

    try {
      const result = isGranted
        ? await storageService.revokeDoctorAccess(accessDoc.id, doctor.id)
        : await storageService.grantDoctorAccess(accessDoc.id, doctor.id);

      if (!result.success && isMountedRef.current) {
        setAccessError(t('documents.accessError'));
      }
    } catch {
      if (isMountedRef.current) setAccessError(t('documents.accessError'));
    } finally {
      if (isMountedRef.current) setTogglingDoctorId(null);
    }
  }, [accessDoc, documents, togglingDoctorId, t]);

  const handleCloseAccessModal = useCallback(() => {
    if (togglingDoctorId) return; // wait for in-flight toggle
    setAccessDoc(null);
    setAccessError(null);
    setAccessDoctors([]);
  }, [togglingDoctorId]);

  // ── Delete handlers ───────────────────────────────────────────────────────
  const handleLongPress = useCallback((doc) => {
    setDeleteError(null);
    setDeleteTarget({ id: doc.id, title: doc.title ?? doc.fileName ?? '—', storagePath: doc.storagePath });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget || isDeleting) return;
    setDeleteError(null);
    setIsDeleting(true);
    try {
      const ok = await storageService.deletePatientDocument(deleteTarget.id, deleteTarget.storagePath);
      if (ok) { setDeleteTarget(null); }
      else    { setDeleteError(t('documents.deleteError')); }
    } catch { setDeleteError(t('documents.deleteError')); }
    finally  { if (isMountedRef.current) setIsDeleting(false); }
  }, [deleteTarget, isDeleting, t]);

  // ── Upload handlers ───────────────────────────────────────────────────────
  const openUploadModal = useCallback(() => {
    setUploadStep('source'); setPendingAsset(null); setUploadTitle('');
    setUploadCategory('general'); setUploadDesc(''); setUploadError(null);
    setPermError(null); setUploadVisible(true);
  }, []);

  const pickFromCamera = useCallback(async () => {
    setPermError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { setPermError(t('documents.permCamera')); return; }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!res.canceled && res.assets?.[0]) {
      const a = res.assets[0];
      setPendingAsset({ uri: a.uri, fileName: resolveFileName(a), mimeType: resolveMimeType(a) });
      setUploadStep('details');
    }
  }, [t]);

  const pickFromGallery = useCallback(async () => {
    setPermError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setPermError(t('documents.permGallery')); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!res.canceled && res.assets?.[0]) {
      const a = res.assets[0];
      setPendingAsset({ uri: a.uri, fileName: resolveFileName(a), mimeType: resolveMimeType(a) });
      setUploadStep('details');
    }
  }, [t]);

  const handleUploadSubmit = useCallback(async () => {
    if (!uploadTitle.trim()) { setUploadError(t('documents.titleRequired')); return; }
    if (!pendingAsset || !user?.uid || isUploading) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      const result = await storageService.uploadDocument(
        user.uid, pendingAsset.uri, pendingAsset.fileName, pendingAsset.mimeType,
        { title: uploadTitle.trim(), category: uploadCategory, description: uploadDesc.trim() },
      );
      if (result.success) { setUploadVisible(false); }
      else                { setUploadError(t('documents.uploadError')); }
    } catch { setUploadError(t('documents.uploadError')); }
    finally  { if (isMountedRef.current) setIsUploading(false); }
  }, [uploadTitle, pendingAsset, user?.uid, isUploading, uploadCategory, uploadDesc, t]);

  const closeUploadModal = useCallback(() => { if (!isUploading) setUploadVisible(false); }, [isUploading]);

  // ── List helpers ──────────────────────────────────────────────────────────
  const keyExtractor   = useCallback((item) => item.id, []);
  const handleCatPress = useCallback((id) => setActiveCategory(id), []);

  const renderDoc = useCallback(({ item }) => (
    <DocumentCard
      doc={item}
      onOpen={handleOpenViewer}
      onManageAccess={handleManageAccess}
      onLongPress={handleLongPress}
    />
  ), [handleOpenViewer, handleManageAccess, handleLongPress]);

  const renderCatTab = useCallback(({ item }) => (
    <CategoryTab
      id={item.id} icon={item.icon}
      isActive={activeCategory === item.id}
      count={catCounts[item.id] ?? 0}
      onPress={handleCatPress}
      label={t(CAT_LABEL_KEY[item.id] ?? 'documents.catGeneral')}
    />
  ), [activeCategory, catCounts, handleCatPress, t]);

  const ListEmpty = useMemo(() => {
    if (isFetching) return null;
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconBox}>
          <Ionicons name="document-text-outline" size={44} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>{t('documents.emptyState')}</Text>
        <Text style={styles.emptySub}>{t('documents.emptyStateSub')}</Text>
        <TouchableOpacity style={styles.emptyUploadBtn} onPress={openUploadModal}>
          <Text style={styles.emptyUploadText}>{t('documents.uploadNew')}</Text>
        </TouchableOpacity>
      </View>
    );
  }, [isFetching, t, openUploadModal]);

  // ── Shared-with count chip (used in access modal header) ──────────────────
  const sharedWithCount = liveAccessDoc?.authorizedDoctors?.length ?? 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ScreenContainer scrollable={false} padded={false} edges={['bottom']}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.headerTitle}>{t('documents.title')}</Text>
        <Text style={styles.headerSub}>{t('documents.docCount', { n: documents.length })}</Text>
      </View>

      {/* Category rail */}
      <View style={styles.catRail}>
        <FlatList
          horizontal data={CATEGORIES} keyExtractor={(c) => c.id}
          renderItem={renderCatTab} showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRailContent}
        />
      </View>

      {/* Content */}
      {isFetching ? (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centeredText}>{t('common.loading')}</Text>
        </View>
      ) : fetchError ? (
        <View style={styles.centeredState}>
          <Ionicons name="cloud-offline-outline" size={44} color={colors.error} />
          <Text style={styles.fetchErrorText}>{fetchError}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredDocs} keyExtractor={keyExtractor} renderItem={renderDoc}
          ListEmptyComponent={ListEmpty}
          contentContainerStyle={[styles.listContent, filteredDocs.length === 0 && styles.listContentGrow]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, isUploading && styles.fabDisabled]}
        onPress={isUploading ? undefined : openUploadModal}
        activeOpacity={0.85}
      >
        {isUploading
          ? <ActivityIndicator size="small" color={colors.white} />
          : <Ionicons name="add" size={28} color={colors.white} />}
      </TouchableOpacity>

      {/* ════════════════════════ DOCUMENT VIEWER MODAL ════════════════════════ */}
      <Modal
        visible={!!viewerDoc} animationType="fade" transparent={false}
        statusBarTranslucent onRequestClose={handleCloseViewer}
      >
        <View style={styles.viewerContainer}>
          <TouchableOpacity
            style={[styles.viewerClose, { top: insets.top + spacing.sm }]}
            onPress={handleCloseViewer}
            hitSlop={{ top: 8, bottom: 8, start: 8, end: 8 }}
          >
            <Ionicons name="close" size={26} color={colors.white} />
          </TouchableOpacity>

          <Text style={[styles.viewerTitle, { marginTop: insets.top + 56 }]} numberOfLines={2}>
            {viewerDoc?.title ?? viewerDoc?.fileName ?? '—'}
          </Text>

          {viewerDoc && isImageMime(viewerDoc.mimeType) ? (
            <Image source={{ uri: viewerDoc.fileUrl }} style={styles.viewerImage} resizeMode="contain" />
          ) : (
            <View style={styles.pdfPlaceholder}>
              <Ionicons name="document-outline" size={72} color={colors.white} />
              <Text style={styles.pdfPlaceholderText}>{t('documents.pdfPreviewUnavailable')}</Text>
              <TouchableOpacity
                style={styles.pdfOpenBtn}
                onPress={() => viewerDoc?.fileUrl && Linking.openURL(viewerDoc.fileUrl)}
              >
                <Text style={styles.pdfOpenBtnText}>{t('documents.openInBrowser')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* ═══════════════════ MANAGE ACCESS MODAL (Consent Model) ═══════════════ */}
      <Modal
        visible={!!accessDoc}
        animationType="slide"
        transparent
        onRequestClose={handleCloseAccessModal}
      >
        <View style={styles.accessOverlay}>
          <View style={[styles.accessSheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>

            {/* Drag handle */}
            <View style={styles.sheetHandle} />

            {/* Sheet header */}
            <View style={styles.accessHeader}>
              <View style={styles.accessHeaderIcon}>
                <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
              </View>
              <View style={styles.accessHeaderText}>
                <Text style={styles.accessSheetTitle}>{t('documents.accessControl')}</Text>
                <Text style={styles.accessDocName} numberOfLines={1}>
                  {accessDoc?.title ?? accessDoc?.fileName ?? '—'}
                </Text>
              </View>
            </View>

            {/* Subtitle with live shared-with count */}
            <Text style={styles.accessSubtitle}>
              {sharedWithCount > 0
                ? t('documents.sharedWith', { n: sharedWithCount })
                : t('documents.notShared')}
            </Text>

            <Text style={styles.accessInstruction}>{t('documents.accessControlSub')}</Text>

            {/* Error banner */}
            {!!accessError && <ErrorBanner message={accessError} />}

            {/* Doctor list */}
            {isLoadingAccessDoctors ? (
              <View style={styles.accessLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : loadAccessDoctorsError ? (
              <View style={styles.accessLoading}>
                <Ionicons name="cloud-offline-outline" size={36} color={colors.error} />
                <Text style={styles.fetchErrorText}>{loadAccessDoctorsError}</Text>
              </View>
            ) : accessDoctors.length === 0 ? (
              <View style={styles.accessLoading}>
                <Ionicons name="person-outline" size={40} color={colors.border} />
                <Text style={styles.emptyTitle}>{t('documents.noAppointmentDoctors')}</Text>
              </View>
            ) : (
              <FlatList
                data={accessDoctors}
                keyExtractor={(d) => d.id}
                style={styles.doctorList}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={styles.doctorSep} />}
                renderItem={({ item: doctor }) => {
                  // Derive switch state from live Firestore snapshot — always accurate
                  const isGranted      = liveAccessDoc?.authorizedDoctors?.includes(doctor.id) ?? false;
                  const isThisToggling = togglingDoctorId === doctor.id;

                  return (
                    <View style={[styles.doctorRow, togglingDoctorId && !isThisToggling && styles.doctorRowDimmed]}>
                      {/* Doctor avatar */}
                      <View style={[styles.doctorAvatar, isGranted && styles.doctorAvatarGranted]}>
                        <Text style={[styles.doctorAvatarText, isGranted && styles.doctorAvatarTextGranted]}>
                          {(doctor.name ?? '?')[0].toUpperCase()}
                        </Text>
                      </View>

                      {/* Doctor info */}
                      <View style={styles.doctorMeta}>
                        <Text style={styles.doctorName} numberOfLines={1}>{doctor.name ?? '—'}</Text>
                        {!!doctor.specialty && (
                          <Text style={styles.doctorSpecialty} numberOfLines={1}>{doctor.specialty}</Text>
                        )}
                        <Text style={[styles.accessStatusText, isGranted && styles.accessStatusGranted]}>
                          {isGranted ? t('documents.grantAccess') : t('documents.revokeAccess')}
                        </Text>
                      </View>

                      {/* Toggle — spinner while this specific doctor's toggle is in-flight */}
                      {isThisToggling ? (
                        <ActivityIndicator size="small" color={colors.primary} style={styles.toggleSpinner} />
                      ) : (
                        <Switch
                          value={isGranted}
                          onValueChange={() => handleToggleDoctorAccess(doctor)}
                          disabled={!!togglingDoctorId}
                          trackColor={{ false: colors.border, true: colors.primary + '60' }}
                          thumbColor={isGranted ? colors.primary : colors.white}
                          ios_backgroundColor={colors.border}
                        />
                      )}
                    </View>
                  );
                }}
              />
            )}

            {/* Done button */}
            <TouchableOpacity
              style={[styles.accessDoneBtn, !!togglingDoctorId && styles.accessDoneBtnDisabled]}
              onPress={handleCloseAccessModal}
              disabled={!!togglingDoctorId}
              activeOpacity={0.8}
            >
              <Text style={styles.accessDoneBtnText}>{t('common.done')}</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

      {/* ═════════════════════════ UPLOAD MODAL ════════════════════════════════ */}
      <Modal visible={uploadVisible} transparent animationType="slide" onRequestClose={closeUploadModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View style={styles.sheetHandle} />

            {uploadStep === 'source' && (
              <>
                <Text style={styles.sheetTitle}>{t('documents.chooseSource')}</Text>
                {!!permError && <ErrorBanner message={permError} />}
                <TouchableOpacity style={styles.sourceBtn} onPress={pickFromCamera} activeOpacity={0.8}>
                  <View style={styles.sourceBtnIcon}><Ionicons name="camera-outline" size={26} color={colors.primary} /></View>
                  <Text style={styles.sourceBtnText}>{t('documents.sourceCamera')}</Text>
                  <Ionicons name="chevron-forward-outline" size={18} color={colors.gray} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.sourceBtn} onPress={pickFromGallery} activeOpacity={0.8}>
                  <View style={styles.sourceBtnIcon}><Ionicons name="images-outline" size={26} color={colors.primary} /></View>
                  <Text style={styles.sourceBtnText}>{t('documents.sourceGallery')}</Text>
                  <Ionicons name="chevron-forward-outline" size={18} color={colors.gray} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeUploadModal} activeOpacity={0.75}>
                  <Text style={styles.cancelBtnText}>{t('documents.cancel')}</Text>
                </TouchableOpacity>
              </>
            )}

            {uploadStep === 'details' && (
              <>
                <View style={styles.detailsHeader}>
                  <TouchableOpacity onPress={() => { setUploadStep('source'); setUploadError(null); }} disabled={isUploading} hitSlop={{ top: 8, bottom: 8, start: 8, end: 8 }}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.sheetTitle}>{t('documents.docDetails')}</Text>
                  <View style={{ width: 22 }} />
                </View>

                {!!pendingAsset && (
                  <View style={styles.fileIndicator}>
                    <Ionicons name="image-outline" size={16} color={colors.primary} />
                    <Text style={styles.fileIndicatorText} numberOfLines={1}>{pendingAsset.fileName}</Text>
                  </View>
                )}

                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>{t('documents.titleLabel')} *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder={t('documents.titlePlaceholder')}
                    placeholderTextColor={colors.gray}
                    value={uploadTitle}
                    onChangeText={(v) => { setUploadTitle(v); setUploadError(null); }}
                    autoCapitalize="sentences" autoCorrect={false} editable={!isUploading}
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>{t('documents.categoryLabel')}</Text>
                  <FlatList
                    horizontal data={CATEGORIES.filter((c) => c.id !== 'all')}
                    keyExtractor={(c) => c.id} showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: spacing.xs }}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[styles.catPickChip, uploadCategory === item.id && styles.catPickChipActive]}
                        onPress={() => setUploadCategory(item.id)} disabled={isUploading} activeOpacity={0.75}
                      >
                        <Text style={[styles.catPickText, uploadCategory === item.id && styles.catPickTextActive]}>
                          {t(CAT_LABEL_KEY[item.id] ?? 'documents.catGeneral')}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>{t('documents.descLabel')}</Text>
                  <TextInput
                    style={[styles.textInput, styles.textInputMulti]}
                    placeholder={t('documents.descPlaceholder')} placeholderTextColor={colors.gray}
                    value={uploadDesc} onChangeText={setUploadDesc}
                    multiline numberOfLines={3} textAlignVertical="top" editable={!isUploading}
                  />
                </View>

                {!!uploadError && <ErrorBanner message={uploadError} />}

                <View style={styles.formActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeUploadModal} disabled={isUploading} activeOpacity={0.75}>
                    <Text style={styles.cancelBtnText}>{t('documents.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.confirmBtn, isUploading && styles.confirmBtnDisabled]} onPress={handleUploadSubmit} disabled={isUploading} activeOpacity={0.85}>
                    {isUploading ? (
                      <><ActivityIndicator size="small" color={colors.white} /><Text style={styles.confirmBtnText}>{t('documents.uploading')}</Text></>
                    ) : (
                      <><Ionicons name="cloud-upload-outline" size={16} color={colors.white} /><Text style={styles.confirmBtnText}>{t('documents.uploadConfirm')}</Text></>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══════════════════════ DELETE MODAL ══════════════════════════════════ */}
      <Modal
        visible={!!deleteTarget} transparent animationType="fade"
        onRequestClose={() => { if (!isDeleting) setDeleteTarget(null); }}
      >
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteSheet}>
            <Ionicons name="trash-outline" size={36} color={colors.error} />
            <Text style={styles.deleteTitle}>{t('documents.deleteTitle')}</Text>
            <Text style={styles.deleteMsg}>{t('documents.deleteMsg', { title: deleteTarget?.title ?? '' })}</Text>
            {!!deleteError && <ErrorBanner message={deleteError} />}
            <View style={styles.deleteActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setDeleteTarget(null); setDeleteError(null); }} disabled={isDeleting}>
                <Text style={styles.cancelBtnText}>{t('documents.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.deleteBtn, isDeleting && styles.confirmBtnDisabled]} onPress={handleDeleteConfirm} disabled={isDeleting}>
                {isDeleting
                  ? <ActivityIndicator size="small" color={colors.white} />
                  : <Text style={styles.deleteBtnText}>{t('documents.deleteConfirmBtn')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScreenContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: { backgroundColor: colors.primary, paddingBottom: spacing.md, paddingHorizontal: spacing.md, ...shadows.sm },
  headerTitle: { fontSize: typography.sizes.xl, fontWeight: '700', color: colors.white },
  headerSub:   { fontSize: typography.sizes.sm, color: colors.white, opacity: 0.8, marginTop: 2 },

  catRail: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  catRailContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  catTab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.full, backgroundColor: colors.borderLight },
  catTabActive: { backgroundColor: colors.primary },
  catTabText:   { fontSize: typography.sizes.xs, fontWeight: '500', color: colors.textSecondary },
  catTabTextActive: { color: colors.white },
  catBubble: { backgroundColor: colors.border, borderRadius: BorderRadius.full, paddingHorizontal: 5, paddingVertical: 1, marginStart: 2 },
  catBubbleActive: { backgroundColor: colors.white + '40' },
  catBubbleText: { fontSize: 9, fontWeight: '600', color: colors.textSecondary },
  catBubbleTextActive: { color: colors.white },

  centeredState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  centeredText:  { fontSize: typography.sizes.sm, color: colors.textSecondary },
  fetchErrorText:{ fontSize: typography.sizes.sm, color: colors.error, textAlign: 'center', marginHorizontal: spacing.lg },

  listContent:     { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xl + 72 },
  listContentGrow: { flex: 1 },
  sep:             { height: spacing.sm },

  // Document card
  docCard: { backgroundColor: colors.white, borderRadius: BorderRadius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', ...shadows.sm },
  docIconBadge: { width: 44, height: 44, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', marginEnd: spacing.sm, flexShrink: 0 },
  docInfo: { flex: 1 },
  docTitle: { fontSize: typography.sizes.md, fontWeight: '600', color: colors.text, marginBottom: 3 },
  docMeta:  { fontSize: typography.sizes.xs, color: colors.textSecondary },

  // Access key button on card
  accessIconBtn: { padding: spacing.xs, marginStart: spacing.sm, position: 'relative' },
  accessDot: {
    position: 'absolute',
    top: spacing.xs - 2,
    end: spacing.xs - 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.white,
  },

  emptyState:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyIconBox:  { width: 80, height: 80, borderRadius: BorderRadius.full, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  emptyTitle:    { fontSize: typography.sizes.lg, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },
  emptySub:      { fontSize: typography.sizes.sm, color: colors.gray, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  emptyUploadBtn:{ marginTop: spacing.lg, backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: BorderRadius.full },
  emptyUploadText:{ color: colors.white, fontSize: typography.sizes.sm, fontWeight: '600' },

  fab: { position: 'absolute', bottom: spacing.xl, end: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.lg },
  fabDisabled: { opacity: 0.6 },

  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.error + '12', borderStartWidth: 3, borderStartColor: colors.error, borderRadius: BorderRadius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, marginVertical: spacing.xs },
  errorBannerText: { fontSize: typography.sizes.sm, color: colors.error, flex: 1 },

  // ── Viewer ────────────────────────────────────────────────────────────────
  viewerContainer: { flex: 1, backgroundColor: colors.black, alignItems: 'center' },
  viewerClose: { position: 'absolute', end: spacing.md, zIndex: 10, width: 40, height: 40, borderRadius: BorderRadius.full, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  viewerTitle: { color: colors.white, fontSize: typography.sizes.md, fontWeight: '600', textAlign: 'center', paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  viewerImage: { flex: 1, width: '100%' },
  pdfPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
  pdfPlaceholderText: { color: colors.white, fontSize: typography.sizes.md, textAlign: 'center', opacity: 0.75 },
  pdfOpenBtn: { borderWidth: 1, borderColor: colors.white, borderRadius: BorderRadius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginTop: spacing.sm },
  pdfOpenBtnText: { color: colors.white, fontSize: typography.sizes.sm, fontWeight: '600' },

  // ── Manage Access modal ───────────────────────────────────────────────────
  accessOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  accessSheet: {
    backgroundColor: colors.white,
    borderTopStartRadius: BorderRadius.xl,
    borderTopEndRadius: BorderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    maxHeight: '80%',
  },
  accessHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  accessHeaderIcon: {
    width: 40, height: 40, borderRadius: BorderRadius.md,
    backgroundColor: colors.primary + '15',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  accessHeaderText: { flex: 1 },
  accessSheetTitle: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.text },
  accessDocName:    { fontSize: typography.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  accessSubtitle:   { fontSize: typography.sizes.sm, fontWeight: '600', color: colors.primary, marginBottom: 2 },
  accessInstruction:{ fontSize: typography.sizes.xs, color: colors.textSecondary, marginBottom: spacing.md },
  accessLoading: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, gap: spacing.md },

  // Doctor rows in access modal
  doctorList: { maxHeight: 320 },
  doctorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.sm },
  doctorRowDimmed: { opacity: 0.4 },

  doctorAvatar: {
    width: 40, height: 40, borderRadius: BorderRadius.full,
    backgroundColor: colors.borderLight,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  doctorAvatarGranted: { backgroundColor: colors.primary + '20' },
  doctorAvatarText:        { fontSize: typography.sizes.md, fontWeight: '700', color: colors.gray },
  doctorAvatarTextGranted: { color: colors.primary },

  doctorMeta: { flex: 1 },
  doctorName:    { fontSize: typography.sizes.md, fontWeight: '600', color: colors.text },
  doctorSpecialty:{ fontSize: typography.sizes.xs, color: colors.textSecondary, marginTop: 2 },
  accessStatusText:    { fontSize: typography.sizes.xs, color: colors.gray, marginTop: 2 },
  accessStatusGranted: { color: colors.primary, fontWeight: '600' },

  toggleSpinner: { marginHorizontal: spacing.sm },
  doctorSep: { height: 1, backgroundColor: colors.border, marginStart: 52 },

  accessDoneBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  accessDoneBtnDisabled: { opacity: 0.5 },
  accessDoneBtnText: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.white },

  // ── Upload modal ──────────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.white, borderTopStartRadius: BorderRadius.xl, borderTopEndRadius: BorderRadius.xl, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  sheetHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: BorderRadius.full, alignSelf: 'center', marginBottom: spacing.md },
  sheetTitle: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: spacing.md, flex: 1 },
  sourceBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  sourceBtnIcon: { width: 44, height: 44, borderRadius: BorderRadius.md, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' },
  sourceBtnText: { flex: 1, fontSize: typography.sizes.md, fontWeight: '500', color: colors.text },
  detailsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  fileIndicator: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.primary + '12', borderRadius: BorderRadius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, marginBottom: spacing.md },
  fileIndicatorText: { flex: 1, fontSize: typography.sizes.sm, color: colors.primary, fontWeight: '500' },
  formField: { marginBottom: spacing.md },
  fieldLabel: { fontSize: typography.sizes.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs },
  textInput: { borderWidth: 1, borderColor: colors.border, borderRadius: BorderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.sizes.md, color: colors.text, backgroundColor: colors.white },
  textInputMulti: { minHeight: 80, paddingTop: spacing.sm },
  catPickChip: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  catPickChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catPickText: { fontSize: typography.sizes.xs, fontWeight: '500', color: colors.textSecondary },
  catPickTextActive: { color: colors.white },
  formActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.md },
  cancelBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelBtnText: { fontSize: typography.sizes.md, fontWeight: '600', color: colors.textSecondary },
  confirmBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.md, borderRadius: BorderRadius.lg, backgroundColor: colors.primary },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.white },

  // ── Delete modal ──────────────────────────────────────────────────────────
  deleteOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  deleteSheet: { backgroundColor: colors.white, borderRadius: BorderRadius.xl, padding: spacing.lg, alignItems: 'center', width: '100%', gap: spacing.sm, ...shadows.lg },
  deleteTitle: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.text },
  deleteMsg:   { fontSize: typography.sizes.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  deleteActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, width: '100%' },
  deleteBtn: { flex: 2, paddingVertical: spacing.md, borderRadius: BorderRadius.lg, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.white },
});
