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

// Only these users can add new users
const ADMIN_USERS = ['Adrian', 'Derrick'];

export default function UserSwitcher({ currentUser, onUserChange }: UserSwitcherProps) {
  // Check if current user can add new users
  const canAddUsers = ADMIN_USERS.some(
    admin => currentUser.name.toLowerCase() === admin.toLowerCase()
  );

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
        .select('id, name, color, role, created_at, last_login')
        .order('name');
      if (data) {
        // Default role to 'member' if not set
        setUsers(data.map(u => ({ ...u, role: u.role || 'member' })));
      }
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

  const handlePinKeyDown = (e: React.KeyboardEvent, index: number, refs: React.MutableRefObject<(HTMLInputElement | null)[]>, pinState: string[]) => {
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
        .insert({ name, pin_hash: pinHash, color, role: 'member' })
        .select('id, name, color, role, created_at, last_login')
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
        const userData = { ...data, role: data.role || 'member' };
        onUserChange(userData);
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
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px] touch-manipulation"
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-semibold shadow-md"
            style={{ backgroundColor: currentUser.color }}
          >
            {getUserInitials(currentUser.name)}
          </div>
          <ChevronDown className={`w-4 h-4 text-white/70 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-64 max-w-[280px] bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 max-h-[70vh] sm:max-h-[80vh] overflow-y-auto">
            {/* Current user */}
            <div className="p-3 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold shadow-md"
                  style={{ backgroundColor: currentUser.color }}
                >
                  {getUserInitials(currentUser.name)}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{currentUser.name}</p>
                  <p className="text-xs text-slate-400">Signed in</p>
                </div>
              </div>
            </div>

            {/* Other users */}
            {users.filter(u => u.id !== currentUser.id).length > 0 && (
              <div className="py-2">
                <p className="px-3 pb-1 text-xs font-medium text-slate-400 uppercase tracking-wide">
                  Switch Account
                </p>
                {users
                  .filter(u => u.id !== currentUser.id)
                  .map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleUserSelect(user)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 sm:py-2 hover:bg-slate-50 active:bg-slate-100 transition-colors text-left min-h-[44px] touch-manipulation"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                        style={{ backgroundColor: user.color }}
                      >
                        {getUserInitials(user.name)}
                      </div>
                      <span className="flex-1 text-slate-700 text-base sm:text-sm truncate">{user.name}</span>
                      <Lock className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                    </button>
                  ))}
              </div>
            )}

            {/* Actions */}
            <div className="border-t border-slate-100">
              {canAddUsers && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setModalState('register');
                    setNewUserName('');
                    setNewUserPin(['', '', '', '']);
                    setConfirmPin(['', '', '', '']);
                    setError('');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-3 sm:py-2.5 hover:bg-slate-50 active:bg-slate-100 text-[#0033A0] font-medium transition-colors min-h-[44px] touch-manipulation text-base sm:text-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  Add New User
                </button>
              )}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-3 sm:py-2.5 hover:bg-red-50 active:bg-red-100 text-red-500 font-medium transition-colors min-h-[44px] touch-manipulation text-base sm:text-sm"
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
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={closeModal}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-[calc(100vw-2rem)] sm:max-w-sm w-full overflow-hidden"
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-100">
              <h3 className="text-base sm:text-lg font-semibold text-slate-900">
                {modalState === 'pin' ? 'Enter PIN' : 'Add New User'}
              </h3>
              <button
                onClick={closeModal}
                className="p-2 sm:p-1.5 rounded-lg hover:bg-slate-100 active:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center touch-manipulation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalState === 'pin' && selectedUser && (
              <div className="p-4 sm:p-6">
                <div className="text-center mb-4 sm:mb-6">
                  <div
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-white text-lg sm:text-xl font-bold mx-auto mb-2 sm:mb-3 shadow-lg"
                    style={{ backgroundColor: selectedUser.color }}
                  >
                    {getUserInitials(selectedUser.name)}
                  </div>
                  <p className="font-medium text-slate-900">{selectedUser.name}</p>
                  <p className="text-sm text-slate-400">Enter 4-digit PIN</p>
                </div>

                <div className="flex justify-center gap-2 sm:gap-3 mb-4">
                  {pin.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { pinInputRefs.current[index] = el; }}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinChange(index, e.target.value, pinInputRefs, pin, setPin)}
                      onKeyDown={(e) => handlePinKeyDown(e, index, pinInputRefs, pin)}
                      disabled={lockoutSeconds > 0 || isSubmitting}
                      className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold rounded-xl border-2 transition-all focus:outline-none touch-manipulation ${
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
                    {lockoutSeconds > 0 ? `Wait ${lockoutSeconds}s` : error}
                  </div>
                )}
              </div>
            )}

            {modalState === 'register' && (
              <div className="p-4 sm:p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Name</label>
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Enter name"
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-[#0033A0] focus:outline-none transition-colors text-slate-900 placeholder-slate-300 text-base min-h-[48px] touch-manipulation"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Choose PIN</label>
                  <div className="flex justify-center gap-2 sm:gap-3">
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
                        className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold rounded-xl border-2 transition-all focus:outline-none touch-manipulation ${
                          digit ? 'border-[#0033A0] bg-[#0033A0]/5' : 'border-slate-200 focus:border-[#0033A0]'
                        } text-slate-900`}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Confirm PIN</label>
                  <div className="flex justify-center gap-2 sm:gap-3">
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
                        className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold rounded-xl border-2 transition-all focus:outline-none touch-manipulation ${
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
                  className="w-full py-3.5 bg-[#0033A0] hover:bg-[#002878] active:bg-[#001d5c] text-white rounded-xl font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-[#0033A0]/30 min-h-[48px] touch-manipulation text-base"
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
