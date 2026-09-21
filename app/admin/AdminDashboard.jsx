'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Ban,
  Crown,
  Loader2,
  Pencil,
  Radio,
  Search,
  Shield,
  Trophy,
  Trash2,
  Users,
  Swords,
  Check,
  X,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import clsx from 'clsx';

const TC_PRESETS = [
  { label: '3+0 Blitz', initialTime: 180, increment: 0 },
  { label: '5+3 Blitz', initialTime: 300, increment: 3 },
  { label: '10+5 Rapid', initialTime: 600, increment: 5 },
  { label: '15+10 Rapid', initialTime: 900, increment: 10 },
  { label: '30+0 Classical', initialTime: 1800, increment: 0 },
];

const TOURNAMENT_TYPES = ['arena', 'swiss', 'round_robin', 'single_elimination'];
const TOURNAMENT_STATUSES = ['registration', 'live', 'finished', 'cancelled'];

function pad(n) {
  return String(n).padStart(2, '0');
}

function toLocalInput(d) {
  const date = d instanceof Date ? d : new Date(d);
  const src = Number.isNaN(date.getTime()) ? new Date(Date.now() + 60 * 60 * 1000) : date;
  return `${src.getFullYear()}-${pad(src.getMonth() + 1)}-${pad(src.getDate())}T${pad(src.getHours())}:${pad(src.getMinutes())}`;
}

function defaultForm() {
  return {
    name: '',
    description: '',
    type: 'arena',
    tcIdx: 1,
    maxPlayers: 32,
    prizePool: '',
    pointsWin: 2,
    pointsDraw: 1,
    pointsLoss: 0,
    prizeFirst: 100,
    prizeSecond: 50,
    prizeThird: 25,
    startAt: toLocalInput(Date.now() + 60 * 60 * 1000),
    status: 'registration',
    official: true,
  };
}

function tournamentToForm(t) {
  const idx = TC_PRESETS.findIndex(
    (p) => p.initialTime === t.timeControl?.initialTime && p.increment === (t.timeControl?.increment || 0)
  );
  return {
    name: t.name || '',
    description: t.description || '',
    type: t.type || 'arena',
    tcIdx: idx >= 0 ? idx : 1,
    maxPlayers: t.maxPlayers || 16,
    prizePool: t.prizePool || '',
    pointsWin: t.scoring?.win ?? 2,
    pointsDraw: t.scoring?.draw ?? 1,
    pointsLoss: t.scoring?.loss ?? 0,
    prizeFirst: t.prizes?.first ?? 0,
    prizeSecond: t.prizes?.second ?? 0,
    prizeThird: t.prizes?.third ?? 0,
    startAt: toLocalInput(t.startAt),
    status: t.status || 'registration',
    official: !!t.official,
  };
}

function formPayload(form) {
  const tc = TC_PRESETS[form.tcIdx] || TC_PRESETS[0];
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    type: form.type,
    timeControl: { initialTime: tc.initialTime, increment: tc.increment, label: tc.label.split(' ')[0] },
    maxPlayers: form.maxPlayers,
    prizePool: form.prizePool.trim(),
    scoring: {
      win: form.pointsWin,
      draw: form.pointsDraw,
      loss: form.pointsLoss,
    },
    prizes: {
      first: form.prizeFirst,
      second: form.prizeSecond,
      third: form.prizeThird,
    },
    startAt: new Date(form.startAt).toISOString(),
    official: form.official,
    status: form.status,
  };
}

