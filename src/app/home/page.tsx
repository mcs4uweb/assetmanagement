// src/app/home/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { Vehicle } from '../../models/Vehicle';
import { ref, onValue, push, set } from 'firebase/database';
import { db } from '../../lib/firebase';
import Layout from '../../components/layout/Layout';

export default function HomePage() {
  const { currentUser, loading } = useAuth();
  const { cartTotal } = useCart();
  const router = useRouter();
  const [assets, setAssets] = useState<Vehicle[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState('');
  const [formData, setFormData] = useState<Partial<Vehicle>>({
    make: '',
    model: '',
    year: undefined,
    vin: '',
    plate: '',
    tires: '',
  });

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
      };
      await set(newAssetRef, newAsset);
      setShowForm(false);
      setFormData({
        make: '',
        model: '',
        year: undefined,
        vin: '',
        plate: '',
        tires: '',
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
      <div className='min-h-screen bg-gray-50'>
        <header className='bg-white shadow'>
          <div className='max-w-7xl mx-auto px-4 py-4 flex justify-between items-center'>
            <h1 className='text-2xl font-bold text-blue-600'>My Assets</h1>
            <div className='flex items-center space-x-4'>
              <button
                type='button'
                onClick={() => router.push('/cart')}
                className='relative p-2 text-gray-600 hover:text-blue-600'
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
                    d='M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5.5M7 13l2.5 5.5m0 0L17 21'
                  />
                </svg>
                {cartTotal > 0 && (
                  <span className='absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center'>
                    {cartTotal}
                  </span>
                )}
              </button>
            </div>
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
                  if (value === 'bike') {
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
                    <input
                      type='number'
                      name='year'
                      value={formData.year}
                      onChange={handleInputChange}
                      className='mb-4 w-full rounded border border-gray-300 bg-white p-2 text-black focus:border-blue-500 focus:bg-white focus:text-black focus:outline-none focus:ring-1 focus:ring-blue-500'
                    />
                  </div>
                  {selectedAsset !== 'bike' && (
                    <div>
                      <label className='block text-sm font-medium text-gray-700'>
                        VIN
                      </label>
                      <input
                        type='text'
                        name='vin'
                        value={formData.vin}
                        onChange={handleInputChange}
                        className='mb-4 w-full rounded border border-gray-300 bg-white p-2 text-black focus:border-blue-500 focus:bg-white focus:text-black focus:outline-none focus:ring-1 focus:ring-blue-500'
                      />
                    </div>
                  )}
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
                    onClick={() => setShowForm(false)}
                    className='bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400'
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {assets.map((asset) => (
              <div
                key={asset.key}
                onClick={() => router.push(`/homedetail/${asset.key}`)}
                className='bg-white rounded-lg shadow cursor-pointer hover:shadow-md transition-shadow'
              >
                <div className='p-6'>
                  <h3 className='text-lg font-semibold text-gray-900'>
                    {asset.make}
                  </h3>
                  <p className='text-gray-600'>
                    {asset.model} {asset.year}
                  </p>
                  <div className='mt-2 text-sm text-gray-500'>
                    <p>VIN: {asset.vin || 'Not set'}</p>
                    <p>Plate: {asset.plate || 'Not set'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

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
