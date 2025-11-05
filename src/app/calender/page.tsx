'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  onValue,
  push,
  ref as dbRef,
  remove,
  set,
  update,
} from 'firebase/database';
import { db } from '../../lib/firebase';

type CalEvent = {
  id: string;
  title: string;
  start: string; // YYYY-MM-DD
  end?: string; // YYYY-MM-DD (inclusive)
  notes?: string;
};

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const toYmd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

// Normalize to noon local time to avoid DST/UTC off-by-one when comparing dates
const toNoon = (ymd: string): Date => new Date(`${ymd}T12:00:00`);

// Monday as first day (0..6)
const dayIndexMon0 = (d: Date) => {
  const js = d.getDay(); // 0=Sun..6=Sat
  return (js + 6) % 7; // 0=Mon..6=Sun
};

// Start of week (Monday)
const startOfWeekMon = (d: Date) => {
  const res = new Date(d);
  const diff = dayIndexMon0(d);
  res.setDate(d.getDate() - diff);
  res.setHours(12, 0, 0, 0);
  return res;
};

// End of week (Sunday)
const endOfWeekSun = (d: Date) => {
  const res = startOfWeekMon(d);
  res.setDate(res.getDate() + 6);
  return res;
};

// Compute grid covering the whole month (weeks start Mon, end Sun)
const monthGrid = (anchor: Date): Date[][] => {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const start = startOfWeekMon(first);
  const end = endOfWeekSun(last);

  const days: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
};

