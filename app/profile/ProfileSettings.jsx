'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Lock, Mail, Save, User, AlertCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Avatar from '@/components/ui/Avatar';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast';
import { AVATAR_COLORS, buildInitialsAvatar, extractAvatarColor, isGeneratedAvatar } from '@/utils/avatar';

export default function ProfileSettings({ username, email, avatar }) {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef(null);

  const initialColor = useMemo(() => extractAvatarColor(avatar), [avatar]);
  const [form, setForm] = useState({
    username: username || '',
    email: email || '',
    avatar: avatar || '',
    color: initialColor,
  });
  const [profileErrors, setProfileErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwErrors, setPwErrors] = useState([]);
  const [pwFieldErrors, setPwFieldErrors] = useState({});
  const [savingPw, setSavingPw] = useState(false);

  const preview = form.avatar || buildInitialsAvatar(form.username || username, form.color);

  function setField(key) {
    return (e) => {
      const value = e.target.value;
      setForm((f) => {
        const next = { ...f, [key]: value };
        if (key === 'username' && isGeneratedAvatar(f.avatar)) {
          next.avatar = buildInitialsAvatar(value, f.color);
        }
        return next;
      });
    };
  }

  function pickColor(color) {
    setForm((f) => ({
      ...f,
      color,
      avatar: buildInitialsAvatar(f.username || username, color),
    }));
  }

  function onPickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpe?g|gif|webp)$/i.test(file.type)) {
      setProfileErrors(['Please choose a PNG, JPEG, GIF, or WebP image']);
      return;
    }
    if (file.size > 200 * 1024) {
      setProfileErrors(['Image must be 200 KB or smaller']);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, avatar: String(reader.result || '') }));
      setProfileErrors([]);
    };
    reader.readAsDataURL(file);
  }

  function resetToInitials() {
    setForm((f) => ({
      ...f,
      avatar: buildInitialsAvatar(f.username || username, f.color),
    }));
  }

  async function saveProfile(e) {
    e.preventDefault();
    const nextErrors = {};
    const u = form.username.trim();
    const em = form.email.trim().toLowerCase();
    if (u.length < 3) nextErrors.username = 'Username must be at least 3 characters';
    else if (u.length > 20) nextErrors.username = 'Username must be at most 20 characters';
    else if (!/^[a-zA-Z0-9_]+$/.test(u)) nextErrors.username = 'Only letters, numbers and underscores';
    if (!em) nextErrors.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(em)) nextErrors.email = 'Enter a valid email address';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSavingProfile(true);
    setProfileErrors([]);
    try {
      const res = await fetch('/api/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: u,
          email: em,
          avatar: form.avatar,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setProfileErrors(data.errors || [data.error || 'Could not save profile']);
        return;
      }
      toast({ title: 'Profile updated', variant: 'success' });
      await refreshUser();
      router.refresh();
    } catch {
      setProfileErrors(['Network error. Please try again.']);
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    const next = {};
    if (!pw.currentPassword) next.currentPassword = 'Current password is required';
    if (!pw.newPassword) next.newPassword = 'New password is required';
    else if (pw.newPassword.length < 8) next.newPassword = 'Password must be at least 8 characters';
    if (!pw.confirmPassword) next.confirmPassword = 'Please confirm the new password';
    else if (pw.newPassword !== pw.confirmPassword) next.confirmPassword = 'Passwords do not match';
    setPwFieldErrors(next);
    if (Object.keys(next).length) return;

    setSavingPw(true);
    setPwErrors([]);
    try {
      const res = await fetch('/api/me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: pw.currentPassword,
          newPassword: pw.newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setPwErrors(data.errors || [data.error || 'Could not update password']);
        return;
      }
      setPw({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast({ title: 'Password changed', variant: 'success' });
    } catch {
      setPwErrors(['Network error. Please try again.']);
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <form onSubmit={saveProfile}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User size={18} className="text-brand-500" /> Edit profile
            </CardTitle>
            <CardDescription>Username, email, and avatar. Ratings cannot be edited.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {profileErrors.length > 0 && (
              <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 p-3 flex items-start gap-2">
                <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                <div className="text-sm text-red-700 dark:text-red-300 space-y-0.5">
                  {profileErrors.map((err) => (
                    <p key={err}>{err}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <Avatar src={preview} alt={form.username} size="xl" />
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    className="hidden"
                    onChange={onPickFile}
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                    <Camera size={14} /> Upload photo
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={resetToInitials}>
                    Use initials
                  </Button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">PNG, JPEG, GIF or WebP · max 200 KB</p>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Avatar color</div>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => pickColor(color)}
                    className="h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 transition"
                    style={{
                      backgroundColor: color,
                      outline: form.color === color && isGeneratedAvatar(form.avatar) ? `2px solid ${color}` : 'none',
                    }}
                    aria-label={`Avatar color ${color}`}
                  />
                ))}
              </div>
            </div>

            <Input
              label="Username"
              icon={User}
              value={form.username}
              onChange={setField('username')}
              error={fieldErrors.username}
              autoComplete="username"
              maxLength={20}
              hint="3–20 characters · letters, numbers, underscore"
            />
            <Input
              label="Email"
              icon={Mail}
              type="email"
              value={form.email}
              onChange={setField('email')}
              error={fieldErrors.email}
              autoComplete="email"
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" loading={savingProfile} className="w-full sm:w-auto">
              <Save size={16} /> Save profile
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <form onSubmit={savePassword}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock size={18} className="text-brand-500" /> Change password
            </CardTitle>
            <CardDescription>Use at least 8 characters. You will stay signed in.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pwErrors.length > 0 && (
              <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 p-3 flex items-start gap-2">
                <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                <div className="text-sm text-red-700 dark:text-red-300 space-y-0.5">
                  {pwErrors.map((err) => (
                    <p key={err}>{err}</p>
                  ))}
                </div>
              </div>
            )}
            <Input
              label="Current password"
              type="password"
              icon={Lock}
              value={pw.currentPassword}
              onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))}
              error={pwFieldErrors.currentPassword}
              autoComplete="current-password"
            />
            <Input
              label="New password"
              type="password"
              icon={Lock}
              value={pw.newPassword}
              onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))}
              error={pwFieldErrors.newPassword}
              autoComplete="new-password"
              hint="Minimum 8 characters"
            />
            <Input
              label="Confirm new password"
              type="password"
              icon={Lock}
              value={pw.confirmPassword}
              onChange={(e) => setPw((p) => ({ ...p, confirmPassword: e.target.value }))}
              error={pwFieldErrors.confirmPassword}
              autoComplete="new-password"
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" variant="secondary" loading={savingPw} className="w-full sm:w-auto">
              <Lock size={16} /> Update password
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
