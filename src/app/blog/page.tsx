// src/app/blog/page.tsx
// Server component: fetches Motor1 RSS and renders a table

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
      'Most vehicles: every 5,000-7,500 miles. AWD and severe driving may require more frequent rotation.',
  },
];

interface RSSItem {
  title: string;
  link: string;
}

async function fetchMotor1RSS(): Promise<RSSItem[]> {
  try {
    const res = await fetch('https://www.motor1.com/rss/news/all', {
      // Cache for an hour on the server to avoid rate limits
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const xml = await res.text();

    // Simple RSS parsing for <item><title> and <link>
    const items: RSSItem[] = [];
    const parts = xml.split('<item>').slice(1); // skip header before first item
    for (const part of parts) {
      const endIdx = part.indexOf('</item>');
      const block = endIdx >= 0 ? part.substring(0, endIdx) : part;

      const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
      const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);

      const rawTitle = titleMatch ? titleMatch[1] : '';
      const title = rawTitle.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim();
      const link = linkMatch ? linkMatch[1].trim() : '';

      if (title && link) {
        items.push({ title, link });
      }
    }
    return items;
  } catch {
    return [];
  }
}

export default async function BlogIndexPage() {
  const rssItems = await fetchMotor1RSS();
  return (
    <Layout>
      <div className='min-h-screen bg-gray-100'>
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
          <section className='mb-8'>
            <h2 className='mb-3 text-xl font-semibold text-gray-900'>Latest News from Motor1</h2>
            <div className='overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm'>
              <table className='min-w-full table-auto divide-y divide-gray-200'>
                <thead className='bg-gray-50'>
                  <tr>
                    <th scope='col' className='px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                      Title
                    </th>
                    <th scope='col' className='px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                      Link
                    </th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-200'>
                  {rssItems.length === 0 ? (
                    <tr>
                      <td colSpan={2} className='px-4 py-3 text-sm text-gray-600'>
                        Unable to load Motor1 RSS feed right now.
                      </td>
                    </tr>
                  ) : (
                    rssItems.slice(0, 20).map((item, idx) => (
                      <tr key={`${item.link}-${idx}`} className='hover:bg-gray-50'>
                        <td className='px-4 py-2 text-sm text-gray-900'>{item.title}</td>
                        <td className='px-4 py-2 text-sm'>
                          <a href={item.link} target='_blank' rel='noopener noreferrer' className='text-blue-600 hover:text-blue-700'>
                            Open Article
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
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
