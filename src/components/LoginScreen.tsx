'use client';

import { useState, useEffect, useRef } from 'react';
import { UserPlus, AlertCircle, ChevronLeft, Lock, CheckSquare, Search } from 'lucide-react';
import { AuthUser } from '@/types/todo';
import {
  hashPin,
  verifyPin,
  isValidPin,
  getRandomUserColor,
  getUserInitials,
  isLockedOut,
  incrementLockout,
  clearLockout,
  setStoredSession,
  getLockoutState,
} from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface LoginScreenProps {
  onLogin: (user: AuthUser) => void;
}

type Screen = 'users' | 'pin' | 'register';

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [screen, setScreen] = useState<Screen>('users');
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<AuthUser | null>(null);
  const [pin, setPin] = useState(['', '', '', '']);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState(3);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const newPinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmPinRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('users')
        .select('id, name, color, role, created_at, last_login')
        .order('name');
      if (data) {
        // Default role to 'member' if not set
        setUsers(data.map(u => ({ ...u, role: u.role || 'member' })));
      }
      setLoading(false);
    };
    fetchUsers();
  }, []);

  // Filter users based on search query
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group users alphabetically for large lists
  const groupedUsers = filteredUsers.reduce((acc, user) => {
    const firstLetter = user.name[0].toUpperCase();
    if (!acc[firstLetter]) acc[firstLetter] = [];
    acc[firstLetter].push(user);
    return acc;
  }, {} as Record<string, AuthUser[]>);

  useEffect(() => {
    if (!selectedUser) return;
    const checkLockout = () => {
      const { locked, remainingSeconds } = isLockedOut(selectedUser.id);
      setLockoutSeconds(locked ? remainingSeconds : 0);
      // Update attempts remaining
      const state = getLockoutState(selectedUser.id);
      setAttemptsRemaining(Math.max(0, 3 - state.attempts));
    };
    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, [selectedUser]);

  const handleUserSelect = (user: AuthUser) => {
    setSelectedUser(user);
    setScreen('pin');
    setPin(['', '', '', '']);
    setError('');
    // Reset attempts display
    const state = getLockoutState(user.id);
    setAttemptsRemaining(Math.max(0, 3 - state.attempts));
    setTimeout(() => pinRefs.current[0]?.focus(), 100);
  };

  const handlePinChange = (
    index: number,
    value: string,
    refs: React.RefObject<(HTMLInputElement | null)[]>,
    pinState: string[],
    setPinState: (p: string[]) => void
  ) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = [...pinState];
    newPin[index] = value.slice(-1);
    setPinState(newPin);
    if (value && index < 3) {
      refs.current?.[index + 1]?.focus();
    }
  };

  const handlePinKeyDown = (
    e: React.KeyboardEvent,
    index: number,
    refs: React.RefObject<(HTMLInputElement | null)[]>,
    pinState: string[],
  ) => {
    if (e.key === 'Backspace' && !pinState[index] && index > 0) {
      refs.current?.[index - 1]?.focus();
    }
  };

  const handlePinSubmit = async () => {
    if (!selectedUser || lockoutSeconds > 0) return;

    const pinString = pin.join('');
    if (!isValidPin(pinString)) {
      setError('Enter a 4-digit PIN');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const { data } = await supabase
        .from('users')
        .select('pin_hash')
        .eq('id', selectedUser.id)
        .single();

      if (!data) {
        setError('User not found');
        setIsSubmitting(false);
        return;
      }

      const isValid = await verifyPin(pinString, data.pin_hash);

      if (isValid) {
        clearLockout(selectedUser.id);
        await supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', selectedUser.id);
        setStoredSession(selectedUser);
        onLogin(selectedUser);
      } else {
        const lockout = incrementLockout(selectedUser.id);
        const remaining = Math.max(0, 3 - lockout.attempts);
        setAttemptsRemaining(remaining);
        if (lockout.lockedUntil) {
          setError('Too many attempts. Please wait.');
        } else {
          setError(`Incorrect PIN`);
        }
        setPin(['', '', '', '']);
        pinRefs.current[0]?.focus();
      }
    } catch {
      setError('Something went wrong.');
    }

    setIsSubmitting(false);
  };

  const handleRegister = async () => {
    const name = newUserName.trim();
    if (!name) {
      setError('Enter your name');
      return;
    }

    const pinString = newUserPin.join('');
    if (!isValidPin(pinString)) {
      setError('Enter a 4-digit PIN');
      return;
    }

    const confirmString = confirmPin.join('');
    if (pinString !== confirmString) {
      setError('PINs don\'t match');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const pinHash = await hashPin(pinString);
      const color = getRandomUserColor();

      const { data, error: insertError } = await supabase
        .from('users')
        .insert({ name, pin_hash: pinHash, color, role: 'member' })
        .select('id, name, color, role, created_at, last_login')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          setError('Name already taken');
        } else {
          setError('Failed to create account');
        }
        setIsSubmitting(false);
        return;
      }

      if (data) {
        const userData = { ...data, role: data.role || 'member' };
        setStoredSession(userData);
        onLogin(userData);
      }
    } catch {
      setError('Something went wrong.');
    }

    setIsSubmitting(false);
  };

  useEffect(() => {
    if (screen === 'pin' && pin.every((d) => d !== '') && !isSubmitting) {
      handlePinSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, screen]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-[#0033A0] to-slate-900">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-[#D4A853]/30 border-t-[#D4A853] rounded-full animate-spin" />
          <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-b-white/20 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-[#0033A0] to-slate-900 p-4 overflow-hidden">
      {/* Skip link for accessibility */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:z-50">
        Skip to content
      </a>

      {/* Animated background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Floating orbs */}
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-[#D4A853]/15 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-[#0033A0]/40 rounded-full blur-[80px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 rounded-full blur-[120px]" />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}
        />

      </div>

      <div id="main-content" className="w-full max-w-[calc(100vw-2rem)] sm:max-w-sm relative z-10">
        {screen === 'users' && (
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/20 overflow-hidden border border-white/20 transition-all duration-300 hover:shadow-[#D4A853]/10">
            {/* Premium Header with gradient accent */}
            <div className="relative p-6 sm:p-8 text-center overflow-hidden">
              {/* Header background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#0033A0] via-[#0033A0] to-[#001a52]" />
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />

              {/* Decorative corner accents */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4A853]/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-xl translate-y-1/2 -translate-x-1/2" />

              <div className="relative z-10">
                {/* Logo container with glow effect */}
                <div className="relative inline-block mb-4">
                  <div className="absolute inset-0 bg-[#D4A853] rounded-2xl blur-lg opacity-40 scale-110" />
                  <div className="relative w-16 h-16 sm:w-18 sm:h-18 bg-gradient-to-br from-[#D4A853] to-[#b8923f] rounded-2xl flex items-center justify-center shadow-lg">
                    <CheckSquare className="w-8 h-8 sm:w-9 sm:h-9 text-white drop-shadow-sm" aria-hidden="true" />
                  </div>
                </div>

                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Bealer Agency</h1>
                <p className="text-sm text-white/60 mt-1 font-medium">Task Management</p>
              </div>
            </div>

            {/* Search for large user lists */}
            {users.length > 5 && (
              <div className="px-4 sm:px-5 pt-4 sm:pt-5">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-colors group-focus-within:text-[#0033A0]" aria-hidden="true" />
                  <input
                    type="text"
                    placeholder="Search team members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 sm:py-3 rounded-xl border-2 border-slate-200/80 bg-slate-50/50 text-base sm:text-sm focus:outline-none focus:ring-4 focus:ring-[#0033A0]/10 focus:border-[#0033A0] focus:bg-white text-slate-800 min-h-[48px] touch-manipulation transition-all duration-200 placeholder:text-slate-400"
                    aria-label="Search users"
                  />
                </div>
              </div>
            )}

            {/* Users list */}
            {filteredUsers.length > 0 ? (
              <div className="px-4 sm:px-5 py-4 max-h-[50vh] sm:max-h-[320px] overflow-y-auto">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1 mb-3 flex items-center gap-2">
                  <span className="w-8 h-px bg-gradient-to-r from-slate-200 to-transparent" />
                  Select Account
                  <span className="w-8 h-px bg-gradient-to-l from-slate-200 to-transparent" />
                </p>

                {/* Show grouped users if more than 10, otherwise flat list */}
                {users.length > 10 ? (
                  Object.entries(groupedUsers).sort().map(([letter, letterUsers]) => (
                    <div key={letter} className="mb-3">
                      <p className="text-xs font-bold text-[#0033A0]/60 px-2 py-1.5 bg-slate-50 rounded-lg inline-block mb-1">{letter}</p>
                      <div className="space-y-1">
                        {letterUsers.map((user) => (
                          <UserButton key={user.id} user={user} onSelect={handleUserSelect} />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="space-y-2">
                    {filteredUsers.map((user) => (
                      <UserButton key={user.id} user={user} onSelect={handleUserSelect} />
                    ))}
                  </div>
                )}
              </div>
            ) : users.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
                  <UserPlus className="w-7 h-7 text-slate-400" />
                </div>
                <p className="text-slate-700 font-semibold">Welcome!</p>
                <p className="text-sm text-slate-400 mt-1">Create your first account to get started</p>
              </div>
            ) : (
              <div className="px-6 py-10 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-100 flex items-center justify-center">
                  <Search className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-slate-500">No results for &ldquo;{searchQuery}&rdquo;</p>
              </div>
            )}

            {/* Add user button - only shown when no users exist (initial setup) */}
            {users.length === 0 && (
              <div className="p-4 sm:p-5 bg-gradient-to-b from-white to-slate-50/80">
                <button
                  onClick={() => {
                    setScreen('register');
                    setNewUserName('');
                    setNewUserPin(['', '', '', '']);
                    setConfirmPin(['', '', '', '']);
                    setError('');
                  }}
                  className="group relative w-full flex items-center justify-center gap-2.5 py-3.5 bg-gradient-to-r from-[#D4A853] to-[#c49943] hover:from-[#c49943] hover:to-[#b38933] active:from-[#b38933] active:to-[#a37923] text-white rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-[#D4A853]/25 hover:shadow-xl hover:shadow-[#D4A853]/30 min-h-[52px] touch-manipulation text-base overflow-hidden"
                  aria-label="Add new user account"
                >
                  <span className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
                  <UserPlus className="w-5 h-5 relative z-10 transition-transform group-hover:scale-110" aria-hidden="true" />
                  <span className="relative z-10">Get Started</span>
                </button>
              </div>
            )}
          </div>
        )}

        {screen === 'pin' && selectedUser && (
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/20 p-5 sm:p-7 border border-white/20">
            <button
              onClick={() => {
                setScreen('users');
                setSearchQuery('');
              }}
              className="group flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 mb-5 sm:mb-7 transition-all duration-200 min-h-[44px] -ml-2 px-2 touch-manipulation rounded-lg hover:bg-slate-100"
              aria-label="Go back to user selection"
            >
              <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
              Back
            </button>

            <div className="text-center mb-6 sm:mb-8">
              {/* User avatar with glow */}
              <div className="relative inline-block mb-4">
                <div
                  className="absolute inset-0 rounded-2xl blur-lg opacity-40 scale-110"
                  style={{ backgroundColor: selectedUser.color }}
                />
                <div
                  className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-white text-xl sm:text-2xl font-bold shadow-xl ring-4 ring-white"
                  style={{ backgroundColor: selectedUser.color }}
                  aria-hidden="true"
                >
                  {getUserInitials(selectedUser.name)}
                </div>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{selectedUser.name}</h2>
              <p className="text-sm text-slate-500 mt-1.5 flex items-center justify-center gap-2">
                <Lock className="w-3.5 h-3.5" />
                Enter your 4-digit PIN
              </p>

              {/* Attempts indicator - shown before any attempt */}
              {lockoutSeconds === 0 && attemptsRemaining < 3 && (
                <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-amber-600 font-medium bg-amber-50 px-3 py-1.5 rounded-full">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
                </div>
              )}
            </div>

            <div className="flex justify-center gap-3 sm:gap-4 mb-6" role="group" aria-label="PIN entry">
              {pin.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { pinRefs.current[index] = el; }}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinChange(index, e.target.value, pinRefs, pin, setPin)}
                  onKeyDown={(e) => handlePinKeyDown(e, index, pinRefs, pin)}
                  disabled={lockoutSeconds > 0 || isSubmitting}
                  aria-label={`PIN digit ${index + 1}`}
                  className={`w-14 h-16 sm:w-16 sm:h-18 text-center text-2xl sm:text-3xl font-bold rounded-2xl border-2 transition-all duration-200 focus:outline-none focus:ring-4 touch-manipulation ${
                    lockoutSeconds > 0
                      ? 'border-red-300 bg-red-50 focus:ring-red-100'
                      : digit
                        ? 'border-[#0033A0] bg-[#0033A0]/5 focus:ring-[#0033A0]/20 shadow-sm'
                        : 'border-slate-200 focus:border-[#0033A0] focus:ring-[#0033A0]/10 bg-slate-50/50'
                  } text-slate-900`}
                />
              ))}
            </div>

            {(error || lockoutSeconds > 0) && (
              <div className="flex items-center justify-center gap-2.5 text-red-600 text-sm bg-gradient-to-r from-red-50 to-red-100/50 py-3.5 px-5 rounded-xl border border-red-200/50" role="alert">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-4 h-4" aria-hidden="true" />
                </div>
                <span className="font-medium">{lockoutSeconds > 0 ? `Account locked. Please wait ${lockoutSeconds}s` : error}</span>
              </div>
            )}

            {isSubmitting && (
              <div className="flex flex-col items-center gap-2" aria-live="polite">
                <div className="relative w-8 h-8">
                  <div className="absolute inset-0 border-3 border-[#0033A0]/20 rounded-full" />
                  <div className="absolute inset-0 border-3 border-[#0033A0] border-t-transparent rounded-full animate-spin" />
                </div>
                <span className="text-sm text-slate-500">Verifying...</span>
              </div>
            )}
          </div>
        )}

        {screen === 'register' && (
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/20 p-5 sm:p-7 border border-white/20">
            <button
              onClick={() => setScreen('users')}
              className="group flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 mb-5 sm:mb-7 transition-all duration-200 min-h-[44px] -ml-2 px-2 touch-manipulation rounded-lg hover:bg-slate-100"
              aria-label="Go back to user selection"
            >
              <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
              Back
            </button>

            <div className="text-center mb-6 sm:mb-8">
              {/* Icon with glow effect */}
              <div className="relative inline-block mb-4">
                <div className="absolute inset-0 bg-[#0033A0] rounded-2xl blur-lg opacity-30 scale-110" />
                <div className="relative w-16 h-16 sm:w-18 sm:h-18 bg-gradient-to-br from-[#0033A0] to-[#001a52] rounded-2xl flex items-center justify-center shadow-lg">
                  <UserPlus className="w-7 h-7 sm:w-8 sm:h-8 text-white" aria-hidden="true" />
                </div>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Create Account</h2>
              <p className="text-sm text-slate-500 mt-1.5">Join the team in seconds</p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleRegister(); }} className="space-y-5 sm:space-y-6">
              <div>
                <label htmlFor="user-name" className="block text-sm font-semibold text-slate-700 mb-2.5">
                  Your Name
                </label>
                <input
                  id="user-name"
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Enter your name"
                  autoFocus
                  autoComplete="name"
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/50 focus:border-[#0033A0] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#0033A0]/10 transition-all duration-200 text-slate-900 placeholder-slate-400 text-base min-h-[52px] touch-manipulation"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                  Choose a PIN
                </label>
                <div className="flex justify-center gap-3" role="group" aria-label="Choose PIN">
                  {newUserPin.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { newPinRefs.current[index] = el; }}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinChange(index, e.target.value, newPinRefs, newUserPin, setNewUserPin)}
                      onKeyDown={(e) => handlePinKeyDown(e, index, newPinRefs, newUserPin)}
                      aria-label={`New PIN digit ${index + 1}`}
                      className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-bold rounded-xl border-2 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-[#0033A0]/10 touch-manipulation ${
                        digit ? 'border-[#0033A0] bg-[#0033A0]/5 shadow-sm' : 'border-slate-200 bg-slate-50/50 focus:border-[#0033A0] focus:bg-white'
                      } text-slate-900`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                  Confirm PIN
                </label>
                <div className="flex justify-center gap-3" role="group" aria-label="Confirm PIN">
                  {confirmPin.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { confirmPinRefs.current[index] = el; }}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinChange(index, e.target.value, confirmPinRefs, confirmPin, setConfirmPin)}
                      onKeyDown={(e) => handlePinKeyDown(e, index, confirmPinRefs, confirmPin)}
                      aria-label={`Confirm PIN digit ${index + 1}`}
                      className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-bold rounded-xl border-2 transition-all duration-200 focus:outline-none focus:ring-4 touch-manipulation ${
                        digit ? 'border-emerald-500 bg-emerald-50 focus:ring-emerald-500/20 shadow-sm' : 'border-slate-200 bg-slate-50/50 focus:border-emerald-500 focus:bg-white focus:ring-emerald-500/10'
                      } text-slate-900`}
                    />
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-center justify-center gap-2.5 text-red-600 text-sm bg-gradient-to-r from-red-50 to-red-100/50 py-3.5 px-5 rounded-xl border border-red-200/50" role="alert">
                  <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative w-full py-4 bg-gradient-to-r from-[#0033A0] to-[#002878] hover:from-[#002878] hover:to-[#001d5c] active:from-[#001d5c] active:to-[#001545] text-white rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 shadow-lg shadow-[#0033A0]/30 hover:shadow-xl hover:shadow-[#0033A0]/40 min-h-[56px] touch-manipulation text-base overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      Create Account
                      <ChevronLeft className="w-4 h-4 rotate-180 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </span>
              </button>
            </form>
          </div>
        )}

        {/* Footer with branding */}
        <p className="text-center text-white/40 text-xs font-medium tracking-wide mt-8">
          Bealer Agency Task Management
        </p>
      </div>
    </div>
  );
}

// Extracted user button component for better organization
function UserButton({ user, onSelect }: { user: AuthUser; onSelect: (user: AuthUser) => void }) {
  return (
    <button
      onClick={() => onSelect(user)}
      className="group w-full flex items-center gap-3.5 p-3 rounded-xl hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-100/50 active:bg-slate-100 transition-all duration-200 text-left min-h-[60px] touch-manipulation border border-transparent hover:border-slate-200/80 hover:shadow-sm"
      aria-label={`Sign in as ${user.name}`}
    >
      {/* Avatar with subtle glow on hover */}
      <div className="relative flex-shrink-0">
        <div
          className="absolute inset-0 rounded-xl blur-md opacity-0 group-hover:opacity-40 transition-opacity duration-200"
          style={{ backgroundColor: user.color }}
        />
        <div
          className="relative w-11 h-11 rounded-xl flex items-center justify-center text-white font-semibold shadow-md text-sm ring-2 ring-white/80 group-hover:ring-white group-hover:shadow-lg transition-all duration-200"
          style={{ backgroundColor: user.color }}
          aria-hidden="true"
        >
          {getUserInitials(user.name)}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <span className="font-semibold text-slate-800 block truncate text-base group-hover:text-slate-900 transition-colors">{user.name}</span>
        {user.last_login && (
          <p className="text-xs text-slate-400 mt-0.5">
            Last login {new Date(user.last_login).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Lock icon with animated transition */}
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-[#0033A0] flex items-center justify-center transition-all duration-200">
        <Lock className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" aria-hidden="true" />
      </div>
    </button>
  );
}
