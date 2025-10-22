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
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [isProModalOpen, setIsProModalOpen] = useState(false);
  const [odometerWarningDays, setOdometerWarningDays] = useState<number>(90);
  const [proModalSource, setProModalSource] = useState<'ai' | 'cloud' | 'cta' | null>(null);
  const [prevProState, setPrevProState] = useState<{ ai: boolean; cloud: boolean }>({ ai: false, cloud: false });
  const TEAM_LIMIT = 2;

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
        if (Array.isArray(parsed.teamMembers)) {
          setTeamMembers(parsed.teamMembers);
        }
        if (
          typeof parsed.odometerWarningDays === 'number' &&
          Number.isFinite(parsed.odometerWarningDays) &&
          parsed.odometerWarningDays > 0
        ) {
          setOdometerWarningDays(parsed.odometerWarningDays);
        }
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
      teamMembers,
      odometerWarningDays,
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Unable to save settings to localStorage', error);
    }
  }, [proAiEnabled, cloudBackupEnabled, odometerWarningDays, preferencesLoaded]);

  const isFreeTierLimitReached = teamMembers.length >= TEAM_LIMIT;

  const handleInviteSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInviteFeedback(null);
    setInviteError(null);

    if (isFreeTierLimitReached) {
      setInviteError(
        'Free tier reaches its limit with 2 members. Go Pro to add more teammates.'
      );
      return;
    }

    const trimmedEmail = inviteEmail.trim().toLowerCase();
    if (!trimmedEmail) {
      setInviteError('Please enter an email to invite.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmedEmail)) {
      setInviteError('Enter a valid email address.');
      return;
    }

    if (teamMembers.includes(trimmedEmail)) {
      setInviteError('This teammate has already been invited.');
      return;
    }

    const updatedMembers = [...teamMembers, trimmedEmail];
    setTeamMembers(updatedMembers);
    setInviteFeedback(
      `Invite sent to ${trimmedEmail}. Message: "Welcome to my Asset Management Group."`
    );
    setInviteEmail('');
  };

  const handleAiToggleClick = () => {
    setProAiEnabled((prev) => {
      const next = !prev;
      if (!prev && next) {
        setPrevProState({ ai: prev, cloud: cloudBackupEnabled });
        setProModalSource('ai');
        setIsProModalOpen(true);
      }
      return next;
    });
  };

  const handleCloudToggleClick = () => {
    setCloudBackupEnabled((prev) => {
      const next = !prev;
      if (!prev && next) {
        setPrevProState({ ai: proAiEnabled, cloud: prev });
        setProModalSource('cloud');
        setIsProModalOpen(true);
      }
      return next;
    });
  };

  if (loading || !currentUser) {
    return (
      <Layout>
        <div className='flex min-h-screen items-center justify-center bg-gray-100'>
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
      <div className='min-h-screen bg-gray-100 py-12'>
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
                  onClick={handleAiToggleClick}
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
                  onClick={handleCloudToggleClick}
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

          <section className='mt-8 rounded-2xl bg-white shadow-sm ring-1 ring-gray-100'>
            <div className='border-b border-gray-100 px-6 py-5'>
              <h2 className='text-lg font-semibold text-gray-900'>
                Vehicle Preferences
              </h2>
              <p className='mt-1 text-sm text-gray-500'>
                Control thresholds used to remind you about odometer updates.
              </p>
            </div>

            <div className='px-6 py-6'>
              <label
                htmlFor='odo-warning-days'
                className='block text-sm font-medium text-gray-700'
              >
                Number of days before your last odometer reading
              </label>
              <div className='mt-1 flex items-center gap-3'>
                <input
                  id='odo-warning-days'
                  type='number'
                  inputMode='numeric'
                  min={1}
                  max={3650}
                  value={odometerWarningDays}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n)) return;
                    const clamped = Math.min(3650, Math.max(1, Math.trunc(n)));
                    setOdometerWarningDays(clamped);
                  }}
                  className='w-32 rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                />
                <span className='text-sm text-gray-500'>
                  Default is 90 days
                </span>
              </div>
              <p className='mt-2 text-xs text-gray-500'>
                When the most recent odometer entry is older than this value, we will highlight it as stale.
              </p>
            </div>
          </section>

          <section className='mt-8 rounded-2xl bg-white shadow-sm ring-1 ring-gray-100'>
            <div className='border-b border-gray-100 px-6 py-5'>
              <h2 className='text-lg font-semibold text-gray-900'>
                Team Collaboration
              </h2>
              <p className='mt-1 text-sm text-gray-500'>
                Invite teammates to manage assets with you. Free tier supports up
                to {TEAM_LIMIT} members. Go Pro anytime to unlock more seats.
              </p>
            </div>

            <div className='px-6 py-6'>
              <div className='mb-6'>
                <h3 className='text-sm font-semibold uppercase tracking-wide text-gray-500'>
                  Current Members ({teamMembers.length}/{TEAM_LIMIT} Free)
                </h3>
                {teamMembers.length === 0 ? (
                  <p className='mt-2 text-sm text-gray-500'>
                    You haven&apos;t invited anyone yet. Add up to two teammates on
                    this plan.
                  </p>
                ) : (
                  <ul className='mt-3 space-y-2'>
                    {teamMembers.map((member) => (
                      <li
                        key={member}
                        className='rounded-md border border-gray-100 bg-gray-50 px-4 py-2 text-sm text-gray-700'
                      >
                        {member}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <form onSubmit={handleInviteSubmit} className='space-y-4'>
                <div>
                  <label
                    htmlFor='invite-email'
                    className='block text-sm font-medium text-gray-700'
                  >
                    Invite by email
                  </label>
                  <input
                    id='invite-email'
                    type='email'
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder='teammate@email.com'
                    className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                  />
                </div>

                {inviteError && (
                  <p className='text-sm text-red-600'>{inviteError}</p>
                )}
                {inviteFeedback && (
                  <p className='text-sm text-green-600'>{inviteFeedback}</p>
                )}

                <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                  <button
                    type='submit'
                    disabled={isFreeTierLimitReached}
                    className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${
                      isFreeTierLimitReached
                        ? 'cursor-not-allowed bg-gray-300'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    Add User
                  </button>
                  <button
                    type='button'
                    onClick={() => { setPrevProState({ ai: proAiEnabled, cloud: cloudBackupEnabled }); setProModalSource('cta'); setIsProModalOpen(true); }}
                    className='inline-flex items-center justify-center rounded-md border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50'
                  >
                    Go Pro
                  </button>
                </div>
              </form>
            </div>
          </section>

          <p className='mt-8 text-sm text-gray-500'>
            These previews help us tailor the Pro roadmap. We&apos;ll notify you
            the moment these upgrades go live in your workspace.
          </p>
        </div>
      </div>

      {isProModalOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4'>
          <div className='w-full max-w-lg rounded-lg bg-white p-8 shadow-xl'>
            <div className='mb-6 text-center'>
              <h2 className='text-2xl font-bold text-gray-900'>
                Unlock Pro Features
              </h2>
              <p className='mt-3 text-gray-600'>
                Go Pro to leverage the full power of AI for ultimate asset
                management efficiency.
              </p>
            </div>
            <ul className='space-y-3 text-gray-700'>
              <li>
                <strong>AI Auto-Tagging</strong> from images/receipts.
              </li>
              <li>
                <strong>Proactive Maintenance</strong> schedules.
              </li>
              <li>
                <strong>Financial Depreciation</strong> narrative reports.
              </li>
            </ul>
            <div className='mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end'>
              <button
                type='button'
                onClick={() => {
                  // Revert any Pro toggles that were turned on when opening the modal
                  setProAiEnabled(prevProState.ai);
                  setCloudBackupEnabled(prevProState.cloud);
                  setIsProModalOpen(false);
                  setProModalSource(null);
                }}
                className='rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100'
              >
                Not Now
              </button>
              <button
                type='button'
                onClick={() => {
                  setIsProModalOpen(false);
                  router.push('/asset-manager-pro');
                }}
                className='rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700'
              >
                Upgrade to Pro Now!
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default SettingsPage;
