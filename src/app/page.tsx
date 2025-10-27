// src/app/page.tsx
'use client';

import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';

const features = [
  {
    title: 'Track Every Asset',
    description:
      'Keep tabs on vehicles, bikes, and household equipment with structured records and maintenance logs.',
  },
  {
    title: 'Smart Reminders',
    description:
      'Set due dates for services or orders so nothing slips through the cracks.',
  },
  {
    title: 'Collaborate With Ease',
    description:
      'Share consistent information across your household or team using a single source of truth.',
  },
];

export default function LandingPage() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100'>
        <div className='text-center'>
          <div className='mx-auto h-20 w-20 animate-spin rounded-full border-b-4 border-blue-600' />
          <p className='mt-4 text-sm text-gray-600'>
            Preparing your experience...
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className='min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100'>
      <section className='mx-auto flex max-w-5xl flex-col gap-12 px-6 pb-16 pt-24 text-gray-900 md:flex-row md:items-center md:justify-between'>
        <div className='max-w-xl space-y-6'>
          <span className='inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700'>
            Asset Manager Pro
          </span>
          <h1 className='text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl'>
            Organize every asset and stay ahead of maintenance
          </h1>
          <p className='text-lg text-gray-600'>
            A single hub to log vehicles, record upkeep, and plan upcoming part
            orders. Designed for owners who want clarity without the spreadsheet
            hassle.
          </p>
          <div className='flex flex-wrap gap-4'>
            <Link
              href={currentUser ? '/dashboard' : '/login'}
              className='inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700'
            >
              {currentUser ? 'Go to your dashboard' : 'Sign in to get started'}
            </Link>
            <Link
              href='#features'
              className='inline-flex items-center justify-center rounded-md border border-blue-600 px-6 py-3 text-sm font-semibold text-blue-600 transition hover:bg-blue-50'
            >
              Explore the platform
            </Link>
            <Link
              href='/blog'
              className='inline-flex items-center justify-center rounded-md border border-blue-600 px-6 py-3 text-sm font-semibold text-blue-600 transition hover:bg-blue-50'
            >
              Read the blog
            </Link>
          </div>
        </div>
        <div className='relative mx-auto max-w-md overflow-hidden rounded-2xl bg-white p-6 shadow-xl'>
          <div className='absolute -top-6 -right-6 h-24 w-24 rounded-full bg-blue-100 blur-2xl' />
          <div className='absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-blue-200 blur-3xl' />
          <div className='relative space-y-4'>
            <h2 className='text-lg font-semibold text-gray-800'>At a glance</h2>
            <ul className='space-y-3 text-sm text-gray-600'>
              <li className='flex items-start gap-3'>
                <span className='mt-1 inline-flex h-2.5 w-2.5 flex-none rounded-full bg-blue-500' />
                <div>
                  <p className='font-medium text-gray-800'>Fleet overview</p>
                  <p>See make, model, year, and condition at a glance.</p>
                </div>
              </li>
              <li className='flex items-start gap-3'>
                <span className='mt-1 inline-flex h-2.5 w-2.5 flex-none rounded-full bg-green-500' />
                <div>
                  <p className='font-medium text-gray-800'>
                    Maintenance history
                  </p>
                  <p>Log services, track due dates, and capture receipts.</p>
                </div>
              </li>
              <li className='flex items-start gap-3'>
                <span className='mt-1 inline-flex h-2.5 w-2.5 flex-none rounded-full bg-indigo-500' />
                <div>
                  <p className='font-medium text-gray-800'>Parts to order</p>
                  <p>Plan ahead with links, expected prices, and reminders.</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>
      <section className='bg-gray-50 py-12'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <h2 className='text-3xl font-bold text-center mb-8 text-black'>
            How It Works
          </h2>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
            <div className='text-center'>
              <div className='w-12 h-12 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center'>
                <span className='text-blue-600 font-bold'>1</span>
              </div>
              <h3 className='text-lg font-semibold mb-2 text-black'>
                Add Your Assets
              </h3>
              <p className='text-gray-600'>
                Input items with easy forms—upload photos and assign locations
                for home or business use.
              </p>
            </div>
            <div className='text-center'>
              <div className='w-12 h-12 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center'>
                <span className='text-blue-600 font-bold'>2</span>
              </div>
              <h3 className='text-lg font-semibold mb-2 text-black'>
                Track & Manage
              </h3>
              <p className='text-gray-600'>
                Monitor status, depreciation, and maintenance schedules with
                real-time updates.
              </p>
            </div>
            <div className='text-center'>
              <div className='w-12 h-12 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center'>
                <span className='text-blue-600 font-bold'>3</span>
              </div>
              <h3 className='text-lg font-semibold mb-2 text-black'>
                Upgrade for Pro
              </h3>
              <p className='text-gray-600'>
                Unlock AI tools, unlimited assets, and detailed reports with a
                Pro subscription.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section id='features' className='bg-white py-16'>
        <div className='mx-auto max-w-5xl px-6'>
          <h2 className='text-center text-2xl font-semibold text-gray-900 sm:text-3xl'>
            Why owners choose Vehicle Assets Manager
          </h2>
          <div className='mt-10 grid gap-8 md:grid-cols-3'>
            {features.map((feature) => (
              <div
                key={feature.title}
                className='rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md'
              >
                <h3 className='text-lg font-semibold text-gray-900'>
                  {feature.title}
                </h3>
                <p className='mt-3 text-sm text-gray-600'>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Paywall/Pricing Section */}
      <section className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12'>
        <h2 className='text-3xl font-bold text-center mb-8 text-black'>
          Pricing Plans
        </h2>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
          <div className='bg-white p-6 rounded-lg shadow-md'>
            <h3 className='text-xl font-semibold mb-2 text-black'>Free Tier</h3>
            <p className='text-gray-600 mb-4'>Perfect for personal use.</p>
            <p className='text-2xl font-bold mb-4 text-black'>$0/month</p>
            <ul className='text-gray-600 mb-4 space-y-2'>
              <li>Up to 20 assets</li>
              <li>Basic tracking & forms</li>
              <li>Photo uploads</li>
            </ul>
            <Link
              href='/login?mode=register'
              className='w-full flex justify-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition'
            >
              Start Free
            </Link>
          </div>
          <div className='bg-white p-6 rounded-lg shadow-md'>
            <h3 className='text-xl font-semibold mb-2 text-black'>Go Pro: Unlock Unlimited Power</h3>
    
            <p className='text-2xl font-bold mb-4 text-black'>$2.99/month</p>
            <ul className='text-gray-600 mb-4 space-y-2'>
              <li>Unlimited assets</li>
              <li>AI insights</li>
              <li>Advanced reports & exports</li>
              <li>Priority support</li>
            </ul>
            <button className='w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition'>
              Upgrade to Pro
            </button>
          </div>
        </div>
        <p className='text-center text-gray-600 mt-4'>
          Try Pro free for 14 days! Cancel anytime.
        </p>
      </section>
      <footer className='bg-gray-800 text-white py-6'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center'>
          <p>&copy; 2025 Asset Manager Pro. All rights reserved.</p>
          <div className='mt-2 space-x-4'>
            <a href='#' className='text-blue-400 hover:underline'>
              Privacy Policy
            </a>
            <a href='#' className='text-blue-400 hover:underline'>
              Terms of Service
            </a>
            <a href='#' className='text-blue-400 hover:underline'>
              Contact Us
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