function timeAgo(d) {
  if (!d) return '—';
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [q, setQ] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [tournaments, setTournaments] = useState([]);
  const [tourneysLoading, setTourneysLoading] = useState(false);
  const [error, setError] = useState('');

  const [banTarget, setBanTarget] = useState(null);
  const [banReason, setBanReason] = useState('Fair-play violation');
  const [banHours, setBanHours] = useState('24');
  const [banPermanent, setBanPermanent] = useState(false);
  const [banBusy, setBanBusy] = useState(false);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formBusy, setFormBusy] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const formOpen = creating || !!editing;

  const loadStats = useCallback(async () => {
    const r = await fetch('/api/admin/stats');
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) throw new Error(d.error || 'Could not load stats');
    setStats(d.stats);
  }, []);

  const loadUsers = useCallback(async (query) => {
    setUsersLoading(true);
    try {
      const r = await fetch(`/api/admin/users?q=${encodeURIComponent(query || '')}&limit=50`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || 'Could not load users');
      setUsers(d.users || []);
      setUserTotal(d.total || 0);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const loadTournaments = useCallback(async () => {
    setTourneysLoading(true);
    try {
      const r = await fetch('/api/admin/tournaments');
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || 'Could not load tournaments');
      setTournaments(d.tournaments || []);
    } finally {
      setTourneysLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadStats(), loadUsers(''), loadTournaments()]);
      } catch (e) {
        setError(e.message || 'Failed to load admin data');
      }
    })();
  }, [loadStats, loadUsers, loadTournaments]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadUsers(q).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [q, loadUsers]);

  async function patchUser(id, payload) {
    const r = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) throw new Error(d.error || 'Action failed');
    return d;
  }

  async function confirmBan() {
    if (!banTarget) return;
    setBanBusy(true);
    try {
      await patchUser(banTarget._id, {
        action: 'ban',
        reason: banReason,
        severity: banPermanent ? 'permanent' : 'temp',
        hours: parseInt(banHours, 10) || 24,
      });
      toast({ title: `${banTarget.username} banned`, variant: 'warning' });
      setBanTarget(null);
      await loadUsers(q);
    } catch (e) {
      toast({ title: e.message || 'Ban failed', variant: 'error' });
    } finally {
      setBanBusy(false);
    }
  }

  async function unban(u) {
    try {
      await patchUser(u._id, { action: 'unban' });
      toast({ title: `${u.username} unbanned`, variant: 'success' });
      await loadUsers(q);
    } catch (e) {
      toast({ title: e.message || 'Unban failed', variant: 'error' });
    }
  }

  async function patchTournament(id, payload) {
    const r = await fetch(`/api/admin/tournaments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) throw new Error(d.error || 'Update failed');
    await loadTournaments();
    await loadStats().catch(() => {});
  }

  function openCreate() {
    setEditing(null);
    setForm(defaultForm());
    setCreating(true);
  }

  function openEdit(t) {
    setCreating(false);
    setForm(tournamentToForm(t));
    setEditing(t);
  }

  function closeForm() {
    if (formBusy) return;
    setCreating(false);
    setEditing(null);
  }

  async function saveTournament(e) {
    e?.preventDefault?.();
    if (form.name.trim().length < 3) return;
    setFormBusy(true);
    try {
      const payload = formPayload(form);
      if (editing) {
        await patchTournament(editing._id, payload);
        toast({ title: 'Tournament updated', variant: 'success' });
        setEditing(null);
      } else {
        const r = await fetch('/api/tournaments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, official: true }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.ok) throw new Error(d.error || 'Could not create tournament');
        toast({ title: 'Official tournament created', variant: 'success' });
        setCreating(false);
        setForm(defaultForm());
        await loadTournaments();
        await loadStats().catch(() => {});
      }
    } catch (err) {
      toast({ title: err.message || (editing ? 'Update failed' : 'Create failed'), variant: 'error' });
    } finally {
      setFormBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      const r = await fetch(`/api/admin/tournaments/${deleteTarget._id}`, { method: 'DELETE' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || 'Delete failed');
      toast({ title: `${deleteTarget.name} deleted`, variant: 'warning' });
      setDeleteTarget(null);
      await loadTournaments();
      await loadStats().catch(() => {});
    } catch (e) {
      toast({ title: e.message || 'Delete failed', variant: 'error' });
    } finally {
      setDeleteBusy(false);
    }
  }

  const statCards = [
    { label: 'Users', value: stats?.users ?? '—', icon: Users, tone: 'text-brand-500' },
    { label: 'Online now', value: stats?.online ?? '—', icon: Radio, tone: 'text-emerald-500' },
    { label: 'Live games', value: stats?.gamesPlaying ?? '—', icon: Swords, tone: 'text-amber-500' },
    { label: 'Games (24h)', value: stats?.gamesToday ?? '—', icon: Crown, tone: 'text-purple-500' },
    { label: 'Open events', value: stats?.tournamentsReg ?? '—', icon: Trophy, tone: 'text-sky-500' },
    { label: 'Official live', value: stats?.official ?? '—', icon: Shield, tone: 'text-rose-500' },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 flex gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <s.icon size={16} className={s.tone} />
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">{s.value}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="users">
        <TabsList className="flex-wrap">
          <TabsTrigger value="users"><Users size={14} /> Users</TabsTrigger>
          <TabsTrigger value="tournaments"><Trophy size={14} /> Official tournaments</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Manage users</CardTitle>
              <CardDescription>{userTotal} accounts · Ban, unban, and review activity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                icon={Search}
                placeholder="Search username or email…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {usersLoading ? (
                <div className="py-10 text-center text-slate-500"><Loader2 className="inline animate-spin mr-2" size={16} /> Loading…</div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60 -mx-2">
                  {users.map((u) => (
                    <div key={u._id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar src={u.avatar} alt={u.username} size="md" status={u.isOnline ? 'online' : 'offline'} />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                            {u.username}
                            {u.role === 'admin' && <Badge variant="gold" size="sm">Admin</Badge>}
                            {u.banned && <Badge variant="danger" size="sm">Banned</Badge>}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {u.email} · {u.rating} Elo · {u.gamesPlayed} games · {u.isOnline ? 'online' : `seen ${timeAgo(u.lastSeen)}`}
                          </div>
                          {u.banned && u.ban?.reason && (
                            <div className="text-xs text-red-600 dark:text-red-400 mt-0.5">{u.ban.reason}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {u.role === 'admin' ? (
                          <span className="text-xs text-slate-400 px-2 py-1">Protected</span>
                        ) : u.banned ? (
                          <Button size="sm" variant="secondary" onClick={() => unban(u)}>
                            <Check size={14} /> Unban
                          </Button>
                        ) : (
                          <Button size="sm" variant="danger" onClick={() => { setBanTarget(u); setBanReason('Fair-play violation'); }}>
                            <Ban size={14} /> Ban
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {users.length === 0 && (
                    <p className="p-8 text-center text-sm text-slate-500">No users match this search.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tournaments">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={openCreate}>
                <Trophy size={16} /> Create official tournament
              </Button>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Tournaments</CardTitle>
                <CardDescription>Edit details, mark official, cancel, or delete events</CardDescription>
              </CardHeader>
              <CardContent>
                {tourneysLoading ? (
                  <div className="py-10 text-center text-slate-500"><Loader2 className="inline animate-spin mr-2" size={16} /> Loading…</div>
                ) : (
                  <div className="space-y-3">
                    {tournaments.map((t) => (
                      <div
                        key={t._id}
                        className="flex flex-col lg:flex-row lg:items-center gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/60"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {t.official && <Badge variant="gold" size="sm">Official</Badge>}
                            <Badge
                              variant={t.status === 'live' ? 'danger' : t.status === 'registration' ? 'success' : t.status === 'cancelled' ? 'default' : 'warning'}
                              size="sm"
                            >
                              {t.status}
                            </Badge>
                            <span className="text-xs text-slate-500">{t.type?.replaceAll('_', ' ')}</span>
                          </div>
                          <div className="font-bold text-slate-900 dark:text-slate-100 truncate">{t.name}</div>
                          <div className="text-xs text-slate-500">
                            {t.timeControl?.label || '—'} · max {t.maxPlayers} · by {t.createdBy}
                            {' · '}
                            Win {t.scoring?.win ?? 2} / Draw {t.scoring?.draw ?? 1} / Loss {t.scoring?.loss ?? 0}
                            {(t.prizes?.first || t.prizes?.second || t.prizes?.third)
                              ? ` · Prizes ${t.prizes?.first || 0}/${t.prizes?.second || 0}/${t.prizes?.third || 0}`
                              : ''}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" onClick={() => openEdit(t)}>
                            <Pencil size={14} /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant={t.official ? 'secondary' : 'ghost'}
                            onClick={() => patchTournament(t._id, { official: !t.official }).catch((e) => toast({ title: e.message, variant: 'error' }))}
                          >
                            {t.official ? 'Unofficial' : 'Make official'}
                          </Button>
                          {t.status !== 'cancelled' && t.status !== 'finished' && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => patchTournament(t._id, { status: 'cancelled' }).catch((e) => toast({ title: e.message, variant: 'error' }))}
                            >
                              <X size={14} /> Cancel
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" href={`/tournaments/${t._id}`}>
                            Open
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => setDeleteTarget(t)}>
                            <Trash2 size={14} /> Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                    {tournaments.length === 0 && (
                      <p className="p-8 text-center text-sm text-slate-500">No tournaments yet.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Modal
        isOpen={!!banTarget}
        onClose={() => setBanTarget(null)}
        title={`Ban ${banTarget?.username || ''}`}
        description="The player will be blocked from playing until the ban expires or is lifted."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setBanTarget(null)} disabled={banBusy}>Cancel</Button>
            <Button variant="danger" onClick={confirmBan} loading={banBusy}><Ban size={14} /> Ban user</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Reason" value={banReason} onChange={(e) => setBanReason(e.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={banPermanent} onChange={(e) => setBanPermanent(e.target.checked)} />
            Permanent ban
          </label>
          {!banPermanent && (
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Duration (hours)
              <input
                type="number"
                min={1}
                max={2160}
                value={banHours}
                onChange={(e) => setBanHours(e.target.value)}
                className="mt-1.5 w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-4 text-sm"
              />
            </label>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={formOpen}
        onClose={closeForm}
        title={editing ? 'Edit tournament' : 'Create official tournament'}
        description={
          editing
            ? 'Update format, time control, scoring, and prizes.'
            : 'Official events appear with a gold badge on the public tournament list.'
        }
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeForm} disabled={formBusy}>Cancel</Button>
            <Button onClick={saveTournament} loading={formBusy} disabled={form.name.trim().length < 3}>
              {editing ? (
                <>
                  <Pencil size={16} /> Save changes
                </>
              ) : (
                <>
                  <Trophy size={16} /> Publish official
                </>
              )}
            </Button>
          </>
        }
      >
        <form onSubmit={saveTournament} className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Weekly Arena #12" />
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Description
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="mt-1.5 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            />
          </label>
          <div>
            <div className="text-sm font-semibold mb-2">Format</div>
            <div className="flex flex-wrap gap-2">
              {TOURNAMENT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type }))}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-bold border',
                    form.type === type
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-700'
                      : 'border-slate-200 dark:border-slate-700'
                  )}
                >
                  {type.replaceAll('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold mb-2">Time control</div>
            <div className="flex flex-wrap gap-2">
              {TC_PRESETS.map((tc, i) => (
                <button
                  key={tc.label}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, tcIdx: i }))}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-bold border',
                    form.tcIdx === i
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-700'
                      : 'border-slate-200 dark:border-slate-700'
                  )}
                >
                  {tc.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Max players"
              type="number"
              value={form.maxPlayers}
              onChange={(e) => setForm((f) => ({ ...f, maxPlayers: parseInt(e.target.value, 10) || 16 }))}
            />
            <Input
              label="Start"
              type="datetime-local"
              value={form.startAt}
              onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
            />
          </div>
          {editing && (
            <div>
              <div className="text-sm font-semibold mb-2">Status</div>
              <div className="flex flex-wrap gap-2">
                {TOURNAMENT_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, status }))}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-bold border',
                      form.status === status
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-700'
                        : 'border-slate-200 dark:border-slate-700'
                    )}
                  >
                    {status.replaceAll('_', ' ')}
                  </button>
                ))}
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.official}
                  onChange={(e) => setForm((f) => ({ ...f, official: e.target.checked }))}
                />
                Official tournament
              </label>
            </div>
          )}
          <div>
            <div className="text-sm font-semibold mb-1">Match points</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Added to standings after each game.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Win"
                type="number"
                min={0}
                max={1000}
                step="0.5"
                value={form.pointsWin}
                onChange={(e) => setForm((f) => ({ ...f, pointsWin: e.target.value }))}
              />
              <Input
                label="Draw"
                type="number"
                min={0}
                max={1000}
                step="0.5"
                value={form.pointsDraw}
                onChange={(e) => setForm((f) => ({ ...f, pointsDraw: e.target.value }))}
              />
              <Input
                label="Loss"
                type="number"
                min={0}
                max={1000}
                step="0.5"
                value={form.pointsLoss}
                onChange={(e) => setForm((f) => ({ ...f, pointsLoss: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold mb-1">Prize points</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Awarded to the top 3 in the final standings.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="1st place"
                type="number"
                min={0}
                max={1000}
                value={form.prizeFirst}
                onChange={(e) => setForm((f) => ({ ...f, prizeFirst: e.target.value }))}
              />
              <Input
                label="2nd place"
                type="number"
                min={0}
                max={1000}
                value={form.prizeSecond}
                onChange={(e) => setForm((f) => ({ ...f, prizeSecond: e.target.value }))}
              />
              <Input
                label="3rd place"
                type="number"
                min={0}
                max={1000}
                value={form.prizeThird}
                onChange={(e) => setForm((f) => ({ ...f, prizeThird: e.target.value }))}
              />
            </div>
          </div>
          <Input
            label="Prize note (optional)"
            value={form.prizePool}
            onChange={(e) => setForm((f) => ({ ...f, prizePool: e.target.value }))}
            placeholder="e.g. Champion badge"
          />
        </form>
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !deleteBusy && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name || 'tournament'}?`}
        description="This removes the event and its registrations. Live games from this tournament will be aborted."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>Keep</Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleteBusy}>
              <Trash2 size={14} /> Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Players will no longer see this tournament. Finished games stay in player history.
        </p>
      </Modal>
    </div>
  );
}
