import { redirect } from 'next/navigation';
import { Shield } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { ensureFounderAdmin, isAdminUser } from '@/lib/admin';
import AdminDashboard from './AdminDashboard';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Admin · Chess Arena',
  robots: 'noindex,nofollow',
};

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  await ensureFounderAdmin();
  const fresh = await getCurrentUser();
  if (!isAdminUser(fresh)) {
    return (
      <div className="flex-1 px-4 py-20">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-10 text-center space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 mx-auto flex items-center justify-center">
              <Shield size={24} className="text-slate-400" />
            </div>
            <h1 className="text-2xl font-black">Admin only</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              You do not have permission to open the admin dashboard.
            </p>
            <Button href="/">Back home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 px-4 sm:px-6 lg:px-8 mx-auto max-w-6xl w-full py-8 lg:py-12">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-2">
          <Shield size={14} /> Administration
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
          Admin dashboard
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Manage players, bans, and official Chess Arena tournaments.
        </p>
      </div>
      <AdminDashboard />
    </div>
  );
}
