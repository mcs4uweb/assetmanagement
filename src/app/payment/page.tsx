'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';

declare global {
  interface Window {
    paypal?: any;
  }
}

const STORAGE_KEY = 'assetmanagement-settings-preferences';

export default function PaymentPage() {
  const router = useRouter();
  const { currentUser, loading } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'rendering' | 'success' | 'error'>('idle');
  const buttonsRef = useRef<HTMLDivElement | null>(null);
  const buttonsRenderedRef = useRef<boolean>(false);

  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';
  const paypalPlanId = process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID || '';

  useEffect(() => {
    if (!loading && !currentUser) {
      router.replace('/login');
    }
  }, [loading, currentUser, router]);

  // Load PayPal SDK for Subscriptions (vault + intent=subscription)
  useEffect(() => {
    if (!currentUser || !paypalClientId || !buttonsRef.current) return;
    const url = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
      paypalClientId
    )}&vault=true&intent=subscription`; // enables subscription buttons

    const ensureButtons = () => {
      if (!window.paypal || !buttonsRef.current) return;
      try {
        if (buttonsRenderedRef.current) return; // guard against duplicate renders
        setStatus('rendering');
        const Buttons = window.paypal.Buttons({
          style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'subscribe' },
          createSubscription: (_: any, actions: any) => {
            if (!paypalPlanId) {
              setErrorMessage('Missing PayPal plan id.');
              throw new Error('Missing PayPal plan id');
            }
            return actions.subscription.create({ plan_id: paypalPlanId });
          },
          onApprove: (data: any, _actions: any) => {
            try {
              // Persist subscription in local settings
              const saved = window.localStorage.getItem(STORAGE_KEY);
              const parsed = saved ? JSON.parse(saved) : {};
              const updated = {
                ...parsed,
                proPlanActive: true,
                proSubscriptionId: data?.subscriptionID || data?.subscriptionId || undefined,
                proPlanPrice: '2.99',
                proPlanInterval: 'MONTH',
              };
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            } catch {}
            setStatus('success');
          },
          onError: (err: any) => {
            console.error('PayPal subscription error', err);
            setErrorMessage('Payment error. Please refresh and try again.');
            setStatus('error');
          },
          onCancel: () => setStatus('idle'),
        });
        if (Buttons.isEligible && !Buttons.isEligible()) return;
        // Clear container before rendering to avoid nested duplicates
        try { buttonsRef.current.innerHTML = ''; } catch {}
        buttonsRenderedRef.current = true;
        Buttons.render(buttonsRef.current).catch(() => {
          buttonsRenderedRef.current = false;
        });
      } catch (err) {
        console.error('Failed to render PayPal subscription buttons', err);
        setErrorMessage('Unable to initialize PayPal checkout.');
      }
    };

    const exists = document.querySelector<HTMLScriptElement>(
      'script[src^="https://www.paypal.com/sdk/js"]'
    );
    if (exists) {
      if (exists.getAttribute('src') !== url) {
        exists.remove();
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.onload = ensureButtons;
        document.body.appendChild(script);
      } else if (window.paypal) {
        ensureButtons();
      } else {
        exists.addEventListener('load', ensureButtons, { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = ensureButtons;
    document.body.appendChild(script);
    return () => {
      // Cleanup to avoid duplicate renders on remounts (e.g., StrictMode)
      if (buttonsRef.current) {
        try { buttonsRef.current.innerHTML = ''; } catch {}
      }
      buttonsRenderedRef.current = false;
    };
  }, [currentUser, paypalClientId, paypalPlanId]);

  return (
    <Layout>
      <div className='min-h-screen bg-gray-100 py-10'>
        <div className='mx-auto max-w-2xl px-4 sm:px-6 lg:px-8'>
          <div className='mb-6'>
            <h1 className='text-3xl font-bold text-gray-900'>Go Pro Subscription</h1>
            <p className='mt-2 text-sm text-gray-600'>
              Subscribe to unlock Pro features. Billed monthly at $2.99.
            </p>
          </div>

          {(!paypalClientId || !paypalPlanId) && (
            <div className='mb-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800'>
              Missing PayPal configuration. Ensure NEXT_PUBLIC_PAYPAL_CLIENT_ID and NEXT_PUBLIC_PAYPAL_PLAN_ID are set.
            </div>
          )}

          <div className='rounded-lg bg-white p-6 shadow'>
            <div className='mb-4'>
              <h2 className='text-lg font-semibold text-gray-900'>Asset Manager Pro</h2>
              <p className='text-sm text-gray-600'>$2.99 per month</p>
            </div>

            <div ref={buttonsRef} />

            {status === 'success' && (
              <div className='mt-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800'>
                Subscription started. Pro features are now enabled.
              </div>
            )}
            {errorMessage && (
              <div className='mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700'>
                {errorMessage}
              </div>
            )}

            <div className='mt-6 flex gap-3'>
              <button
                type='button'
                onClick={() => router.push('/settings')}
                className='rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100'
              >
                Back to Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
