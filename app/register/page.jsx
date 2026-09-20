'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Mail, Lock, ArrowRight, AlertCircle, Check } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast';

export default function RegisterPage() {
  const router = useRouter();
  const { register, loading } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [serverErrors, setServerErrors] = useState([]);

  const onChange = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  function passwordStrength(pw) {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  }

  const strength = passwordStrength(form.password);
  const strengthLabels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
  const strengthColors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-lime-500',
    'bg-emerald-500',
    'bg-emerald-600',
  ];

  function validate() {
    const errs = {};
    const username = form.username.trim();
    const email = form.email.trim().toLowerCase();

    if (!username) {
      errs.username = 'Username is required';
    } else if (username.length < 3) {
      errs.username = 'Username must be at least 3 characters';
    } else if (username.length > 20) {
      errs.username = 'Username must be at most 20 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      errs.username = 'Only letters, numbers and underscores';
    }

    if (!email) {
      errs.email = 'Email is required';
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      errs.email = 'Enter a valid email address';
    }

    if (!form.password) {
      errs.password = 'Password is required';
    } else if (form.password.length < 8) {
      errs.password = 'Password must be at least 8 characters';
    }

    if (!form.confirmPassword) {
      errs.confirmPassword = 'Please confirm your password';
    } else if (form.password !== form.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerErrors([]);
    if (!validate()) return;

    const res = await register({
      username: form.username.trim(),
      email: form.email.trim(),
      password: form.password,
    });

    if (res.success) {
      toast({
        title: 'Account created!',
        description: `Welcome to Chess Arena, ${res.user.username}!`,
        variant: 'success',
      });
      router.push('/lobby');
    } else {
      setServerErrors(res.errors || ['Registration failed. Please try again.']);
    }
  }

  return (
    <div className="flex-1 px-4 sm:px-6 lg:px-8 py-10 sm:py-14 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
            <div className="h-10 w-10 rounded-xl gradient-bg flex items-center justify-center shadow-lg shadow-brand-500/30">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white">
                <path d="M8 2L4 6v5l8 11 8-11V6l-4-4H8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M12 10a2 2 0 100-4 2 2 0 000 4z" fill="currentColor" />
              </svg>
            </div>
          </Link>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            Create your account
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Join Chess Arena and start playing in seconds
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign up for Chess Arena</CardTitle>
            <CardDescription>
              Free forever. No credit card required.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {serverErrors.length > 0 && (
                <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 p-4 flex items-start gap-3">
                  <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm space-y-1">
                    {serverErrors.map((err, i) => (
                      <p key={i} className="text-red-700 dark:text-red-300 font-medium">
                        {err}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <Input
                label="Username"
                placeholder="grandmaster42"
                icon={User}
                value={form.username}
                onChange={onChange('username')}
                error={errors.username}
                hint="3-20 chars, letters, numbers, underscore"
                autoComplete="username"
              />
              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                icon={Mail}
                value={form.email}
                onChange={onChange('email')}
                error={errors.email}
                autoComplete="email"
              />
              <div className="space-y-1.5">
                <Input
                  label="Password"
                  type="password"
                  placeholder="At least 8 characters"
                  icon={Lock}
                  value={form.password}
                  onChange={onChange('password')}
                  error={errors.password}
                  autoComplete="new-password"
                />
                {form.password && (
                  <div className="px-1 space-y-1.5">
                    <div className="flex gap-1 h-1.5">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`flex-1 rounded-full transition-colors ${
                            i < strength ? strengthColors[Math.min(strength, 5)] : 'bg-slate-200 dark:bg-slate-700'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={`font-semibold ${
                          strength <= 1
                            ? 'text-red-600 dark:text-red-400'
                            : strength <= 2
                              ? 'text-orange-600 dark:text-orange-400'
                              : strength <= 3
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {strengthLabels[Math.min(strength, 5)]}
                      </span>
                    </div>
                    <ul className="space-y-1 mt-2">
                      {[
                        ['At least 8 characters', form.password.length >= 8],
                        ['A number', /[0-9]/.test(form.password)],
                        ['An uppercase letter', /[A-Z]/.test(form.password)],
                      ].map(([label, ok], i) => (
                        <li key={i} className="flex items-center gap-2 text-xs">
                          <span
                            className={`flex-shrink-0 h-4 w-4 rounded-full flex items-center justify-center ${
                              ok ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                            }`}
                          >
                            <Check size={10} />
                          </span>
                          <span className={ok ? 'text-slate-600 dark:text-slate-400' : 'text-slate-500 dark:text-slate-500'}>
                            {label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <Input
                label="Confirm password"
                type="password"
                placeholder="Re-enter your password"
                icon={Lock}
                value={form.confirmPassword}
                onChange={onChange('confirmPassword')}
                error={errors.confirmPassword}
                autoComplete="new-password"
              />
              <label className="flex items-start gap-2 text-xs sm:text-sm cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  required
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  I agree to the{' '}
                  <Link href="#" className="text-brand-600 dark:text-brand-400 font-semibold hover:underline">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="#" className="text-brand-600 dark:text-brand-400 font-semibold hover:underline">
                    Privacy Policy
                  </Link>
                </span>
              </label>
            </CardContent>
            <CardFooter>
              <Button type="submit" size="lg" loading={loading} className="w-full">
                Create Account
                <ArrowRight size={18} />
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-600 dark:text-brand-400 font-bold hover:underline">
            Sign in →
          </Link>
        </p>
      </div>
    </div>
  );
}
