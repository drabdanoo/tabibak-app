/**
 * NotificationsScreen.js — Phase 4 Rebuild
 *
 * Displays the in-app notification feed for the signed-in user.
 *
 * ── Architecture ──────────────────────────────────────────────────────────────
 *
 *  Data layer      : notificationService.subscribeToNotifications (real-time)
 *  Read tracking   : notificationService.markAsRead / markAllAsRead
 *  Routing engine  : handleNotificationTap → switches on notification.type
 *  Locale          : t('notifications.*') — zero hardcoded strings
 *  Firebase        : zero direct imports — all through notificationService
 *
 * ── Notification document shape ───────────────────────────────────────────────
 *
 *   notifications/{id}
 *     userId:      string   — owner UID
 *     type:        string   — 'chat' | 'appointment' | 'general'
 *     title:       string
 *     body:        string
 *     referenceId: string   — chatId or appointmentId (optional)
 *     read:        boolean
 *     createdAt:   Timestamp
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation }    from 'react-i18next';
import { Ionicons }          from '@expo/vector-icons';

import ScreenContainer       from '../../components/ui/ScreenContainer';
import { useAuth }           from '../../contexts/AuthContext';
import notificationService   from '../../services/notificationService';
import {
  BorderRadius,
  colors,
  shadows,
  spacing,
  typography,
} from '../../config/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a human-readable relative time label.
 * @param {import('firebase/firestore').Timestamp|null} ts
 * @param {function} t
 * @returns {string}
 */
function getTimeLabel(ts, t) {
  if (!ts) return '';
  const ms      = ts.toMillis?.() ?? ts * 1000;
  const diffMs  = Date.now() - ms;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return t('notifications.justNow');
  if (diffMin < 60) return t('notifications.minutesAgo', { n: diffMin });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return t('notifications.hoursAgo', { n: diffH });
  const diffD = Math.floor(diffH / 24);
  return t('notifications.daysAgo', { n: diffD });
}

/** Map notification.type → icon name (Ionicons) */
function typeIcon(type) {
  switch (type) {
    case 'chat':        return 'chatbubble-ellipses';
    case 'appointment': return 'calendar';
    default:            return 'notifications';
  }
}

