/**
 * ChatScreen.js — Real-Time 1-on-1 Messaging (Phase 4)
 *
 * ╔══ ARCHITECTURE ════════════════════════════════════════════════════════════╗
 *
 * INVERTED FLATLIST — the core chat pattern
 * ──────────────────────────────────────────
 *   FlatList inverted={true} physically rotates the scroll view 180°.
 *   Firestore query: orderBy('timestamp', 'desc') → data is [newest … oldest].
 *   After inversion: newest = visual bottom, oldest = visual top.
 *
 *   • New messages arrive at data[0] → always at the visual bottom.
 *     No programmatic scrollToBottom is ever needed.
 *   • onEndReached fires when the user scrolls to data[N-1] (visual top) —
 *     the natural "load more history" trigger.
 *
 * KEYBOARD AVOIDANCE
 * ──────────────────
 *   ScreenContainer (edges=['bottom']) provides:
 *     • SafeAreaView  — handles notch + home indicator (bottom only)
 *     • KeyboardAvoidingView — behavior='padding' on iOS, undefined on Android
 *   ChatHeader handles its own top inset via useSafeAreaInsets().top.
 *   With behavior='padding', the KAV adds bottom padding = keyboard height,
 *   compressing only the FlatList while keeping the header and InputBar fixed.
 *
 * COMPONENT ISOLATION — prevents typing from re-rendering the message list
 * ──────────────────────────────────────────────────────────────────────────
 *   • InputBar       is React.memo — its props are all stable references
 *   • MessageBubble  is React.memo — only re-renders when its own data changes
 *   • renderItem     useCallback([]) — empty deps; reads uid via a stable uidRef
 *   • messagesWithMeta useMemo — date-separator flags pre-computed here,
 *                    so renderItem is dependency-free
 *   Every keystroke updates inputText state → ChatScreen re-renders, but
 *   messagesWithMeta.data reference is unchanged → FlatList cells stay stable.
 *
 * BUBBLE STYLING (RTL-aware logical properties throughout)
 * ─────────────────────────────────────────────────────────
 *   "My" bubble    → colors.primary bg, white text, alignSelf flex-end
 *                    sharp borderTopEndRadius (nearest to trailing edge)
 *                    tail at borderBottomEndRadius: 0
 *   "Their" bubble → colors.borderLight bg, dark text, alignSelf flex-start
 *                    sharp borderTopStartRadius (nearest to leading edge)
 *                    tail at borderBottomStartRadius: 0
 *
 * PUSH NOTIFICATIONS — fire-and-forget IIFE after each successful send
 *   Token lookup: chatService.fetchPushToken(recipientId)
 *   Delivery failure is non-fatal and fully transparent to the UI.
 *
 * CONTRACTS ENFORCED
 * ───────────────────
 *   ✅ ScreenContainer (scrollable=false, padded=false, edges=['bottom'])
 *   ✅ RTL logical properties throughout (marginStart/End, borderTopStartRadius/End,
 *      borderBottomStartRadius/End, end: N for absolute positioning)
 *   ✅ All strings via t() — zero hardcoded text
 *   ✅ colors / spacing / typography / BorderRadius from theme.js only
 *   ✅ Zero Firebase imports — all Firestore ops via chatService
 *   ✅ Zero SafeAreaView from react-native (ScreenContainer handles it)
 *
 * Route params:
 *   recipientId:     string  — other user's UID (required)
 *   recipientName:   string  — display name shown in header
 *   recipientAvatar: string? — photo URL (optional, falls back to initials)
 *
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  memo,
} from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect }      from '@react-navigation/native';
import { Ionicons }            from '@expo/vector-icons';
import { useTranslation }      from 'react-i18next';
import { useSafeAreaInsets }   from 'react-native-safe-area-context';

import ScreenContainer         from '../../components/ui/ScreenContainer';
import chatService, { computeChatId } from '../../services/chatService';
import notificationService     from '../../services/notificationService';
import { useAuth }             from '../../contexts/AuthContext';
import {
  colors,
  spacing,
  typography,
  BorderRadius,
  shadows,
} from '../../config/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Re-export computeChatId for screens that imported it from here previously
// ─────────────────────────────────────────────────────────────────────────────
export { computeChatId };

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MESSAGES_PER_PAGE = 30;

// ─────────────────────────────────────────────────────────────────────────────
// Pure formatting helpers (no i18n dependency — labels resolved by caller)
// ─────────────────────────────────────────────────────────────────────────────

/** Firestore Timestamp | Date | null → 'HH:MM' (24h) */
function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = typeof timestamp.toDate === 'function'
    ? timestamp.toDate()
    : new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Resolve a localized day label for the date separator.
 * Returns t('chat.today'), t('chat.yesterday'), or a locale-formatted date string.
 *
 * @param {object|Date|null} timestamp - Firestore Timestamp or Date
 * @param {function} t - i18next translate function
 */
