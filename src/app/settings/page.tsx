'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';

const STORAGE_KEY = 'assetmanagement-settings-preferences';

const SettingsPage: React.FC = () => {
  const router = useRouter();
  const { currentUser, loading } = useAuth();
  const [proAiEnabled, setProAiEnabled] = useState(false);
  const [cloudBackupEnabled, setCloudBackupEnabled] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  useEffect(() => {
    if (!loading && !currentUser) {
      router.replace('/login');
    }
  }, [loading, currentUser, router]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const savedSettings = window.localStorage.getItem(STORAGE_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setProAiEnabled(Boolean(parsed.proAiEnabled));
        setCloudBackupEnabled(Boolean(parsed.cloudBackupEnabled));
      }
    } catch (error) {
      console.error('Unable to load settings from localStorage', error);
    } finally {
      setPreferencesLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!preferencesLoaded || typeof window === 'undefined') {
      return;
    }

    const settings = {
      proAiEnabled,
      cloudBackupEnabled,
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Unable to save settings to localStorage', error);
    }
  }, [proAiEnabled, cloudBackupEnabled, preferencesLoaded]);

  if (loading || !currentUser) {
    return (
      <Layout>
        <div className='flex min-h-screen items-center justify-center bg-gray-50'>
          <div className='text-center'>
            <div className='mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600' />
            <p className='mt-4 text-gray-600'>Loading your settings...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className='min-h-screen bg-gray-50 py-12'>
        <div className='mx-auto max-w-3xl px-4 sm:px-6 lg:px-8'>
          <header className='mb-8'>
            <p className='text-sm font-semibold uppercase tracking-wide text-blue-600'>
              Preferences
            </p>
            <h1 className='mt-2 text-3xl font-bold text-gray-900'>Settings</h1>
            <p className='mt-2 text-sm text-gray-600'>
              Tailor how Asset Management works for you. Adjust the Pro
              benefits below to explore what&apos;s coming next.
            </p>
          </header>

          <section className='rounded-2xl bg-white shadow-sm ring-1 ring-gray-100'>
            <div className='border-b border-gray-100 px-6 py-5'>
              <h2 className='text-lg font-semibold text-gray-900'>
                Pro Experience
              </h2>
              <p className='mt-1 text-sm text-gray-500'>
                Unlock advanced AI workflows and secure backups when you Go
                Pro. Toggle the options below to see what you can expect.
              </p>
            </div>

            <div className='divide-y divide-gray-100'>
              <div className='flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-start sm:justify-between'>
                <div className='max-w-xl'>
                  <div className='flex items-center gap-2'>
                    <h3 className='text-base font-medium text-gray-900'>
                      AI Co-Pilot
                    </h3>
                    <span className='inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-blue-600'>
                      Pro
                    </span>
                  </div>
                  <p className='mt-1 text-sm text-gray-500'>
                    Experience proactive maintenance suggestions, component
                    forecasts, and AI insights tailored to your garage.
                  </p>
                  <p className='mt-3 text-sm font-semibold text-gray-700'>
                    Ready to turn on Go Pro features that handle AI-driven
                    insights?
                  </p>
                </div>
                <button
                  type='button'
                  onClick={() => setProAiEnabled((value) => !value)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    proAiEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                  role='switch'
                  aria-checked={proAiEnabled}
                  aria-label='Enable Go Pro AI features'
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      proAiEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className='flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-start sm:justify-between'>
                <div className='max-w-xl'>
                  <div className='flex items-center gap-2'>
                    <h3 className='text-base font-medium text-gray-900'>
                      Cloud Backup
                    </h3>
                    <span className='inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-blue-600'>
                      Pro
                    </span>
                  </div>
                  <p className='mt-1 text-sm text-gray-500'>
                    Automatically protect your vehicle records and documents in
                    a secure cloud vault with version history.
                  </p>
                  <p className='mt-3 text-sm font-semibold text-gray-700'>
                    Want to keep a Pro-grade backup of your data in the cloud?
                  </p>
                </div>
                <button
                  type='button'
                  onClick={() => setCloudBackupEnabled((value) => !value)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    cloudBackupEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                  role='switch'
                  aria-checked={cloudBackupEnabled}
                  aria-label='Enable Pro cloud backups'
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      cloudBackupEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          <p className='mt-8 text-sm text-gray-500'>
            These previews help us tailor the Pro roadmap. We&apos;ll notify you
            the moment these upgrades go live in your workspace.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default SettingsPage;
