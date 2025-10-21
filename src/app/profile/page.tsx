'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';

type StatusState =
  | { type: 'success'; message: string }
  | { type: 'error'; message: string }
  | null;

const ProfilePage: React.FC = () => {
  const router = useRouter();
  const { currentUser, loading, updateProfileDetails } = useAuth();

  const [formState, setFormState] = useState({
    displayName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
  });
  const [status, setStatus] = useState<StatusState>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !currentUser) {
      router.replace('/login');
    }
  }, [loading, currentUser, router]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    setFormState({
      displayName: currentUser.DisplayName ?? '',
      email: currentUser.Email ?? '',
      phone: currentUser.Phone ?? '',
      address: currentUser.Address ?? '',
      city: currentUser.City ?? '',
      state: currentUser.State ?? '',
      zip: currentUser.Zip ?? '',
    });
  }, [currentUser]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const { name, value } = event.target;
    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser) {
      return;
    }
    setSaving(true);
    setStatus(null);

    try {
      await updateProfileDetails({
        DisplayName: formState.displayName,
        Phone: formState.phone,
        Address: formState.address,
        City: formState.city,
        State: formState.state,
        Zip: formState.zip,
      });
      setStatus({ type: 'success', message: 'Profile updated successfully.' });
    } catch (error: any) {
      setStatus({
        type: 'error',
        message: error?.message ?? 'Failed to update profile.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !currentUser) {
    return (
      <Layout>
        <div className='flex min-h-screen items-center justify-center bg-gray-100'>
          <div className='text-center'>
            <div className='mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600' />
            <p className='mt-4 text-gray-600'>Loading your profile...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className='min-h-screen bg-gray-100 py-10'>
        <div className='mx-auto max-w-3xl px-6'>
          <div className='mb-8 text-center'>
            <h1 className='text-3xl font-bold text-gray-900'>Your Profile</h1>
            <p className='mt-2 text-sm text-gray-600'>
              Review and keep your contact details up to date.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className='space-y-6 rounded-lg bg-white p-6 shadow-sm'
          >
            {status && (
              <div
                className={`rounded-md border px-4 py-3 text-sm ${
                  status.type === 'success'
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {status.message}
              </div>
            )}

            <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
              <div className='md:col-span-2'>
                <label
                  htmlFor='displayName'
                  className='block text-sm font-medium text-gray-700'
                >
                  Display name
                </label>
                <input
                  id='displayName'
                  name='displayName'
                  type='text'
                  value={formState.displayName}
                  onChange={handleChange}
                  className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                  placeholder='What should we call you?'
                />
              </div>

              <div className='md:col-span-2'>
                <label
                  htmlFor='email'
                  className='block text-sm font-medium text-gray-700'
                >
                  Email address
                </label>
                <input
                  id='email'
                  name='email'
                  type='email'
                  value={formState.email}
                  disabled
                  className='mt-1 w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-gray-600 shadow-sm'
                />
                <p className='mt-1 text-xs text-gray-500'>
                  Email changes require help from the support team.
                </p>
              </div>

              <div>
                <label
                  htmlFor='phone'
                  className='block text-sm font-medium text-gray-700'
                >
                  Phone
                </label>
                <input
                  id='phone'
                  name='phone'
                  type='tel'
                  value={formState.phone}
                  onChange={handleChange}
                  className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                  placeholder='(555) 555-5555'
                />
              </div>

              <div className='md:col-span-2'>
                <label
                  htmlFor='address'
                  className='block text-sm font-medium text-gray-700'
                >
                  Address
                </label>
                <input
                  id='address'
                  name='address'
                  type='text'
                  value={formState.address}
                  onChange={handleChange}
                  className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                  placeholder='Street address'
                />
              </div>

              <div>
                <label
                  htmlFor='city'
                  className='block text-sm font-medium text-gray-700'
                >
                  City
                </label>
                <input
                  id='city'
                  name='city'
                  type='text'
                  value={formState.city}
                  onChange={handleChange}
                  className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                />
              </div>

              <div>
                <label
                  htmlFor='state'
                  className='block text-sm font-medium text-gray-700'
                >
                  State / Province
                </label>
                <input
                  id='state'
                  name='state'
                  type='text'
                  value={formState.state}
                  onChange={handleChange}
                  className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                />
              </div>

              <div>
                <label
                  htmlFor='zip'
                  className='block text-sm font-medium text-gray-700'
                >
                  Zip / Postal code
                </label>
                <input
                  id='zip'
                  name='zip'
                  type='text'
                  value={formState.zip}
                  onChange={handleChange}
                  className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                />
              </div>
            </div>

            <div className='flex items-center justify-end gap-3'>
              <button
                type='button'
                onClick={() => router.back()}
                className='rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100'
              >
                Cancel
              </button>
              <button
                type='submit'
                disabled={saving}
                className='inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300'
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default ProfilePage;
