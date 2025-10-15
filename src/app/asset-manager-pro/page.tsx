'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { storage } from '../../lib/firebase';
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytesResumable,
} from 'firebase/storage';

const AssetManagerProPage: React.FC = () => {
  const router = useRouter();
  const { currentUser, loading } = useAuth();
  const [showProActions, setShowProActions] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !currentUser) {
      router.replace('/login');
    }
  }, [loading, currentUser, router]);

  if (loading || !currentUser) {
    return (
      <Layout>
        <div className='flex min-h-screen items-center justify-center bg-gray-50'>
          <div className='text-center'>
            <div className='mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600' />
            <p className='mt-4 text-gray-600'>Preparing your pro workspace...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!currentUser?.UserId) {
      setUploadError('Authentication required to upload photos.');
      event.target.value = '';
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setUploadedUrl(null);

    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
    const uploadRef = storageRef(
      storage,
      `asset-uploads/${currentUser.UserId}/${fileName}`
    );
    const uploadTask = uploadBytesResumable(uploadRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(Math.round(progress));
      },
      (error) => {
        console.error('Photo upload failed:', error);
        setUploadError('Failed to upload photo. Please try again.');
        setUploading(false);
        setUploadProgress(null);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setUploadedUrl(downloadURL);
        } catch (error) {
          console.error('Unable to retrieve uploaded photo URL:', error);
          setUploadError('Uploaded, but unable to fetch the download link.');
        } finally {
          setUploading(false);
          setUploadProgress(null);
        }
      }
    );

    event.target.value = '';
  };

  return (
    <Layout>
      <div className='mx-auto max-w-4xl px-4 py-10'>
        <header className='mb-8 space-y-4'>
          <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
            <h1 className='text-3xl font-bold text-gray-900'>
              Asset Manager tracker With AI
            </h1>
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
              <button
                type='button'
                onClick={() => setShowProActions((prev) => !prev)}
                className='rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700'
              >
                PRO User
              </button>
              <button
                type='button'
                onClick={handleUploadClick}
                disabled={uploading}
                className={`rounded-md border border-blue-600 px-4 py-2 text-sm font-semibold transition ${
                  uploading
                    ? 'cursor-not-allowed bg-blue-100 text-blue-400'
                    : 'text-blue-600 hover:bg-blue-50'
                }`}
              >
                {uploading ? 'Uploading...' : 'Upload Photo'}
              </button>
              <input
                ref={fileInputRef}
                type='file'
                accept='image/*'
                onChange={handleFileChange}
                className='hidden'
              />
            </div>
          </div>
          {(uploading || uploadError || uploadedUrl) && (
            <div className='rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700'>
              {uploading && (
                <p>
                  Uploading photo{typeof uploadProgress === 'number'
                    ? ` (${uploadProgress}%)`
                    : '...'}
                </p>
              )}
              {!uploading && uploadError && (
                <p className='text-red-600'>{uploadError}</p>
              )}
              {!uploading && uploadedUrl && (
                <p>
                  Upload complete.{' '}
                  <a
                    href={uploadedUrl}
                    target='_blank'
                    rel='noreferrer'
                    className='font-semibold text-blue-600 underline'
                  >
                    View asset photo
                  </a>
                </p>
              )}
            </div>
          )}
          {showProActions && (
            <div>
              <button
                type='button'
                onClick={() => setIsModalOpen(true)}
                className='rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-indigo-700'
              >
                Go Pro
              </button>
            </div>
          )}
        </header>

        <section className='rounded-lg border border-dashed border-gray-300 bg-white p-8 text-gray-700 shadow-sm'>
          <p>
            Manage your assets smarter with AI-assisted workflows tailored for
            professional users. Track uploads, automate insights, and keep every
            detail at your fingertips.
          </p>
        </section>
      </div>

      {isModalOpen && (
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
                onClick={() => setIsModalOpen(false)}
                className='rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100'
              >
                Not Now
              </button>
              <button
                type='button'
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

export default AssetManagerProPage;
