// src/app/dashboard/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  onValue,
  ref,
  query,
  orderByChild,
  equalTo,
  push,
  set,
  remove,
} from 'firebase/database';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { type Vehicle, type Maintenance } from '../../models/Vehicle';
import { Bell, Trash2 } from 'lucide-react';

interface DashboardItem {
  assetKey: string;
  assetLabel: string;
  maintenanceType: string;
  maintenanceDesc?: string;
  dueDate?: Date;
}

interface ReminderItem {
  id: string;
  title: string;
  date?: string;
  notes?: string;
}

const DAYS = 30; // threshold window for "about to expire" and "upcoming"

export default function DashboardPage() {
  const router = useRouter();
  const { currentUser, loading } = useAuth();
  const [assets, setAssets] = useState<Vehicle[]>([]);
  const [noOdometerAssets, setNoOdometerAssets] = useState<Vehicle[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [dismissModal, setDismissModal] = useState<{
    open: boolean;
    type: 'warranty' | 'maint' | null;
    item: DashboardItem | null;
  }>({ open: false, type: null, item: null });

  // Reminder modal state (local-only placeholder)
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderNotes, setReminderNotes] = useState('');
  const [localReminders, setLocalReminders] = useState<ReminderItem[]>([]);

  useEffect(() => {
    if (!currentUser) {
      setAssets([]);
      setNoOdometerAssets([]);
      setLocalReminders([]);
      return;
    }

    const assetsRef = ref(db, `assets/${currentUser.UserId}`);
    const unsubscribe = onValue(assetsRef, (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        const list: Vehicle[] = Object.keys(data).map((key) => ({
          key,
          ...data[key],
        }));
        setAssets(list);
      } else {
        setAssets([]);
      }
    });

    // Query for assets missing odometer field directly from Firebase
    const q = query(assetsRef, orderByChild('odometer'), equalTo(null));
    const unsubscribeNoOdo = onValue(q, (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        const list: Vehicle[] = Object.keys(data).map((key) => ({
          key,
          ...data[key],
        }));
        setNoOdometerAssets(list);
      } else {
        setNoOdometerAssets([]);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeNoOdo();
    };
  }, [currentUser]);

  // Load reminders for this user from Firebase
  useEffect(() => {
    if (!currentUser) return;
    const uid = currentUser.UserId;
    const remindersRef = ref(db, `reminders/${uid}`);
    const unsub = onValue(remindersRef, (snap) => {
      const data = snap.val() as Record<
        string,
        { title?: string; date?: string; notes?: string }
      > | null;
      if (!data) {
        setLocalReminders([]);
        return;
      }
      const list: ReminderItem[] = Object.entries(data)
        .map(([id, r]) => ({
          id,
          title: (r.title || '').trim(),
          date: r.date || undefined,
          notes: r.notes || undefined,
        }))
        .filter((r) => r.title);
      // Sort by date (if present), then title
      list.sort((a, b) => {
        const ad = a.date ? Date.parse(a.date) : NaN;
        const bd = b.date ? Date.parse(b.date) : NaN;
        const aHas = Number.isFinite(ad);
        const bHas = Number.isFinite(bd);
        if (aHas && bHas) return ad - bd;
        if (aHas) return -1;
        if (bHas) return 1;
        return a.title.localeCompare(b.title);
      });
      setLocalReminders(list);
    });
    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    if (!loading && !currentUser) {
      router.replace('/login');
    }
  }, [loading, currentUser, router]);

  const labelForAsset = (a: Vehicle): string => {
    const parts: string[] = [];
    if (a.year) parts.push(String(a.year));
    if (a.make) parts.push(a.make);
    if (a.model) parts.push(a.model);
    const candidate = parts.join(' ').trim();
    if (candidate) return candidate;
    if (a.vin && a.vin.trim()) return a.vin.trim();
    if (a.plate && a.plate.trim()) return a.plate.trim();
    return a.category?.trim() || 'Asset';
  };

  const now = new Date();
  const soon = new Date(now.getTime() + DAYS * 24 * 60 * 60 * 1000);

  const { warrantyExpiring, upcomingMaintenance } = useMemo(() => {
    const warrantyExpiring: DashboardItem[] = [];
    const upcomingMaintenance: DashboardItem[] = [];

    for (const a of assets) {
      const maint: Maintenance[] = a.maintenance ?? [];
      for (const m of maint) {
        const type = (m.maintenanceType || '').trim();
        const desc = (m.maintenanceDesc || '').trim() || undefined;
        const dueRaw = m.maintenanceEndDate;
        let due: Date | undefined;
        if (dueRaw) {
          const d = new Date(dueRaw as any);
          if (!Number.isNaN(d.getTime())) {
            due = d;
          }
        }

        const item: DashboardItem = {
          assetKey: a.key || '',
          assetLabel: labelForAsset(a),
          maintenanceType: type,
          maintenanceDesc: desc,
          dueDate: due,
        };

        // Warranty expiring soon (within DAYS)
        if (
          type.toLowerCase().includes('warranty') &&
          due &&
          due >= now &&
          due <= soon
        ) {
          warrantyExpiring.push(item);
        }

        // Upcoming maintenance: specifically oil change and tire rotation in the near future
        const lower = type.toLowerCase();
        const isTarget =
          lower.includes('oil') || lower.includes('tire rotation');
        if (isTarget && due && due >= now && due <= soon) {
          upcomingMaintenance.push(item);
        }
      }
    }

    const byDate = (a?: Date, b?: Date) => {
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      return a.getTime() - b.getTime();
    };

    warrantyExpiring.sort((a, b) => byDate(a.dueDate, b.dueDate));
    upcomingMaintenance.sort((a, b) => byDate(a.dueDate, b.dueDate));

    return { warrantyExpiring, upcomingMaintenance };
  }, [assets]);

  const noOdometerVehicles = useMemo(() => {
    return (noOdometerAssets || []).filter(
      (a) => (a.category || '').toString().trim().toLowerCase() === 'vehicle'
    );
  }, [noOdometerAssets]);

  const staleOdometerVehicles = useMemo(() => {
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const isVehicle = (a: Vehicle) =>
      (a.category || '').toString().trim().toLowerCase() === 'vehicle';
    const latestDateMs = (a: Vehicle): number | null => {
      const entries = Array.isArray(a.odometer) ? a.odometer : [];
      if (entries.length === 0) return null;
      let latest = Number.NEGATIVE_INFINITY;
      for (const e of entries) {
        const raw = (e as any)?.date ?? (e as any)?.reading;
        const ts = raw ? new Date(raw as any).getTime() : NaN;
        if (!Number.isNaN(ts) && ts > latest) latest = ts;
      }
      return Number.isFinite(latest) ? latest : null;
    };

    return assets.filter((a) => {
      if (!isVehicle(a)) return false;
      const ms = latestDateMs(a);
      if (ms === null) return false; // handled by noOdometerVehicles instead
      return Date.now() - ms > ninetyDaysMs;
    });
  }, [assets]);

  const missingOrStaleVehicles = useMemo(() => {
    const byKey: Record<
      string,
      { asset: Vehicle; stale: boolean; lastDate?: string }
    > = {};
    for (const a of noOdometerVehicles) {
      if (!a.key) continue;
      byKey[a.key] = { asset: a, stale: false };
    }
    for (const a of staleOdometerVehicles) {
      if (!a.key) continue;
      // compute last date string
      let lastDate: string | undefined;
      const entries = Array.isArray(a.odometer) ? a.odometer : [];
      let latest = Number.NEGATIVE_INFINITY;
      for (const e of entries) {
        const raw = (e as any)?.date ?? (e as any)?.reading;
        const ts = raw ? new Date(raw as any).getTime() : NaN;
        if (!Number.isNaN(ts) && ts > latest) {
          latest = ts;
        }
      }
      if (Number.isFinite(latest)) {
        lastDate = new Date(latest).toLocaleDateString();
      }
      byKey[a.key] = { asset: a, stale: true, lastDate };
    }
    return Object.values(byKey);
  }, [noOdometerVehicles, staleOdometerVehicles]);

  // Mock sample data when there are no real items
  const sampleWarrantyExpiring: DashboardItem[] = useMemo(
    () => [
      {
        assetKey: 'sample-1',
        assetLabel: '2018 Honda Civic',
        maintenanceType: 'Powertrain Warranty',
        maintenanceDesc: '5yr / 60k mi',
        dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
    ],
    []
  );

  const sampleUpcomingMaintenance: DashboardItem[] = useMemo(
    () => [
      {
        assetKey: 'sample-2',
        assetLabel: 'Dodge 3500 ram',
        maintenanceType: 'Oil Change',
        maintenanceDesc: 'Full synthetic',
        dueDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      },
      {
        assetKey: 'sample-3',
        assetLabel: '2016 Ford F-150',
        maintenanceType: 'Tire Rotation',
        maintenanceDesc: 'Cross-pattern',
        dueDate: new Date(now.getTime() + 18 * 24 * 60 * 60 * 1000),
      },
    ],
    []
  );

  const showSampleWarranty = warrantyExpiring.length === 0;
  const showSampleMaint = upcomingMaintenance.length === 0;
  const displayWarranty = showSampleWarranty
    ? sampleWarrantyExpiring
    : warrantyExpiring;

  // Try to link the sample maintenance item labeled "Didge 3500 ram" to a real asset if present
  const preferredRamAssetKey = useMemo(() => {
    const lc = (v?: string) => (v ? v.toLowerCase() : '');
    const hay = (a: Vehicle) =>
      [a.make, a.model, a.description, a.category].map(lc).join(' ');
    // Best match: contains "didge" + "3500" + "ram"
    const best = assets.find((a) => {
      const h = hay(a);
      return h.includes('didge') && h.includes('3500') && h.includes('ram');
    });
    if (best?.key) return best.key;
    // Second best: contains "dodge" + "3500" + "ram"
    const next = assets.find((a) => {
      const h = hay(a);
      return h.includes('dodge') && h.includes('3500') && h.includes('ram');
    });
    if (next?.key) return next.key;
    // Fallback: contains "3500" and "ram"
    const fallback = assets.find((a) => {
      const h = hay(a);
      return h.includes('3500') && h.includes('ram');
    });
    return fallback?.key;
  }, [assets]);

  const displayMaint = useMemo(() => {
    if (!showSampleMaint) return upcomingMaintenance;
    if (!preferredRamAssetKey) return sampleUpcomingMaintenance;
    return sampleUpcomingMaintenance.map((it) =>
      it.assetLabel.toLowerCase().includes('didge 3500 ram')
        ? { ...it, assetKey: preferredRamAssetKey }
        : it
    );
  }, [
    showSampleMaint,
    upcomingMaintenance,
    preferredRamAssetKey,
    sampleUpcomingMaintenance,
  ]);

  // Utility: stable ID for a warning row (section + asset + type + date)
  const warningId = (section: 'warranty' | 'maint', item: DashboardItem) => {
    const dateKey = item.dueDate
      ? new Date(item.dueDate).toISOString().slice(0, 10)
      : 'na';
    const typeKey = (item.maintenanceType || '').toLowerCase();
    const key = item.assetKey || 'sample';
    return `${section}:${key}:${typeKey}:${dateKey}`;
  };

  const filteredWarranty = useMemo(
    () =>
      displayWarranty.filter((it) => !dismissed.has(warningId('warranty', it))),
    [displayWarranty, dismissed]
  );
  const filteredMaint = useMemo(
    () => displayMaint.filter((it) => !dismissed.has(warningId('maint', it))),
    [displayMaint, dismissed]
  );

  const openDismissModal = (
    type: 'warranty' | 'maint',
    item: DashboardItem
  ) => {
    setDismissModal({ open: true, type, item });
  };

  const closeDismissModal = () =>
    setDismissModal({ open: false, type: null, item: null });

  const confirmDismiss = () => {
    if (!dismissModal.open || !dismissModal.type || !dismissModal.item) return;
    const id = warningId(dismissModal.type, dismissModal.item);
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    closeDismissModal();
  };

  // Reminder helpers
  const resetReminderForm = () => {
    setReminderTitle('');
    setReminderDate('');
    setReminderNotes('');
  };
  const saveReminder = async () => {
    const title = reminderTitle.trim();
    if (!title) return;
    if (!currentUser) return;
    const uid = currentUser.UserId;
    const remindersRef = ref(db, `reminders/${uid}`);
    const newRef = push(remindersRef);
    await set(newRef, {
      title,
      date: reminderDate || null,
      notes: reminderNotes || null,
      createdAt: Date.now(),
    });
    resetReminderForm();
    setReminderOpen(false);
  };
  const deleteReminder = async (id: string) => {
    if (!currentUser) return;
    const uid = currentUser.UserId;
    await remove(ref(db, `reminders/${uid}/${id}`));
  };

  if (loading || !currentUser) {
    return (
      <Layout>
        <div className='flex min-h-screen items-center justify-center'>
          <div className='text-center'>
            <div className='mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600' />
            <p className='mt-4 text-gray-600'>Loading dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className='min-h-screen bg-gray-100'>
        <header className='bg-white shadow'>
          <div className='mx-auto max-w-7xl px-4 py-3 flex items-center justify-between'>
            <div>
              <h1 className='text-2xl font-bold text-blue-600'>Dashboard</h1>
            </div>
            <div className='flex items-center gap-2'>
              <button
                type='button'
                onClick={() => setReminderOpen(true)}
                className='inline-flex items-center gap-2 rounded-md border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50'
                aria-label='Add reminder'
                title='Add reminder'
              >
                <Bell className='h-4 w-4' />
                <span className='hidden sm:inline'>Add Reminder</span>
              </button>
            </div>
          </div>
        </header>

        <main className='mx-auto max-w-7xl px-3 py-4 flex flex-col gap-4 md:flex-row md:flex-wrap'>
          <section className='w-full rounded-lg bg-white p-3 md:p-4 shadow-sm border border-solid border-green-300'>
            <div className='mb-2 flex items-center justify-between'>
              <h2 className='text-lg font-semibold text-green-800'>
                Reminders
              </h2>
            </div>
            {localReminders.length === 0 ? (
              <div className='text-sm text-gray-600'>No reminders yet.</div>
            ) : (
              <ul className='divide-y divide-gray-200'>
                {localReminders.map((r) => (
                  <li key={r.id} className='py-2'>
                    <div className='flex items-start justify-between gap-4'>
                      <div>
                        <div className='font-medium text-gray-900'>
                          {r.title}
                        </div>
                        <div className='text-sm text-gray-700'>
                          {r.date ? (
                            <span className='mr-2'>Due: {r.date}</span>
                          ) : null}
                          {r.notes ? (
                            <span className='text-gray-500'>— {r.notes}</span>
                          ) : null}
                        </div>
                      </div>
                      <div className='shrink-0'>
                        <button
                          type='button'
                          onClick={() => deleteReminder(r.id)}
                          className='inline-flex items-center rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50'
                          aria-label={`Delete reminder ${r.title}`}
                          title='Delete reminder'
                        >
                          <Trash2 className='h-4 w-4' />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className='w-full md:w-1/2 rounded-lg bg-white p-3 md:p-4 shadow-sm'>
            <div className='mb-2 flex items-center justify-between'>
              <h2 className='text-lg font-semibold text-gray-900'>
                Warranties Expiring Soon
              </h2>
              <div className='flex items-center gap-3'>
                <span className='text-xs text-gray-500'>Next {DAYS} days</span>
              </div>
            </div>
            {filteredWarranty.length === 0 ? (
              <p className='text-sm text-gray-600'>
                No warranties are expiring soon.
              </p>
            ) : (
              <ul className='divide-y divide-gray-200'>
                {filteredWarranty.map((item, idx) => (
                  <li key={`${item.assetKey}-${idx}`} className='py-2'>
                    <div className='flex items-start justify-between gap-4'>
                      <div>
                        {item.assetKey &&
                        !item.assetKey.startsWith('sample') ? (
                          <Link
                            href={`/homedetail/${item.assetKey}`}
                            className='font-medium text-blue-600 hover:text-blue-700'
                          >
                            {item.assetLabel}
                          </Link>
                        ) : (
                          <div className='font-medium text-gray-900'>
                            {item.assetLabel}{' '}
                            <span className='ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600'>
                              Sample
                            </span>
                          </div>
                        )}
                        <div className='text-sm text-gray-700'>
                          {item.maintenanceType || 'Warranty'}{' '}
                          {item.maintenanceDesc
                            ? `– ${item.maintenanceDesc}`
                            : ''}
                        </div>
                      </div>
                      <div className='text-right'>
                        <div className='flex items-center justify-end gap-2'>
                          <div className='text-sm font-medium text-gray-900'>
                            {item.dueDate
                              ? new Date(item.dueDate).toLocaleDateString()
                              : 'No date'}
                          </div>
                          {item.assetKey &&
                          !item.assetKey.startsWith('sample') ? (
                            <Link
                              href={`/homedetail/${item.assetKey}?edit=maintenance`}
                              className='inline-flex items-center rounded-md border border-blue-400 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50'
                              aria-label={`Edit maintenance for ${item.assetLabel}`}
                            >
                              Edit
                            </Link>
                          ) : (
                            <Link
                              href={'/home'}
                              className='inline-flex items-center rounded-md border border-blue-400 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50'
                              aria-label={`Edit maintenance for ${item.assetLabel}`}
                            >
                              Edit
                            </Link>
                          )}
                          <button
                            type='button'
                            onClick={() => openDismissModal('warranty', item)}
                            className='inline-flex items-center rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50'
                            aria-label={`Dismiss warning for ${item.assetLabel}`}
                          >
                            Dismiss
                          </button>
                        </div>
                        {item.dueDate && (
                          <div className='text-xs text-gray-500'>
                            due in{' '}
                            {Math.ceil(
                              (item.dueDate.getTime() - now.getTime()) /
                                (1000 * 60 * 60 * 24)
                            )}{' '}
                            days
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className='w-full md:w-1/2 rounded-lg bg-white p-3 md:p-4 shadow-sm'>
            <div className='mb-2 flex items-center justify-between'>
              <h2 className='text-lg font-semibold text-gray-900'>
                Upcoming Maintenance
              </h2>
              <div className='flex items-center gap-3'>
                <span className='text-xs text-gray-500'>Next {DAYS} days</span>
              </div>
            </div>
            {filteredMaint.length === 0 ? (
              <p className='text-sm text-gray-600'>
                No upcoming maintenance due soon for oil changes or tire
                rotations.
              </p>
            ) : (
              <ul className='divide-y divide-gray-200'>
                {filteredMaint.map((item, idx) => (
                  <li key={`${item.assetKey}-${idx}`} className='py-2'>
                    <div className='flex items-start justify-between gap-4'>
                      <div>
                        {item.assetKey &&
                        !item.assetKey.startsWith('sample') ? (
                          <Link
                            href={`/homedetail/${item.assetKey}`}
                            className='font-medium text-blue-600 hover:text-blue-700'
                          >
                            {item.assetLabel}
                          </Link>
                        ) : (
                          <div className='font-medium text-gray-900'>
                            {item.assetLabel}{' '}
                            <span className='ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600'>
                              Sample
                            </span>
                          </div>
                        )}
                        <div className='text-sm text-gray-700'>
                          {item.maintenanceType || 'Maintenance'}{' '}
                          {item.maintenanceDesc
                            ? `– ${item.maintenanceDesc}`
                            : ''}
                        </div>
                      </div>
                      <div className='text-right'>
                        <div className='flex items-center justify-end gap-2'>
                          <div className='text-sm font-medium text-gray-900'>
                            {item.dueDate
                              ? new Date(item.dueDate).toLocaleDateString()
                              : 'No date'}
                          </div>
                          {item.assetKey &&
                          !item.assetKey.startsWith('sample') ? (
                            <Link
                              href={`/homedetail/${item.assetKey}?edit=maintenance`}
                              className='inline-flex items-center rounded-md border border-blue-400 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50'
                              aria-label={`Edit maintenance for ${item.assetLabel}`}
                            >
                              Edit
                            </Link>
                          ) : (
                            <Link
                              href={'/home'}
                              className='inline-flex items-center rounded-md border border-blue-400 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50'
                              aria-label={`Edit maintenance for ${item.assetLabel}`}
                            >
                              Edit
                            </Link>
                          )}
                          <button
                            type='button'
                            onClick={() => openDismissModal('maint', item)}
                            className='inline-flex items-center rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50'
                            aria-label={`Dismiss warning for ${item.assetLabel}`}
                          >
                            Dismiss
                          </button>
                        </div>
                        {item.dueDate && (
                          <div className='text-xs text-gray-500'>
                            due in{' '}
                            {Math.ceil(
                              (item.dueDate.getTime() - now.getTime()) /
                                (1000 * 60 * 60 * 24)
                            )}{' '}
                            days
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className='w-full md:w-full rounded-lg bg-white p-3 md:p-4 shadow-sm'>
            <div className='mb-2 flex items-center justify-between'>
              <h2 className='text-lg font-semibold text-gray-900'>
                Vehicles Missing or Stale Odometer Reading
              </h2>
              <div className='flex items-center gap-3'>
                <span className='text-xs text-gray-500'>
                  Filtered from database
                </span>
              </div>
            </div>
            {missingOrStaleVehicles.length === 0 ? (
              <p className='text-sm text-gray-600'>
                All vehicles have a recent odometer reading.
              </p>
            ) : (
              <ul className='divide-y divide-gray-200'>
                {missingOrStaleVehicles.map(({ asset: a, stale, lastDate }) => (
                  <li key={a.key} className='py-2'>
                    <div className='flex items-center justify-between gap-4'>
                      <Link
                        href={`/homedetail/${a.key}`}
                        className='font-medium text-blue-600 hover:text-blue-700'
                      >
                        {labelForAsset(a)}
                      </Link>
                      <div className='flex items-center gap-3'>
                        {stale ? (
                          <span className='text-xs text-red-600'>
                            Last reading older than 90 days
                            {lastDate ? ` (${lastDate})` : ''}
                          </span>
                        ) : (
                          <span className='text-xs text-gray-600'>
                            No odometer readings
                          </span>
                        )}
                        <Link
                          href={`/homedetail/${a.key}`}
                          className='inline-flex items-center rounded-md border border-blue-400 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50'
                        >
                          {stale ? 'Update Reading' : 'Add Reading'}
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>

        {reminderOpen && (
          <div className='fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 px-4'>
            <div className='w-full max-w-md rounded-lg bg-white p-5 shadow-xl'>
              <h2 className='text-base font-semibold text-gray-900 flex items-center gap-2'>
                <Bell className='h-4 w-4' /> Add Reminder
              </h2>
              <div className='mt-4 space-y-3'>
                <div>
                  <label className='block text-sm font-medium text-gray-700'>
                    Title
                  </label>
                  <input
                    type='text'
                    value={reminderTitle}
                    onChange={(e) => setReminderTitle(e.target.value)}
                    placeholder='e.g., Renew registration'
                    className='mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700'>
                    Date
                  </label>
                  <input
                    type='date'
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    className='mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700'>
                    Notes
                  </label>
                  <textarea
                    value={reminderNotes}
                    onChange={(e) => setReminderNotes(e.target.value)}
                    rows={3}
                    className='mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                    placeholder='Optional details'
                  />
                </div>
              </div>
              <div className='mt-5 flex justify-end gap-3'>
                <button
                  type='button'
                  onClick={() => {
                    setReminderOpen(false);
                    resetReminderForm();
                  }}
                  className='inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100'
                >
                  Cancel
                </button>
                <button
                  type='button'
                  onClick={saveReminder}
                  disabled={!reminderTitle.trim()}
                  className='inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {dismissModal.open && dismissModal.item && (
          <div className='fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 px-4'>
            <div className='w-full max-w-sm rounded-lg bg-white p-5 shadow-xl'>
              <h2 className='text-base font-semibold text-gray-900'>
                Dismiss Warning
              </h2>
              <p className='mt-2 text-sm text-gray-600'>
                Are you sure you want to dismiss this warning for
                <span className='font-medium'>
                  {' '}
                  {dismissModal.item.assetLabel}
                </span>
                ?
              </p>
              <div className='mt-5 flex justify-end gap-3'>
                <button
                  type='button'
                  onClick={closeDismissModal}
                  className='inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100'
                >
                  Cancel
                </button>
                <button
                  type='button'
                  onClick={confirmDismiss}
                  className='inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700'
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
