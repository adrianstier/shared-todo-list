'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { ChatMessage, AuthUser, ChatConversation } from '@/types/todo';
import { v4 as uuidv4 } from 'uuid';
import {
  MessageSquare, Send, X, Minimize2, Maximize2, ChevronDown,
  Users, ChevronLeft, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatPanelProps {
  currentUser: AuthUser;
  users: { name: string; color: string }[];
}

export default function ChatPanel({ currentUser, users }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [tableExists, setTableExists] = useState(true);
  const [conversation, setConversation] = useState<ChatConversation>({ type: 'team' });
  const [showConversationList, setShowConversationList] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAtBottom(isBottom);
    if (isBottom && isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  // Filter messages for current conversation
  const filteredMessages = useMemo(() => {
    if (conversation.type === 'team') {
      // Team chat: messages with no recipient (null or undefined)
      return messages.filter(m => !m.recipient);
    } else {
      // DM: messages between current user and the other user
      const otherUser = conversation.userName;
      return messages.filter(m =>
        (m.created_by === currentUser.name && m.recipient === otherUser) ||
        (m.created_by === otherUser && m.recipient === currentUser.name)
      );
    }
  }, [messages, conversation, currentUser.name]);

  // Fetch all messages
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
      setMessages(data || []);
      setTableExists(true);
    }
    setLoading(false);
  }, []);

  // Track state in refs to avoid re-subscribing
  const isOpenRef = useRef(isOpen);
  const isAtBottomRef = useRef(isAtBottom);
  const conversationRef = useRef(conversation);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { isAtBottomRef.current = isAtBottom; }, [isAtBottom]);
  useEffect(() => { conversationRef.current = conversation; }, [conversation]);

  // Real-time subscription
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    fetchMessages();

    const channel = supabase
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
            // Check if message is relevant to current user
            const isRelevant = !newMsg.recipient || // team message
              newMsg.recipient === currentUser.name || // DM to me
              newMsg.created_by === currentUser.name; // my message

            if (isRelevant && newMsg.created_by !== currentUser.name) {
              // Increment unread if chat is closed or not at bottom
              if (!isOpenRef.current || !isAtBottomRef.current) {
                setUnreadCount((prev) => prev + 1);
              }
            }
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMessages, currentUser.name]);

  // Auto-scroll on new messages if at bottom
  useEffect(() => {
    if (isAtBottom && isOpen && !showConversationList) {
      scrollToBottom();
    }
  }, [filteredMessages, isAtBottom, isOpen, scrollToBottom, showConversationList]);

  // Focus input when opening chat or switching conversations
  useEffect(() => {
    if (isOpen && !isMinimized && !showConversationList) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setUnreadCount(0);
    }
  }, [isOpen, isMinimized, showConversationList]);

  const sendMessage = async () => {
    const text = newMessage.trim();
    if (!text) return;

    const message: ChatMessage = {
      id: uuidv4(),
      text,
      created_by: currentUser.name,
      created_at: new Date().toISOString(),
      recipient: conversation.type === 'dm' ? conversation.userName : null,
    };

    // Optimistic update
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

  // Get unread count per conversation
  const getConversationUnread = useCallback((conv: ChatConversation) => {
    // For now, we don't track per-conversation unread. Could be added later.
    return 0;
  }, []);

  // Group consecutive messages by same user
  const groupedMessages = filteredMessages.reduce((acc, msg, idx) => {
    const prevMsg = filteredMessages[idx - 1];
    const isGrouped = prevMsg && prevMsg.created_by === msg.created_by &&
      new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 60000;

    return [...acc, { ...msg, isGrouped }];
  }, [] as (ChatMessage & { isGrouped: boolean })[]);

  const selectConversation = (conv: ChatConversation) => {
    setConversation(conv);
    setShowConversationList(false);
  };

  const getConversationTitle = () => {
    if (conversation.type === 'team') return 'Team Chat';
    return conversation.userName;
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full
                       bg-[var(--accent)] hover:bg-[var(--allstate-blue-dark)]
                       text-white shadow-lg hover:shadow-xl
                       transition-all duration-200 flex items-center justify-center
                       group"
          >
            <MessageSquare className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500
                             rounded-full text-xs font-bold flex items-center
                             justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
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
              height: isMinimized ? 'auto' : '500px'
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)]
                       bg-[var(--surface)] border border-[var(--border)]
                       rounded-2xl shadow-2xl overflow-hidden flex flex-col"
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
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    {conversation.type === 'team' ? (
                      <Users className="w-5 h-5" />
                    ) : (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ backgroundColor: getUserColor(conversation.userName) }}
                      >
                        {getInitials(conversation.userName)}
                      </div>
                    )}
                    <span className="font-semibold">{getConversationTitle()}</span>
                  </>
                )}
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
              </div>
              <div className="flex items-center gap-1">
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

            {/* Content */}
            {!isMinimized && (
              <>
                {showConversationList ? (
                  /* Conversation List */
                  <div className="flex-1 overflow-y-auto bg-[var(--background)]">
                    {/* Team Chat Option */}
                    <button
                      onClick={() => selectConversation({ type: 'team' })}
                      className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--surface-2)] transition-colors
                                ${conversation.type === 'team' ? 'bg-[var(--accent-light)]' : ''}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-white">
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-[var(--foreground)]">Team Chat</div>
                        <div className="text-sm text-[var(--text-muted)]">Message everyone</div>
                      </div>
                    </button>

                    {/* Divider */}
                    <div className="px-4 py-2">
                      <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                        Direct Messages
                      </div>
                    </div>

                    {/* User List for DMs */}
                    {otherUsers.length === 0 ? (
                      <div className="px-4 py-8 text-center text-[var(--text-muted)]">
                        <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No other users yet</p>
                      </div>
                    ) : (
                      otherUsers.map((user) => {
                        const isSelected = conversation.type === 'dm' && conversation.userName === user.name;
                        return (
                          <button
                            key={user.name}
                            onClick={() => selectConversation({ type: 'dm', userName: user.name })}
                            className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--surface-2)] transition-colors
                                      ${isSelected ? 'bg-[var(--accent-light)]' : ''}`}
                          >
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                              style={{ backgroundColor: user.color }}
                            >
                              {getInitials(user.name)}
                            </div>
                            <div className="flex-1 text-left">
                              <div className="font-medium text-[var(--foreground)]">{user.name}</div>
                              <div className="text-sm text-[var(--text-muted)]">Direct message</div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                ) : (
                  /* Messages View */
                  <>
                    <div
                      ref={messagesContainerRef}
                      onScroll={handleScroll}
                      className="flex-1 overflow-y-auto p-4 space-y-1 bg-[var(--background)]"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
                          Loading messages...
                        </div>
                      ) : !tableExists ? (
                        <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] gap-2 p-4 text-center">
                          <MessageSquare className="w-12 h-12 opacity-30" />
                          <p className="font-medium">Chat Setup Required</p>
                          <p className="text-sm">Run the messages table migration in Supabase to enable chat.</p>
                        </div>
                      ) : filteredMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] gap-2">
                          <MessageSquare className="w-12 h-12 opacity-30" />
                          <p>No messages yet</p>
                          <p className="text-sm">
                            {conversation.type === 'team'
                              ? 'Start the team conversation!'
                              : `Start chatting with ${conversation.userName}!`}
                          </p>
                        </div>
                      ) : (
                        groupedMessages.map((msg) => {
                          const isOwn = msg.created_by === currentUser.name;
                          const userColor = getUserColor(msg.created_by);

                          return (
                            <motion.div
                              key={msg.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`flex ${isOwn ? 'justify-end' : 'justify-start'}
                                        ${msg.isGrouped ? 'mt-0.5' : 'mt-3'}`}
                            >
                              <div className={`flex items-end gap-2 max-w-[80%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                                {/* Avatar - only show for first in group */}
                                {!msg.isGrouped ? (
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center
                                             text-white text-xs font-bold flex-shrink-0"
                                    style={{ backgroundColor: userColor }}
                                  >
                                    {getInitials(msg.created_by)}
                                  </div>
                                ) : (
                                  <div className="w-8 flex-shrink-0" />
                                )}

                                <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                                  {/* Name and time - only show for first in group */}
                                  {!msg.isGrouped && (
                                    <div className={`flex items-center gap-2 mb-1 text-xs
                                                  ${isOwn ? 'flex-row-reverse' : ''}`}>
                                      <span className="font-medium text-[var(--foreground)]">
                                        {isOwn ? 'You' : msg.created_by}
                                      </span>
                                      <span className="text-[var(--text-muted)]">
                                        {formatTime(msg.created_at)}
                                      </span>
                                    </div>
                                  )}

                                  {/* Message bubble */}
                                  <div
                                    className={`px-3 py-2 rounded-2xl break-words whitespace-pre-wrap
                                              ${isOwn
                                                ? 'bg-[var(--accent)] text-white rounded-br-md'
                                                : 'bg-[var(--surface-2)] text-[var(--foreground)] rounded-bl-md'
                                              }`}
                                  >
                                    {msg.text}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Scroll to bottom button */}
                    <AnimatePresence>
                      {!isAtBottom && filteredMessages.length > 0 && (
                        <motion.button
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          onClick={() => scrollToBottom()}
                          className="absolute bottom-20 left-1/2 -translate-x-1/2
                                   bg-[var(--surface)] border border-[var(--border)]
                                   rounded-full px-3 py-1.5 shadow-lg flex items-center gap-1
                                   text-sm text-[var(--text-muted)] hover:text-[var(--foreground)]
                                   transition-colors"
                        >
                          <ChevronDown className="w-4 h-4" />
                          {unreadCount > 0 && `${unreadCount} new`}
                        </motion.button>
                      )}
                    </AnimatePresence>

                    {/* Input Area */}
                    <div className="p-3 border-t border-[var(--border)] bg-[var(--surface)]">
                      <div className="flex items-end gap-2">
                        <textarea
                          ref={inputRef}
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder={
                            !tableExists
                              ? "Chat not available"
                              : conversation.type === 'team'
                              ? "Message the team..."
                              : `Message ${conversation.userName}...`
                          }
                          disabled={!tableExists}
                          rows={1}
                          className="flex-1 px-4 py-2.5 rounded-2xl border border-[var(--border)]
                                   bg-[var(--background)] text-[var(--foreground)]
                                   placeholder:text-[var(--text-muted)]
                                   focus:outline-none focus:border-[var(--accent)]
                                   resize-none max-h-32 transition-colors
                                   disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            height: 'auto',
                            minHeight: '42px',
                            maxHeight: '128px'
                          }}
                          onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                          }}
                        />
                        <button
                          onClick={sendMessage}
                          disabled={!newMessage.trim() || !tableExists}
                          className="p-2.5 rounded-full bg-[var(--accent)] text-white
                                   hover:bg-[var(--allstate-blue-dark)] disabled:opacity-50
                                   disabled:cursor-not-allowed transition-all duration-200
                                   hover:scale-105 active:scale-95"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-2 text-center">
                        Press Enter to send, Shift+Enter for new line
                      </p>
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
