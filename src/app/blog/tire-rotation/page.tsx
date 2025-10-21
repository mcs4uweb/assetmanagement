// src/app/blog/tire-rotation/page.tsx
'use client';

import Link from 'next/link';
import Layout from '../../../components/layout/Layout';

export default function TireRotationArticle() {
  return (
    <Layout>
      <div className='min-h-screen bg-gray-100'>
        <header className='bg-white shadow'>
          <div className='mx-auto max-w-3xl px-4 py-4'>
            <p className='text-xs uppercase tracking-wide text-gray-400'>Blog</p>
            <h1 className='mt-1 text-2xl font-bold text-blue-600'>Tire Rotation: How Often Should You Rotate Your Tires?</h1>
            <p className='mt-1 text-sm text-gray-500'>Reference guide for when to rotate your tires</p>
          </div>
        </header>

        <main className='mx-auto max-w-3xl px-4 py-6'>
          <article className='prose prose-blue max-w-none dark:prose-invert'>
            <p>
              As a general rule, most vehicles should have their tires rotated every
              <strong> 5,000 to 7,500 miles</strong>.
            </p>

            <h2>Important Details and Exceptions</h2>
            <ul>
              <li>
                <strong>The Best Source:</strong> The most accurate recommendation for your specific
                vehicle is always in your owner&apos;s manual. Manufacturer guidelines can vary.
              </li>
              <li>
                <strong>Practical Timing:</strong> Many people find it convenient to have their tires
                rotated at the same time as their oil change, which often falls within this 5,000- to
                7,500-mile window.
              </li>
              <li>
                <strong>All-Wheel Drive (AWD) Exception:</strong> Vehicles with All-Wheel Drive often
                require more frequent rotation. The common recommendation for AWD vehicles is typically
                every <strong>3,000 to 5,000 miles</strong> to prevent uneven wear and potential strain on the drivetrain.
              </li>
              <li>
                <strong>Driving Habits:</strong> If you frequently drive at high speeds, carry heavy loads,
                or drive on rough roads, you may need to rotate your tires more often.
              </li>
            </ul>

            <p>
              Regular tire rotation is important because it helps ensure your tires wear evenly, which
              extends their lifespan, improves safety, and provides better traction and handling.
            </p>
          </article>

          <div className='mt-8 flex items-center justify-between'>
            <Link href='/blog' className='text-sm font-medium text-blue-600 hover:text-blue-700'>
              ← Back to Blog
            </Link>
            <Link href='/' className='text-sm font-medium text-blue-600 hover:text-blue-700'>
              Go to Home →
            </Link>
          </div>

          <section className='mt-8 rounded-lg border border-gray-200 bg-white p-4 shadow-sm'>
            <div className='mb-2 flex items-center justify-between'>
              <h2 className='text-base font-semibold text-gray-900'>Discussion</h2>
              <span className='text-xs text-gray-500'>Coming soon</span>
            </div>
            <p className='text-sm text-gray-600'>We&apos;ll add user discussion for this article here.</p>
          </section>
        </main>
      </div>
    </Layout>
  );
}
