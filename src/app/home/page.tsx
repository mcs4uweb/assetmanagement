// src/app/home/page.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { Vehicle } from '../../models/Vehicle';
import { ref, onValue, push, set, update } from 'firebase/database';
import { db } from '../../lib/firebase';
import Layout from '../../components/layout/Layout';
import { Pencil } from 'lucide-react';

export default function HomePage() {
  const { currentUser, loading } = useAuth();
  const { cartTotal } = useCart();
  const router = useRouter();
  const [assets, setAssets] = useState<Vehicle[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState('');
  const [showInsuranceForm, setShowInsuranceForm] = useState(false);
  const [showWarrantyForm, setShowWarrantyForm] = useState(false);
  const [editingOdometerFor, setEditingOdometerFor] = useState<string | null>(null);
  const [odometerDraft, setOdometerDraft] = useState<{ reading: string; date: string }>({ reading: '', date: '' });
  const [isSavingOdometer, setIsSavingOdometer] = useState(false);
  const [odometerError, setOdometerError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Vehicle>>({
    make: '',
    model: '',
    year: undefined,
    vin: '',
    plate: '',
    tires: '',
    insuranceCompany: '',
    insurancePolicyNumber: '',
    insuranceExpirationDate: '',
    warranty: false,
    warrantyNumber: '',
    warrantyPhone: '',
    warrantyNotes: '',
    warrantyExpiry: '',
  });

  // Years dropdown options from current year down to 1980
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const start = 1980;
    const years: number[] = [];
    for (let y = current; y >= start; y -= 1) years.push(y);
    return years;
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setAssets([]);
      return;
    }

    const assetsRef = ref(db, `assets/${currentUser.UserId}`);
    const unsubscribe = onValue(assetsRef, (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        const assetsList = Object.keys(data).map((key) => ({
          key,
          ...data[key],
        }));
        setAssets(assetsList);
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

  // Group assets by category with desired order
  const groupedAssets = useMemo(() => {
    const order: Record<string, number> = { vehicle: 0, household: 1, bike: 2 };
    const groups: Record<string, Vehicle[]> = {};

    const normalizeCategory = (a: Vehicle): string => {
      const raw = (a.category || '').toLowerCase().trim();
      if (raw in order) return raw;
      // Treat common vehicle-like values/brands as vehicles
      const vehicleAliases = new Set([
        'car',
        'cars',
        'truck',
        'trucks',
        'suv',
        'van',
        'motorcycle',
        'motorbike',
        'atv',
        'utv',
        'dodge',
        'polaris',
        'polarius',
      ]);
      if (vehicleAliases.has(raw)) return 'vehicle';
      // If it has a VIN or plate, consider it a vehicle
      if ((a.vin && a.vin.trim()) || (a.plate && a.plate.trim())) return 'vehicle';
      return 'other';
    };

    for (const a of assets) {
      const key = normalizeCategory(a);
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    }
    const categories = Object.keys(groups).sort(
      (a, b) => (order[a] ?? 99) - (order[b] ?? 99)
    );
    return categories.map((c) => ({ category: c, items: groups[c] }));
  }, [assets]);

  const categoryLabel: Record<string, string> = {
    vehicle: 'Vehicles',
    household: 'Household Items',
    bike: 'Bikes',
    other: 'Other',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.UserId) {
      console.error('Unable to add asset: user is not authenticated.');
      return;
    }

    try {
      const assetsRef = ref(db, `assets/${currentUser.UserId}`);
      const newAssetRef = push(assetsRef);
      const newAsset: Vehicle = {
        ...formData,
        UserId: currentUser.UserId,
        category: selectedAsset,
        key: newAssetRef.key ?? undefined,
        warranty: Boolean((formData as any).warranty),
      };
      await set(newAssetRef, newAsset);
      setShowForm(false);
      setShowInsuranceForm(false);
      setShowWarrantyForm(false);
      setFormData({
        make: '',
        model: '',
        year: undefined,
        vin: '',
        plate: '',
        tires: '',
        insuranceCompany: '',
        insurancePolicyNumber: '',
        insuranceExpirationDate: '',
        warranty: false,
        warrantyNumber: '',
        warrantyPhone: '',
        warrantyNotes: '',
        warrantyExpiry: '',
      });
      setSelectedAsset('');
    } catch (error) {
      console.error('Error adding asset:', error);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Helper to compute the latest odometer entry for a card
  const formatLatestOdometer = (
    a: Vehicle
  ): { number: string; date?: string; dateMs?: number } | null => {
    const entries = Array.isArray(a.odometer) ? a.odometer : [];
    if (entries.length === 0) return null;
    let latestIndex = -1;
    let latestTs = -Infinity;
    for (let i = 0; i < entries.length; i += 1) {
      const e = entries[i] as any;
      const raw = e?.date ?? e?.reading;
      const ts = raw ? new Date(raw as any).getTime() : NaN;
      const safeTs = Number.isNaN(ts) ? -Infinity : ts;
      if (safeTs > latestTs) {
        latestTs = safeTs;
        latestIndex = i;
      }
    }
    const chosen = entries[latestIndex] as any;
    if (!chosen || typeof chosen.odometer !== 'number' || !Number.isFinite(chosen.odometer)) return null;
    const number = new Intl.NumberFormat().format(chosen.odometer as number);
    let date: string | undefined;
    let dateMs: number | undefined;
    const raw = chosen?.date ?? chosen?.reading;
    if (raw) {
      const d = new Date(raw as any);
      if (!Number.isNaN(d.getTime())) {
        date = d.toLocaleDateString();
        dateMs = d.getTime();
      }
    }
    return { number, date, dateMs };
  };

  const openOdometerEditor = (asset: Vehicle) => {
    const today = new Date().toISOString().split('T')[0];
    setEditingOdometerFor(asset.key || null);
    setOdometerDraft({ reading: '', date: today });
    setOdometerError(null);
  };

  const cancelOdometerEdit = () => {
    if (isSavingOdometer) return;
    setEditingOdometerFor(null);
    setOdometerDraft({ reading: '', date: '' });
    setOdometerError(null);
  };

  const handleOdometerSave = async (asset: Vehicle) => {
    if (!currentUser?.UserId || !asset?.key) return;

    const readingTrim = odometerDraft.reading.trim();
    const dateTrim = odometerDraft.date.trim();

    if (!readingTrim) {
      setOdometerError('Please enter the odometer reading.');
      return;
    }
    const readingNum = Number(readingTrim);
    if (!Number.isFinite(readingNum)) {
      setOdometerError('Odometer reading must be a valid number.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTrim)) {
      setOdometerError('Please provide a valid date.');
      return;
    }
    const isoDate = `${dateTrim}T00:00:00.000Z`;

    try {
      setIsSavingOdometer(true);
      setOdometerError(null);
      const targetRef = ref(db, `assets/${currentUser.UserId}/${asset.key}`);
      const prior = Array.isArray(asset.odometer) ? asset.odometer : [];
      const next = [...prior, { odometer: readingNum, date: isoDate }];
      await update(targetRef, { odometer: next });
      setEditingOdometerFor(null);
      setOdometerDraft({ reading: '', date: '' });
    } catch (err) {
      console.error('Failed to save odometer', err);
      setOdometerError('Unable to save odometer reading. Please try again.');
    } finally {
      setIsSavingOdometer(false);
    }
  };

  if (loading || !currentUser) {
    return (
      <Layout>
        <div className='flex min-h-screen items-center justify-center'>
          <div className='text-center'>
            <div className='mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600' />
            <p className='mt-4 text-gray-600'>Loading your assets...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className='min-h-screen bg-gray-100'>
        <header className='bg-white shadow'>
          <div className='max-w-7xl mx-auto px-4 py-4 flex justify-between items-center'>
            <h1 className='text-2xl font-bold text-blue-600'>My Assets</h1>
          </div>
        </header>

        <main className='relative max-w-7xl mx-auto px-4 py-6'>
          <button
            type='button'
            onClick={() => setShowForm(true)}
            className='absolute top-6 right-6 z-10 p-4 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg'
            aria-label='Add New Asset'
            title='Add New Asset'
          >
            <svg
              className='w-6 h-6'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 4v16m8-8H4'
              />
            </svg>
          </button>

          {assets.length === 0 && !showForm && (
            <div className='text-center py-12'>
              <svg
                className='mx-auto h-12 w-12 text-gray-400'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                />
              </svg>
              <h3 className='mt-2 text-sm font-medium text-gray-900'>
                No assets
              </h3>
              <p className='mt-1 text-sm text-gray-500'>
                Get started by adding your first asset.
              </p>
              <div className='mt-6'>
                <button
                  onClick={() => setShowForm(true)}
                  className='inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700'
                >
                  Add Asset
                </button>
              </div>
            </div>
          )}

          {showForm && (
            <div className='bg-white p-6 rounded-lg shadow mb-6'>
              <h3 className='text-lg font-medium mb-4'>Add New Asset</h3>
              <select
                value={selectedAsset}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedAsset(value);
                  if (value === 'bike' || value === 'household') {
                    setFormData((prev) => ({
                      ...prev,
                      vin: '',
                    }));
                  }
                }}
                className='mb-4 w-full rounded border border-gray-300 bg-white p-2 text-black focus:border-blue-500 focus:bg-white focus:text-black focus:outline-none focus:ring-1 focus:ring-blue-500'
              >
                <option value=''>Select Asset Type</option>
                <option value='vehicle'>Vehicle</option>
                <option value='bike'>Bike</option>
                <option value='household'>Household Item</option>
              </select>

              {selectedAsset && (
              <form onSubmit={handleSubmit} className='space-y-4'>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700'>
                      Make
                    </label>
                    <input
                      type='text'
                      name='make'
                      value={formData.make}
                      onChange={handleInputChange}
                      required
                      className='mb-4 w-full rounded border border-gray-300 bg-white p-2 text-black focus:border-blue-500 focus:bg-white focus:text-black focus:outline-none focus:ring-1 focus:ring-blue-500'
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700'>
                      Model
                    </label>
                    <input
                      type='text'
                      name='model'
                      value={formData.model}
                      onChange={handleInputChange}
                      required
                      className='mb-4 w-full rounded border border-gray-300 bg-white p-2 text-black focus:border-blue-500 focus:bg-white focus:text-black focus:outline-none focus:ring-1 focus:ring-blue-500'
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700'>
                      Year
                    </label>
                    <select
                      name='year'
                      value={formData.year ?? ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          year: e.target.value ? Number(e.target.value) : undefined,
                        }))
                      }
                      className='mb-4 w-full rounded border border-gray-300 bg-white p-2 text-black focus:border-blue-500 focus:bg-white focus:text-black focus:outline-none focus:ring-1 focus:ring-blue-500'
                    >
                      <option value=''>Select Year</option>
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedAsset !== 'bike' && selectedAsset !== 'household' && (
                   <div>
                       <label className='block text-sm font-medium text-gray-700'>
                         VIN
                       </label>
                       <input
                         type='text'
                         name='vin'
                         value={formData.vin}
                         onChange={handleInputChange}
                         required
                         className='mb-4 w-full rounded border border-gray-300 bg-white p-2 text-black focus:border-blue-500 focus:bg-white focus:text-black focus:outline-none focus:ring-1 focus:ring-blue-500'
                       />
                     </div>
                   )}
                  <div className='md:col-span-2'>
                    <div className='flex flex-wrap gap-3'>
                      {!showInsuranceForm && (
                        <button
                          type='button'
                          onClick={() => setShowInsuranceForm(true)}
                          className='inline-flex items-center rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100'
                        >
                          Add Insurance
                        </button>
                      )}
                      {!showWarrantyForm && (
                        <button
                          type='button'
                          onClick={() => setShowWarrantyForm(true)}
                          className='inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100'
                        >
                          Add Warranty
                        </button>
                      )}
                    </div>
                    {showInsuranceForm && (
                      <div className='mt-3 grid grid-cols-1 md:grid-cols-2 gap-4'>
                        <div>
                          <label className='block text-sm font-medium text-gray-700'>
                            Insurance Company
                          </label>
                          <input
                            type='text'
                            name='insuranceCompany'
                            value={formData.insuranceCompany ?? ''}
                            onChange={handleInputChange}
                            className='mb-4 w-full rounded border border-gray-300 bg-white p-2 text-black focus:border-blue-500 focus:bg-white focus:text-black focus:outline-none focus:ring-1 focus:ring-blue-500'
                          />
                        </div>
                        <div>
                          <label className='block text-sm font-medium text-gray-700'>
                            Insurance Policy Number
                          </label>
                          <input
                            type='text'
                            name='insurancePolicyNumber'
                            value={formData.insurancePolicyNumber ?? ''}
                            onChange={handleInputChange}
                            className='mb-4 w-full rounded border border-gray-300 bg-white p-2 text-black focus:border-blue-500 focus:bg-white focus:text-black focus:outline-none focus:ring-1 focus:ring-blue-500'
                          />
                        </div>
                        <div>
                          <label className='block text-sm font-medium text-gray-700'>
                            Insurance Expiration Date
                          </label>
                          <input
                            type='date'
                            name='insuranceExpirationDate'
                            value={(formData.insuranceExpirationDate as string) ?? ''}
                            onChange={handleInputChange}
                            className='mb-4 w-full rounded border border-gray-300 bg-white p-2 text-black focus:border-blue-500 focus:bg-white focus:text-black focus:outline-none focus:ring-1 focus:ring-blue-500'
                          />
                        </div>
                      </div>
                    )}
                    {showWarrantyForm && (
                      <div className='mt-3 grid grid-cols-1 md:grid-cols-2 gap-4'>
                        <div className='flex items-center gap-2 md:col-span-2'>
                          <input
                            id='warranty'
                            name='warranty'
                            type='checkbox'
                            checked={Boolean(formData.warranty)}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                warranty: e.target.checked,
                              }))
                            }
                            className='h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                          />
                          <label htmlFor='warranty' className='text-sm font-medium text-gray-700'>
                            Under Warranty
                          </label>
                        </div>
                        {formData.warranty && (
                          <>
                            <div>
                              <label className='block text-sm font-medium text-gray-700'>
                                Warranty Number
                              </label>
                              <input
                                type='text'
                                name='warrantyNumber'
                                value={formData.warrantyNumber ?? ''}
                                onChange={handleInputChange}
                                className='mb-4 w-full rounded border border-gray-300 bg-white p-2 text-black focus:border-blue-500 focus:bg-white focus:text-black focus:outline-none focus:ring-1 focus:ring-blue-500'
                              />
                            </div>
                            <div>
                              <label className='block text-sm font-medium text-gray-700'>
                                Warranty Phone Number
                              </label>
                              <input
                                type='tel'
                                name='warrantyPhone'
                                value={formData.warrantyPhone ?? ''}
                                onChange={handleInputChange}
                                className='mb-4 w-full rounded border border-gray-300 bg-white p-2 text-black focus:border-blue-500 focus:bg-white focus:text-black focus:outline-none focus:ring-1 focus:ring-blue-500'
                                placeholder='e.g. (800) 555-1234'
                              />
                            </div>
                            <div className='md:col-span-2'>
                              <label className='block text-sm font-medium text-gray-700'>
                                Warranty Notes
                              </label>
                              <textarea
                                name='warrantyNotes'
                                value={formData.warrantyNotes ?? ''}
                                onChange={handleInputChange}
                                rows={3}
                                className='mb-4 w-full rounded border border-gray-300 bg-white p-2 text-black focus:border-blue-500 focus:bg-white focus:text-black focus:outline-none focus:ring-1 focus:ring-blue-500'
                                placeholder='Any additional warranty details'
                              />
                            </div>
                            <div>
                              <label className='block text-sm font-medium text-gray-700'>
                                Warranty End Date
                              </label>
                              <input
                                type='date'
                                name='warrantyExpiry'
                                value={(formData.warrantyExpiry as string) ?? ''}
                                onChange={handleInputChange}
                                className='mb-4 w-full rounded border border-gray-300 bg-white p-2 text-black focus:border-blue-500 focus:bg-white focus:text-black focus:outline-none focus:ring-1 focus:ring-blue-500'
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className='flex space-x-4'>
                  <button
                    type='submit'
                    className='bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700'
                  >
                    Add Asset
                  </button>
                  <button
                    type='button'
                    onClick={() => { setShowForm(false); setShowInsuranceForm(false); setShowWarrantyForm(false); }}
                    className='bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400'
                  >
                    Cancel
                  </button>
                </div>
              </form>
              )}
            </div>
          )}

          {groupedAssets.map(({ category, items }) => (
            <div key={category} className='mt-8'>
              <div className='mb-2'>
                <div className='text-xs font-medium uppercase tracking-wide text-gray-500'>
                  Category
                </div>
                <div className='text-lg font-semibold text-gray-900'>
                  {categoryLabel[category] ?? category}
                </div>
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {items.map((asset) => (
                  <div
                    key={asset.key}
                    onClick={() =>
                      router.push(
                        `/homedetail/${asset.key}?category=${encodeURIComponent(
                          asset.category || category || ''
                        )}`
                      )
                    }
                    className='bg-white rounded-md shadow-sm cursor-pointer hover:shadow transition-shadow'
                  >
                    <div className='p-2'>
                      <div className='flex items-start justify-between'>
                        <div>
                          <h3 className='text-base font-semibold text-gray-900'>
                            {asset.make}
                          </h3>
                          <p className='text-sm text-gray-600'>
                            {asset.model} {asset.year}
                          </p>
                        </div>
                        {category === 'vehicle' && (
                          <button
                            type='button'
                            onClick={(e) => {
                              e.stopPropagation();
                              openOdometerEditor(asset);
                            }}
                            className='rounded-full border border-gray-300 p-1 text-gray-600 transition hover:bg-gray-100'
                            aria-label='Edit current odometer'
                            title='Edit current odometer'
                          >
                            <Pencil className='w-4 h-4' />
                          </button>
                        )}
                      </div>
                      <div className='mt-1 text-sm text-gray-500'>
                        <p>VIN: {asset.vin || 'Not set'}</p>
                        <p>Plate: {asset.plate || 'Not set'}</p>
                        {(() => {
                          const latest = formatLatestOdometer(asset);
                          if (!latest) return null;
                          const ninety = 90 * 24 * 60 * 60 * 1000;
                          const stale = latest.dateMs !== undefined && Date.now() - latest.dateMs > ninety;
                          return (
                            <>
                              <p>
                                Odometer: {latest.number}
                                {latest.date ? ` (${latest.date})` : ''}
                              </p>
                              {category === 'vehicle' && stale && (
                                <p className='text-xs text-red-600 mt-1'>
                                  Odometer reading is older than 90 days. Please update.
                                </p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      {category === 'vehicle' && editingOdometerFor === asset.key && (
                        <form
                          onClick={(e) => e.stopPropagation()}
                          onSubmit={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void handleOdometerSave(asset);
                          }}
                          className='mt-2 space-y-2 border-t border-gray-200 pt-2'
                        >
                          <div className='grid grid-cols-1 gap-2'>
                            <div>
                              <label className='block text-xs font-medium text-gray-700'>Current Odometer</label>
                              <input
                                type='number'
                                inputMode='numeric'
                                value={odometerDraft.reading}
                                onChange={(e) => setOdometerDraft((p) => ({ ...p, reading: e.target.value }))}
                                className='mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900'
                                placeholder='e.g. 45231'
                              />
                            </div>
                            <div>
                              <label className='block text-xs font-medium text-gray-700'>Date of Reading</label>
                              <input
                                type='date'
                                value={odometerDraft.date}
                                onChange={(e) => setOdometerDraft((p) => ({ ...p, date: e.target.value }))}
                                className='mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900'
                              />
                            </div>
                          </div>
                          {odometerError && (
                            <p className='text-xs text-red-600'>{odometerError}</p>
                          )}
                          <div className='flex gap-2'>
                            <button
                              type='submit'
                              disabled={isSavingOdometer}
                              className='inline-flex items-center rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60'
                            >
                              {isSavingOdometer ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              type='button'
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelOdometerEdit();
                              }}
                              className='inline-flex items-center rounded border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100'
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {assets.length > 0 && (
            <button
              onClick={() => setShowForm(true)}
              className='fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700'
            >
              <svg
                className='w-6 h-6'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 4v16m8-8H4'
                />
              </svg>
            </button>
          )}
        </main>
      </div>
    </Layout>
  );
}