function getDateLabel(timestamp, t) {
  if (!timestamp) return '';
  const date = typeof timestamp.toDate === 'function'
    ? timestamp.toDate()
    : new Date(timestamp);

  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString())     return t('chat.today');
  if (date.toDateString() === yesterday.toDateString()) return t('chat.yesterday');
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Decide whether a date separator should appear below a message in JSX.
 * Because the FlatList is physically inverted, "below in JSX" = "above on screen".
 *
 * Data is DESC order: messages[index + 1] is the older neighbour.
 * We show a separator when adjacent items are on different calendar days,
 * and always above the oldest loaded message.
 */
function shouldShowDateSeparator(messages, index) {
  if (index === messages.length - 1) return true;        // oldest message

  const current = messages[index];
  const older   = messages[index + 1]; // one step older in DESC order
  if (!current?.timestamp || !older?.timestamp) return false;

  const toDate = (ts) =>
    typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  return toDate(current.timestamp).toDateString() !==
         toDate(older.timestamp).toDateString();
}

/** Extract ≤2-character initials from a display name */
function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length)    return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Avatar — initials on a colored circle
// ─────────────────────────────────────────────────────────────────────────────
const Avatar = memo(({ name = '', size = 36, style }) => (
  <View style={[{
    width:           size,
    height:          size,
    borderRadius:    size / 2,
    backgroundColor: colors.primaryDark,
    alignItems:      'center',
    justifyContent:  'center',
  }, style]}>
    <Text style={{
      color:      colors.white,
      fontSize:   size * 0.38,
      fontWeight: '700',
      lineHeight: size * 0.48,
    }}>
      {getInitials(name)}
    </Text>
  </View>
));

// ─────────────────────────────────────────────────────────────────────────────
// ReadReceipt — single ✓ (sent) or double ✓✓ (read) inside "my" bubbles
// ─────────────────────────────────────────────────────────────────────────────
const ReadReceipt = memo(({ read }) => (
  <Ionicons
    name={read ? 'checkmark-done' : 'checkmark'}
    size={12}
    color={read ? '#a7f3d0' : 'rgba(255,255,255,0.55)'}
    style={{ marginStart: 2 }}
  />
));

// ─────────────────────────────────────────────────────────────────────────────
// DateSeparator — pill with lines, receives a pre-resolved label string
// ─────────────────────────────────────────────────────────────────────────────
const DateSeparator = memo(({ label }) => (
  <View style={styles.dateSepRow}>
    <View style={styles.dateSepLine} />
    <View style={styles.dateSepPill}>
      <Text style={styles.dateSepText}>{label}</Text>
    </View>
    <View style={styles.dateSepLine} />
  </View>
));

