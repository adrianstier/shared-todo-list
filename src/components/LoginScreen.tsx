'use client';

import { useState, useEffect, useRef } from 'react';
import { UserPlus, AlertCircle, ChevronLeft, Lock } from 'lucide-react';
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
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <p className="text-neutral-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 p-4">
      <div className="w-full max-w-sm">
        {screen === 'users' && (
          <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
              <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                Sign In
              </h1>
              <p className="text-sm text-neutral-500 mt-1">
                Select your account
              </p>
            </div>

            {users.length > 0 ? (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-left"
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                      style={{ backgroundColor: user.color }}
                    >
                      {getUserInitials(user.name)}
                    </div>
                    <span className="flex-1 text-neutral-900 dark:text-neutral-100">
                      {user.name}
                    </span>
                    <Lock className="w-4 h-4 text-neutral-400" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-neutral-500">
                No users yet
              </div>
            )}

            <div className="p-4 border-t border-neutral-100 dark:border-neutral-800">
              <button
                onClick={() => {
                  setScreen('register');
                  setNewUserName('');
                  setNewUserPin(['', '', '', '']);
                  setConfirmPin(['', '', '', '']);
                  setError('');
                }}
                className="w-full flex items-center justify-center gap-2 py-3 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Add New User
              </button>
            </div>
          </div>
        )}

        {screen === 'pin' && selectedUser && (
          <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
            <button
              onClick={() => setScreen('users')}
              className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 mb-6"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <div className="text-center mb-6">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-medium mx-auto mb-3"
                style={{ backgroundColor: selectedUser.color }}
              >
                {getUserInitials(selectedUser.name)}
              </div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {selectedUser.name}
              </h2>
              <p className="text-sm text-neutral-500">Enter your PIN</p>
            </div>

            <div className="flex justify-center gap-3 mb-4">
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
                  className="w-14 h-16 text-center text-2xl font-bold rounded-lg border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-blue-500"
                />
              ))}
            </div>

            {(error || lockoutSeconds > 0) && (
              <div className="flex items-center justify-center gap-2 text-red-500 text-sm">
                <AlertCircle className="w-4 h-4" />
                {lockoutSeconds > 0 ? `Wait ${lockoutSeconds}s` : error}
              </div>
            )}
          </div>
        )}

        {screen === 'register' && (
          <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
            <button
              onClick={() => setScreen('users')}
              className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 mb-6"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6">
              Create Account
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Enter your name"
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  PIN
                </label>
                <div className="flex justify-center gap-2">
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
                      className="w-12 h-14 text-center text-xl font-bold rounded-lg border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-blue-500"
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Confirm PIN
                </label>
                <div className="flex justify-center gap-2">
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
                      className="w-12 h-14 text-center text-xl font-bold rounded-lg border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-blue-500"
                    />
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-center justify-center gap-2 text-red-500 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <button
                onClick={handleRegister}
                disabled={isSubmitting}
                className="w-full py-3 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
