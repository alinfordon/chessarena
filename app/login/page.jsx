'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast';

export default function LoginPage() {
  const router = useRouter();
  const { login, loading } = useAuth();
  const { toast } = useToast();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [serverErrors, setServerErrors] = useState([]);

  function validate() {
    const errs = {};
    if (!identifier.trim()) {
      errs.identifier = 'Username or email is required';
    }
    if (!password) {
      errs.password = 'Password is required';
    } else if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerErrors([]);
    if (!validate()) return;

    const res = await login({ identifier, password });
    if (res.success) {
      toast({ title: 'Logged in!', variant: 'success' });
      router.push('/lobby');
    } else {
      setServerErrors(res.errors || ['Login failed']);
    }
  }

  return (
    <div className="flex-1 px-4 sm:px-6 lg:px-8 py-10 sm:py-16 flex items-center justify-center">
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
            Welcome back
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Log in to continue your chess journey
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in to Chess Arena</CardTitle>
            <CardDescription>
              Enter your credentials to start playing
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {serverErrors.length > 0 && (
                <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 p-4 flex items-start gap-3">
                  <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    {serverErrors.map((err, i) => (
                      <p key={i} className="text-red-700 dark:text-red-300 font-medium">
                        {err}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <Input
                label="Username or Email"
                placeholder="grandmaster42"
                icon={User}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                error={errors.identifier}
                autoComplete="username"
                autoFocus
              />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                icon={Lock}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                autoComplete="current-password"
                hint="Minimum 8 characters"
              />

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    Remember me
                  </span>
                </label>
                <Link href="#" className="text-brand-600 dark:text-brand-400 font-semibold hover:underline">
                  Forgot password?
                </Link>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" size="lg" loading={loading} className="w-full">
                Sign In
                <ArrowRight size={18} />
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-brand-600 dark:text-brand-400 font-bold hover:underline">
            Sign up free →
          </Link>
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Badge variant="default" size="md">
            New to Chess Arena?
          </Badge>
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center max-w-xs">
            Join thousands of players and start competing in tournaments today.
            No credit card required.
          </p>
        </div>
      </div>
    </div>
  );
}
