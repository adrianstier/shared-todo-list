'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, LogOut, UserPlus, Lock, AlertCircle, X } from 'lucide-react';
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
  clearStoredSession,
} from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface UserSwitcherProps {
  currentUser: AuthUser;
  onUserChange: (user: AuthUser | null) => void;
}

type ModalState = 'closed' | 'pin' | 'register';

export default function UserSwitcher({ currentUser, onUserChange }: UserSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [modalState, setModalState] = useState<ModalState>('closed');
  const [selectedUser, setSelectedUser] = useState<AuthUser | null>(null);
  const [pin, setPin] = useState(['', '', '', '']);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pinInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const newPinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmPinRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('users')
        .select('id, name, color, created_at, last_login')
        .order('name');
      if (data) setUsers(data);
    };
    fetchUsers();
  }, [modalState]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const handleLogout = () => {
    clearStoredSession();
    onUserChange(null);
  };

  const handleUserSelect = (user: AuthUser) => {
    if (user.id === currentUser.id) {
      setIsOpen(false);
      return;
    }
    setSelectedUser(user);
    setModalState('pin');
    setPin(['', '', '', '']);
    setError('');
    setIsOpen(false);
    setTimeout(() => pinInputRefs.current[0]?.focus(), 100);
  };

  const handlePinChange = (index: number, value: string, refs: React.MutableRefObject<(HTMLInputElement | null)[]>, pinState: string[], setPinState: (p: string[]) => void) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = [...pinState];
    newPin[index] = value.slice(-1);
    setPinState(newPin);
    if (value && index < 3) {
      refs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyDown = (e: React.KeyboardEvent, index: number, refs: React.MutableRefObject<(HTMLInputElement | null)[]>, pinState: string[], setPinState: (p: string[]) => void) => {
    if (e.key === 'Backspace' && !pinState[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handlePinSubmit = async () => {
    if (!selectedUser || lockoutSeconds > 0) return;

    const pinString = pin.join('');
    if (!isValidPin(pinString)) {
      setError('Please enter a 4-digit PIN');
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
        onUserChange(selectedUser);
        setModalState('closed');
      } else {
        const lockout = incrementLockout(selectedUser.id);
        if (lockout.lockedUntil) {
          setError('Too many attempts. Please wait.');
        } else {
          setError(`Incorrect PIN. ${3 - lockout.attempts} attempts left.`);
        }
        setPin(['', '', '', '']);
        pinInputRefs.current[0]?.focus();
      }
    } catch {
      setError('An error occurred.');
    }

    setIsSubmitting(false);
  };

  const handleRegister = async () => {
    const name = newUserName.trim();
    if (!name) {
      setError('Please enter your name');
      return;
    }

    const pinString = newUserPin.join('');
    if (!isValidPin(pinString)) {
      setError('Please enter a 4-digit PIN');
      return;
    }

    const confirmString = confirmPin.join('');
    if (pinString !== confirmString) {
      setError('PINs do not match');
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
          setError('Name already taken');
        } else {
          setError('Failed to create user');
        }
        setIsSubmitting(false);
        return;
      }

      if (data) {
        onUserChange(data);
        setModalState('closed');
      }
    } catch {
      setError('An error occurred.');
    }

    setIsSubmitting(false);
  };

  useEffect(() => {
    if (modalState === 'pin' && pin.every(d => d !== '') && !isSubmitting) {
      handlePinSubmit();
    }
  }, [pin, modalState]);

  const closeModal = () => {
    setModalState('closed');
    setSelectedUser(null);
    setError('');
  };

  return (
    <>
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium"
            style={{ backgroundColor: currentUser.color }}
          >
            {getUserInitials(currentUser.name)}
          </div>
          <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden z-50">
            <div className="p-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                  style={{ backgroundColor: currentUser.color }}
                >
                  {getUserInitials(currentUser.name)}
                </div>
                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {currentUser.name}
                </div>
              </div>
            </div>

            <div className="max-h-40 overflow-y-auto">
              {users
                .filter(u => u.id !== currentUser.id)
                .map(user => (
                  <button
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-left text-sm"
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs"
                      style={{ backgroundColor: user.color }}
                    >
                      {getUserInitials(user.name)}
                    </div>
                    <span className="text-neutral-700 dark:text-neutral-300">{user.name}</span>
                    <Lock className="w-3 h-3 text-neutral-400 ml-auto" />
                  </button>
                ))}
            </div>

            <div className="border-t border-neutral-100 dark:border-neutral-800">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setModalState('register');
                  setNewUserName('');
                  setNewUserPin(['', '', '', '']);
                  setConfirmPin(['', '', '', '']);
                  setError('');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-sm text-blue-600"
              >
                <UserPlus className="w-4 h-4" />
                Add User
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-600"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalState !== 'closed' && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={closeModal}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-sm w-full p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {modalState === 'pin' ? 'Enter PIN' : 'New User'}
              </h3>
              <button onClick={closeModal} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded">
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>

            {modalState === 'pin' && selectedUser && (
              <div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                  Enter PIN for {selectedUser.name}
                </p>

                <div className="flex justify-center gap-2 mb-4">
                  {pin.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { pinInputRefs.current[index] = el; }}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinChange(index, e.target.value, pinInputRefs, pin, setPin)}
                      onKeyDown={(e) => handlePinKeyDown(e, index, pinInputRefs, pin, setPin)}
                      disabled={lockoutSeconds > 0 || isSubmitting}
                      className="w-12 h-14 text-center text-xl font-bold rounded-lg border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-blue-500"
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

            {modalState === 'register' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Your name"
                    autoFocus
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        onKeyDown={(e) => handlePinKeyDown(e, index, newPinRefs, newUserPin, setNewUserPin)}
                        className="w-12 h-12 text-center text-lg font-bold rounded-lg border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-blue-500"
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
                        onKeyDown={(e) => handlePinKeyDown(e, index, confirmPinRefs, confirmPin, setConfirmPin)}
                        className="w-12 h-12 text-center text-lg font-bold rounded-lg border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-blue-500"
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
                  className="w-full py-3 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
