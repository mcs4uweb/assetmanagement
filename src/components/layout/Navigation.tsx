// src/components/Layout/Navigation.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';

const THEME_STORAGE_KEY = 'assetmanagement-theme';

const Navigation: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { cartTotal } = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const applyTheme = (preferDark: boolean) => {
    if (typeof window === 'undefined') {
      return;
    }

    const root = window.document.documentElement;
    if (preferDark) {
      root.classList.add('dark');
      window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    } else {
      root.classList.remove('dark');
      window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    }
    setIsDarkMode(preferDark);
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = storedTheme
      ? storedTheme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;

    applyTheme(prefersDark);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
    setIsProfileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileMenuOpen(false);
      }
    };

    if (isProfileMenuOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', current: pathname === '/dashboard' },
    { name: 'My Assets', href: '/home', current: pathname === '/home' },
    { name: 'Blog', href: '/blog', current: pathname.startsWith('/blog') },
    {
      name: 'Asset Manager Pro',
      href: '/asset-manager-pro',
      current: pathname === '/asset-manager-pro',
    },
    { name: 'Cart', href: '/cart', current: pathname === '/cart' },
    { name: 'My Orders', href: '/myorders', current: pathname === '/myorders' },
    { name: 'Settings', href: '/settings', current: pathname === '/settings' },
  ];

  const handleThemeToggle = () => {
    applyTheme(!isDarkMode);
  };

  const userLabel =
    currentUser?.DisplayName?.trim() || currentUser?.Email || '';

  return (
    <nav className='bg-white shadow-lg dark:bg-gray-900'>
      <div className='mx-auto max-w-7xl px-4'>
        <div className='flex h-16 justify-between'>
          <div className='flex items-center'>
            <div className='flex flex-shrink-0 items-center'>
              <Link
                href='/'
                className='text-xl font-bold text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
              >
                Asset Tracker
              </Link>
            </div>

            <div className='hidden md:ml-6 md:flex md:space-x-4'>
              {navigation.map((item) => (
                <button
                  key={item.name}
                  onClick={() => router.push(item.href)}
                  className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
                    item.current
                      ? 'border-blue-500 text-gray-900 dark:text-gray-100'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-100'
                  }`}
                >
                  {item.name}
                  {item.name === 'Cart' && cartTotal > 0 && (
                    <span className='ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white'>
                      {cartTotal}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className='hidden items-center space-x-4 md:flex'>
            {/* Notifications */}
            <button
              type='button'
              onClick={() => router.push('/dashboard')}
              className='relative p-2 text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400'
              aria-label='Open notifications'
              title='Notifications'
            >
              <svg
                className='h-6 w-6'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'
                />
              </svg>
              <span className='absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white'>
                3
              </span>
            </button>

            {/* Information */}
            <button
              type='button'
              className='p-2 text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400'
              aria-label='Information'
              title='Information'
            >
              <svg
                className='h-6 w-6'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z'
                />
              </svg>
            </button>

            <button
              type='button'
              onClick={() => router.push('/cart')}
              className='relative p-2 text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400'
              aria-label='Open cart'
            >
              <svg
                className='h-6 w-6'
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
                <span className='absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white'>
                  {cartTotal}
                </span>
              )}
            </button>
            <span className='text-gray-700 dark:text-gray-200'>
              {userLabel}
            </span>
            <div className='relative' ref={profileMenuRef}>
              <button
                type='button'
                onClick={() => setIsProfileMenuOpen((value) => !value)}
                className='flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                aria-haspopup='menu'
                aria-expanded={isProfileMenuOpen}
                aria-label='Open profile menu'
              >
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={1.5}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='h-5 w-5'
                >
                  <path d='M16.5 7a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z' />
                  <path d='M4.5 20.25a8.75 8.75 0 0115 0' />
                </svg>
              </button>

              {isProfileMenuOpen && (
                <div
                  role='menu'
                  className='absolute right-0 z-20 mt-2 w-48 rounded-lg border border-gray-100 bg-white py-2 shadow-lg ring-1 ring-black ring-opacity-5 dark:border-gray-700 dark:bg-gray-800'
                >
                  <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    router.push('/profile');
                  }}
                    className='flex w-full items-center px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                    role='menuitem'
                  >
                    <span className='mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900 dark:text-blue-200'>
                      <svg
                        xmlns='http://www.w3.org/2000/svg'
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth={1.5}
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        className='h-4 w-4'
                      >
                        <path d='M16 7a4 4 0 11-8 0 4 4 0 018 0z' />
                        <path d='M12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' />
                      </svg>
                    </span>
                    Profile
                  </button>
                  <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    router.push('/payment');
                  }}
                    className='flex w-full items-center px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                    role='menuitem'
                  >
                    <span className='mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-50 text-green-600 dark:bg-green-900 dark:text-green-200'>
                      <svg
                        xmlns='http://www.w3.org/2000/svg'
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth={1.5}
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        className='h-4 w-4'
                      >
                        <path d='M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4' />
                        <polyline points='7 10 12 15 17 10' />
                        <line x1='12' y1='15' x2='12' y2='3' />
                      </svg>
                    </span>
                    Payment
                  </button>
                  <button
                    onClick={() => {
                      handleThemeToggle();
                      setIsProfileMenuOpen(false);
                    }}
                    className='flex w-full items-center justify-between px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                    role='menuitem'
                  >
                    <span className='flex items-center'>
                      <span className='mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900 dark:text-blue-200'>
                        <svg
                          xmlns='http://www.w3.org/2000/svg'
                          viewBox='0 0 24 24'
                          fill='none'
                          stroke='currentColor'
                          strokeWidth={1.5}
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          className='h-4 w-4'
                        >
                          <path d='M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z' />
                        </svg>
                      </span>
                      {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                    </span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className='flex w-full items-center px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                    role='menuitem'
                  >
                    <span className='mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-900 dark:text-red-200'>
                      <svg
                        xmlns='http://www.w3.org/2000/svg'
                        fill='none'
                        viewBox='0 0 24 24'
                        strokeWidth={1.5}
                        stroke='currentColor'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        className='h-4 w-4'
                      >
                        <path d='M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15' />
                        <path d='M12 9l3 3m0 0l-3 3m3-3H3' />
                      </svg>
                    </span>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className='flex items-center md:hidden'>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className='inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100'
            >
              <svg
                className='h-6 w-6'
                stroke='currentColor'
                fill='none'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M4 6h16M4 12h16M4 18h16'
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className='md:hidden'>
          <div className='space-y-1 px-2 pt-2 pb-3 sm:px-3'>
            {navigation.map((item) => (
              <button
                key={item.name}
                onClick={() => {
                  router.push(item.href);
                  setIsMenuOpen(false);
                }}
                className={`block w-full border-l-4 py-2 pl-3 pr-4 text-left text-base font-medium ${
                  item.current
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-gray-800 dark:text-blue-200'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                }`}
              >
                {item.name}
                {item.name === 'Cart' && cartTotal > 0 && (
                  <span className='ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white'>
                    {cartTotal}
                  </span>
                )}
              </button>
            ))}
            <div className='border-t border-gray-200 pt-4 pb-3 dark:border-gray-700'>
              <div className='px-4'>
                <div className='text-base font-medium text-gray-800 dark:text-gray-200'>
                  {userLabel}
                </div>
              </div>
              <div className='mt-3 space-y-1 px-2'>
              <button
                onClick={() => {
                  router.push('/profile');
                  setIsMenuOpen(false);
                }}
                  className='block w-full rounded-md px-3 py-2 text-left text-base text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                >
                  Profile
                </button>
                <button
                  onClick={() => {
                    router.push('/payment');
                    setIsMenuOpen(false);
                  }}
                  className='block w-full rounded-md px-3 py-2 text-left text-base text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                >
                  Payment
                </button>
                <button
                  onClick={() => {
                    handleThemeToggle();
                    setIsMenuOpen(false);
                  }}
                  className='block w-full rounded-md px-3 py-2 text-left text-base text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                >
                  {isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                </button>
                <button
                  onClick={() => {
                    handleLogout();
                    setIsMenuOpen(false);
                  }}
                  className='block w-full rounded-md px-3 py-2 text-left text-base text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;
