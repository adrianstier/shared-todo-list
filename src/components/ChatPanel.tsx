'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { ChatMessage, AuthUser, ChatConversation, TapbackType, MessageReaction, PresenceStatus, Todo } from '@/types/todo';
import { v4 as uuidv4 } from 'uuid';
import {
  MessageSquare, Send, X, Minimize2, Maximize2, ChevronDown,
  Users, ChevronLeft, User, Smile, Check, CheckCheck, Wifi, WifiOff,
  Bell, BellOff, Search, Reply, MoreHorizontal, Edit3, Trash2, Pin,
  AtSign, Link2, Plus, Moon, Volume2, VolumeX, Circle, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Notification sound (short, pleasant chime)
const NOTIFICATION_SOUND_URL = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleTs1WpbOzq1fMUJFk8zSrGg/V0Bml8jRzaZ4g2pqmaW4zc7Mu7/Fz8q9rZ2WnqWyxdLOv62WiaOxyb6kkXuNqL+2pJZ7cn2ftLaylnuFjJmnq52Xjn5/gI+dn6OZj4KGjJGVl5qakIuIhYaHiYuOkJGQj42Lh4OCgoKEhoeIiIiHhoWDgoGBgYGCg4SEhISDgoGAgICAgIGBgoKCgoKBgYCAgICAgICBgYGBgYGBgICAgICAgICAgYGBgYGBgYCAgICAgA==';

// Helper to request notification permission
async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

// Helper to show browser notification
function showBrowserNotification(title: string, body: string, onClick?: () => void) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const notification = new Notification(title, {
    body,
    icon: '/favicon.ico',
    tag: 'chat-message',
    requireInteraction: false,
  });

  if (onClick) {
    notification.onclick = () => {
      window.focus();
      onClick();
      notification.close();
    };
  }

  setTimeout(() => notification.close(), 5000);
}

// Tapback emoji mapping
const TAPBACK_EMOJIS: Record<TapbackType, string> = {
  heart: '❤️',
  thumbsup: '👍',
  thumbsdown: '👎',
  haha: '😂',
  exclamation: '❗',
  question: '❓',
};

// Expanded emoji picker with categories
const EMOJI_CATEGORIES = {
  recent: ['😀', '😂', '❤️', '👍', '🎉', '🔥'],
  smileys: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌'],
  gestures: ['👍', '👎', '👏', '🙌', '🤝', '🙏', '💪', '✌️', '🤞', '🤙', '👋', '✋'],
  symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '💯', '✨', '🔥', '⭐', '💫', '🎉'],
};

// Presence status config
const PRESENCE_CONFIG: Record<PresenceStatus, { color: string; label: string }> = {
  online: { color: '#22c55e', label: 'Online' },
  away: { color: '#f59e0b', label: 'Away' },
  dnd: { color: '#ef4444', label: 'Do Not Disturb' },
  offline: { color: '#6b7280', label: 'Offline' },
};

interface ChatPanelProps {
  currentUser: AuthUser;
  users: { name: string; color: string }[];
  todos?: Todo[];
  onCreateTask?: (text: string, assignedTo?: string) => void;
}

// Typing indicator component
function TypingIndicator({ userName }: { userName: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center gap-2 px-3 py-2"
    >
      <span className="text-sm text-[var(--text-muted)]">{userName} is typing</span>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]"
            animate={{ y: [0, -4, 0] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// Mention autocomplete component
function MentionAutocomplete({
  users,
  filter,
  onSelect,
  position
}: {
  users: { name: string; color: string }[];
  filter: string;
  onSelect: (name: string) => void;
  position: { top: number; left: number };
}) {
  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(filter.toLowerCase())
  ).slice(0, 5);

  if (filteredUsers.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 5 }}
      className="absolute z-30 bg-[var(--surface)] border border-[var(--border)]
                 rounded-lg shadow-xl overflow-hidden min-w-[150px]"
      style={{ bottom: position.top, left: position.left }}
    >
      {filteredUsers.map((user) => (
        <button
          key={user.name}
          onClick={() => onSelect(user.name)}
          className="w-full px-3 py-2 flex items-center gap-2 hover:bg-[var(--surface-2)]
                   transition-colors text-left"
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: user.color }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm text-[var(--foreground)]">{user.name}</span>
        </button>
      ))}
    </motion.div>
  );
}

