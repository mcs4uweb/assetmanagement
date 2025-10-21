// src/app/dashboard/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onValue, ref } from 'firebase/database';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { type Vehicle, type Maintenance } from '../../models/Vehicle';

interface DashboardItem {
  assetKey: string;
  assetLabel: string;
  maintenanceType: string;
  maintenanceDesc?: string;
  dueDate?: Date;
}

const DAYS = 30; // threshold window for "about to expire" and "upcoming"

export default function DashboardPage() {
  const router = useRouter();
  const { currentUser, loading } = useAuth();
  const [assets, setAssets] = useState<Vehicle[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [dismissModal, setDismissModal] = useState<{
    open: boolean;
    type: 'warranty' | 'maint' | null;
    item: DashboardItem | null;
  }>({ open: false, type: null, item: null });

  useEffect(() => {
    if (!currentUser) {
      setAssets([]);
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

    return () => unsubscribe();
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
          <div className='mx-auto max-w-7xl px-4 py-3'>
            <h1 className='text-2xl font-bold text-blue-600'>Dashboard</h1>
            <p className='text-sm text-gray-600'>
              Quick view of expiring warranties and upcoming maintenance
            </p>
          </div>
        </header>

        <main className='mx-auto max-w-7xl px-3 py-4 flex flex-col gap-4 md:flex-row'>
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
        </main>

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
