'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { ChatMessage, AuthUser, ChatConversation, TapbackType, MessageReaction } from '@/types/todo';
import { v4 as uuidv4 } from 'uuid';
import {
  MessageSquare, Send, X, Minimize2, Maximize2, ChevronDown,
  Users, ChevronLeft, User, Smile, Check, CheckCheck, Wifi, WifiOff, Bell, BellOff
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
    tag: 'chat-message', // Prevents duplicate notifications
    requireInteraction: false,
  });

  if (onClick) {
    notification.onclick = () => {
      window.focus();
      onClick();
      notification.close();
    };
  }

  // Auto-close after 5 seconds
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

interface ChatPanelProps {
  currentUser: AuthUser;
  users: { name: string; color: string }[];
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

export default function ChatPanel({ currentUser, users }: ChatPanelProps) {
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Ignore autoplay errors
      });
    }
  }, []);

  // Function to handle enabling notifications
  const enableNotifications = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setNotificationsEnabled(granted);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const lastTypingBroadcastRef = useRef<number>(0);

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

  // Filter messages for current conversation
  const filteredMessages = useMemo(() => {
    if (!conversation) return [];
    if (conversation.type === 'team') {
      return messages.filter(m => !m.recipient);
    } else {
      const otherUser = conversation.userName;
      return messages.filter(m =>
        (m.created_by === currentUser.name && m.recipient === otherUser) ||
        (m.created_by === otherUser && m.recipient === currentUser.name)
      );
    }
  }, [messages, conversation, currentUser.name]);

  // Get conversations sorted by most recent activity
  const sortedConversations = useMemo(() => {
    const conversations: { conv: ChatConversation; lastMessage: ChatMessage | null; lastActivity: number }[] = [];

    // Team chat
    const teamMessages = messages.filter(m => !m.recipient);
    const lastTeamMsg = teamMessages.length > 0 ? teamMessages[teamMessages.length - 1] : null;
    conversations.push({
      conv: { type: 'team' },
      lastMessage: lastTeamMsg,
      lastActivity: lastTeamMsg ? new Date(lastTeamMsg.created_at).getTime() : 0
    });

    // DMs for each user
    otherUsers.forEach(user => {
      const dmMessages = messages.filter(m =>
        (m.created_by === currentUser.name && m.recipient === user.name) ||
        (m.created_by === user.name && m.recipient === currentUser.name)
      );
      const lastMsg = dmMessages.length > 0 ? dmMessages[dmMessages.length - 1] : null;
      conversations.push({
        conv: { type: 'dm', userName: user.name },
        lastMessage: lastMsg,
        lastActivity: lastMsg ? new Date(lastMsg.created_at).getTime() : 0
      });
    });

    // Sort by most recent activity (conversations with no messages go to bottom)
    return conversations.sort((a, b) => {
      if (a.lastActivity === 0 && b.lastActivity === 0) return 0;
      if (a.lastActivity === 0) return 1;
      if (b.lastActivity === 0) return -1;
      return b.lastActivity - a.lastActivity;
    });
  }, [messages, otherUsers, currentUser.name]);

  // Get the most recent conversation
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

      // Calculate initial unread counts based on read_by field
      const initialUnreadCounts: Record<string, number> = {};
      messages.forEach((msg: ChatMessage) => {
        // Skip messages from current user
        if (msg.created_by === currentUser.name) return;

        // Check if current user has read this message
        const readBy = msg.read_by || [];
        if (readBy.includes(currentUser.name)) return;

        // Determine the conversation key for this message
        let convKey: string | null = null;
        if (!msg.recipient) {
          // Team message
          convKey = 'team';
        } else if (msg.recipient === currentUser.name) {
          // DM sent to current user
          convKey = msg.created_by;
        }

        if (convKey) {
          initialUnreadCounts[convKey] = (initialUnreadCounts[convKey] || 0) + 1;
        }
      });

      setUnreadCounts(initialUnreadCounts);
    }
    setLoading(false);
  }, [currentUser.name]);

  // Track state in refs to avoid re-subscribing
  const isOpenRef = useRef(isOpen);
  const isAtBottomRef = useRef(isAtBottom);
  const conversationRef = useRef(conversation);
  const showConversationListRef = useRef(showConversationList);
  const playNotificationSoundRef = useRef(playNotificationSound);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { isAtBottomRef.current = isAtBottom; }, [isAtBottom]);
  useEffect(() => { conversationRef.current = conversation; }, [conversation]);
  useEffect(() => { showConversationListRef.current = showConversationList; }, [showConversationList]);
  useEffect(() => { playNotificationSoundRef.current = playNotificationSound; }, [playNotificationSound]);

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

  // Real-time subscription for messages and typing
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

            // Clear typing indicator for sender
            setTypingUsers(prev => ({ ...prev, [newMsg.created_by]: false }));

            // Don't count own messages as unread
            if (newMsg.created_by === currentUser.name) return;

            // Determine which conversation this message belongs to for the current user
            let msgConvKey: string | null = null;
            if (!newMsg.recipient) {
              // Team message - always counts for team conversation
              msgConvKey = 'team';
            } else if (newMsg.recipient === currentUser.name) {
              // DM sent TO current user - counts under sender's conversation
              msgConvKey = newMsg.created_by;
            }
            // If recipient is someone else, this message isn't relevant to current user

            if (!msgConvKey) return;

            // Check if user is currently viewing this conversation
            const currentConv = conversationRef.current;
            const currentKey = currentConv ? (currentConv.type === 'team' ? 'team' : currentConv.userName) : null;
            const isPanelOpen = isOpenRef.current;
            const isViewingConversation = !showConversationListRef.current;
            const isViewingThisConv = currentKey === msgConvKey;
            const isAtBottomOfChat = isAtBottomRef.current;

            // Only mark as unread if user is NOT actively viewing this conversation at the bottom
            const shouldMarkUnread = !isPanelOpen || !isViewingConversation || !isViewingThisConv || !isAtBottomOfChat;

            if (shouldMarkUnread) {
              setUnreadCounts(prev => ({
                ...prev,
                [msgConvKey]: (prev[msgConvKey] || 0) + 1
              }));

              // Play notification sound
              playNotificationSoundRef.current();

              // Show browser notification if page is not focused
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
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as ChatMessage;
            setMessages((prev) => prev.map(m =>
              m.id === updatedMsg.id ? { ...m, reactions: updatedMsg.reactions, read_by: updatedMsg.read_by } : m
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
          // Clear typing after 3 seconds
          setTimeout(() => {
            setTypingUsers(prev => ({ ...prev, [payload.user]: false }));
          }, 3000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(typingChannel);
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

  const sendMessage = async () => {
    const text = newMessage.trim();
    if (!text || !conversation) return;

    const message: ChatMessage = {
      id: uuidv4(),
      text,
      created_by: currentUser.name,
      created_at: new Date().toISOString(),
      recipient: conversation.type === 'dm' ? conversation.userName : null,
    };

    setMessages((prev) => [...prev, message]);
    setNewMessage('');
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
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim()) {
      broadcastTyping();
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
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [tapbackMessageId]);

  // Format relative time for conversation list
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

  const groupedMessages = filteredMessages.reduce((acc, msg, idx) => {
    const prevMsg = filteredMessages[idx - 1];
    const isGrouped = prevMsg && prevMsg.created_by === msg.created_by &&
      new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 60000;

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

  // Get typing users for current conversation
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
              height: isMinimized ? 'auto' : 'min(550px, 80vh)'
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)]
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
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                                   ring-2 ring-white/30"
                        style={{ backgroundColor: getUserColor(conversation.userName) }}
                      >
                        {getInitials(conversation.userName)}
                      </div>
                    ) : (
                      <MessageSquare className="w-5 h-5" />
                    )}
                    <span className="font-semibold">{getConversationTitle()}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Notification toggle */}
                <button
                  onClick={enableNotifications}
                  className={`p-1.5 rounded-lg transition-colors ${
                    notificationsEnabled
                      ? 'bg-green-500/20 text-green-200'
                      : 'hover:bg-white/20 text-white/70'
                  }`}
                  title={notificationsEnabled ? 'Notifications enabled' : 'Enable notifications'}
                  aria-label={notificationsEnabled ? 'Notifications enabled' : 'Enable notifications'}
                >
                  {notificationsEnabled ? (
                    <Bell className="w-4 h-4" />
                  ) : (
                    <BellOff className="w-4 h-4" />
                  )}
                </button>
                {/* Connection status */}
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs
                             ${connected ? 'bg-green-500/20' : 'bg-red-500/20'}`}
                  title={connected ? 'Connected' : 'Disconnected'}
                >
                  {connected ? (
                    <Wifi className="w-3 h-3" />
                  ) : (
                    <WifiOff className="w-3 h-3" />
                  )}
                  <span className="hidden sm:inline">{connected ? 'Live' : 'Offline'}</span>
                </div>
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                  aria-label={isMinimized ? 'Expand chat' : 'Minimize chat'}
                >
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                  aria-label="Close chat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            {!isMinimized && (
              <>
                {showConversationList ? (
                  /* Conversation List - sorted by recency */
                  <div className="flex-1 overflow-y-auto bg-[var(--background)]">
                    {sortedConversations.map(({ conv, lastMessage }) => {
                      const isTeam = conv.type === 'team';
                      const userName = conv.type === 'dm' ? conv.userName : '';
                      const userColor = isTeam ? 'var(--accent)' : getUserColor(userName);
                      const unreadCount = unreadCounts[isTeam ? 'team' : userName] || 0;
                      const isSelected = conversation?.type === conv.type &&
                        (conv.type === 'team' || (conv.type === 'dm' && conversation?.type === 'dm' && conversation.userName === conv.userName));

                      return (
                        <button
                          key={isTeam ? 'team' : userName}
                          onClick={() => selectConversation(conv)}
                          className={`w-full px-4 py-3 flex items-center gap-3
                                    hover:bg-[var(--surface-2)] transition-colors border-b border-[var(--border)]/50
                                    ${isSelected ? 'bg-[var(--accent)]/10' : ''}
                                    ${unreadCount > 0 ? 'bg-[var(--accent)]/5' : ''}`}
                        >
                          <div className="relative flex-shrink-0">
                            <div
                              className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shadow-sm
                                         ${isTeam ? 'bg-[var(--accent)]' : ''}`}
                              style={!isTeam ? { backgroundColor: userColor } : undefined}
                            >
                              {isTeam ? <Users className="w-5 h-5" /> : getInitials(userName)}
                            </div>
                            {unreadCount > 0 && (
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
                                              ${unreadCount > 0 ? 'font-semibold' : ''}`}>
                                {isTeam ? 'Team Chat' : userName}
                              </span>
                              {lastMessage && (
                                <span className={`text-xs flex-shrink-0
                                                ${unreadCount > 0 ? 'text-[var(--accent)] font-medium' : 'text-[var(--text-muted)]'}`}>
                                  {formatRelativeTime(lastMessage.created_at)}
                                </span>
                              )}
                            </div>
                            <div className={`text-sm truncate mt-0.5
                                          ${unreadCount > 0 ? 'text-[var(--foreground)] font-medium' : 'text-[var(--text-muted)]'}`}>
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
                            <p className="font-medium text-[var(--foreground)]">No messages yet</p>
                            <p className="text-sm mt-1">
                              {conversation?.type === 'team'
                                ? 'Be the first to say hello!'
                                : conversation?.type === 'dm'
                                ? `Start a conversation with ${conversation.userName}`
                                : 'Select a conversation'}
                            </p>
                          </div>
                          <button
                            onClick={() => inputRef.current?.focus()}
                            className="mt-2 px-4 py-2 bg-[var(--accent)] text-white rounded-full text-sm
                                     hover:bg-[var(--allstate-blue-dark)] transition-colors"
                          >
                            Send a message
                          </button>
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

                            const reactionCounts = reactions.reduce((acc, r) => {
                              acc[r.reaction] = (acc[r.reaction] || 0) + 1;
                              return acc;
                            }, {} as Record<TapbackType, number>);

                            return (
                              <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.15 }}
                                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}
                                          ${msg.isGrouped ? 'mt-0.5' : 'mt-3'} group relative`}
                                onMouseEnter={() => setHoveredMessageId(msg.id)}
                                onMouseLeave={() => setHoveredMessageId(null)}
                              >
                                <div className={`flex items-end gap-2 max-w-[85%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                                  {/* Avatar - only show for first in group */}
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
                                    {/* Name and time - only show for first in group */}
                                    {!msg.isGrouped && (
                                      <div className={`flex items-center gap-2 mb-0.5 text-xs
                                                    ${isOwn ? 'flex-row-reverse' : ''}`}>
                                        <span className="font-medium text-[var(--foreground)]">
                                          {isOwn ? 'You' : msg.created_by}
                                        </span>
                                        <span className="text-[var(--text-muted)]">
                                          {formatTime(msg.created_at)}
                                        </span>
                                      </div>
                                    )}

                                    {/* Message bubble with tapback trigger */}
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
                                        {msg.text}
                                      </div>

                                      {/* Show time on hover for grouped messages */}
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
                                                  aria-label={`React with ${reaction}`}
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
                                        <div className={`absolute ${isOwn ? '-left-2' : '-right-2'}
                                                      -bottom-2.5 z-10`}>
                                          <div className="bg-[var(--surface)] border border-[var(--border)]
                                                        rounded-full px-1.5 py-0.5 flex items-center gap-0.5 shadow-sm">
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
                                        </div>
                                      )}
                                    </div>

                                    {/* Read receipts - only show for last own message */}
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
                          className="absolute bottom-[88px] left-1/2 -translate-x-1/2
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

                    {/* Input Area */}
                    <div className="p-3 border-t border-[var(--border)] bg-[var(--surface)]">
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
                            {/* Category tabs */}
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
                            {/* Emoji grid */}
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
                          aria-label="Open emoji picker"
                        >
                          <Smile className="w-5 h-5" />
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
                          aria-label="Send message"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