// Reactions summary tooltip
function ReactionsSummary({ reactions, users }: { reactions: MessageReaction[]; users: { name: string; color: string }[] }) {
  const groupedByReaction = reactions.reduce((acc, r) => {
    if (!acc[r.reaction]) acc[r.reaction] = [];
    acc[r.reaction].push(r.user);
    return acc;
  }, {} as Record<TapbackType, string[]>);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl p-2 min-w-[120px]">
      {Object.entries(groupedByReaction).map(([reaction, userNames]) => (
        <div key={reaction} className="flex items-center gap-2 py-1">
          <span className="text-lg">{TAPBACK_EMOJIS[reaction as TapbackType]}</span>
          <div className="flex flex-wrap gap-1">
            {userNames.map(name => (
              <span key={name} className="text-xs text-[var(--foreground)]">{name}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ChatPanel({ currentUser, users, todos = [], onCreateTask }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [tableExists, setTableExists] = useState(true);
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [showConversationList, setShowConversationList] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState<keyof typeof EMOJI_CATEGORIES>('recent');
  const [tapbackMessageId, setTapbackMessageId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // New feature states
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  const [userPresence, setUserPresence] = useState<Record<string, PresenceStatus>>({});
  const [mutedConversations, setMutedConversations] = useState<Set<string>>(new Set());
  const [isDndMode, setIsDndMode] = useState(false);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [showReactionsSummary, setShowReactionsSummary] = useState<string | null>(null);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [taskFromMessage, setTaskFromMessage] = useState<ChatMessage | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const lastTypingBroadcastRef = useRef<number>(0);
  const presenceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio element for notification sound
  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
    audioRef.current.volume = 0.5;
  }, []);

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  // Function to play notification sound
  const playNotificationSound = useCallback(() => {
    if (isDndMode) return;
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, [isDndMode]);

  // Function to handle enabling notifications
  const enableNotifications = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setNotificationsEnabled(granted);
  }, []);

  // Other users (excluding current user)
  const otherUsers = useMemo(() =>
    users.filter(u => u.name !== currentUser.name),
    [users, currentUser.name]
  );

  const getUserColor = useCallback((userName: string) => {
    const user = users.find(u => u.name === userName);
    return user?.color || '#0033A0';
  }, [users]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const getConversationKey = useCallback((conv: ChatConversation) => {
    return conv.type === 'team' ? 'team' : conv.userName;
  }, []);

  const totalUnreadCount = useMemo(() => {
    return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
  }, [unreadCounts]);

  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAtBottom(isBottom);
    if (isBottom && isOpen && conversation) {
      const key = getConversationKey(conversation);
      setUnreadCounts(prev => ({ ...prev, [key]: 0 }));
    }
  }, [isOpen, conversation, getConversationKey]);

  // Filter messages for current conversation (excluding deleted)
  const filteredMessages = useMemo(() => {
    if (!conversation) return [];
    let msgs = messages.filter(m => !m.deleted_at);

    if (conversation.type === 'team') {
      msgs = msgs.filter(m => !m.recipient);
    } else {
      const otherUser = conversation.userName;
      msgs = msgs.filter(m =>
        (m.created_by === currentUser.name && m.recipient === otherUser) ||
        (m.created_by === otherUser && m.recipient === currentUser.name)
      );
    }

    // Apply search filter if active
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      msgs = msgs.filter(m =>
        m.text.toLowerCase().includes(query) ||
        m.created_by.toLowerCase().includes(query)
      );
    }

    return msgs;
  }, [messages, conversation, currentUser.name, searchQuery]);

  // Pinned messages for current conversation
  const pinnedMessages = useMemo(() => {
    return filteredMessages.filter(m => m.is_pinned);
  }, [filteredMessages]);

  // Get conversations sorted by most recent activity
  const sortedConversations = useMemo(() => {
    const conversations: { conv: ChatConversation; lastMessage: ChatMessage | null; lastActivity: number }[] = [];

    const teamMessages = messages.filter(m => !m.recipient && !m.deleted_at);
    const lastTeamMsg = teamMessages.length > 0 ? teamMessages[teamMessages.length - 1] : null;
    conversations.push({
      conv: { type: 'team' },
      lastMessage: lastTeamMsg,
      lastActivity: lastTeamMsg ? new Date(lastTeamMsg.created_at).getTime() : 0
    });

    otherUsers.forEach(user => {
      const dmMessages = messages.filter(m =>
        !m.deleted_at &&
        ((m.created_by === currentUser.name && m.recipient === user.name) ||
        (m.created_by === user.name && m.recipient === currentUser.name))
      );
      const lastMsg = dmMessages.length > 0 ? dmMessages[dmMessages.length - 1] : null;
      conversations.push({
        conv: { type: 'dm', userName: user.name },
        lastMessage: lastMsg,
        lastActivity: lastMsg ? new Date(lastMsg.created_at).getTime() : 0
      });
    });

    return conversations.sort((a, b) => {
      if (a.lastActivity === 0 && b.lastActivity === 0) return 0;
      if (a.lastActivity === 0) return 1;
      if (b.lastActivity === 0) return -1;
      return b.lastActivity - a.lastActivity;
    });
  }, [messages, otherUsers, currentUser.name]);

  const mostRecentConversation = useMemo((): ChatConversation => {
    if (sortedConversations.length > 0 && sortedConversations[0].lastActivity > 0) {
      return sortedConversations[0].conv;
    }
    return { type: 'team' };
  }, [sortedConversations]);

  // Fetch all messages and calculate initial unread counts
  const fetchMessages = useCallback(async () => {
    if (!isSupabaseConfigured()) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(500);

    if (error) {
      console.error('Error fetching messages:', error);
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        setTableExists(false);
      }
    } else {
      const messages = data || [];
      setMessages(messages);
      setTableExists(true);

      const initialUnreadCounts: Record<string, number> = {};
      let firstUnread: string | null = null;

      messages.forEach((msg: ChatMessage) => {
        if (msg.created_by === currentUser.name) return;
        if (msg.deleted_at) return;

        const readBy = msg.read_by || [];
        if (readBy.includes(currentUser.name)) return;

        let convKey: string | null = null;
        if (!msg.recipient) {
          convKey = 'team';
        } else if (msg.recipient === currentUser.name) {
          convKey = msg.created_by;
        }

        if (convKey) {
          initialUnreadCounts[convKey] = (initialUnreadCounts[convKey] || 0) + 1;
          if (!firstUnread) firstUnread = msg.id;
        }
      });

      setUnreadCounts(initialUnreadCounts);
      setFirstUnreadId(firstUnread);
    }
    setLoading(false);
  }, [currentUser.name]);

  // Track state in refs to avoid re-subscribing
  const isOpenRef = useRef(isOpen);
  const isAtBottomRef = useRef(isAtBottom);
  const conversationRef = useRef(conversation);
  const showConversationListRef = useRef(showConversationList);
  const playNotificationSoundRef = useRef(playNotificationSound);
  const mutedConversationsRef = useRef(mutedConversations);
  const isDndModeRef = useRef(isDndMode);

  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { isAtBottomRef.current = isAtBottom; }, [isAtBottom]);
  useEffect(() => { conversationRef.current = conversation; }, [conversation]);
  useEffect(() => { showConversationListRef.current = showConversationList; }, [showConversationList]);
  useEffect(() => { playNotificationSoundRef.current = playNotificationSound; }, [playNotificationSound]);
  useEffect(() => { mutedConversationsRef.current = mutedConversations; }, [mutedConversations]);
  useEffect(() => { isDndModeRef.current = isDndMode; }, [isDndMode]);

  const getMessageConversationKey = useCallback((msg: ChatMessage): string | null => {
    if (!msg.recipient) {
      return 'team';
    }
    if (msg.created_by === currentUser.name) {
      return msg.recipient;
    }
    if (msg.recipient === currentUser.name) {
      return msg.created_by;
    }
    return null;
  }, [currentUser.name]);

  // Update presence periodically
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const updatePresence = () => {
      supabase.channel('presence-channel').send({
        type: 'broadcast',
        event: 'presence',
        payload: {
          user: currentUser.name,
          status: isDndMode ? 'dnd' : 'online',
          timestamp: Date.now()
        }
      });
    };

    updatePresence();
    presenceIntervalRef.current = setInterval(updatePresence, 30000);

    return () => {
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
      }
    };
  }, [currentUser.name, isDndMode]);

  // Real-time subscription for messages, typing, and presence
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    fetchMessages();

    const messagesChannel = supabase
      .channel('messages-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as ChatMessage;
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === newMsg.id);
              if (exists) return prev;
              return [...prev, newMsg];
            });

            setTypingUsers(prev => ({ ...prev, [newMsg.created_by]: false }));

            if (newMsg.created_by === currentUser.name) return;

            let msgConvKey: string | null = null;
            if (!newMsg.recipient) {
              msgConvKey = 'team';
            } else if (newMsg.recipient === currentUser.name) {
              msgConvKey = newMsg.created_by;
            }

            if (!msgConvKey) return;

            // Check if conversation is muted
            if (mutedConversationsRef.current.has(msgConvKey)) return;

            const currentConv = conversationRef.current;
            const currentKey = currentConv ? (currentConv.type === 'team' ? 'team' : currentConv.userName) : null;
            const isPanelOpen = isOpenRef.current;
            const isViewingConversation = !showConversationListRef.current;
            const isViewingThisConv = currentKey === msgConvKey;
            const isAtBottomOfChat = isAtBottomRef.current;

            const shouldMarkUnread = !isPanelOpen || !isViewingConversation || !isViewingThisConv || !isAtBottomOfChat;

            if (shouldMarkUnread) {
              setUnreadCounts(prev => ({
                ...prev,
                [msgConvKey]: (prev[msgConvKey] || 0) + 1
              }));

              if (!isDndModeRef.current) {
                playNotificationSoundRef.current();

                if (document.hidden) {
                  const title = newMsg.recipient
                    ? `Message from ${newMsg.created_by}`
                    : `${newMsg.created_by} in Team Chat`;
                  const body = newMsg.text.length > 100
                    ? newMsg.text.slice(0, 100) + '...'
                    : newMsg.text;
                  showBrowserNotification(title, body);
                }
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as ChatMessage;
            setMessages((prev) => prev.map(m =>
              m.id === updatedMsg.id ? updatedMsg : m
            ));
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    // Typing indicator channel
    const typingChannel = supabase
      .channel('typing-channel')
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.user !== currentUser.name) {
          setTypingUsers(prev => ({ ...prev, [payload.user]: true }));
          setTimeout(() => {
            setTypingUsers(prev => ({ ...prev, [payload.user]: false }));
          }, 3000);
        }
      })
      .subscribe();

    // Presence channel
    const presenceChannel = supabase
      .channel('presence-channel')
      .on('broadcast', { event: 'presence' }, ({ payload }) => {
        if (payload.user !== currentUser.name) {
          setUserPresence(prev => ({ ...prev, [payload.user]: payload.status }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(typingChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [fetchMessages, currentUser.name, getMessageConversationKey]);

  // Broadcast typing indicator (throttled)
  const broadcastTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingBroadcastRef.current > 2000) {
      lastTypingBroadcastRef.current = now;
      supabase.channel('typing-channel').send({
        type: 'broadcast',
        event: 'typing',
        payload: { user: currentUser.name, conversation: conversation ? getConversationKey(conversation) : null }
      });
    }
  }, [currentUser.name, conversation, getConversationKey]);

  // Auto-scroll on new messages if at bottom
  useEffect(() => {
    if (isAtBottom && isOpen && !showConversationList) {
      scrollToBottom();
    }
  }, [filteredMessages, isAtBottom, isOpen, scrollToBottom, showConversationList]);

  // Focus input when opening chat or switching conversations
  useEffect(() => {
    if (isOpen && !isMinimized && !showConversationList && conversation) {
      setTimeout(() => inputRef.current?.focus(), 100);
      const key = getConversationKey(conversation);
      setUnreadCounts(prev => ({ ...prev, [key]: 0 }));
    }
  }, [isOpen, isMinimized, showConversationList, conversation, getConversationKey]);

  // Handle mention detection in input
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setNewMessage(value);

    // Detect @mention
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setShowMentions(true);
      setMentionFilter(mentionMatch[1]);
      setMentionCursorPos(cursorPos);
    } else {
      setShowMentions(false);
    }

    if (value.trim()) {
      broadcastTyping();
    }
  };

  const insertMention = (userName: string) => {
    const textBeforeMention = newMessage.slice(0, mentionCursorPos).replace(/@\w*$/, '');
    const textAfterCursor = newMessage.slice(mentionCursorPos);
    setNewMessage(`${textBeforeMention}@${userName} ${textAfterCursor}`);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  // Extract mentions from message text
  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      const userName = match[1];
      if (users.some(u => u.name.toLowerCase() === userName.toLowerCase())) {
        mentions.push(userName);
      }
    }
    return mentions;
  };

  const sendMessage = async () => {
    const text = newMessage.trim();
    if (!text || !conversation) return;

    const mentions = extractMentions(text);

    const message: ChatMessage = {
      id: uuidv4(),
      text,
      created_by: currentUser.name,
      created_at: new Date().toISOString(),
      recipient: conversation.type === 'dm' ? conversation.userName : null,
      reply_to_id: replyingTo?.id || null,
      reply_to_text: replyingTo ? replyingTo.text.slice(0, 100) : null,
      reply_to_user: replyingTo?.created_by || null,
      mentions: mentions.length > 0 ? mentions : undefined,
    };

    setMessages((prev) => [...prev, message]);
    setNewMessage('');
    setReplyingTo(null);
    scrollToBottom();

    const { error } = await supabase.from('messages').insert([message]);

    if (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
      setNewMessage(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editingMessage) {
        saveEdit();
      } else {
        sendMessage();
      }
    }
    if (e.key === 'Escape') {
      setReplyingTo(null);
      setEditingMessage(null);
      setShowSearch(false);
    }
  };

  const addEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const toggleTapback = async (messageId: string, reaction: TapbackType) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const currentReactions = message.reactions || [];
    const existingReaction = currentReactions.find(r => r.user === currentUser.name);

    let newReactions: MessageReaction[];

    if (existingReaction?.reaction === reaction) {
      newReactions = currentReactions.filter(r => r.user !== currentUser.name);
    } else if (existingReaction) {
      newReactions = currentReactions.map(r =>
        r.user === currentUser.name
          ? { user: currentUser.name, reaction, created_at: new Date().toISOString() }
          : r
      );
    } else {
      newReactions = [...currentReactions, {
        user: currentUser.name,
        reaction,
        created_at: new Date().toISOString()
      }];
    }

    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, reactions: newReactions } : m
    ));
    setTapbackMessageId(null);

    const { error } = await supabase
      .from('messages')
      .update({ reactions: newReactions })
      .eq('id', messageId);

    if (error) {
      console.error('Error updating reaction:', error);
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, reactions: currentReactions } : m
      ));
    }
  };

  // Edit message
  const startEdit = (message: ChatMessage) => {
    setEditingMessage(message);
    setEditText(message.text);
    setShowMessageMenu(null);
  };

  const saveEdit = async () => {
    if (!editingMessage || !editText.trim()) return;

    const updatedMessage = {
      ...editingMessage,
      text: editText.trim(),
      edited_at: new Date().toISOString(),
    };

    setMessages(prev => prev.map(m =>
      m.id === editingMessage.id ? updatedMessage : m
    ));
    setEditingMessage(null);
    setEditText('');

    const { error } = await supabase
      .from('messages')
      .update({ text: editText.trim(), edited_at: new Date().toISOString() })
      .eq('id', editingMessage.id);

    if (error) {
      console.error('Error editing message:', error);
    }
  };

  // Delete message (soft delete)
  const deleteMessage = async (messageId: string) => {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, deleted_at: new Date().toISOString() } : m
    ));
    setShowMessageMenu(null);

    const { error } = await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId);

    if (error) {
      console.error('Error deleting message:', error);
    }
  };

  // Pin/unpin message
  const togglePin = async (message: ChatMessage) => {
    const isPinned = !message.is_pinned;

    setMessages(prev => prev.map(m =>
      m.id === message.id ? {
        ...m,
        is_pinned: isPinned,
        pinned_by: isPinned ? currentUser.name : null,
        pinned_at: isPinned ? new Date().toISOString() : null
      } : m
    ));
    setShowMessageMenu(null);

    const { error } = await supabase
      .from('messages')
      .update({
        is_pinned: isPinned,
        pinned_by: isPinned ? currentUser.name : null,
        pinned_at: isPinned ? new Date().toISOString() : null
      })
      .eq('id', message.id);

    if (error) {
      console.error('Error pinning message:', error);
    }
  };

  // Toggle mute for conversation
  const toggleMute = (convKey: string) => {
    setMutedConversations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(convKey)) {
        newSet.delete(convKey);
      } else {
        newSet.add(convKey);
      }
      return newSet;
    });
  };

  // Create task from message
  const createTaskFromMessage = (message: ChatMessage) => {
    setTaskFromMessage(message);
    setShowCreateTaskModal(true);
    setShowMessageMenu(null);
  };

  const handleCreateTask = () => {
    if (taskFromMessage && onCreateTask) {
      onCreateTask(taskFromMessage.text, taskFromMessage.created_by);
    }
    setShowCreateTaskModal(false);
    setTaskFromMessage(null);
  };

  const markMessagesAsRead = useCallback(async (messageIds: string[]) => {
    if (messageIds.length === 0) return;

    setMessages(prev => prev.map(m => {
      if (messageIds.includes(m.id) && m.created_by !== currentUser.name) {
        const readBy = m.read_by || [];
        if (!readBy.includes(currentUser.name)) {
          return { ...m, read_by: [...readBy, currentUser.name] };
        }
      }
      return m;
    }));

    for (const messageId of messageIds) {
      const message = messages.find(m => m.id === messageId);
      if (message && message.created_by !== currentUser.name) {
        const readBy = message.read_by || [];
        if (!readBy.includes(currentUser.name)) {
          await supabase
            .from('messages')
            .update({ read_by: [...readBy, currentUser.name] })
            .eq('id', messageId);
        }
      }
    }
  }, [messages, currentUser.name]);

  useEffect(() => {
    if (isOpen && !showConversationList && conversation && filteredMessages.length > 0) {
      const unreadMessageIds = filteredMessages
        .filter(m => m.created_by !== currentUser.name && !(m.read_by || []).includes(currentUser.name))
        .map(m => m.id);

      if (unreadMessageIds.length > 0) {
        markMessagesAsRead(unreadMessageIds);
      }
    }
  }, [isOpen, showConversationList, conversation, filteredMessages, currentUser.name, markMessagesAsRead]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (tapbackMessageId) {
        setTapbackMessageId(null);
      }
      if (showMessageMenu) {
        setShowMessageMenu(null);
      }
      if (showReactionsSummary) {
        setShowReactionsSummary(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [tapbackMessageId, showMessageMenu, showReactionsSummary]);

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Render message text with mentions highlighted
  const renderMessageText = (text: string) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const userName = part.slice(1);
        const isMentioned = users.some(u => u.name.toLowerCase() === userName.toLowerCase());
        const isMe = userName.toLowerCase() === currentUser.name.toLowerCase();

        if (isMentioned) {
          return (
            <span
              key={i}
              className={`px-1 rounded font-medium ${
                isMe
                  ? 'bg-yellow-500/30 text-yellow-200'
                  : 'bg-[var(--accent)]/30 text-[var(--accent)]'
              }`}
            >
              {part}
            </span>
          );
        }
      }
      return part;
    });
  };

  const groupedMessages = filteredMessages.reduce((acc, msg, idx) => {
    const prevMsg = filteredMessages[idx - 1];
    const isGrouped = prevMsg && prevMsg.created_by === msg.created_by &&
      new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 60000 &&
      !msg.reply_to_id;

    return [...acc, { ...msg, isGrouped }];
  }, [] as (ChatMessage & { isGrouped: boolean })[]);

  const selectConversation = (conv: ChatConversation) => {
    setConversation(conv);
    setShowConversationList(false);
    const key = getConversationKey(conv);
    setUnreadCounts(prev => ({ ...prev, [key]: 0 }));
  };

  const getConversationTitle = () => {
    if (!conversation) return 'Messages';
    if (conversation.type === 'team') return 'Team Chat';
    return conversation.userName;
  };

  const activeTypingUsers = useMemo(() => {
    if (!conversation) return [];
    return Object.entries(typingUsers)
      .filter(([user, isTyping]) => isTyping && user !== currentUser.name)
      .map(([user]) => user);
  }, [typingUsers, conversation, currentUser.name]);

  return (
    <>
      {/* Chat Toggle Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => {
              setIsOpen(true);
              if (messages.length > 0) {
                setConversation(mostRecentConversation);
                setShowConversationList(false);
              } else {
                setShowConversationList(true);
              }
            }}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full
                       bg-[var(--accent)] hover:bg-[var(--allstate-blue-dark)]
                       text-white shadow-lg hover:shadow-xl
                       transition-all duration-200 flex items-center justify-center
                       group"
            aria-label={`Open chat${totalUnreadCount > 0 ? `, ${totalUnreadCount} unread messages` : ''}`}
          >
            <MessageSquare className="w-6 h-6" />
            {totalUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[1.5rem] h-6 px-1.5 bg-red-500
                             rounded-full text-xs font-bold flex items-center
                             justify-center text-white shadow-lg border-2 border-white animate-pulse">
                {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              height: isMinimized ? 'auto' : 'min(600px, 85vh)'
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)]
                       bg-[var(--surface)] border border-[var(--border)]
                       rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            role="dialog"
            aria-label="Chat panel"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3
                          bg-[var(--accent)] text-white">
              <div className="flex items-center gap-2">
                {showConversationList ? (
                  <>
                    <MessageSquare className="w-5 h-5" />
                    <span className="font-semibold">Messages</span>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setShowConversationList(true)}
                      className="p-1 hover:bg-white/20 rounded-lg transition-colors -ml-1"
                      aria-label="Back to conversations"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    {conversation?.type === 'team' ? (
                      <Users className="w-5 h-5" />
                    ) : conversation?.type === 'dm' ? (
                      <div className="relative">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                                     ring-2 ring-white/30"
                          style={{ backgroundColor: getUserColor(conversation.userName) }}
                        >
                          {getInitials(conversation.userName)}
                        </div>
                        {/* Presence indicator */}
                        <div
                          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--accent)]"
                          style={{ backgroundColor: PRESENCE_CONFIG[userPresence[conversation.userName] || 'offline'].color }}
                          title={PRESENCE_CONFIG[userPresence[conversation.userName] || 'offline'].label}
                        />
                      </div>
                    ) : (
                      <MessageSquare className="w-5 h-5" />
                    )}
                    <span className="font-semibold">{getConversationTitle()}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1">
                {/* Search toggle */}
                {!showConversationList && (
                  <button
                    onClick={() => setShowSearch(!showSearch)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      showSearch ? 'bg-white/20' : 'hover:bg-white/20'
                    }`}
                    title="Search messages"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                )}

                {/* Pinned messages */}
                {!showConversationList && pinnedMessages.length > 0 && (
                  <button
                    onClick={() => setShowPinnedMessages(!showPinnedMessages)}
                    className={`p-1.5 rounded-lg transition-colors relative ${
                      showPinnedMessages ? 'bg-white/20' : 'hover:bg-white/20'
                    }`}
                    title="Pinned messages"
                  >
                    <Pin className="w-4 h-4" />
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full text-[10px] flex items-center justify-center">
                      {pinnedMessages.length}
                    </span>
                  </button>
                )}

                {/* DND toggle */}
                <button
                  onClick={() => setIsDndMode(!isDndMode)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isDndMode
                      ? 'bg-red-500/20 text-red-200'
                      : 'hover:bg-white/20'
                  }`}
                  title={isDndMode ? 'Do Not Disturb (ON)' : 'Do Not Disturb (OFF)'}
                >
                  {isDndMode ? <Moon className="w-4 h-4" /> : <Moon className="w-4 h-4 opacity-50" />}
                </button>

                {/* Notification toggle */}
                <button
                  onClick={enableNotifications}
                  className={`p-1.5 rounded-lg transition-colors ${
                    notificationsEnabled
                      ? 'bg-green-500/20 text-green-200'
                      : 'hover:bg-white/20 text-white/70'
                  }`}
                  title={notificationsEnabled ? 'Notifications enabled' : 'Enable notifications'}
                >
                  {notificationsEnabled ? (
                    <Bell className="w-4 h-4" />
                  ) : (
                    <BellOff className="w-4 h-4" />
                  )}
                </button>

                {/* Connection status */}
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs
                             ${connected ? 'bg-green-500/20' : 'bg-red-500/20'}`}
                  title={connected ? 'Connected' : 'Disconnected'}
                >
                  {connected ? (
                    <Wifi className="w-3 h-3" />
                  ) : (
                    <WifiOff className="w-3 h-3" />
                  )}
                </div>

                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search bar */}
            <AnimatePresence>
              {showSearch && !showConversationList && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-b border-[var(--border)] bg-[var(--surface)]"
                >
                  <div className="p-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search messages..."
                        className="w-full pl-9 pr-4 py-2 rounded-lg border border-[var(--border)]
                                 bg-[var(--background)] text-[var(--foreground)]
                                 placeholder:text-[var(--text-muted)] text-sm
                                 focus:outline-none focus:border-[var(--accent)]"
                        autoFocus
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          <X className="w-4 h-4 text-[var(--text-muted)]" />
                        </button>
                      )}
                    </div>
                    {searchQuery && (
                      <div className="mt-1 text-xs text-[var(--text-muted)]">
                        {filteredMessages.length} result{filteredMessages.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pinned messages panel */}
            <AnimatePresence>
              {showPinnedMessages && !showConversationList && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-b border-[var(--border)] bg-yellow-500/5 max-h-32 overflow-y-auto"
                >
                  <div className="p-2">
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-2">
                      <Pin className="w-3 h-3" />
                      <span>Pinned Messages</span>
                    </div>
                    {pinnedMessages.map(msg => (
                      <div
                        key={msg.id}
                        className="text-sm p-2 rounded bg-[var(--surface)] mb-1 cursor-pointer
                                 hover:bg-[var(--surface-2)]"
                        onClick={() => {
                          setShowPinnedMessages(false);
                          // Could scroll to message here
                        }}
                      >
                        <span className="font-medium">{msg.created_by}: </span>
                        <span className="text-[var(--text-muted)]">
                          {msg.text.slice(0, 50)}{msg.text.length > 50 ? '...' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Content */}
            {!isMinimized && (
              <>
                {showConversationList ? (
                  /* Conversation List */
                  <div className="flex-1 overflow-y-auto bg-[var(--background)]">
                    {sortedConversations.map(({ conv, lastMessage }) => {
                      const isTeam = conv.type === 'team';
                      const userName = conv.type === 'dm' ? conv.userName : '';
                      const userColor = isTeam ? 'var(--accent)' : getUserColor(userName);
                      const unreadCount = unreadCounts[isTeam ? 'team' : userName] || 0;
                      const isMuted = mutedConversations.has(isTeam ? 'team' : userName);
                      const presence = isTeam ? null : userPresence[userName];
                      const isSelected = conversation?.type === conv.type &&
                        (conv.type === 'team' || (conv.type === 'dm' && conversation?.type === 'dm' && conversation.userName === conv.userName));

                      return (
                        <div
                          key={isTeam ? 'team' : userName}
                          className={`px-4 py-3 flex items-center gap-3
                                    hover:bg-[var(--surface-2)] transition-colors border-b border-[var(--border)]/50
                                    ${isSelected ? 'bg-[var(--accent)]/10' : ''}
                                    ${unreadCount > 0 && !isMuted ? 'bg-[var(--accent)]/5' : ''}`}
                        >
                          <button
                            onClick={() => selectConversation(conv)}
                            className="flex-1 flex items-center gap-3"
                          >
                            <div className="relative flex-shrink-0">
                              <div
                                className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shadow-sm
                                           ${isTeam ? 'bg-[var(--accent)]' : ''}`}
                                style={!isTeam ? { backgroundColor: userColor } : undefined}
                              >
                                {isTeam ? <Users className="w-5 h-5" /> : getInitials(userName)}
                              </div>
                              {/* Presence indicator for DMs */}
                              {!isTeam && presence && (
                                <div
                                  className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--background)]"
                                  style={{ backgroundColor: PRESENCE_CONFIG[presence].color }}
                                />
                              )}
                              {unreadCount > 0 && !isMuted && (
                                <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 bg-red-500
                                               rounded-full text-xs font-bold flex items-center justify-center text-white
                                               shadow-md border border-white/50 animate-pulse">
                                  {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`font-medium text-[var(--foreground)] truncate
                                                ${unreadCount > 0 && !isMuted ? 'font-semibold' : ''}`}>
                                  {isTeam ? 'Team Chat' : userName}
                                </span>
                                {lastMessage && (
                                  <span className={`text-xs flex-shrink-0
                                                  ${unreadCount > 0 && !isMuted ? 'text-[var(--accent)] font-medium' : 'text-[var(--text-muted)]'}`}>
                                    {formatRelativeTime(lastMessage.created_at)}
                                  </span>
                                )}
                              </div>
                              <div className={`text-sm truncate mt-0.5
                                            ${unreadCount > 0 && !isMuted ? 'text-[var(--foreground)] font-medium' : 'text-[var(--text-muted)]'}`}>
                                {lastMessage ? (
                                  <>
                                    {lastMessage.created_by === currentUser.name ? 'You: ' : `${lastMessage.created_by}: `}
                                    {lastMessage.text.slice(0, 35)}{lastMessage.text.length > 35 ? '...' : ''}
                                  </>
                                ) : (
                                  <span className="italic">No messages yet</span>
                                )}
                              </div>
                            </div>
                          </button>
                          {/* Mute button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMute(isTeam ? 'team' : userName);
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isMuted ? 'bg-[var(--surface-2)] text-[var(--text-muted)]' : 'hover:bg-[var(--surface-2)] text-[var(--text-muted)]'
                            }`}
                            title={isMuted ? 'Unmute' : 'Mute'}
                          >
                            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                          </button>
                        </div>
                      );
                    })}

                    {otherUsers.length === 0 && (
                      <div className="px-4 py-8 text-center text-[var(--text-muted)]">
                        <User className="w-10 h-10 mx-auto mb-3 opacity-40" />
                        <p className="font-medium">No other users yet</p>
                        <p className="text-sm mt-1">Invite teammates to start chatting</p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Messages View */
                  <>
                    <div
                      ref={messagesContainerRef}
                      onScroll={handleScroll}
                      className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5 bg-[var(--background)]"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                            <span>Loading messages...</span>
                          </div>
                        </div>
                      ) : !tableExists ? (
                        <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] gap-3 p-4 text-center">
                          <div className="w-16 h-16 rounded-full bg-[var(--surface-2)] flex items-center justify-center">
                            <MessageSquare className="w-8 h-8 opacity-50" />
                          </div>
                          <div>
                            <p className="font-semibold text-[var(--foreground)]">Chat Setup Required</p>
                            <p className="text-sm mt-1">Run the messages migration in Supabase to enable chat.</p>
                          </div>
                        </div>
                      ) : filteredMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] gap-3">
                          <div className="w-16 h-16 rounded-full bg-[var(--surface-2)] flex items-center justify-center">
                            <MessageSquare className="w-8 h-8 opacity-50" />
                          </div>
                          <div className="text-center">
                            <p className="font-medium text-[var(--foreground)]">
                              {searchQuery ? 'No messages found' : 'No messages yet'}
                            </p>
                            <p className="text-sm mt-1">
                              {searchQuery
                                ? 'Try a different search term'
                                : conversation?.type === 'team'
                                ? 'Be the first to say hello!'
                                : conversation?.type === 'dm'
                                ? `Start a conversation with ${conversation.userName}`
                                : 'Select a conversation'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {groupedMessages.map((msg, msgIndex) => {
                            const isOwn = msg.created_by === currentUser.name;
                            const userColor = getUserColor(msg.created_by);
                            const reactions = msg.reactions || [];
                            const readBy = msg.read_by || [];
                            const isLastOwnMessage = isOwn && msgIndex === groupedMessages.length - 1;
                            const showTapbackMenu = tapbackMessageId === msg.id;
                            const isHovered = hoveredMessageId === msg.id;
                            const isFirstUnread = msg.id === firstUnreadId;

                            const reactionCounts = reactions.reduce((acc, r) => {
                              acc[r.reaction] = (acc[r.reaction] || 0) + 1;
                              return acc;
                            }, {} as Record<TapbackType, number>);

                            return (
                              <div key={msg.id}>
                                {/* Unread divider */}
                                {isFirstUnread && (
                                  <div className="flex items-center gap-2 my-3">
                                    <div className="flex-1 h-px bg-red-500/50" />
                                    <span className="text-xs text-red-500 font-medium px-2">New Messages</span>
                                    <div className="flex-1 h-px bg-red-500/50" />
                                  </div>
                                )}

                                <motion.div
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.15 }}
                                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}
                                            ${msg.isGrouped ? 'mt-0.5' : 'mt-3'} group relative`}
                                  onMouseEnter={() => setHoveredMessageId(msg.id)}
                                  onMouseLeave={() => setHoveredMessageId(null)}
                                >
                                  <div className={`flex items-end gap-2 max-w-[85%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                                    {/* Avatar */}
                                    {!msg.isGrouped ? (
                                      <div
                                        className="w-7 h-7 rounded-full flex items-center justify-center
                                                 text-white text-[10px] font-bold flex-shrink-0 shadow-sm"
                                        style={{ backgroundColor: userColor }}
                                      >
                                        {getInitials(msg.created_by)}
                                      </div>
                                    ) : (
                                      <div className="w-7 flex-shrink-0" />
                                    )}

                                    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                                      {/* Name and time */}
                                      {!msg.isGrouped && (
                                        <div className={`flex items-center gap-2 mb-0.5 text-xs
                                                      ${isOwn ? 'flex-row-reverse' : ''}`}>
                                          <span className="font-medium text-[var(--foreground)]">
                                            {isOwn ? 'You' : msg.created_by}
                                          </span>
                                          <span className="text-[var(--text-muted)]">
                                            {formatTime(msg.created_at)}
                                          </span>
                                          {msg.edited_at && (
                                            <span className="text-[var(--text-muted)] italic">(edited)</span>
                                          )}
                                          {msg.is_pinned && (
                                            <Pin className="w-3 h-3 text-yellow-500" />
                                          )}
                                        </div>
                                      )}

                                      {/* Reply preview */}
                                      {msg.reply_to_text && (
                                        <div className={`text-xs px-2 py-1 mb-1 rounded border-l-2 border-[var(--accent)]
                                                       bg-[var(--surface-2)] text-[var(--text-muted)] max-w-full truncate`}>
                                          <span className="font-medium">{msg.reply_to_user}: </span>
                                          {msg.reply_to_text}
                                        </div>
                                      )}

                                      {/* Message bubble */}
                                      <div className="relative">
                                        <div
                                          onClick={() => setTapbackMessageId(tapbackMessageId === msg.id ? null : msg.id)}
                                          className={`px-3 py-1.5 rounded-2xl break-words whitespace-pre-wrap cursor-pointer
                                                    transition-all duration-150 text-[15px] leading-relaxed
                                                    ${isOwn
                                                      ? 'bg-[var(--accent)] text-white rounded-br-sm shadow-sm'
                                                      : 'bg-[var(--surface-2)] text-[var(--foreground)] rounded-bl-sm'
                                                    }
                                                    ${showTapbackMenu ? 'ring-2 ring-[var(--accent)]/50' : ''}
                                                    hover:shadow-md`}
                                        >
                                          {renderMessageText(msg.text)}
                                        </div>

                                        {/* Action buttons on hover */}
                                        {isHovered && !showTapbackMenu && (
                                          <div className={`absolute top-0 flex gap-0.5 bg-[var(--surface)]
                                                         border border-[var(--border)] rounded-lg shadow-lg p-0.5
                                                         ${isOwn ? 'right-full mr-1' : 'left-full ml-1'}`}>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setReplyingTo(msg);
                                              }}
                                              className="p-1.5 hover:bg-[var(--surface-2)] rounded"
                                              title="Reply"
                                            >
                                              <Reply className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setShowMessageMenu(showMessageMenu === msg.id ? null : msg.id);
                                              }}
                                              className="p-1.5 hover:bg-[var(--surface-2)] rounded"
                                              title="More"
                                            >
                                              <MoreHorizontal className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                            </button>
                                          </div>
                                        )}

                                        {/* Message menu dropdown */}
                                        <AnimatePresence>
                                          {showMessageMenu === msg.id && (
                                            <motion.div
                                              initial={{ opacity: 0, scale: 0.95 }}
                                              animate={{ opacity: 1, scale: 1 }}
                                              exit={{ opacity: 0, scale: 0.95 }}
                                              className={`absolute top-full mt-1 z-30 bg-[var(--surface)] border border-[var(--border)]
                                                        rounded-lg shadow-xl overflow-hidden min-w-[140px]
                                                        ${isOwn ? 'right-0' : 'left-0'}`}
                                            >
                                              <button
                                                onClick={() => {
                                                  setReplyingTo(msg);
                                                  setShowMessageMenu(null);
                                                }}
                                                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2
                                                         hover:bg-[var(--surface-2)]"
                                              >
                                                <Reply className="w-4 h-4" /> Reply
                                              </button>
                                              <button
                                                onClick={() => togglePin(msg)}
                                                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2
                                                         hover:bg-[var(--surface-2)]"
                                              >
                                                <Pin className="w-4 h-4" /> {msg.is_pinned ? 'Unpin' : 'Pin'}
                                              </button>
                                              {onCreateTask && (
                                                <button
                                                  onClick={() => createTaskFromMessage(msg)}
                                                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2
                                                           hover:bg-[var(--surface-2)]"
                                                >
                                                  <Plus className="w-4 h-4" /> Create Task
                                                </button>
                                              )}
                                              {isOwn && (
                                                <>
                                                  <button
                                                    onClick={() => startEdit(msg)}
                                                    className="w-full px-3 py-2 text-left text-sm flex items-center gap-2
                                                             hover:bg-[var(--surface-2)]"
                                                  >
                                                    <Edit3 className="w-4 h-4" /> Edit
                                                  </button>
                                                  <button
                                                    onClick={() => deleteMessage(msg.id)}
                                                    className="w-full px-3 py-2 text-left text-sm flex items-center gap-2
                                                             hover:bg-[var(--surface-2)] text-red-500"
                                                  >
                                                    <Trash2 className="w-4 h-4" /> Delete
                                                  </button>
                                                </>
                                              )}
                                            </motion.div>
                                          )}
                                        </AnimatePresence>

                                        {/* Time on hover for grouped messages */}
                                        {msg.isGrouped && isHovered && (
                                          <div className={`absolute top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)]
                                                        pointer-events-none whitespace-nowrap
                                                        ${isOwn ? 'right-full mr-2' : 'left-full ml-2'}`}>
                                            {formatTime(msg.created_at)}
                                          </div>
                                        )}

                                        {/* Tapback menu */}
                                        <AnimatePresence>
                                          {showTapbackMenu && (
                                            <motion.div
                                              initial={{ opacity: 0, scale: 0.9, y: 8 }}
                                              animate={{ opacity: 1, scale: 1, y: 0 }}
                                              exit={{ opacity: 0, scale: 0.9, y: 8 }}
                                              transition={{ duration: 0.15 }}
                                              className={`absolute ${isOwn ? 'right-0' : 'left-0'} bottom-full mb-2 z-20
                                                        bg-[var(--surface)] border border-[var(--border)]
                                                        rounded-2xl shadow-xl px-1.5 py-1 flex gap-0.5`}
                                            >
                                              {(Object.keys(TAPBACK_EMOJIS) as TapbackType[]).map((reaction) => {
                                                const myReaction = reactions.find(r => r.user === currentUser.name);
                                                const isSelected = myReaction?.reaction === reaction;
                                                return (
                                                  <button
                                                    key={reaction}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      toggleTapback(msg.id, reaction);
                                                    }}
                                                    className={`w-9 h-9 flex items-center justify-center rounded-full
                                                              transition-all duration-150 text-xl
                                                              ${isSelected
                                                                ? 'bg-[var(--accent)] scale-110 shadow-md'
                                                                : 'hover:bg-[var(--surface-2)] hover:scale-110'}`}
                                                  >
                                                    {TAPBACK_EMOJIS[reaction]}
                                                  </button>
                                                );
                                              })}
                                            </motion.div>
                                          )}
                                        </AnimatePresence>

                                        {/* Reactions display */}
                                        {Object.keys(reactionCounts).length > 0 && (
                                          <div
                                            className={`absolute ${isOwn ? '-left-2' : '-right-2'} -bottom-2.5 z-10`}
                                            onMouseEnter={() => setShowReactionsSummary(msg.id)}
                                            onMouseLeave={() => setShowReactionsSummary(null)}
                                          >
                                            <div className="bg-[var(--surface)] border border-[var(--border)]
                                                          rounded-full px-1.5 py-0.5 flex items-center gap-0.5 shadow-sm cursor-pointer">
                                              {(Object.entries(reactionCounts) as [TapbackType, number][]).map(([reaction, count]) => (
                                                <span key={reaction} className="flex items-center text-sm">
                                                  {TAPBACK_EMOJIS[reaction]}
                                                  {count > 1 && (
                                                    <span className="text-[10px] ml-0.5 text-[var(--text-muted)] font-medium">
                                                      {count}
                                                    </span>
                                                  )}
                                                </span>
                                              ))}
                                            </div>
                                            {/* Reactions summary tooltip */}
                                            <AnimatePresence>
                                              {showReactionsSummary === msg.id && (
                                                <motion.div
                                                  initial={{ opacity: 0, y: 5 }}
                                                  animate={{ opacity: 1, y: 0 }}
                                                  exit={{ opacity: 0, y: 5 }}
                                                  className={`absolute bottom-full mb-2 z-30
                                                            ${isOwn ? 'right-0' : 'left-0'}`}
                                                >
                                                  <ReactionsSummary reactions={reactions} users={users} />
                                                </motion.div>
                                              )}
                                            </AnimatePresence>
                                          </div>
                                        )}
                                      </div>

                                      {/* Read receipts */}
                                      {isOwn && isLastOwnMessage && (
                                        <div className={`flex items-center gap-1 mt-1 text-[10px] text-[var(--text-muted)]
                                                      ${reactions.length > 0 ? 'mt-3' : ''}`}>
                                          {readBy.length === 0 ? (
                                            <span className="flex items-center gap-0.5">
                                              <Check className="w-3 h-3" />
                                              Sent
                                            </span>
                                          ) : (
                                            <span className="flex items-center gap-0.5 text-blue-500">
                                              <CheckCheck className="w-3 h-3" />
                                              {conversation?.type === 'dm' ? 'Read' : `Read by ${readBy.length}`}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              </div>
                            );
                          })}

                          {/* Typing indicator */}
                          <AnimatePresence>
                            {activeTypingUsers.length > 0 && (
                              <TypingIndicator userName={activeTypingUsers[0]} />
                            )}
                          </AnimatePresence>
                        </>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Scroll to bottom button */}
                    <AnimatePresence>
                      {!isAtBottom && filteredMessages.length > 0 && (
                        <motion.button
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          onClick={() => scrollToBottom()}
                          className="absolute bottom-[120px] left-1/2 -translate-x-1/2
                                   bg-[var(--surface)] border border-[var(--border)]
                                   rounded-full px-3 py-1.5 shadow-lg flex items-center gap-1.5
                                   text-sm text-[var(--foreground)] hover:bg-[var(--surface-2)]
                                   transition-colors"
                        >
                          <ChevronDown className="w-4 h-4" />
                          <span>New messages</span>
                        </motion.button>
                      )}
                    </AnimatePresence>

                    {/* Reply preview bar */}
                    <AnimatePresence>
                      {replyingTo && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm">
                              <Reply className="w-4 h-4 text-[var(--accent)]" />
                              <span className="text-[var(--text-muted)]">Replying to</span>
                              <span className="font-medium">{replyingTo.created_by}</span>
                            </div>
                            <button
                              onClick={() => setReplyingTo(null)}
                              className="p-1 hover:bg-[var(--surface)] rounded"
                            >
                              <X className="w-4 h-4 text-[var(--text-muted)]" />
                            </button>
                          </div>
                          <p className="text-sm text-[var(--text-muted)] truncate mt-1">
                            {replyingTo.text}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Edit mode bar */}
                    <AnimatePresence>
                      {editingMessage && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-[var(--border)] bg-yellow-500/10 px-3 py-2"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-sm">
                              <Edit3 className="w-4 h-4 text-yellow-500" />
                              <span className="font-medium">Editing message</span>
                            </div>
                            <button
                              onClick={() => {
                                setEditingMessage(null);
                                setEditText('');
                              }}
                              className="p-1 hover:bg-[var(--surface)] rounded"
                            >
                              <X className="w-4 h-4 text-[var(--text-muted)]" />
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={handleKeyDown}
                              className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)]
                                       bg-[var(--background)] text-[var(--foreground)] text-sm
                                       focus:outline-none focus:border-[var(--accent)]"
                              autoFocus
                            />
                            <button
                              onClick={saveEdit}
                              disabled={!editText.trim()}
                              className="px-3 py-2 bg-[var(--accent)] text-white rounded-lg text-sm
                                       hover:bg-[var(--allstate-blue-dark)] disabled:opacity-50"
                            >
                              Save
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Input Area */}
                    {!editingMessage && (
                      <div className="p-3 border-t border-[var(--border)] bg-[var(--surface)] relative">
                        {/* Mention autocomplete */}
                        <AnimatePresence>
                          {showMentions && (
                            <MentionAutocomplete
                              users={otherUsers}
                              filter={mentionFilter}
                              onSelect={insertMention}
                              position={{ top: 50, left: 40 }}
                            />
                          )}
                        </AnimatePresence>

                        {/* Emoji Picker */}
                        <AnimatePresence>
                          {showEmojiPicker && (
                            <motion.div
                              ref={emojiPickerRef}
                              initial={{ opacity: 0, y: 8, height: 0 }}
                              animate={{ opacity: 1, y: 0, height: 'auto' }}
                              exit={{ opacity: 0, y: 8, height: 0 }}
                              className="mb-2 bg-[var(--background)] border border-[var(--border)]
                                       rounded-xl shadow-lg overflow-hidden"
                            >
                              <div className="flex border-b border-[var(--border)]">
                                {(Object.keys(EMOJI_CATEGORIES) as (keyof typeof EMOJI_CATEGORIES)[]).map((cat) => (
                                  <button
                                    key={cat}
                                    onClick={() => setEmojiCategory(cat)}
                                    className={`flex-1 py-2 text-xs font-medium capitalize transition-colors
                                              ${emojiCategory === cat
                                                ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-b-2 border-[var(--accent)]'
                                                : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'}`}
                                  >
                                    {cat}
                                  </button>
                                ))}
                              </div>
                              <div className="p-2">
                                <div className="grid grid-cols-6 gap-1">
                                  {EMOJI_CATEGORIES[emojiCategory].map((emoji, i) => (
                                    <button
                                      key={`${emoji}-${i}`}
                                      onClick={() => addEmoji(emoji)}
                                      className="w-9 h-9 flex items-center justify-center rounded-lg
                                               hover:bg-[var(--surface-2)] transition-colors text-xl
                                               hover:scale-110 active:scale-95"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="flex items-end gap-2">
                          <button
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            disabled={!tableExists}
                            className={`p-2 rounded-full transition-all duration-200
                                     hover:bg-[var(--surface-2)] disabled:opacity-50
                                     disabled:cursor-not-allowed
                                     ${showEmojiPicker ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}
                          >
                            <Smile className="w-5 h-5" />
                          </button>

                          {/* Mention button */}
                          <button
                            onClick={() => {
                              setNewMessage(prev => prev + '@');
                              setShowMentions(true);
                              setMentionFilter('');
                              inputRef.current?.focus();
                            }}
                            disabled={!tableExists}
                            className="p-2 rounded-full transition-all duration-200
                                     hover:bg-[var(--surface-2)] disabled:opacity-50
                                     text-[var(--text-muted)]"
                            title="Mention someone"
                          >
                            <AtSign className="w-5 h-5" />
                          </button>

                          <textarea
                            ref={inputRef}
                            value={newMessage}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder={
                              !tableExists
                                ? "Chat not available"
                                : !conversation
                                ? "Select a conversation"
                                : conversation.type === 'team'
                                ? "Message team..."
                                : `Message ${conversation.userName}...`
                            }
                            disabled={!tableExists}
                            rows={1}
                            className="flex-1 px-4 py-2 rounded-2xl border border-[var(--border)]
                                     bg-[var(--background)] text-[var(--foreground)]
                                     placeholder:text-[var(--text-muted)]
                                     focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20
                                     resize-none max-h-24 transition-all text-[15px]
                                     disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              height: 'auto',
                              minHeight: '40px',
                              maxHeight: '96px'
                            }}
                            onInput={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = Math.min(target.scrollHeight, 96) + 'px';
                            }}
                          />
                          <button
                            onClick={sendMessage}
                            disabled={!newMessage.trim() || !tableExists}
                            className="p-2.5 rounded-full bg-[var(--accent)] text-white
                                     hover:bg-[var(--allstate-blue-dark)] disabled:opacity-40
                                     disabled:cursor-not-allowed transition-all duration-200
                                     hover:scale-105 active:scale-95 shadow-sm
                                     disabled:hover:scale-100"
                          >
                            <Send className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Task Modal */}
      <AnimatePresence>
        {showCreateTaskModal && taskFromMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowCreateTaskModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--surface)] rounded-xl shadow-2xl p-6 max-w-md w-full"
            >
              <h3 className="text-lg font-semibold mb-4">Create Task from Message</h3>
              <div className="p-3 bg-[var(--surface-2)] rounded-lg mb-4">
                <p className="text-sm text-[var(--text-muted)]">From {taskFromMessage.created_by}:</p>
                <p className="mt-1">{taskFromMessage.text}</p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowCreateTaskModal(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--border)]
                           hover:bg-[var(--surface-2)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTask}
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white
                           hover:bg-[var(--allstate-blue-dark)] transition-colors"
                >
                  Create Task
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
