/**
 * chatService.js — Real-Time Chat Service Layer
 *
 * All Firestore reads/writes for 1-on-1 messaging go through this module.
 * No screen imports Firebase directly.
 *
 * ── Firestore data model ──────────────────────────────────────────────────────
 *
 *   chats/{chatId}                         ← metadata document
 *     participants:        [uid1, uid2]
 *     lastMessage:         string
 *     lastMessageTime:     Timestamp
 *     lastMessageSenderId: uid
 *     unreadCounts:        { [uid]: number }
 *     participantInfo:     { [uid]: { name, avatar } }
 *
 *   chats/{chatId}/messages/{messageId}    ← per-message sub-document
 *     text:       string
 *     senderId:   uid
 *     senderName: string
 *     timestamp:  Timestamp   (serverTimestamp on write)
 *     read:       boolean
 *
 *   chatId is deterministic: [uid1, uid2].sort().join('_')
 *   Both participants always reference the same path, no server coordination needed.
 */

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { COLLECTIONS } from '../config/firebase';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CHAT_COLLECTION    = 'chats';
const MESSAGE_COLLECTION = 'messages';
const DEFAULT_PAGE_SIZE  = 30;

// ─────────────────────────────────────────────────────────────────────────────
// ChatService
// ─────────────────────────────────────────────────────────────────────────────

class ChatService {
  /** Lazy Firestore instance — avoids calling getFirestore() at module load time */
  get db() {
    if (!this._db) this._db = getFirestore();
    return this._db;
  }

  // ── computeChatId ──────────────────────────────────────────────────────────

  /**
   * Deterministic chat ID from two user UIDs.
   * Sorting guarantees both users compute the same ID regardless of who initiates.
   *
   * @param {string} uid1
   * @param {string} uid2
   * @returns {string}  e.g. "abc123_xyz789"
   */
  computeChatId(uid1, uid2) {
    return [uid1, uid2].sort().join('_');
  }

  // ── subscribeToChat ────────────────────────────────────────────────────────

  /**
   * Subscribe to a chat's messages in real time, ordered by timestamp DESCENDING.
   *
   * Using DESC order + inverted FlatList means data[0] (newest) renders at
   * the visual bottom — the user always lands at the latest message.
   * onEndReached on the inverted list fires when the user scrolls to the oldest
   * visible message (data[N-1] = visual top), the natural "load more" trigger.
   *
   * @param {string}   chatId       - The chat document ID
   * @param {function} onChange     - Called with Message[] on every snapshot update
   * @param {function} onError      - Called with Error on listener failure
   * @param {number}   messageLimit - Max messages to return (default 30, increase for pagination)
   * @returns {function} unsubscribe — call to tear down the Firestore listener
   */
  subscribeToChat(chatId, onChange, onError, messageLimit = DEFAULT_PAGE_SIZE) {
    const q = query(
      collection(this.db, CHAT_COLLECTION, chatId, MESSAGE_COLLECTION),
      orderBy('timestamp', 'desc'),
      limit(messageLimit),
    );

    return onSnapshot(
      q,
      (snapshot) => {
        onChange(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      onError,
    );
  }

  // ── sendMessage ────────────────────────────────────────────────────────────

  /**
   * Dual-write: add a message to the messages subcollection AND update the chat
   * metadata document atomically via setDoc + merge.
   *
   * The metadata write is idempotent — setDoc + merge creates the chat doc on
   * the first message and safely updates it on every subsequent send without
   * clobbering unrelated fields (e.g. the other participant's unreadCount).
   *
   * @param {string} chatId   - The chat document ID
   * @param {string} senderId - The sending user's UID
   * @param {string} text     - Raw message text (trimmed internally)
   * @param {object} meta     - Supporting fields for metadata update:
   *   {string} senderName      - Sender's display name
   *   {string} recipientId     - Recipient's UID
   *   {string} recipientName   - Recipient's display name
   *   {string|null} senderAvatar    - Sender's photo URL
   *   {string|null} recipientAvatar - Recipient's photo URL
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async sendMessage(chatId, senderId, text, meta = {}) {
    const {
      senderName      = '',
      recipientId     = '',
      recipientName   = '',
      senderAvatar    = null,
      recipientAvatar = null,
      // Document attachment (type: 'document')
      type            = 'text',
      fileUrl         = null,
      fileName        = null,
    } = meta;

    const trimmed = text.trim();
    if (!trimmed) return { success: false, error: 'Empty message' };

    try {
      // 1. Write message to subcollection
      const messageDoc = {
        text:       trimmed,
        senderId,
        senderName,
        timestamp:  serverTimestamp(),
        read:       false,
      };

      // Attach document metadata when sharing a file
      if (type === 'document' && fileUrl) {
        messageDoc.type     = 'document';
        messageDoc.fileUrl  = fileUrl;
        messageDoc.fileName = fileName ?? '';
      }

      await addDoc(
        collection(this.db, CHAT_COLLECTION, chatId, MESSAGE_COLLECTION),
        messageDoc,
      );

      // 2. Update / create chat metadata doc (setDoc + merge = create-or-update)
      //    increment(1) is atomic: no race condition with concurrent senders.
      await setDoc(
        doc(this.db, CHAT_COLLECTION, chatId),
        {
          participants:        [senderId, recipientId].filter(Boolean),
          lastMessage:         trimmed,
          lastMessageTime:     serverTimestamp(),
          lastMessageSenderId: senderId,
          unreadCounts: {
            [recipientId]: increment(1),  // recipient's unread count goes up
            [senderId]:    0,             // sender's stays zero
          },
          participantInfo: {
            [senderId]:    { name: senderName,    avatar: senderAvatar    },
            [recipientId]: { name: recipientName, avatar: recipientAvatar },
          },
        },
        { merge: true }, // never clobber unrelated fields
      );

      return { success: true };
    } catch (error) {
      console.error('[chatService.sendMessage]', error);
      return { success: false, error: error.message };
    }
  }

  // ── markAsRead ─────────────────────────────────────────────────────────────

  /**
   * Reset the unread counter for a specific user in a chat.
   * Silent on failure — the chat doc may not exist yet if no messages have been sent.
   *
   * @param {string} chatId - The chat document ID
   * @param {string} uid    - The user whose counter to clear
   */
  async markAsRead(chatId, uid) {
    if (!chatId || !uid) return;
    try {
      await updateDoc(doc(this.db, CHAT_COLLECTION, chatId), {
        [`unreadCounts.${uid}`]: 0,
      });
    } catch {
      // Silently ignore — chat doc may not exist if no messages yet
    }
  }

  // ── fetchPushToken ─────────────────────────────────────────────────────────

  /**
   * Fetch the Expo push token for a user (stored in users/{uid}.pushToken).
   * Used for fire-and-forget push notifications after message delivery.
   *
   * @param {string} recipientId - The recipient's UID
   * @returns {Promise<string|null>} push token or null
   */
  async fetchPushToken(recipientId) {
    try {
      const snap = await getDoc(doc(this.db, COLLECTIONS.USERS, recipientId));
      return snap.data()?.pushToken ?? null;
    } catch {
      return null;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

/** Convenience named export for screens that need chatId before calling chatService */
export const computeChatId = (uid1, uid2) => [uid1, uid2].sort().join('_');

export default new ChatService();
