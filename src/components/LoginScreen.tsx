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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0033A0] to-[#001a52]">
        <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0033A0] to-[#001a52] p-4">
      {/* Skip link for accessibility */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:z-50">
        Skip to content
      </a>

      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4A853]/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
      </div>

      <div id="main-content" className="w-full max-w-[calc(100vw-2rem)] sm:max-w-sm relative z-10">
        {screen === 'users' && (
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Simplified Header */}
            <div className="p-4 sm:p-6 text-center bg-gradient-to-b from-white to-slate-50 border-b border-slate-100">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#0033A0] rounded-xl flex items-center justify-center mx-auto mb-2 sm:mb-3 shadow-lg shadow-[#0033A0]/30">
                <CheckSquare className="w-6 h-6 sm:w-7 sm:h-7 text-white" aria-hidden="true" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">Bealer Agency Tasks</h1>
            </div>

            {/* Search for large user lists */}
            {users.length > 5 && (
              <div className="px-3 sm:px-4 pt-3 sm:pt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 sm:py-2.5 rounded-lg border border-slate-200 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0] text-slate-800 min-h-[44px] touch-manipulation"
                    aria-label="Search users"
                  />
                </div>
              </div>
            )}

            {/* Users list */}
            {filteredUsers.length > 0 ? (
              <div className="px-3 sm:px-4 py-3 max-h-[50vh] sm:max-h-[300px] overflow-y-auto">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide px-2 mb-2">
                  Select Account
                </p>

                {/* Show grouped users if more than 10, otherwise flat list */}
                {users.length > 10 ? (
                  Object.entries(groupedUsers).sort().map(([letter, letterUsers]) => (
                    <div key={letter} className="mb-2">
                      <p className="text-xs font-bold text-slate-300 px-2 py-1">{letter}</p>
                      {letterUsers.map((user) => (
                        <UserButton key={user.id} user={user} onSelect={handleUserSelect} />
                      ))}
                    </div>
                  ))
                ) : (
                  <div className="space-y-1">
                    {filteredUsers.map((user) => (
                      <UserButton key={user.id} user={user} onSelect={handleUserSelect} />
                    ))}
                  </div>
                )}
              </div>
            ) : users.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-slate-500 font-medium">No users yet</p>
                <p className="text-sm text-slate-400 mt-1">Create your first account below</p>
              </div>
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-slate-500">No users match "{searchQuery}"</p>
              </div>
            )}

            {/* Add user button */}
            <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100">
              <button
                onClick={() => {
                  setScreen('register');
                  setNewUserName('');
                  setNewUserPin(['', '', '', '']);
                  setConfirmPin(['', '', '', '']);
                  setError('');
                }}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#D4A853] hover:bg-[#c49943] active:bg-[#b38933] text-white rounded-xl font-semibold transition-colors shadow-md min-h-[48px] touch-manipulation text-base sm:text-sm"
                aria-label="Add new user account"
              >
                <UserPlus className="w-5 h-5" aria-hidden="true" />
                Add New User
              </button>
            </div>
          </div>
        )}

        {screen === 'pin' && selectedUser && (
          <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6">
            <button
              onClick={() => {
                setScreen('users');
                setSearchQuery('');
              }}
              className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 mb-4 sm:mb-6 transition-colors min-h-[44px] -ml-2 px-2 touch-manipulation"
              aria-label="Go back to user selection"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              Back
            </button>

            <div className="text-center mb-4 sm:mb-6">
              <div
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center text-white text-lg sm:text-xl font-bold mx-auto mb-2 sm:mb-3 shadow-lg"
                style={{ backgroundColor: selectedUser.color }}
                aria-hidden="true"
              >
                {getUserInitials(selectedUser.name)}
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">{selectedUser.name}</h2>
              <p className="text-sm text-slate-400 mt-1">Enter your 4-digit PIN</p>

              {/* Attempts indicator - shown before any attempt */}
              {lockoutSeconds === 0 && attemptsRemaining < 3 && (
                <p className="text-xs text-amber-600 mt-2 font-medium">
                  {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
                </p>
              )}
            </div>

            <div className="flex justify-center gap-2 sm:gap-3 mb-4 sm:mb-6" role="group" aria-label="PIN entry">
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
                  className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-bold rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30 touch-manipulation ${
                    lockoutSeconds > 0
                      ? 'border-red-200 bg-red-50'
                      : digit
                        ? 'border-[#0033A0] bg-[#0033A0]/5'
                        : 'border-slate-200 focus:border-[#0033A0]'
                  } text-slate-900`}
                />
              ))}
            </div>

            {(error || lockoutSeconds > 0) && (
              <div className="flex items-center justify-center gap-2 text-red-600 text-sm bg-red-50 py-3 px-4 rounded-lg" role="alert">
                <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                <span>{lockoutSeconds > 0 ? `Locked. Wait ${lockoutSeconds}s` : error}</span>
              </div>
            )}

            {isSubmitting && (
              <div className="flex justify-center" aria-live="polite">
                <div className="w-6 h-6 border-2 border-[#0033A0] border-t-transparent rounded-full animate-spin" />
                <span className="sr-only">Verifying PIN...</span>
              </div>
            )}
          </div>
        )}

        {screen === 'register' && (
          <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6">
            <button
              onClick={() => setScreen('users')}
              className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 mb-4 sm:mb-6 transition-colors min-h-[44px] -ml-2 px-2 touch-manipulation"
              aria-label="Go back to user selection"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              Back
            </button>

            <div className="text-center mb-4 sm:mb-6">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#0033A0]/10 rounded-xl flex items-center justify-center mx-auto mb-2 sm:mb-3">
                <UserPlus className="w-6 h-6 sm:w-7 sm:h-7 text-[#0033A0]" aria-hidden="true" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">Create Account</h2>
              <p className="text-sm text-slate-400 mt-1">Enter your details below</p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleRegister(); }} className="space-y-4 sm:space-y-5">
              <div>
                <label htmlFor="user-name" className="block text-sm font-medium text-slate-700 mb-2">
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
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-[#0033A0] focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 transition-colors text-slate-900 placeholder-slate-300 text-base min-h-[48px] touch-manipulation"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Choose a PIN
                </label>
                <div className="flex justify-center gap-2 sm:gap-3" role="group" aria-label="Choose PIN">
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
                      className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 touch-manipulation ${
                        digit ? 'border-[#0033A0] bg-[#0033A0]/5' : 'border-slate-200 focus:border-[#0033A0]'
                      } text-slate-900`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Confirm PIN
                </label>
                <div className="flex justify-center gap-2 sm:gap-3" role="group" aria-label="Confirm PIN">
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
                      className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 touch-manipulation ${
                        digit ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 focus:border-[#0033A0]'
                      } text-slate-900`}
                    />
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-center justify-center gap-2 text-red-600 text-sm bg-red-50 py-3 px-4 rounded-lg" role="alert">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-[#0033A0] hover:bg-[#002878] active:bg-[#001d5c] text-white rounded-xl font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-[#0033A0]/30 min-h-[48px] touch-manipulation text-base"
              >
                {isSubmitting ? 'Creating...' : 'Create Account'}
              </button>
            </form>
          </div>
        )}

        {/* Simplified Footer */}
        <p className="text-center text-white/40 text-xs mt-6">
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
      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors text-left group min-h-[56px] touch-manipulation"
      aria-label={`Sign in as ${user.name}`}
    >
      <div
        className="w-10 h-10 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-white font-semibold shadow-sm flex-shrink-0 text-sm sm:text-base"
        style={{ backgroundColor: user.color }}
        aria-hidden="true"
      >
        {getUserInitials(user.name)}
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-medium text-slate-900 block truncate text-base sm:text-sm">{user.name}</span>
        {user.last_login && (
          <p className="text-xs text-slate-400">
            Last: {new Date(user.last_login).toLocaleDateString()}
          </p>
        )}
      </div>
      <Lock className="w-4 h-4 text-slate-300 group-hover:text-[#0033A0] transition-colors flex-shrink-0" aria-hidden="true" />
    </button>
  );
}
