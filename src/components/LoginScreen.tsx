'use client';

import { useState, useEffect, useRef } from 'react';
import { UserPlus, AlertCircle, ChevronLeft, Lock, Shield } from 'lucide-react';
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
} from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface LoginScreenProps {
  onLogin: (user: AuthUser) => void;
}

type Screen = 'users' | 'pin' | 'register';

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [screen, setScreen] = useState<Screen>('users');
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AuthUser | null>(null);
  const [pin, setPin] = useState(['', '', '', '']);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
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
        .select('id, name, color, created_at, last_login')
        .order('name');
      if (data) setUsers(data);
      setLoading(false);
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!selectedUser) return;
    const checkLockout = () => {
      const { locked, remainingSeconds } = isLockedOut(selectedUser.id);
      setLockoutSeconds(locked ? remainingSeconds : 0);
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
    setTimeout(() => pinRefs.current[0]?.focus(), 100);
  };

  const handlePinChange = (
    index: number,
    value: string,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
    pinState: string[],
    setPinState: (p: string[]) => void
  ) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = [...pinState];
    newPin[index] = value.slice(-1);
    setPinState(newPin);
    if (value && index < 3) {
      refs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyDown = (
    e: React.KeyboardEvent,
    index: number,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
    pinState: string[],
  ) => {
    if (e.key === 'Backspace' && !pinState[index] && index > 0) {
      refs.current[index - 1]?.focus();
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
        if (lockout.lockedUntil) {
          setError('Too many attempts. Wait 30 seconds.');
        } else {
          setError(`Wrong PIN. ${3 - lockout.attempts} left.`);
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
        .insert({ name, pin_hash: pinHash, color })
        .select('id, name, color, created_at, last_login')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          setError('Name taken');
        } else {
          setError('Failed to create');
        }
        setIsSubmitting(false);
        return;
      }

      if (data) {
        setStoredSession(data);
        onLogin(data);
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
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4A853]/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {screen === 'users' && (
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-8 text-center bg-gradient-to-b from-white to-slate-50">
              <div className="w-16 h-16 bg-[#0033A0] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#0033A0]/30">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Bealer Agency</h1>
              <p className="text-sm text-[#0033A0] font-medium mt-1">Task Management</p>
            </div>

            {/* Users list */}
            {users.length > 0 ? (
              <div className="px-4 pb-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide px-2 mb-2">
                  Select Account
                </p>
                <div className="space-y-2">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleUserSelect(user)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group"
                    >
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-semibold shadow-md"
                        style={{ backgroundColor: user.color }}
                      >
                        {getUserInitials(user.name)}
                      </div>
                      <div className="flex-1">
                        <span className="font-medium text-slate-900">{user.name}</span>
                        {user.last_login && (
                          <p className="text-xs text-slate-400">
                            Last: {new Date(user.last_login).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Lock className="w-4 h-4 text-slate-300 group-hover:text-[#0033A0] transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-slate-400">No users yet</p>
                <p className="text-sm text-slate-300">Create your first account</p>
              </div>
            )}

            {/* Add user button */}
            <div className="p-4">
              <button
                onClick={() => {
                  setScreen('register');
                  setNewUserName('');
                  setNewUserPin(['', '', '', '']);
                  setConfirmPin(['', '', '', '']);
                  setError('');
                }}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#D4A853] hover:bg-[#c49943] text-white rounded-xl font-semibold transition-colors shadow-lg shadow-[#D4A853]/30"
              >
                <UserPlus className="w-5 h-5" />
                Add New User
              </button>
            </div>
          </div>
        )}

        {screen === 'pin' && selectedUser && (
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <button
              onClick={() => setScreen('users')}
              className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 mb-6 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <div className="text-center mb-8">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4 shadow-lg"
                style={{ backgroundColor: selectedUser.color }}
              >
                {getUserInitials(selectedUser.name)}
              </div>
              <h2 className="text-xl font-bold text-slate-900">{selectedUser.name}</h2>
              <p className="text-sm text-slate-400 mt-1">Enter your 4-digit PIN</p>
            </div>

            <div className="flex justify-center gap-3 mb-6">
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
                  className={`w-14 h-16 text-center text-2xl font-bold rounded-xl border-2 transition-all focus:outline-none ${
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
              <div className="flex items-center justify-center gap-2 text-red-500 text-sm bg-red-50 py-2 px-4 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                {lockoutSeconds > 0 ? `Locked. Wait ${lockoutSeconds}s` : error}
              </div>
            )}

            {isSubmitting && (
              <div className="flex justify-center">
                <div className="w-6 h-6 border-2 border-[#0033A0] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}

        {screen === 'register' && (
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <button
              onClick={() => setScreen('users')}
              className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 mb-6 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-[#0033A0]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <UserPlus className="w-8 h-8 text-[#0033A0]" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Create Account</h2>
              <p className="text-sm text-slate-400 mt-1">Enter your details</p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Enter your name"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-[#0033A0] focus:outline-none transition-colors text-slate-900 placeholder-slate-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Choose a PIN
                </label>
                <div className="flex justify-center gap-3">
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
                      className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 transition-all focus:outline-none ${
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
                <div className="flex justify-center gap-3">
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
                      className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 transition-all focus:outline-none ${
                        digit ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 focus:border-[#0033A0]'
                      } text-slate-900`}
                    />
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-center justify-center gap-2 text-red-500 text-sm bg-red-50 py-2 px-4 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <button
                onClick={handleRegister}
                disabled={isSubmitting}
                className="w-full py-3.5 bg-[#0033A0] hover:bg-[#002878] text-white rounded-xl font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-[#0033A0]/30"
              >
                {isSubmitting ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-white/50 text-sm mt-6">
          Powered by Allstate
        </p>
      </div>
    </div>
  );
}