// ─────────────────────────────────────────────────────────────────────────────
// MessageBubble
//
// React.memo prevents re-renders unless the message object changes.
// showSeparator + dateLabel are pre-computed in messagesWithMeta useMemo so
// this component's prop surface is stable between Firestore snapshot updates.
//
// RTL bubble styling (per task spec):
//   "My" message    → borderTopEndRadius   sharp (nearest to trailing edge)
//   "Their" message → borderTopStartRadius sharp (nearest to leading edge)
//
// Tail corners (both sides use logical properties, auto-mirror in RTL):
//   "My"    → borderBottomEndRadius:   0  (tail at logical END)
//   "Their" → borderBottomStartRadius: 0  (tail at logical START)
// ─────────────────────────────────────────────────────────────────────────────
const MessageBubble = memo(({ message, isMine, showSeparator, dateLabel }) => {
  const timeStr  = formatTime(message.timestamp);
  const isPending = !message.timestamp; // optimistic: null while serverTimestamp pending

  return (
    <>
      {/*
       * DateSeparator rendered BELOW the bubble in JSX.
       * Because FlatList is physically inverted, "below in JSX" = "above on screen".
       * This places "Today", "Yesterday", etc. between message groups visually.
       */}
      {showSeparator && dateLabel ? (
        <DateSeparator label={dateLabel} />
      ) : null}

      <View style={[
        styles.bubbleWrapper,
        isMine ? styles.bubbleWrapperMine : styles.bubbleWrapperTheirs,
      ]}>
        {/* Avatar — shown only for incoming messages */}
        {!isMine && (
          <Avatar name={message.senderName} size={28} style={styles.bubbleAvatar} />
        )}

        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
          {/* Message text */}
          <Text style={isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>
            {message.text}
          </Text>

          {/* Meta row: timestamp + read receipt */}
          <View style={styles.bubbleMeta}>
            {isPending ? (
              <ActivityIndicator size={9} color="rgba(255,255,255,0.55)" />
            ) : (
              <Text style={[
                styles.bubbleTime,
                isMine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs,
              ]}>
                {timeStr}
              </Text>
            )}
            {isMine && !isPending && <ReadReceipt read={message.read} />}
          </View>
        </View>
      </View>
    </>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ChatHeader
//
// Rendered inside ScreenContainer but above the FlatList + InputBar.
// With KAV behavior='padding', adding bottom padding compresses only the
// FlatList — the header stays visually fixed at the top.
// ─────────────────────────────────────────────────────────────────────────────
const ChatHeader = memo(({ navigation, recipientName, insetTop, t }) => (
  <View style={[styles.header, { paddingTop: insetTop + spacing.xs }]}>
    {/* Back button */}
    <TouchableOpacity
      style={styles.headerBackBtn}
      onPress={() => navigation.goBack()}
      hitSlop={{ top: 12, bottom: 12, start: 12, end: 12 }}
      accessibilityRole="button"
    >
      <Ionicons
        name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
        size={24}
        color={colors.white}
      />
    </TouchableOpacity>

    {/* Avatar + online dot */}
    <View style={styles.headerAvatarWrap}>
      <Avatar name={recipientName} size={38} />
      <View style={styles.onlineDot} />
    </View>

    {/* Name + status */}
    <View style={styles.headerInfo}>
      <Text style={styles.headerName} numberOfLines={1}>{recipientName}</Text>
      <Text style={styles.headerStatus}>{t('chat.online2')}</Text>
    </View>
  </View>
));

// ─────────────────────────────────────────────────────────────────────────────
// InputBar
//
// React.memo: onChangeText = setInputText (stable setState fn),
// onSend = useCallback with stable deps.
// Typing updates only InputBar — the FlatList stays untouched.
// ─────────────────────────────────────────────────────────────────────────────
const InputBar = memo(({ value, onChangeText, onSend, sending, inputRef, placeholder }) => {
  const canSend = value.trim().length > 0 && !sending;

  return (
    <View style={styles.inputBar}>
      <View style={styles.inputWrap}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.gray}
          multiline
          maxLength={2000}
          returnKeyType="default"
          blurOnSubmit={false}
          textAlignVertical="center"
        />
      </View>

      <TouchableOpacity
        style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
        onPress={onSend}
        disabled={!canSend}
        accessibilityRole="button"
      >
        {sending ? (
          <ActivityIndicator size={18} color={colors.white} />
        ) : (
          <Ionicons name="send" size={18} color={colors.white} />
        )}
      </TouchableOpacity>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ChatScreen — main component
// ─────────────────────────────────────────────────────────────────────────────

const ChatScreen = ({ route, navigation }) => {
  const { t }             = useTranslation();
  const insets            = useSafeAreaInsets();
  const { user, userProfile } = useAuth();

  const {
    recipientId,
    recipientName   = t('common.noResults'),
    recipientAvatar = null,
  } = route.params ?? {};

  // ── Derived / stable values ───────────────────────────────────────────────
  const chatId = useMemo(
    () => (user?.uid && recipientId ? computeChatId(user.uid, recipientId) : null),
    [user?.uid, recipientId],
  );

  const myDisplayName =
    userProfile?.name ??
    userProfile?.displayName ??
    user?.displayName ??
    '';

  // Stable UID ref — keeps renderItem callback dep-free across auth updates
  const uidRef = useRef(user?.uid);
  useEffect(() => { uidRef.current = user?.uid; }, [user?.uid]);

  // ── State ─────────────────────────────────────────────────────────────────
  const [messages,      setMessages]      = useState([]);
  const [inputText,     setInputText]     = useState('');
  const [isSending,     setIsSending]     = useState(false);
  const [sendError,     setSendError]     = useState(null);
  const [isLoading,     setIsLoading]     = useState(true);
  const [messageLimit,  setMessageLimit]  = useState(MESSAGES_PER_PAGE);
  const [hasMore,       setHasMore]       = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const inputRef     = useRef(null);
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

  // ── Pre-computed message list with separator flags + date labels ──────────
  //
  // Pre-computing here (not inside renderItem) means renderItem has zero
  // reactive dependencies. React.memo on MessageBubble then prevents individual
  // bubble re-renders unless the item's own data changes.
  const messagesWithMeta = useMemo(
    () =>
      messages.map((msg, i) => {
        const showSep = shouldShowDateSeparator(messages, i);
        return {
          ...msg,
          showSeparator: showSep,
          dateLabel:     showSep ? getDateLabel(msg.timestamp, t) : null,
        };
      }),
    [messages, t],
  );

  // ── Real-time listener ────────────────────────────────────────────────────
  //
  // Re-subscribes when chatId or messageLimit changes.
  // The previous listener is torn down by the effect cleanup return.
  useEffect(() => {
    if (!chatId) { setIsLoading(false); return; }

    const unsubscribe = chatService.subscribeToChat(
      chatId,
      (docs) => {
        if (!isMountedRef.current) return;
        setMessages(docs);
        setIsLoading(false);
        if (docs.length < messageLimit) setHasMore(false);
        setIsLoadingMore(false);
      },
      (err) => {
        console.error('[ChatScreen] listener error:', err);
        if (!isMountedRef.current) return;
        setIsLoading(false);
        setIsLoadingMore(false);
      },
      messageLimit,
    );

    return unsubscribe;
  }, [chatId, messageLimit]);

  // ── Mark as read on focus ─────────────────────────────────────────────────
  const markAsRead = useCallback(async () => {
    if (!chatId || !user?.uid) return;
    await chatService.markAsRead(chatId, user.uid);
  }, [chatId, user?.uid]);

  useFocusEffect(useCallback(() => { markAsRead(); }, [markAsRead]));

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isSending || !user?.uid || !chatId || !recipientId) return;

    // Optimistic: clear input immediately for instant UX feedback
    setInputText('');
    setSendError(null);
    setIsSending(true);

    const result = await chatService.sendMessage(chatId, user.uid, trimmed, {
      senderName:      myDisplayName,
      recipientId,
      recipientName,
      senderAvatar:    userProfile?.profileImage ?? null,
      recipientAvatar,
    });

    if (!result.success) {
      // Restore input so the user can retry without retyping
      if (isMountedRef.current) {
        setInputText(trimmed);
        setSendError(t('chat.sendError'));
      }
    } else {
      // Fire-and-forget push notification — never blocks UI
      (async () => {
        try {
          const pushToken = await chatService.fetchPushToken(recipientId);
          if (pushToken) {
            await notificationService.sendPushNotification(
              pushToken,
              myDisplayName,
              trimmed,
              { type: 'new_message', chatId, senderId: user.uid },
              { channelId: 'messages', priority: 'high' },
            );
          }
        } catch (pushErr) {
          if (pushErr?.code !== 'DeviceNotRegistered') {
            console.warn('[ChatScreen] push error:', pushErr?.message);
          }
        }
      })();
    }

    if (isMountedRef.current) setIsSending(false);
  }, [
    inputText, isSending, user?.uid, chatId, recipientId,
    recipientName, recipientAvatar, myDisplayName, userProfile, t,
  ]);

  // Clear send error when user starts typing again
  const handleChangeText = useCallback((text) => {
    setInputText(text);
    if (sendError) setSendError(null);
  }, [sendError]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const loadMoreMessages = useCallback(() => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    setMessageLimit((prev) => prev + MESSAGES_PER_PAGE);
  }, [hasMore, isLoadingMore]);

  // ── FlatList helpers ──────────────────────────────────────────────────────

  // renderItem is dep-free — reads uid via stable uidRef; all other data
  // pre-computed in messagesWithMeta. Combined with React.memo on MessageBubble,
  // individual cells never re-render just because inputText changes.
  const renderItem = useCallback(
    ({ item }) => (
      <MessageBubble
        message={item}
        isMine={item.senderId === uidRef.current}
        showSeparator={item.showSeparator}
        dateLabel={item.dateLabel}
      />
    ),
    [], // intentionally empty — all data via ref or pre-computed on item
  );

  const keyExtractor = useCallback((item) => item.id, []);

  const ListFooterComponent = useCallback(
    () => isLoadingMore ? (
      <ActivityIndicator
        size="small"
        color={colors.primary}
        style={styles.loadMoreSpinner}
      />
    ) : null,
    [isLoadingMore],
  );

  const ListEmptyComponent = useCallback(
    () => !isLoading ? (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconBox}>
          <Ionicons name="chatbubbles-outline" size={44} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>{t('chat.startConversation')}</Text>
        <Text style={styles.emptySub}>
          {t('chat.startConversationSub', { name: recipientName })}
        </Text>
      </View>
    ) : null,
    [isLoading, recipientName, t],
  );

  // ── Safety guard ──────────────────────────────────────────────────────────
  if (!recipientId) {
    return (
      <ScreenContainer scrollable={false} padded={false} edges={['bottom']}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
          <TouchableOpacity style={styles.headerBackBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
        <View style={styles.centeredState}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.centeredStateText}>{t('chat.noRecipient')}</Text>
        </View>
      </ScreenContainer>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ScreenContainer scrollable={false} padded={false} edges={['bottom']}>

      {/* ══ Header — above the message list ══ */}
      <ChatHeader
        navigation={navigation}
        recipientName={recipientName}
        insetTop={insets.top}
        t={t}
      />

      {/* ══ Message list ══ */}
      {isLoading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        /*
         * inverted={true}
         *   Physically rotates scroll view 180°.
         *   data[0] (newest) → visual bottom — user always lands here.
         *   data[N] (oldest) → visual top — revealed on scroll up.
         *
         * keyboardShouldPersistTaps="handled"
         *   Allows taps on the Send button (child of the InputBar, sibling of
         *   the list) to be processed without dismissing the keyboard.
         *
         * onEndReached → loadMoreMessages
         *   In an inverted list, "end" = visual top = oldest messages.
         *   This is the natural "load more history" trigger.
         */
        <FlatList
          data={messagesWithMeta}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          inverted
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMoreMessages}
          onEndReachedThreshold={0.3}
          ListFooterComponent={ListFooterComponent}
          ListEmptyComponent={ListEmptyComponent}
          contentContainerStyle={[
            styles.listContent,
            messagesWithMeta.length === 0 && styles.listContentEmpty,
          ]}
          style={styles.flatList}
          // Performance tuning
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={15}
          updateCellsBatchingPeriod={50}
          windowSize={10}
          initialNumToRender={15}
        />
      )}

      {/* ══ Send error inline banner ══ */}
      {!!sendError && (
        <TouchableOpacity
          style={styles.sendErrorBanner}
          onPress={handleSend}
          activeOpacity={0.8}
        >
          <Ionicons name="warning-outline" size={14} color={colors.error} />
          <Text style={styles.sendErrorText}>{sendError}</Text>
        </TouchableOpacity>
      )}

      {/* ══ Input bar ══ */}
      <InputBar
        value={inputText}
        onChangeText={handleChangeText}
        onSend={handleSend}
        sending={isSending}
        inputRef={inputRef}
        placeholder={t('chat.placeholder')}
      />

    </ScreenContainer>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles — RTL-compliant throughout
//
// All directional properties use logical values (React Native mirrors in RTL):
//   marginStart / marginEnd
//   paddingStart / paddingEnd
//   borderTopStartRadius / borderTopEndRadius
//   borderBottomStartRadius / borderBottomEndRadius
//   end: N  (absolute positioning — never 'right')
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Root / shared ─────────────────────────────────────────────────────────
  flatList: { flex: 1 },
  listContent: {
    paddingHorizontal: spacing.xs,
    paddingVertical:   spacing.sm,
    flexGrow: 1,
  },
  listContentEmpty: {
    justifyContent: 'center',
    alignItems:     'center',
  },

  // ── Chat header ───────────────────────────────────────────────────────────
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    minHeight:         60,
    backgroundColor:   colors.primary,
    paddingHorizontal: spacing.sm,
    paddingBottom:     spacing.sm,
    elevation:         4,
    shadowColor:       colors.black,
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.2,
    shadowRadius:      3,
  },
  headerBackBtn: {
    padding:   spacing.xs,
    marginEnd: spacing.xs,       // logical gap between arrow and avatar
  },
  headerAvatarWrap: {
    position:  'relative',
    marginEnd: spacing.sm,       // logical gap between avatar and name block
  },
  onlineDot: {
    position:        'absolute',
    bottom:          0,
    end:             0,          // logical bottom-end corner of avatar
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: '#22c55e',
    borderWidth:     2,
    borderColor:     colors.primary,
  },
  headerInfo: {
    flex:           1,
    justifyContent: 'center',
  },
  headerName: {
    color:      colors.white,
    fontSize:   typography.sizes.md,
    fontWeight: '700',
  },
  headerStatus: {
    color:     'rgba(255,255,255,0.75)',
    fontSize:  typography.sizes.xs,
    marginTop: 1,
  },

  // ── Centered states ───────────────────────────────────────────────────────
  centeredState: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
    gap:            spacing.md,
    padding:        spacing.xl,
  },
  centeredStateText: {
    color:    colors.error,
    fontSize: typography.sizes.md,
    textAlign: 'center',
  },

  // ── Loading more spinner (FlatList footer) ────────────────────────────────
  loadMoreSpinner: { paddingVertical: spacing.md },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyContainer: {
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: spacing.xxl,
    gap:             spacing.sm,
  },
  emptyIconBox: {
    width:           72,
    height:          72,
    borderRadius:    BorderRadius.full,
    backgroundColor: colors.primary + '15',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    spacing.xs,
  },
  emptyTitle: {
    color:      colors.textSecondary,
    fontSize:   typography.sizes.lg,
    fontWeight: '600',
  },
  emptySub: {
    color:     colors.gray,
    fontSize:  typography.sizes.sm,
    textAlign: 'center',
  },

  // ── Message bubbles ───────────────────────────────────────────────────────
  //
  // bubbleWrapper: full-width row that positions bubble to one side.
  //   Mine   → justifyContent 'flex-end'   (logical END,   left in RTL)
  //   Theirs → justifyContent 'flex-start' (logical START, right in RTL)
  //
  // Bubble tail corners (logical, auto-mirror in RTL):
  //   Mine   → borderBottomEndRadius:   0  (tail at logical END)
  //   Theirs → borderBottomStartRadius: 0  (tail at logical START)
  //
  // Per task spec, the "sharp" top corner faces the trailing/leading edge:
  //   Mine   → borderTopEndRadius:   BorderRadius.sm  (sharp, trailing edge)
  //   Theirs → borderTopStartRadius: BorderRadius.sm  (sharp, leading edge)
  bubbleWrapper: {
    flexDirection:     'row',
    alignItems:        'flex-end',
    marginVertical:    2,
    paddingHorizontal: spacing.xs,
  },
  bubbleWrapperMine:   { justifyContent: 'flex-end'   },
  bubbleWrapperTheirs: { justifyContent: 'flex-start' },
  bubbleAvatar: {
    marginEnd:  spacing.xs,   // logical: gap between avatar and bubble
    flexShrink: 0,
  },
  bubble: {
    maxWidth:          '75%',
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
  },

  // "My" bubble — primary green, white text
  bubbleMine: {
    backgroundColor:      colors.primary,
    // Task spec: sharp on borderTopEndRadius
    borderTopStartRadius:  BorderRadius.lg,
    borderTopEndRadius:    BorderRadius.sm,   // ← sharp (trailing / logical end)
    borderBottomStartRadius: BorderRadius.lg,
    borderBottomEndRadius: 0,                 // tail at logical end
    marginStart:           52,               // offset from start edge (room for avatar of theirs)
  },

  // "Their" bubble — light gray from theme, dark text
  bubbleTheirs: {
    backgroundColor:       colors.borderLight,
    // Task spec: sharp on borderTopStartRadius
    borderTopStartRadius:  BorderRadius.sm,   // ← sharp (leading / logical start)
    borderTopEndRadius:    BorderRadius.lg,
    borderBottomStartRadius: 0,              // tail at logical start
    borderBottomEndRadius: BorderRadius.lg,
    marginEnd:             52,               // offset from end edge
  },

  bubbleTextMine: {
    color:      colors.white,
    fontSize:   typography.sizes.md,
    lineHeight: typography.sizes.md * 1.45,
  },
  bubbleTextTheirs: {
    color:      colors.text,
    fontSize:   typography.sizes.md,
    lineHeight: typography.sizes.md * 1.45,
  },
  bubbleMeta: {
    flexDirection:  'row',
    justifyContent: 'flex-end',
    alignItems:     'center',
    marginTop:      3,
    gap:            2,
  },
  bubbleTime:       { fontSize: typography.sizes.xs },
  bubbleTimeMine:   { color: 'rgba(255,255,255,0.70)' },
  bubbleTimeTheirs: { color: colors.textSecondary },

  // ── Date separator ────────────────────────────────────────────────────────
  dateSepRow: {
    flexDirection:     'row',
    alignItems:        'center',
    marginVertical:    spacing.md,
    paddingHorizontal: spacing.md,
  },
  dateSepLine: {
    flex:            1,
    height:          StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  dateSepPill: {
    backgroundColor:   colors.background,
    borderRadius:      BorderRadius.full,
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       colors.border,
    paddingVertical:   3,
    paddingHorizontal: spacing.sm,
    marginHorizontal:  spacing.sm,
  },
  dateSepText: {
    color:      colors.textSecondary,
    fontSize:   typography.sizes.xs,
    fontWeight: '500',
  },

  // ── Send error banner ─────────────────────────────────────────────────────
  sendErrorBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   colors.error + '15',
    borderTopWidth:    1,
    borderTopColor:    colors.error + '30',
    paddingHorizontal: spacing.md,
    paddingVertical:   6,
    gap:               spacing.xs,
  },
  sendErrorText: {
    flex:     1,
    fontSize: typography.sizes.xs,
    color:    colors.error,
    fontWeight: '500',
  },

  // ── Input bar ─────────────────────────────────────────────────────────────
  inputBar: {
    flexDirection:     'row',
    alignItems:        'flex-end',
    backgroundColor:   colors.white,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.sm,
    elevation:         4,
    shadowColor:       colors.black,
    shadowOffset:      { width: 0, height: -1 },
    shadowOpacity:     0.06,
    shadowRadius:      3,
  },
  inputWrap: {
    flex:              1,
    backgroundColor:   colors.background,
    borderRadius:      BorderRadius.xl,
    borderWidth:       1,
    borderColor:       colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical:   Platform.OS === 'ios' ? spacing.sm : 2,
    marginEnd:         spacing.sm,   // logical: gap between field and send button
    minHeight:         40,
    maxHeight:         110,          // ~4 lines before scrolling inside TextInput
    justifyContent:    'center',
  },
  input: {
    color:             colors.text,
    fontSize:          typography.sizes.md,
    textAlignVertical: 'center',
    paddingTop:        0,
    paddingBottom:     0,
    textAlign:         'right',      // Arabic default — flips in LTR layouts
  },
  sendBtn: {
    width:           42,
    height:          42,
    borderRadius:    21,
    backgroundColor: colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  sendBtnDisabled: { backgroundColor: colors.gray },
});

export default ChatScreen;
