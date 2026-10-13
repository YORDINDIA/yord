'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { Field, TextInput } from '@/features/ui/Field';
import { Button } from '@/features/ui/Button';
import { AccountPageHeader } from '../_components/AccountPageHeader';
import { AuthNotice } from '@/features/auth/AuthShell';
import { PasswordField } from '@/features/auth/PasswordField';

export default function SettingsPage() {
  const { user } = useAuth();
  const supabase = createClient();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // user loads async; sync fields when it arrives (initializers run once on null)
  // Deferred via queueMicrotask: effect syncs external auth store to local state.
  useEffect(() => {
    if (user) {
      const first = (user.user_metadata?.first_name as string) || '';
      const last = (user.user_metadata?.last_name as string) || '';
      queueMicrotask(() => {
        setFirstName(first);
        setLastName(last);
      });
    }
  }, [user]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

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
    setPasswordError(null);
    setPasswordSuccess(false);

    // Per-field messages, so the correction lands on the input that needs it.
    const lengthError =
      newPassword.length < 8 ? 'Password must be at least 8 characters' : null;
    const matchError = newPassword !== confirmPassword ? 'Passwords do not match' : null;
    setNewPasswordError(lengthError);
    setConfirmPasswordError(matchError);
    if (lengthError || matchError) return;

    setIsChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      setPasswordSuccess(true);
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
      <AccountPageHeader title="Account Settings" />

      {/* Profile Section */}
      <div className="bg-surface-card border border-border-default p-6">
        <h3 className="font-accent text-lg tracking-wider text-text-secondary mb-6">
          PROFILE INFORMATION
        </h3>

        {error ? <AuthNotice>{error}</AuthNotice> : null}
        {saveSuccess ? <AuthNotice tone="success">Profile updated successfully</AuthNotice> : null}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="First Name" name="settings-first-name">
              <TextInput
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </Field>
            <Field label="Last Name" name="settings-last-name">
              <TextInput
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Email Address" name="settings-email" hint="Email cannot be changed">
            <TextInput
              type="email"
              inputMode="email"
              autoComplete="email"
              value={user?.email || ''}
              disabled
              className="cursor-not-allowed opacity-70"
            />
          </Field>

          <div className="pt-4">
            <Button type="submit" isLoading={isSaving}>
              {isSaving ? 'SAVING...' : 'SAVE CHANGES'}
            </Button>
          </div>
        </form>
      </div>

      {/* Password Section */}
      <div className="bg-surface-card border border-border-default p-6">
        <h3 className="font-accent text-lg tracking-wider text-text-secondary mb-6">
          CHANGE PASSWORD
        </h3>

        {passwordError ? <AuthNotice>{passwordError}</AuthNotice> : null}
        {passwordSuccess ? (
          <AuthNotice tone="success">Password changed successfully</AuthNotice>
        ) : null}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <PasswordField
            label="New Password"
            name="settings-new-password"
            value={newPassword}
            onChange={(value) => {
              setNewPassword(value);
              if (newPasswordError) setNewPasswordError(null);
            }}
            autoComplete="new-password"
            placeholder="Enter new password"
            error={newPasswordError ?? undefined}
          />
          <PasswordField
            label="Confirm New Password"
            name="settings-confirm-password"
            value={confirmPassword}
            onChange={(value) => {
              setConfirmPassword(value);
              if (confirmPasswordError) setConfirmPasswordError(null);
            }}
            autoComplete="new-password"
            placeholder="Confirm new password"
            error={confirmPasswordError ?? undefined}
          />

          <div className="pt-4">
            <Button
              type="submit"
              variant="secondary"
              disabled={!newPassword || !confirmPassword}
              isLoading={isChangingPassword}
            >
              {isChangingPassword ? 'CHANGING...' : 'CHANGE PASSWORD'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