/** Map notification.type → locale key for the pill label */
function typeLabel(type, t) {
  switch (type) {
    case 'chat':        return t('notifications.typeChat');
    case 'appointment': return t('notifications.typeAppointment');
    default:            return t('notifications.typeGeneral');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NotificationCard — memo to prevent re-renders when other cards change
// ─────────────────────────────────────────────────────────────────────────────

const NotificationCard = memo(({ item, onTap, timeLabel, label }) => {
  const isUnread = item.read === false;

  return (
    <Pressable
      onPress={() => onTap(item)}
      style={({ pressed }) => [
        styles.card,
        isUnread && styles.cardUnread,
        pressed && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: isUnread }}
    >
      {/* Unread dot */}
      {isUnread && <View style={styles.unreadDot} />}

      {/* Icon badge */}
      <View style={[styles.iconBadge, isUnread && styles.iconBadgeUnread]}>
        <Ionicons
          name={typeIcon(item.type)}
          size={20}
          color={isUnread ? colors.white : colors.textSecondary}
        />
      </View>

      {/* Body */}
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardTime}>{timeLabel}</Text>
        </View>
        {!!item.body && (
          <Text style={styles.cardBodyText} numberOfLines={2}>{item.body}</Text>
        )}
        <Text style={styles.cardTypeLabel}>{label}</Text>
      </View>
    </Pressable>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// EmptyState
// ─────────────────────────────────────────────────────────────────────────────

const EmptyState = memo(({ t }) => (
  <View style={styles.emptyContainer}>
    <Ionicons name="notifications-off-outline" size={64} color={colors.border} />
    <Text style={styles.emptyTitle}>{t('notifications.empty')}</Text>
    <Text style={styles.emptySub}>{t('notifications.emptySub')}</Text>
  </View>
));

// ─────────────────────────────────────────────────────────────────────────────
// NotificationsScreen
// ─────────────────────────────────────────────────────────────────────────────

export default function NotificationsScreen({ navigation }) {
  const { t }               = useTranslation();
  const { user }            = useAuth();
  const insets              = useSafeAreaInsets();

  const [notifications, setNotifications] = useState([]);
  const [isFetching,    setIsFetching]    = useState(true);
  const [loadError,     setLoadError]     = useState(null);
  const [isMarkingAll,  setIsMarkingAll]  = useState(false);

  // Stable ref so renderItem closure never captures a stale uid
  const uidRef = useRef(user?.uid);
  useEffect(() => { uidRef.current = user?.uid; }, [user?.uid]);

  // ── Real-time subscription ────────────────────────────────────────────────

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) { setIsFetching(false); return; }

    setIsFetching(true);
    setLoadError(null);

    const unsub = notificationService.subscribeToNotifications(
      uid,
      (docs) => {
        setNotifications(docs);
        setIsFetching(false);
      },
      (err) => {
        console.error('[NotificationsScreen] subscription error:', err);
        setLoadError(t('notifications.loadError'));
        setIsFetching(false);
      },
    );

    return unsub;
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived state ─────────────────────────────────────────────────────────

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.read === false).length,
    [notifications],
  );

  // Pre-compute time labels and type labels so renderItem has no reactive deps
  const enrichedNotifications = useMemo(
    () => notifications.map((n) => ({
      ...n,
      _timeLabel: getTimeLabel(n.createdAt, t),
      _typeLabel: typeLabel(n.type, t),
    })),
    [notifications, t],
  );

  // ── Routing engine ────────────────────────────────────────────────────────

  const handleNotificationTap = useCallback((notification) => {
    // Fire-and-forget mark as read
    notificationService.markAsRead(notification.id);

    switch (notification.type) {
      case 'chat':
        if (notification.referenceId) {
          navigation.navigate('ChatScreen', { chatId: notification.referenceId });
        }
        break;
      case 'appointment':
        if (notification.referenceId) {
          navigation.navigate('AppointmentDetails', { id: notification.referenceId });
        }
        break;
      default:
        // No routing for generic notifications
        break;
    }
  }, [navigation]);

  // ── Mark all as read ──────────────────────────────────────────────────────

  const handleMarkAllRead = useCallback(async () => {
    const uid = uidRef.current;
    if (!uid || unreadCount === 0 || isMarkingAll) return;
    setIsMarkingAll(true);
    await notificationService.markAllAsRead(uid);
    setIsMarkingAll(false);
  }, [unreadCount, isMarkingAll]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderItem = useCallback(({ item }) => (
    <NotificationCard
      item={item}
      onTap={handleNotificationTap}
      timeLabel={item._timeLabel}
      label={item._typeLabel}
    />
  ), [handleNotificationTap]);

  const keyExtractor = useCallback((item) => item.id, []);

  const ListEmptyComponent = useMemo(() => {
    if (isFetching) return null;
    return <EmptyState t={t} />;
  }, [isFetching, t]);

  const ItemSeparator = useCallback(() => <View style={styles.separator} />, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ScreenContainer scrollable={false} padded={false} edges={['bottom']}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.headerTitle}>{t('notifications.title')}</Text>
        <TouchableOpacity
          onPress={handleMarkAllRead}
          disabled={unreadCount === 0 || isMarkingAll}
          hitSlop={{ top: 8, bottom: 8, start: 8, end: 8 }}
        >
          {isMarkingAll
            ? <ActivityIndicator size="small" color={colors.white} />
            : (
              <Text style={[
                styles.markAllText,
                unreadCount === 0 && styles.markAllTextDisabled,
              ]}>
                {t('notifications.markAllRead')}
              </Text>
            )
          }
        </TouchableOpacity>
      </View>

      {/* ── Error banner ────────────────────────────────────────────────── */}
      {!!loadError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      )}

      {/* ── Loading skeleton ────────────────────────────────────────────── */}
      {isFetching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        /* ── Notification list ─────────────────────────────────────────── */
        <FlatList
          data={enrichedNotifications}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ItemSeparatorComponent={ItemSeparator}
          ListEmptyComponent={ListEmptyComponent}
          contentContainerStyle={[
            styles.listContent,
            enrichedNotifications.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}

    </ScreenContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const UNREAD_TINT = `${colors.primary}14`; // 8% opacity green

const styles = StyleSheet.create({
  // ── Header
  header: {
    backgroundColor:  colors.primary,
    paddingBottom:    spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    ...shadows.sm,
  },
  headerTitle: {
    fontSize:   typography.sizes.xl,
    fontWeight: '700',
    color:      colors.white,
  },
  markAllText: {
    fontSize:   typography.sizes.sm,
    fontWeight: '600',
    color:      colors.white,
  },
  markAllTextDisabled: {
    opacity: 0.45,
  },

  // ── Error banner
  errorBanner: {
    backgroundColor:  colors.error + '15',
    borderStartWidth: 3,
    borderStartColor: colors.error,
    marginHorizontal: spacing.md,
    marginTop:        spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical:  spacing.sm,
    borderRadius:     BorderRadius.md,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    color:    colors.error,
  },

  // ── Loading
  loadingContainer: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // ── List
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.xl,
  },
  listContentEmpty: {
    flex: 1,
  },
  separator: {
    height: spacing.sm,
  },

  // ── Notification card
  card: {
    backgroundColor:  colors.white,
    borderRadius:     BorderRadius.lg,
    paddingVertical:  spacing.md,
    paddingStart:     spacing.md,
    paddingEnd:       spacing.md,
    flexDirection:    'row',
    alignItems:       'flex-start',
    ...shadows.sm,
  },
  cardUnread: {
    backgroundColor: UNREAD_TINT,
    borderStartWidth: 3,
    borderStartColor: colors.primary,
  },
  cardPressed: {
    opacity: 0.85,
  },

  // Unread indicator dot (top-end corner)
  unreadDot: {
    position:        'absolute',
    top:             spacing.sm,
    end:             spacing.sm,
    width:           8,
    height:          8,
    borderRadius:    BorderRadius.full,
    backgroundColor: colors.primary,
  },

  // Icon badge
  iconBadge: {
    width:          40,
    height:         40,
    borderRadius:   BorderRadius.full,
    backgroundColor: colors.borderLight,
    alignItems:     'center',
    justifyContent: 'center',
    marginEnd:      spacing.sm,
    flexShrink:     0,
  },
  iconBadgeUnread: {
    backgroundColor: colors.primary,
  },

  // Card body
  cardBody: {
    flex: 1,
  },
  cardHeader: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    marginBottom:   2,
  },
  cardTitle: {
    flex:       1,
    fontSize:   typography.sizes.md,
    fontWeight: '600',
    color:      colors.text,
    marginEnd:  spacing.sm,
  },
  cardTime: {
    fontSize:  typography.sizes.xs,
    color:     colors.textSecondary,
    flexShrink: 0,
  },
  cardBodyText: {
    fontSize:     typography.sizes.sm,
    color:        colors.textSecondary,
    lineHeight:   20,
    marginBottom: 4,
  },
  cardTypeLabel: {
    fontSize:   typography.sizes.xs,
    color:      colors.primary,
    fontWeight: '500',
  },

  // ── Empty state
  emptyContainer: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize:   typography.sizes.lg,
    fontWeight: '600',
    color:      colors.textSecondary,
    marginTop:  spacing.md,
    textAlign:  'center',
  },
  emptySub: {
    fontSize:   typography.sizes.sm,
    color:      colors.gray,
    marginTop:  spacing.sm,
    textAlign:  'center',
    lineHeight: 20,
  },
});