export default function CalendarPage() {
  const router = useRouter();
  const { currentUser, loading } = useAuth();
  const [viewDate, setViewDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  });
  const [events, setEvents] = useState<CalEvent[]>([]);

  // Modal state
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!loading && !currentUser) router.replace('/login');
  }, [loading, currentUser, router]);

  useEffect(() => {
    if (!currentUser) return;
    const uid = currentUser.UserId;
    const ref = dbRef(db, `calendar/${uid}`);
    const unsub = onValue(ref, (snap) => {
      const data = snap.val() as Record<string, Omit<CalEvent, 'id'>> | null;
      if (!data) {
        setEvents([]);
        return;
      }
      const list: CalEvent[] = Object.entries(data).map(([id, e]) => ({
        id,
        title: e.title || '',
        start: e.start,
        end: e.end,
        notes: e.notes,
      }));
      // sort by start then title
      list.sort((a, b) => {
        const ad = Date.parse(a.start);
        const bd = Date.parse(b.start);
        if (ad !== bd) return ad - bd;
        return a.title.localeCompare(b.title);
      });
      setEvents(list);
    });
    return () => unsub();
  }, [currentUser]);

  const weeks = useMemo(() => monthGrid(viewDate), [viewDate]);
  const monthLabel = useMemo(() => {
    return viewDate.toLocaleString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  }, [viewDate]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setStart('');
    setEnd('');
    setNotes('');
  };

  const openForNew = (ymd: string) => {
    resetForm();
    setStart(ymd);
    setEnd(ymd);
    setOpen(true);
  };

  const openForEdit = (e: CalEvent) => {
    setEditingId(e.id);
    setTitle(e.title);
    setStart(e.start);
    setEnd(e.end ?? e.start);
    setNotes(e.notes || '');
    setOpen(true);
  };

  const saveEvent = async () => {
    const t = title.trim();
    const n = notes.trim();
    if (!currentUser || !t || !start || !(end || start) || !n) return;
    const payload: Omit<CalEvent, 'id'> = {
      title: t,
      start,
      end: end || start,
      notes: n,
    };
    const base = dbRef(db, `calendar/${currentUser.UserId}`);
    if (editingId) {
      await update(dbRef(db, `calendar/${currentUser.UserId}/${editingId}`), payload);
    } else {
      const newRef = push(base);
      await set(newRef, payload);
    }
    setOpen(false);
    resetForm();
  };

  const deleteEvent = async () => {
    if (!currentUser || !editingId) return;
    await remove(dbRef(db, `calendar/${currentUser.UserId}/${editingId}`));
    setOpen(false);
    resetForm();
  };

  const today = () => setViewDate(new Date());
  const prevMonth = () =>
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () =>
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  // Build a quick index of event segments per week
  const weeklySegments = useMemo(() => {
    return weeks.map((week) => {
      const wStart = new Date(week[0]);
      const wEnd = new Date(week[6]);
      const segs: Array<{
        id: string;
        title: string;
        startCol: number; // 1..7
        endCol: number; // 1..7
        base: CalEvent;
      }> = [];
      for (const e of events) {
        const s = toNoon(e.start);
        const eEnd = toNoon(e.end || e.start);
        if (eEnd < wStart || s > wEnd) continue; // no overlap with this week

        const overlapStart = s < wStart ? wStart : s;
        const overlapEnd = eEnd > wEnd ? wEnd : eEnd;
        const startWithin = dayIndexMon0(overlapStart) + 1; // 1..7
        const endWithin = dayIndexMon0(overlapEnd) + 1; // 1..7

        segs.push({
          id: e.id,
          title: e.title,
          startCol: startWithin,
          endCol: endWithin,
          base: e,
        });
      }
      return segs;
    });
  }, [weeks, events]);

  return (
    <Layout>
      <div className='mx-auto max-w-6xl px-4 py-6'>
        <div className='mb-4 flex items-center justify-between'>
          <h1 className='text-2xl font-semibold text-gray-900'>{monthLabel}</h1>
          <div className='flex items-center gap-2'>
            <button
              onClick={today}
              className='rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200'
            >
              today
            </button>
            <div className='inline-flex overflow-hidden rounded-md border border-gray-300'>
              <button
                onClick={prevMonth}
                className='px-3 py-1.5 text-sm hover:bg-gray-50'
                aria-label='Previous month'
                title='Previous month'
              >
                ◀
              </button>
              <button
                onClick={nextMonth}
                className='border-l border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50'
                aria-label='Next month'
                title='Next month'
              >
                ▶
              </button>
            </div>
            <button
              onClick={() => openForNew(toYmd(new Date()))}
              className='rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700'
            >
              Add Event
            </button>
          </div>
        </div>

        {/* Weekday header */}
        <div className='grid grid-cols-7 border-b border-gray-200 bg-white text-center text-sm font-semibold text-gray-700'>
          {weekdayLabels.map((w) => (
            <div key={w} className='px-2 py-2'>
              {w}
            </div>
          ))}
        </div>

        {/* Month grid */}
        <div className='border border-gray-200 bg-white'>
          {weeks.map((week, wi) => (
            <div key={wi} className='border-b last:border-b-0'>
              {/* Day cells */}
              <div className='grid grid-cols-7'>
                {week.map((d, di) => {
                  const inMonth = d.getMonth() === viewDate.getMonth();
                  const isToday = isSameDay(d, new Date());
                  return (
                    <button
                      key={di}
                      onClick={() => openForNew(toYmd(d))}
                      className={
                        'h-28 border-r last:border-r-0 p-2 text-left transition ' +
                        (inMonth
                          ? 'bg-white hover:bg-gray-50'
                          : 'bg-gray-50 text-gray-400 hover:bg-gray-100') +
                        (isToday ? ' outline outline-1 outline-yellow-300' : '')
                      }
                      title='Add event'
                    >
                      <div className='text-xs font-medium'>
                        {d.getDate()}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Events for the week */}
              {weeklySegments[wi] && weeklySegments[wi].length > 0 && (
                <div className='grid grid-cols-7 gap-x-0.5 px-1 pb-2 pt-1'>
                  {weeklySegments[wi].map((seg) => (
                    <div
                      key={`${seg.id}-${seg.startCol}-${seg.endCol}`}
                      style={{ gridColumn: `${seg.startCol} / ${seg.endCol + 1}` }}
                      className='cursor-pointer truncate rounded bg-blue-500 px-2 py-1 text-xs font-medium text-white hover:bg-blue-600'
                      onClick={() => openForEdit(seg.base)}
                      title={seg.title}
                    >
                      {seg.title}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Modal */}
        {open && (
          <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
            <div className='w-full max-w-lg rounded-lg bg-white p-6 shadow-xl'>
              <h2 className='mb-4 text-lg font-semibold text-gray-900'>
                {editingId ? 'Edit Event' : 'Add Event'}
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  // Leverage built-in required validation
                  const form = e.currentTarget as HTMLFormElement;
                  if (!form.checkValidity()) {
                    form.reportValidity();
                    return;
                  }
                  void saveEvent();
                }}
                className='space-y-3'
              >
                <div>
                  <label className='block text-sm font-medium text-gray-700'>
                    Title
                  </label>
                  <input
                    required
                    aria-required='true'
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className='mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none'
                    placeholder='e.g., Vacation time'
                  />
                </div>
                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700'>
                      Start date
                    </label>
                    <input
                      required
                      aria-required='true'
                      type='date'
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      className='mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none'
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700'>
                      End date
                    </label>
                    <input
                      required
                      aria-required='true'
                      type='date'
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                      className='mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none'
                    />
                  </div>
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700'>
                    Notes
                  </label>
                  <textarea
                    required
                    aria-required='true'
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className='mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none'
                    rows={3}
                    placeholder='Add details'
                  />
                </div>
                <div className='mt-6 flex items-center justify-end gap-2'>
                  {editingId && (
                    <button
                      type='button'
                      onClick={deleteEvent}
                      className='rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50'
                    >
                      Delete
                    </button>
                  )}
                  <button
                    type='button'
                    onClick={() => {
                      setOpen(false);
                      resetForm();
                    }}
                    className='rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50'
                  >
                    Cancel
                  </button>
                  <button
                    type='submit'
                    className='rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700'
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
