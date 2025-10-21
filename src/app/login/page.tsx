// src/app/login/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(
    () => searchParams.get('mode') === 'register'
  );

  const { login, signup, googleSignIn, currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      router.push('/home');
    }
  }, [currentUser, router]);

  useEffect(() => {
    const isRegisterQuery = searchParams.get('mode') === 'register';
    setIsRegisterMode((prev) =>
      prev === isRegisterQuery ? prev : isRegisterQuery
    );
  }, [searchParams]);

  useEffect(() => {
    setError('');
  }, [isRegisterMode]);

  const handleModeSwitch = (mode: 'login' | 'register') => {
    setIsRegisterMode(mode === 'register');
    if (mode === 'register') {
      router.replace('/login?mode=register');
    } else {
      router.replace('/login');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isRegisterMode) {
        await signup(email, password);
      } else {
        await login(email, password);
      }
      router.push('/home');
    } catch (error: any) {
      const message = isRegisterMode
        ? 'Failed to register: ' + error.message
        : 'Failed to log in: ' + error.message;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await googleSignIn();
      router.push('/home');
    } catch (error: any) {
      setError('Failed to sign in with Google: ' + error.message);
    }
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8'>
      <div className='max-w-md w-full space-y-8'>
        <div>
          <h2 className='mt-6 text-center text-3xl font-extrabold text-gray-900'>
            Assets Management Tracker
          </h2>
        </div>
        <form className='mt-8 space-y-6' onSubmit={handleSubmit}>
          {error && (
            <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded'>
              {error}
            </div>
          )}

          <div>
            <label htmlFor='email' className='sr-only'>
              Email address
            </label>
            <input
              id='email'
              name='email'
              type='email'
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className='relative block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-black placeholder-gray-500 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-blue-500 dark:bg-white dark:text-black dark:focus:bg-white'
            />
          </div>

          <div>
            <label htmlFor='password' className='sr-only'>
              Password
            </label>
            <input
              id='password'
              name='password'
              type='password'
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className='relative block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-black placeholder-gray-500 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-blue-500 dark:bg-white dark:text-black dark:focus:bg-white'
              placeholder='Password'
            />
          </div>

          <div>
            <button
              type='submit'
              disabled={loading}
              className='group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            >
              {loading
                ? isRegisterMode
                  ? 'Creating account...'
                  : 'Signing in...'
                : isRegisterMode
                ? 'Create account'
                : 'Sign in'}
            </button>
          </div>
        </form>

        <div className='text-center text-sm text-gray-600'>
          {isRegisterMode ? (
            <p>
              Already have an account?{' '}
              <button
                type='button'
                onClick={() => handleModeSwitch('login')}
                className='font-medium text-blue-600 hover:text-blue-500'
              >
                Sign in
              </button>
            </p>
          ) : (
            <p>
              Need an account?{' '}
              <button
                type='button'
                onClick={() => handleModeSwitch('register')}
                className='font-medium text-blue-600 hover:text-blue-500'
              >
                Register now
              </button>
            </p>
          )}
        </div>

        <div className='mt-6'>
          <button
            onClick={handleGoogleSignIn}
            className='w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50'
          >
            <svg className='w-5 h-5 mr-2' viewBox='0 0 24 24'>
              <path
                fill='#4285F4'
                d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
              />
              <path
                fill='#34A853'
                d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
              />
              <path
                fill='#FBBC05'
                d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
              />
              <path
                fill='#EA4335'
                d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
              />
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
}
