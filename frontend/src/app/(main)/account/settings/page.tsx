'use client';

import { useState } from 'react';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

export default function SettingsPage() {
  const { user } = useAuth();
  const supabase = createClient();

  const [firstName, setFirstName] = useState(user?.user_metadata?.first_name || '');
  const [lastName, setLastName] = useState(user?.user_metadata?.last_name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`,
        },
      });

      if (error) throw error;
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      setIsChangingPassword(false);
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      setIsChangingPassword(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-ivory-50">
        Account Settings
      </h2>

      {/* Profile Section */}
      <div className="bg-noir-900 border border-noir-800 p-6">
        <h3 className="font-[family-name:var(--font-bebas)] text-lg tracking-wider text-ivory-100 mb-6">
          PROFILE INFORMATION
        </h3>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="font-[family-name:var(--font-jakarta)] text-sm text-red-400">{error}</p>
          </div>
        )}

        {saveSuccess && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 flex items-center gap-3">
            <Check className="w-5 h-5 text-green-400" />
            <p className="font-[family-name:var(--font-jakarta)] text-sm text-green-400">Profile updated successfully</p>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-[family-name:var(--font-jakarta)] text-xs uppercase tracking-wider text-ivory-400 mb-2">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-ivory-100 font-[family-name:var(--font-jakarta)] text-sm focus:outline-none focus:border-gold-200 transition-colors"
              />
            </div>
            <div>
              <label className="block font-[family-name:var(--font-jakarta)] text-xs uppercase tracking-wider text-ivory-400 mb-2">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-ivory-100 font-[family-name:var(--font-jakarta)] text-sm focus:outline-none focus:border-gold-200 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block font-[family-name:var(--font-jakarta)] text-xs uppercase tracking-wider text-ivory-400 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-4 py-3 bg-noir-800/50 border border-noir-700 text-ivory-400 font-[family-name:var(--font-jakarta)] text-sm cursor-not-allowed"
            />
            <p className="mt-1 font-[family-name:var(--font-jakarta)] text-xs text-ivory-500">
              Email cannot be changed
            </p>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 bg-gold-200 text-noir-950 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-gold-300 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  SAVING...
                </>
              ) : (
                'SAVE CHANGES'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Password Section */}
      <div className="bg-noir-900 border border-noir-800 p-6">
        <h3 className="font-[family-name:var(--font-bebas)] text-lg tracking-wider text-ivory-100 mb-6">
          CHANGE PASSWORD
        </h3>

        {passwordError && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="font-[family-name:var(--font-jakarta)] text-sm text-red-400">{passwordError}</p>
          </div>
        )}

        {passwordSuccess && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 flex items-center gap-3">
            <Check className="w-5 h-5 text-green-400" />
            <p className="font-[family-name:var(--font-jakarta)] text-sm text-green-400">Password changed successfully</p>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block font-[family-name:var(--font-jakarta)] text-xs uppercase tracking-wider text-ivory-400 mb-2">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-ivory-100 font-[family-name:var(--font-jakarta)] text-sm placeholder:text-ivory-500 focus:outline-none focus:border-gold-200 transition-colors"
            />
          </div>
          <div>
            <label className="block font-[family-name:var(--font-jakarta)] text-xs uppercase tracking-wider text-ivory-400 mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-ivory-100 font-[family-name:var(--font-jakarta)] text-sm placeholder:text-ivory-500 focus:outline-none focus:border-gold-200 transition-colors"
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isChangingPassword || !newPassword || !confirmPassword}
              className="px-6 py-2 border border-ivory-500 text-ivory-100 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:border-ivory-300 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isChangingPassword ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  CHANGING...
                </>
              ) : (
                'CHANGE PASSWORD'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
