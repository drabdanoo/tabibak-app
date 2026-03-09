/**
 * ChatScreen.js — Real-Time 1-on-1 Messaging (Phase 5)
 *
 * ╔══ ARCHITECTURE NOTES ═══════════════════════════════════════════════════════╗
 *
 * 1. INVERTED FLATLIST — why it works perfectly for chat
 * ────────────────────────────────────────────────────────
 *   React Native's FlatList with inverted={true} physically rotates the scroll
 *   view 180°. The practical effect: data[0] of the array appears at the BOTTOM
 *   of the screen, and data[N-1] appears at the TOP.
 *
 *   Firestore query: orderBy('timestamp', 'desc') → data is [newest, ..., oldest].
 *   After inversion: newest = bottom, oldest = top. No manual reversal needed.
 *
 *   • The list never needs programmatic scrollToBottom — new messages arrive at
 *     index 0, which is always the visual bottom. The user sees them immediately.
 *   • onEndReached fires when the user scrolls to data[N-1] (oldest, visual top).
 *     This is the natural "load more history" trigger.
 *   • Date separators are rendered inside each message item. Because the list is
 *     physically flipped, a separator placed "below" the bubble in JSX appears
 *     "above" it on screen — between the older and newer message groups.
 *
 * 2. KEYBOARD AVOIDANCE
 * ───────────────────────
 *   The ChatHeader lives OUTSIDE the KeyboardAvoidingView so it never shifts
 *   when the keyboard slides up. KAV wraps only the FlatList + InputBar.
 *
 *     iOS:     behavior="padding" — KAV adds bottom padding = keyboard height,
 *              which compresses the FlatList and keeps InputBar above the keyboard.
 *     Android: behavior={undefined} — the OS handles it via windowSoftInputMode
 *              adjustResize; no KAV manipulation needed.
 *
 *   keyboardShouldPersistTaps="handled" on the FlatList ensures the keyboard
 *   stays open when the user taps the Send button (sibling of the list). Without
 *   this, the list's gesture responder would dismiss the keyboard on any tap.
 *
 * 3. PUSH NOTIFICATION HOOKUP
 * ────────────────────────────
 *   After every successful Firestore write, sendMessage dispatches a push
 *   notification to the recipient in a fire-and-forget IIFE (never blocks UI):
 *
 *     • Reads users/{recipientId}.pushToken (the fast-lookup field written by
 *       notificationService.registerDeviceToken and syncTokenToUserDocument).
 *     • Calls notificationService.sendPushNotification(token, title, body, data)
 *       with channelId: 'messages' (matches the 'messages' Android channel
 *       declared in usePushNotifications.js and notificationService.js).
 *     • DeviceNotRegistered errors are caught and logged but never shown to user.
 *
 *   data payload: { type: 'new_message', chatId, senderId }
 *   → Add 'new_message' → 'Chat' entry to AppNavigator's ROUTE_MAP once a
 *     dedicated Chat tab / shared entry point exists in the tab navigators.
 *
 * 4. FIRESTORE DATA MODEL
 * ─────────────────────────
 *   chats/{chatId}                               ← metadata document
 *     participants:        [uid1, uid2]
 *     lastMessage:         string
 *     lastMessageTime:     Timestamp
 *     lastMessageSenderId: uid
 *     unreadCounts:        { [uid1]: 0, [uid2]: N }
 *     participantInfo:     { [uid1]: { name, avatar }, [uid2]: { name, avatar } }
 *
 *   chats/{chatId}/messages/{messageId}          ← per-message sub-documents
 *     text:       string
 *     senderId:   uid
 *     senderName: string
 *     timestamp:  Timestamp  (serverTimestamp on write)
 *     read:       boolean
 *
 *   chatId is deterministic: [uid1, uid2].sort().join('_')
 *   Both participants always reference the same Firestore path, with no server
 *   coordination or chatId exchange required.
 *
 * 5. PAGINATION STRATEGY
 * ────────────────────────
 *   messageLimit state starts at MESSAGES_PER_PAGE (30).
 *   onEndReached → increments messageLimit by 30.
 *   The onSnapshot useEffect has [chatId, messageLimit] in its dep array, so
 *   the listener re-subscribes with the enlarged limit. The previous listener
 *   is torn down via the effect cleanup return. React Native re-renders only
 *   the newly loaded items (memoized MessageBubble prevents re-renders of
 *   previously loaded bubbles).
 *
 * 6. RENDERITEM PERFORMANCE
 * ──────────────────────────
 *   Date-separator flags are pre-computed in useMemo([messages]) and attached
 *   to each item as item.showSeparator. This keeps the renderItem callback
 *   dependency-free (it reads uid via a stable ref), so it is never recreated
 *   between renders. Combined with React.memo on MessageBubble, individual
 *   bubbles only re-render when their own message data changes.
 *
 * 7. RTL COMPLIANCE (master rule)
 * ─────────────────────────────────
 *   All directional style properties use CSS logical equivalents:
 *     marginStart / marginEnd           → never physical left/right margin
 *     paddingStart / paddingEnd         → never physical left/right padding
 *     borderTopStartRadius / EndRadius
 *     borderBottomStartRadius / EndRadius
 *     end: N  (not right: N for absolute positioning)
 *
 *   Bubble alignment uses cross-axis flexbox (alignSelf: flex-end / flex-start)
 *   which React Native automatically mirrors in RTL layout.
 *
 *   "My" bubble tail:    borderBottomEndRadius: 0   → pointed at logical END
 *   "Their" bubble tail: borderBottomStartRadius: 0  → pointed at logical START
 *
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Route params expected:
 *   recipientId:     string  — other user's Firebase UID (required)
 *   recipientName:   string  — display name shown in header
 *   recipientAvatar: string? — photo URL (optional; falls back to initials)
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
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getFirestore,
  doc,
  collection,
  addDoc,
  setDoc,
  updateDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

import { useAuth }         from '../../contexts/AuthContext';
import { COLLECTIONS }     from '../../config/firebase';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSizes,
}                          from '../../config/theme';
import notificationService from '../../services/notificationService';

// ─────────────────────────────────────────────────────────────────────────────
// Module constants
// ─────────────────────────────────────────────────────────────────────────────
const CHAT_COLLECTION    = 'chats';
const MESSAGE_COLLECTION = 'messages';
const MESSAGES_PER_PAGE  = 30;

// ─────────────────────────────────────────────────────────────────────────────
// computeChatId
//
// Deterministic chat ID from two user UIDs. Sorting guarantees both users
// compute the same ID regardless of which side initiates the conversation.
// ─────────────────────────────────────────────────────────────────────────────
export function computeChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Firestore Timestamp | Date | null → 'HH:MM' (24h) */
function formatTime(timestamp) {
  if (!timestamp) return '';
  const date =
    typeof timestamp.toDate === 'function'
      ? timestamp.toDate()
      : new Date(timestamp);
  return date.toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

/** Firestore Timestamp → Arabic date label for the day separator pill */
function formatDateSeparator(timestamp) {
  if (!timestamp) return '';
  const date =
    typeof timestamp.toDate === 'function'
      ? timestamp.toDate()
      : new Date(timestamp);

  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString())     return 'اليوم';    // Today
  if (date.toDateString() === yesterday.toDateString()) return 'أمس';     // Yesterday
  return date.toLocaleDateString('ar-SA', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/**
 * shouldShowDateSeparator
 *
 * Called during the useMemo pass that attaches metadata to each message.
 * Data is ordered DESC (newest first), so messages[index + 1] is the
 * OLDER neighbour. We show a separator when two adjacent items are on
 * different calendar days, and always above the oldest loaded message.
 *
 * The separator is rendered BELOW the bubble in JSX. Because the FlatList
 * is inverted (physically flipped), "below in JSX" = "above on screen".
 */
function shouldShowDateSeparator(messages, index) {
  // Always show a separator above the oldest loaded message
  if (index === messages.length - 1) return true;

  const current = messages[index];
  const older   = messages[index + 1]; // next index = one step older (DESC order)

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
// Avatar — circular icon: initials on a colored circle
// ─────────────────────────────────────────────────────────────────────────────
const Avatar = memo(({ name = '', size = 36, style }) => {
  const radius = size / 2;
  return (
    <View
      style={[
        {
          width:           size,
          height:          size,
          borderRadius:    radius,
          backgroundColor: Colors.primaryDark,
          alignItems:      'center',
          justifyContent:  'center',
        },
        style,
      ]}
    >
      <Text
        style={{
          color:      Colors.white,
          fontSize:   size * 0.38,
          fontWeight: '700',
          lineHeight: size * 0.48,
        }}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
});

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
// DateSeparator — pill with horizontal lines on each side
// ─────────────────────────────────────────────────────────────────────────────
const DateSeparator = memo(({ timestamp }) => (
  <View style={styles.dateSepRow}>
    <View style={styles.dateSepLine} />
    <View style={styles.dateSepPill}>
      <Text style={styles.dateSepText}>{formatDateSeparator(timestamp)}</Text>
    </View>
    <View style={styles.dateSepLine} />
  </View>
));

// ─────────────────────────────────────────────────────────────────────────────
// MessageBubble
//
// React.memo prevents re-renders unless the message object or isMine changes.
// showSeparator is pre-computed outside renderItem (see messagesWithMeta useMemo)
// so this component's prop surface is fully stable between snapshot updates.
//
// RTL bubble tails:
//   "My"    → borderBottomEndRadius: 0   (tail at logical END, right in LTR)
//   "Their" → borderBottomStartRadius: 0 (tail at logical START, left in LTR)
// In RTL layout React Native automatically mirrors the logical sides.
// ─────────────────────────────────────────────────────────────────────────────
const MessageBubble = memo(({ message, isMine, showSeparator }) => {
  const timeStr = formatTime(message.timestamp);
  // Optimistic: timestamp is null while serverTimestamp is pending
  const isPending = !message.timestamp;

  return (
    <>
      {/*
        * Date separator — rendered BELOW the bubble in JSX but appears ABOVE
        * it on screen because the parent FlatList is physically inverted.
        * This places "Today", "Yesterday", etc. between message groups visually.
        */}
      {showSeparator && <DateSeparator timestamp={message.timestamp} />}

      <View
        style={[
          styles.bubbleWrapper,
          isMine ? styles.bubbleWrapperMine : styles.bubbleWrapperTheirs,
        ]}
      >
        {/* Avatar shown only for incoming (their) messages */}
        {!isMine && (
          <Avatar
            name={message.senderName}
            size={28}
            style={styles.bubbleAvatar}
          />
        )}

        <View
          style={[
            styles.bubble,
            isMine ? styles.bubbleMine : styles.bubbleTheirs,
          ]}
        >
          {/* Message text */}
          <Text style={isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>
            {message.text}
          </Text>

          {/* Meta row: time + read receipt */}
          <View style={styles.bubbleMeta}>
            {isPending ? (
              <ActivityIndicator size={9} color="rgba(255,255,255,0.55)" />
            ) : (
              <Text
                style={[
                  styles.bubbleTime,
                  isMine
                    ? styles.bubbleTimeMine
                    : styles.bubbleTimeTheirs,
                ]}
              >
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
// Lives OUTSIDE the KeyboardAvoidingView so it never shifts when the
// keyboard appears. Uses primary green background matching the app theme.
// ─────────────────────────────────────────────────────────────────────────────
const ChatHeader = memo(({ navigation, recipientName }) => (
  <View style={styles.header}>
    <StatusBar backgroundColor={Colors.primaryDark} barStyle="light-content" />

    {/* Back button — adaptive icon per platform */}
    <TouchableOpacity
      style={styles.headerBackBtn}
      onPress={() => navigation.goBack()}
      hitSlop={{ top: 12, bottom: 12, start: 12, end: 12 }}
      accessibilityLabel="رجوع"
      accessibilityRole="button"
    >
      <Ionicons
        name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
        size={24}
        color={Colors.white}
      />
    </TouchableOpacity>

    {/* Avatar + online indicator */}
    <View style={styles.headerAvatarWrap}>
      <Avatar name={recipientName} size={38} />
      <View style={styles.onlineDot} />
    </View>

    {/* Recipient name + status */}
    <View style={styles.headerInfo}>
      <Text style={styles.headerName} numberOfLines={1}>
        {recipientName}
      </Text>
      <Text style={styles.headerStatus}>متاح الآن</Text>
    </View>
  </View>
));

// ─────────────────────────────────────────────────────────────────────────────
// InputBar
//
// Multiline TextInput that grows up to 4 lines + a circular Send button.
// Sits at the bottom of KeyboardAvoidingView so it rides up with the keyboard.
// The Send button does NOT dismiss the keyboard (keyboardShouldPersistTaps
// on the sibling FlatList handles this).
// ─────────────────────────────────────────────────────────────────────────────
const InputBar = memo(({ value, onChangeText, onSend, sending, inputRef }) => {
  const canSend = value.trim().length > 0 && !sending;

  return (
    <View style={styles.inputBar}>
      {/* Text field */}
      <View style={styles.inputWrap}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder="اكتب رسالة..."
          placeholderTextColor={Colors.gray}
          multiline
          maxLength={2000}
          returnKeyType="default"
          blurOnSubmit={false}
          textAlignVertical="center"
          accessibilityLabel="حقل الرسالة"
          accessibilityHint="اكتب رسالتك هنا"
        />
      </View>

      {/* Send button */}
      <TouchableOpacity
        style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
        onPress={onSend}
        disabled={!canSend}
        accessibilityLabel="إرسال الرسالة"
        accessibilityRole="button"
      >
        {sending ? (
          <ActivityIndicator size={18} color={Colors.white} />
        ) : (
          <Ionicons name="send" size={18} color={Colors.white} />
        )}
      </TouchableOpacity>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ChatScreen — main component
// ─────────────────────────────────────────────────────────────────────────────
const ChatScreen = ({ route, navigation }) => {
  const { user, userProfile } = useAuth();

  const {
    recipientId,
    recipientName   = 'مجهول',
    recipientAvatar = null,
  } = route.params ?? {};

  // ── Derived / stable values ─────────────────────────────────────────────
  const chatId = useMemo(
    () =>
      user?.uid && recipientId
        ? computeChatId(user.uid, recipientId)
        : null,
    [user?.uid, recipientId],
  );

  const myDisplayName =
    userProfile?.name ??
    userProfile?.displayName ??
    user?.displayName ??
    'مستخدم';

  // Stable UID ref — keeps renderItem callback dep-free across auth updates
  const uidRef = useRef(user?.uid);
  useEffect(() => { uidRef.current = user?.uid; }, [user?.uid]);

  // ── State ────────────────────────────────────────────────────────────────
  const [messages,      setMessages]      = useState([]);
  const [inputText,     setInputText]     = useState('');
  const [isSending,     setIsSending]     = useState(false);
  const [isLoading,     setIsLoading]     = useState(true);
  const [messageLimit,  setMessageLimit]  = useState(MESSAGES_PER_PAGE);
  const [hasMore,       setHasMore]       = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const inputRef     = useRef(null);
  const isMountedRef = useRef(true);

  // ── Derived data: messages with pre-computed separator flags ─────────────
  //
  // Pre-computing showSeparator here (not inside renderItem) means renderItem
  // has zero dependencies — it reads uid via the stable uidRef — and is never
  // recreated. React.memo on MessageBubble prevents individual bubble re-renders
  // unless the item's own data changes.
  const messagesWithMeta = useMemo(
    () =>
      messages.map((msg, i) => ({
        ...msg,
        showSeparator: shouldShowDateSeparator(messages, i),
      })),
    [messages],
  );

  // ── onSnapshot listener ──────────────────────────────────────────────────
  //
  // Dep array: [chatId, messageLimit]
  //   chatId change      → re-subscribe to a different conversation
  //   messageLimit change → re-subscribe with a larger window (pagination)
  //
  // The previous listener is safely torn down by the effect cleanup return.
  useEffect(() => {
    if (!chatId) return;

    const db          = getFirestore();
    const messagesRef = collection(db, CHAT_COLLECTION, chatId, MESSAGE_COLLECTION);
    const q           = query(
      messagesRef,
      orderBy('timestamp', 'desc'),
      limit(messageLimit),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!isMountedRef.current) return;

        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMessages(docs);
        setIsLoading(false);

        // If we received fewer docs than the limit, all history is loaded
        if (docs.length < messageLimit) setHasMore(false);
        setIsLoadingMore(false);
      },
      (err) => {
        if (!isMountedRef.current) return;
        console.error('[ChatScreen] onSnapshot error:', err);
        setIsLoading(false);
        setIsLoadingMore(false);
      },
    );

    return unsubscribe; // previous Firestore listener torn down on dep change
  }, [chatId, messageLimit]);

  // ── Mark messages as read (clear unread counter for current user) ────────
  const markAsRead = useCallback(async () => {
    if (!chatId || !user?.uid) return;
    try {
      const db = getFirestore();
      // updateDoc with dot-notation path updates only the nested field,
      // leaving all other unreadCounts entries (other UIDs) intact.
      await updateDoc(doc(db, CHAT_COLLECTION, chatId), {
        [`unreadCounts.${user.uid}`]: 0,
      });
    } catch {
      // Chat document may not exist yet (no messages sent).
      // updateDoc throws on missing doc — silently ignore.
    }
  }, [chatId, user?.uid]);

  // Re-runs markAsRead every time the screen gains focus (back from another
  // screen, returning from background, etc.)
  useFocusEffect(
    useCallback(() => {
      markAsRead();
    }, [markAsRead]),
  );

  // Cleanup: prevent setState calls after unmount
  useEffect(() => () => { isMountedRef.current = false; }, []);

  // ── sendMessage ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const trimmedText = inputText.trim();
    if (!trimmedText || isSending || !user?.uid || !chatId || !recipientId) return;

    // Optimistic: clear input immediately for instant UX feedback
    setInputText('');
    setIsSending(true);

    const db          = getFirestore();
    const messagesRef = collection(db, CHAT_COLLECTION, chatId, MESSAGE_COLLECTION);
    const chatRef     = doc(db, CHAT_COLLECTION, chatId);

    try {
      // ── Step 1: Write the message to the subcollection ─────────────────
      await addDoc(messagesRef, {
        text:       trimmedText,
        senderId:   user.uid,
        senderName: myDisplayName,
        timestamp:  serverTimestamp(),
        read:       false,
      });

      // ── Step 2: Update chat metadata (setDoc + merge = create-or-update) ─
      // increment(1) is atomic: no race condition between concurrent writers.
      await setDoc(
        chatRef,
        {
          participants:        [user.uid, recipientId],
          lastMessage:         trimmedText,
          lastMessageTime:     serverTimestamp(),
          lastMessageSenderId: user.uid,
          unreadCounts: {
            [recipientId]: increment(1), // recipient's unread count increments
            [user.uid]:    0,            // sender's unread stays 0
          },
          participantInfo: {
            [user.uid]: {
              name:   myDisplayName,
              avatar: userProfile?.profileImage ?? null,
            },
            [recipientId]: {
              name:   recipientName,
              avatar: recipientAvatar,
            },
          },
        },
        { merge: true }, // never clobber unrelated fields
      );

      // ── Step 3: Push notification to recipient (fire-and-forget) ────────
      //
      // Wrapped in an immediately-invoked async function so it NEVER blocks
      // the "message sent" confirmation visible to the sender. Push delivery
      // failure is non-fatal and transparent to the UI.
      //
      // Token lookup: reads users/{recipientId}.pushToken — the fast-lookup
      // field maintained by notificationService.registerDeviceToken and
      // syncTokenToUserDocument.
      //
      // channelId: 'messages' — matches the 'messages' Android notification
      // channel registered in usePushNotifications.js ANDROID_CHANNELS.
      (async () => {
        try {
          const recipientSnap = await getDoc(
            doc(db, COLLECTIONS.USERS, recipientId),
          );
          const pushToken = recipientSnap.data()?.pushToken;

          if (pushToken) {
            await notificationService.sendPushNotification(
              pushToken,
              myDisplayName,           // notification title = sender's name
              trimmedText,             // notification body  = message text
              {
                type:     'new_message',
                chatId,
                senderId: user.uid,
              },
              {
                channelId: 'messages', // Android channel for chat notifications
                priority:  'high',     // wake screen / heads-up notification
              },
            );
          }
        } catch (pushErr) {
          if (pushErr?.code === 'DeviceNotRegistered') {
            // Token is stale — will be refreshed on recipient's next login
            console.warn(
              '[ChatScreen] Stale push token for recipient:', recipientId,
            );
          } else {
            console.warn(
              '[ChatScreen] Push notification error:', pushErr?.message,
            );
          }
        }
      })();

    } catch (err) {
      // Restore input text so the user can retry without retyping
      if (isMountedRef.current) setInputText(trimmedText);
      console.error('[ChatScreen] sendMessage error:', err);
    } finally {
      if (isMountedRef.current) setIsSending(false);
    }
  }, [
    inputText, isSending, user?.uid, chatId, recipientId,
    recipientName, recipientAvatar, myDisplayName, userProfile,
  ]);

  // ── Pagination ───────────────────────────────────────────────────────────
  //
  // onEndReached fires when the user scrolls to the oldest visible message
  // (visual top of the inverted list = data array end). Incrementing the
  // limit triggers the useEffect to re-subscribe with a larger Firestore query.
  const loadMoreMessages = useCallback(() => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    setMessageLimit((prev) => prev + MESSAGES_PER_PAGE);
  }, [hasMore, isLoadingMore]);

  // ── FlatList renderItem — dependency-free, fully stable ─────────────────
  //
  // Reads uid via uidRef (stable ref) so this callback is never recreated.
  // showSeparator is pre-computed on each item in messagesWithMeta.
  const renderItem = useCallback(
    ({ item }) => (
      <MessageBubble
        message={item}
        isMine={item.senderId === uidRef.current}
        showSeparator={item.showSeparator}
      />
    ),
    [], // intentionally empty — all data read via refs or pre-computed in item
  );

  const keyExtractor = useCallback((item) => item.id, []);

  const ListFooterComponent = useCallback(
    () =>
      isLoadingMore ? (
        <ActivityIndicator
          size="small"
          color={Colors.primary}
          style={styles.loadMoreSpinner}
        />
      ) : null,
    [isLoadingMore],
  );

  const ListEmptyComponent = useCallback(
    () =>
      !isLoading ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={60} color={Colors.border} />
          <Text style={styles.emptyTitle}>ابدأ المحادثة</Text>
          <Text style={styles.emptySubtitle}>
            أرسل رسالة لـ {recipientName}
          </Text>
        </View>
      ) : null,
    [isLoading, recipientName],
  );

  // ── Safety guard: recipientId is required ────────────────────────────────
  if (!recipientId) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
        <Text style={styles.errorText}>خطأ: لم يتم تحديد المستخدم</Text>
      </View>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/*
        * ChatHeader is OUTSIDE KeyboardAvoidingView.
        * It remains fixed at the top and never shifts when the keyboard appears.
        * The KAV only controls the FlatList + InputBar region below.
        */}
      <ChatHeader
        navigation={navigation}
        recipientName={recipientName}
        recipientAvatar={recipientAvatar}
      />

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        // keyboardVerticalOffset is 0 because the header is outside the KAV.
        // If you use the native stack header, set this to the header height.
      >
        {/* Initial loading spinner */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          /*
           * FlatList — the core of the chat UI
           *
           * inverted={true}
           *   Physically rotates the scroll view 180°.
           *   data[0] (newest) → visual bottom    ← user always lands here
           *   data[N] (oldest) → visual top       ← revealed on scroll up
           *
           * keyboardShouldPersistTaps="handled"
           *   Allows touches that land on interactive children (Send button)
           *   to be processed without dismissing the keyboard. Without this,
           *   tapping outside the TextInput (but inside the list area) would
           *   dismiss the keyboard and the user would lose focus.
           *
           * onEndReached → loadMoreMessages (at visual top = oldest messages)
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
            // Performance tuning
            removeClippedSubviews={Platform.OS === 'android'}
            maxToRenderPerBatch={15}
            updateCellsBatchingPeriod={50}
            windowSize={10}
            initialNumToRender={15}
            style={styles.flatList}
          />
        )}

        {/*
          * InputBar sits at the bottom of the KAV region.
          * On iOS with behavior="padding", the KAV adds bottom padding equal
          * to the keyboard height → the InputBar rides up with the keyboard.
          * On Android, the OS shrinks the window → same visual result.
          */}
        <InputBar
          value={inputText}
          onChangeText={setInputText}
          onSend={sendMessage}
          sending={isSending}
          inputRef={inputRef}
        />
      </KeyboardAvoidingView>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles — RTL-compliant throughout
//
// All directional properties use logical values (RTL mirrors automatically):
//   marginStart, marginEnd, paddingStart, paddingEnd
//   borderTopStartRadius, borderTopEndRadius
//   borderBottomStartRadius, borderBottomEndRadius
//   end: N  (absolute positioning — never 'right')
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  // ── Root layout ────────────────────────────────────────────────────────────
  root: {
    flex:            1,
    backgroundColor: Colors.background,
  },
  flex1: {
    flex: 1,
  },
  flatList: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.xs,
    paddingVertical:   Spacing.sm,
    flexGrow:          1,       // needed for ListEmptyComponent to fill space
  },
  listContentEmpty: {
    justifyContent: 'center',
    alignItems:     'center',
  },

  // ── Chat header ─────────────────────────────────────────────────────────────
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    height:           60,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    // Shadow (iOS) + elevation (Android)
    elevation:    4,
    shadowColor:  Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius:  3,
  },
  headerBackBtn: {
    padding:   Spacing.xs,
    marginEnd: Spacing.xs,      // logical: space between arrow and avatar
  },
  headerAvatarWrap: {
    position:  'relative',
    marginEnd: Spacing.sm,      // logical: space between avatar and text
  },
  onlineDot: {
    position:        'absolute',
    bottom:           0,
    end:              0,                // logical: bottom-end corner of avatar
    width:            10,
    height:           10,
    borderRadius:     5,
    backgroundColor: '#22c55e',        // green online indicator
    borderWidth:      2,
    borderColor:      Colors.primary,  // matches header background
  },
  headerInfo: {
    flex:           1,
    justifyContent: 'center',
  },
  headerName: {
    color:      Colors.white,
    fontSize:   FontSizes.md,
    fontWeight: '700',
  },
  headerStatus: {
    color:     'rgba(255,255,255,0.75)',
    fontSize:  FontSizes.xs,
    marginTop: 1,
  },

  // ── Loading and empty states ────────────────────────────────────────────────
  loadingContainer: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
  },
  loadMoreSpinner: {
    paddingVertical: Spacing.md,
  },
  emptyContainer: {
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    gap:             Spacing.sm,
  },
  emptyTitle: {
    color:      Colors.textSecondary,
    fontSize:   FontSizes.lg,
    fontWeight: '600',
    marginTop:  Spacing.sm,
  },
  emptySubtitle: {
    color:    Colors.gray,
    fontSize: FontSizes.sm,
  },
  errorContainer: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
    gap:            Spacing.sm,
    padding:        Spacing.xl,
  },
  errorText: {
    color:    Colors.error,
    fontSize: FontSizes.md,
    textAlign: 'center',
  },

  // ── Message bubbles ─────────────────────────────────────────────────────────
  //
  // bubbleWrapper: a full-width flex-row that justifies the bubble to one side.
  //   bubbleWrapperMine   → justifyContent: 'flex-end'   (logical END, left in RTL)
  //   bubbleWrapperTheirs → justifyContent: 'flex-start' (logical START, right in RTL)
  //
  // bubble: constrained to 75% of screen width, common top radii + side padding.
  //
  // Tail corners (RTL-logical):
  //   "Mine"   → borderBottomEndRadius: 0    (tail at logical END)
  //   "Theirs" → borderBottomStartRadius: 0  (tail at logical START)
  bubbleWrapper: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    marginVertical: 2,
    paddingHorizontal: Spacing.xs,
  },
  bubbleWrapperMine: {
    justifyContent: 'flex-end',   // pushes bubble to logical end (left in RTL)
  },
  bubbleWrapperTheirs: {
    justifyContent: 'flex-start', // pushes bubble to logical start (right in RTL)
  },
  bubbleAvatar: {
    marginEnd:  Spacing.xs,       // logical: gap between avatar and bubble
    flexShrink: 0,
  },
  bubble: {
    maxWidth:          '75%',
    paddingVertical:    Spacing.sm,
    paddingHorizontal:  Spacing.md,
    // Rounded top corners (same for both sides)
    borderTopStartRadius: BorderRadius.lg,
    borderTopEndRadius:   BorderRadius.lg,
  },
  bubbleMine: {
    backgroundColor: Colors.primary,   // primary green
    // Tail: flat bottom-END corner → points toward logical end
    borderBottomStartRadius: BorderRadius.lg,
    borderBottomEndRadius:   0,
    // Margin pushes bubble away from logical start (leaves whitespace on start side)
    marginStart: 52,
  },
  bubbleTheirs: {
    backgroundColor: Colors.borderLight, // very light gray #f3f4f6
    // Tail: flat bottom-START corner → points toward logical start
    borderBottomStartRadius: 0,
    borderBottomEndRadius:   BorderRadius.lg,
    // Margin pushes bubble away from logical end (leaves whitespace on end side)
    marginEnd: 52,
  },
  bubbleTextMine: {
    color:      Colors.white,
    fontSize:   FontSizes.md,
    lineHeight: FontSizes.md * 1.45,
  },
  bubbleTextTheirs: {
    color:      Colors.text,
    fontSize:   FontSizes.md,
    lineHeight: FontSizes.md * 1.45,
  },
  bubbleMeta: {
    flexDirection:  'row',
    justifyContent: 'flex-end',
    alignItems:     'center',
    marginTop:       3,
    gap:             2,
  },
  bubbleTime: {
    fontSize: FontSizes.xs,
  },
  bubbleTimeMine: {
    color: 'rgba(255,255,255,0.70)',
  },
  bubbleTimeTheirs: {
    color: Colors.textSecondary,
  },

  // ── Date separator ─────────────────────────────────────────────────────────
  dateSepRow: {
    flexDirection:    'row',
    alignItems:       'center',
    marginVertical:    Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  dateSepLine: {
    flex:            1,
    height:          StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  dateSepPill: {
    backgroundColor:  Colors.background,
    borderRadius:     BorderRadius.full,
    borderWidth:      StyleSheet.hairlineWidth,
    borderColor:      Colors.border,
    paddingVertical:  3,
    paddingHorizontal: Spacing.sm,
    marginHorizontal:  Spacing.sm,
  },
  dateSepText: {
    color:      Colors.textSecondary,
    fontSize:   FontSizes.xs,
    fontWeight: '500',
  },

  // ── Input bar ───────────────────────────────────────────────────────────────
  inputBar: {
    flexDirection:   'row',
    alignItems:      'flex-end',
    backgroundColor: Colors.white,
    borderTopWidth:  StyleSheet.hairlineWidth,
    borderTopColor:  Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   Spacing.sm,
    // Subtle shadow to lift it from the list
    elevation:    4,
    shadowColor:  Colors.black,
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.06,
    shadowRadius:  3,
  },
  inputWrap: {
    flex:              1,
    backgroundColor:   Colors.background,
    borderRadius:      BorderRadius.xl,
    borderWidth:       1,
    borderColor:       Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Platform.OS === 'ios' ? Spacing.sm : 2,
    marginEnd:         Spacing.sm,    // logical: gap between field and send button
    minHeight:         40,
    maxHeight:         110,           // ~4 lines before scrolling inside TextInput
    justifyContent:    'center',
  },
  input: {
    color:             Colors.text,
    fontSize:          FontSizes.md,
    textAlignVertical: 'center',
    paddingTop:        0,             // normalise Android top padding
    paddingBottom:     0,
    textAlign:         'right',       // Arabic content — explicitly right-aligned
  },
  sendBtn: {
    width:           42,
    height:          42,
    borderRadius:    21,
    backgroundColor: Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  sendBtnDisabled: {
    backgroundColor: Colors.gray,
  },
});

export default ChatScreen;
