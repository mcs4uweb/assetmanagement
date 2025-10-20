// src/app/blog/page.tsx
'use client';

import Link from 'next/link';
import Layout from '../../components/layout/Layout';

interface ArticleMeta {
  slug: string;
  title: string;
  summary: string;
}

const articles: ArticleMeta[] = [
  {
    slug: 'tire-rotation',
    title: 'Tire Rotation: How Often Should You Rotate Your Tires?',
    summary:
      'Most vehicles: every 5,000–7,500 miles. AWD and severe driving may require more frequent rotation.',
  },
];

export default function BlogIndexPage() {
  return (
    <Layout>
      <div className='min-h-screen bg-gray-50'>
        <header className='bg-white shadow'>
          <div className='mx-auto max-w-7xl px-4 py-4'>
            <div className='flex items-center justify-between'>
              <div>
                <h1 className='text-2xl font-bold text-blue-600'>Blog</h1>
                <p className='text-sm text-gray-600'>Reference articles and guides for better asset care.</p>
              </div>
              <Link
                href='/'
                className='inline-flex items-center rounded-md border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50'
              >
                Go to Home
              </Link>
            </div>
          </div>
        </header>

        <main className='mx-auto max-w-7xl px-4 py-6'>
          <ul className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            {articles.map((a) => (
              <li key={a.slug} className='rounded-lg border border-gray-200 bg-white p-4 shadow-sm'>
                <h2 className='text-lg font-semibold text-gray-900'>
                  <Link href={`/blog/${a.slug}`} className='text-blue-600 hover:text-blue-700'>
                    {a.title}
                  </Link>
                </h2>
                <p className='mt-2 text-sm text-gray-600'>{a.summary}</p>
                <div className='mt-3'>
                  <Link
                    href={`/blog/${a.slug}`}
                    className='inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700'
                  >
                    Read Article
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </main>
      </div>
    </Layout>
  );
}
