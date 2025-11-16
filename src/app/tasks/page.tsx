'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  onValue,
  push,
  ref as dbRef,
  remove,
  set,
  update,
} from 'firebase/database';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';

type ScheduleType = 'daily' | 'weekly';

type ScheduledTask = {
  id: string;
  name: string;
  instructions: string;
  scheduleType: ScheduleType;
  time: string; // HH:mm in 24h format
  dayOfWeek?: number; // 0=Sunday..6=Saturday (for weekly)
  paused?: boolean;
  createdAt?: number;
};

const weekdayNames = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const formatTime = (time: string): string => {
  if (!time) return '';
  const [hStr, mStr] = time.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const isPm = h >= 12;
  const hour12 = ((h + 11) % 12) + 1;
  const mm = String(m).padStart(2, '0');
  return `${hour12}:${mm} ${isPm ? 'PM' : 'AM'}`;
};

const formatSchedule = (task: ScheduledTask): string => {
  const timeLabel = formatTime(task.time);
  if (task.scheduleType === 'daily') {
    return `Daily at ${timeLabel}`;
  }
  const idx =
    typeof task.dayOfWeek === 'number' &&
    task.dayOfWeek >= 0 &&
    task.dayOfWeek <= 6
      ? task.dayOfWeek
      : 0;
  return `Every ${weekdayNames[idx]} at ${timeLabel}`;
};

export default function ScheduledTasksPage() {
  const router = useRouter();
  const { currentUser, loading } = useAuth();

  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);

  // Modal state
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [scheduleType, setScheduleType] = useState<ScheduleType>('daily');
  const [time, setTime] = useState('08:00');
  const [dayOfWeek, setDayOfWeek] = useState<number>(1); // Monday
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!loading && !currentUser) router.replace('/login');
  }, [loading, currentUser, router]);

  useEffect(() => {
    if (!currentUser) {
      setTasks([]);
      setTasksLoaded(false);
      return;
    }
    const uid = currentUser.UserId;
    const ref = dbRef(db, `scheduledTasks/${uid}`);
    const unsub = onValue(ref, (snap) => {
      const data = snap.val() as
        | Record<
            string,
            {
              name?: string;
              instructions?: string;
              scheduleType?: ScheduleType;
              time?: string;
              dayOfWeek?: number;
              paused?: boolean;
              createdAt?: number;
            }
          >
        | null;
      if (!data) {
        setTasks([]);
        setTasksLoaded(true);
        return;
      }
      const list: ScheduledTask[] = Object.entries(data).map(([id, raw]) => ({
        id,
        name: (raw.name || '').trim(),
        instructions: (raw.instructions || '').trim(),
        scheduleType: raw.scheduleType === 'weekly' ? 'weekly' : 'daily',
        time: raw.time || '08:00',
        dayOfWeek:
          typeof raw.dayOfWeek === 'number' &&
          raw.dayOfWeek >= 0 &&
          raw.dayOfWeek <= 6
            ? raw.dayOfWeek
            : undefined,
        paused: !!raw.paused,
        createdAt:
          typeof raw.createdAt === 'number' ? raw.createdAt : undefined,
      }));
      list.sort((a, b) => {
        const aCreated = a.createdAt ?? 0;
        const bCreated = b.createdAt ?? 0;
        if (aCreated !== bCreated) return aCreated - bCreated;
        return a.name.localeCompare(b.name);
      });
      setTasks(list);
      setTasksLoaded(true);
    });
    return () => unsub();
  }, [currentUser]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setInstructions('');
    setScheduleType('daily');
    setTime('08:00');
    setDayOfWeek(1);
    setPaused(false);
  };

  const openForNew = () => {
    resetForm();
    setOpen(true);
  };

  const openForEdit = (task: ScheduledTask) => {
    setEditingId(task.id);
    setName(task.name);
    setInstructions(task.instructions);
    setScheduleType(task.scheduleType);
    setTime(task.time || '08:00');
    setDayOfWeek(
      typeof task.dayOfWeek === 'number' ? task.dayOfWeek : new Date().getDay()
    );
    setPaused(!!task.paused);
    setOpen(true);
  };

  const saveTask = async () => {
    if (!currentUser) return;
    const trimmedName = name.trim();
    const trimmedInstructions = instructions.trim();
    if (!trimmedName || !trimmedInstructions || !time) return;

    const uid = currentUser.UserId;
    const base = dbRef(db, `scheduledTasks/${uid}`);
    const now = Date.now();

    const payload = {
      name: trimmedName,
      instructions: trimmedInstructions,
      scheduleType,
      time,
      dayOfWeek: scheduleType === 'weekly' ? dayOfWeek : null,
      paused,
      createdAt: now,
    };

    if (editingId) {
      await update(dbRef(db, `scheduledTasks/${uid}/${editingId}`), payload);
    } else {
      const newRef = push(base);
      await set(newRef, payload);
    }

    setOpen(false);
    resetForm();
  };

  const deleteTask = async (taskId: string) => {
    if (!currentUser) return;
    const uid = currentUser.UserId;
    await remove(dbRef(db, `scheduledTasks/${uid}/${taskId}`));
  };

  const togglePause = async (task: ScheduledTask) => {
    if (!currentUser) return;
    const uid = currentUser.UserId;
    await update(dbRef(db, `scheduledTasks/${uid}/${task.id}`), {
      paused: !task.paused,
    });
  };

  const createQuickTask = async (kind: 'weather' | 'beer') => {
    if (!currentUser) return;
    const uid = currentUser.UserId;
    const base = dbRef(db, `scheduledTasks/${uid}`);
    const now = Date.now();

    if (kind === 'weather') {
      const newRef = push(base);
      await set(newRef, {
        name: 'Morning weather',
        instructions: 'Check and show today’s weather forecast.',
        scheduleType: 'daily' as ScheduleType,
        time: '08:00',
        dayOfWeek: null,
        paused: false,
        createdAt: now,
      });
      return;
    }

    const newRef = push(base);
    await set(newRef, {
      name: 'Friday beer reminder',
      instructions: 'Remind me to have a beer.',
      scheduleType: 'weekly' as ScheduleType,
      time: '15:00',
      dayOfWeek: 5, // Friday
      paused: false,
      createdAt: now,
    });
  };

  const hasWeatherQuickTask = useMemo(
    () =>
      tasks.some(
        (t) =>
          t.scheduleType === 'daily' &&
          t.time === '08:00' &&
          t.name.toLowerCase().includes('weather')
      ),
    [tasks]
  );

  const hasBeerQuickTask = useMemo(
    () =>
      tasks.some(
        (t) =>
          t.scheduleType === 'weekly' &&
          t.time === '15:00' &&
          (t.dayOfWeek ?? -1) === 5 &&
          t.name.toLowerCase().includes('beer')
      ),
    [tasks]
  );

  const isLoading = loading || !tasksLoaded;

  return (
    <Layout>
      <div className='mx-auto max-w-4xl px-4 py-6'>
        <div className='mb-4 flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-gray-900'>
              Scheduled Tasks
            </h1>
            <p className='mt-1 text-sm text-gray-600'>
              Create recurring tasks like a daily weather check or a weekly
              reminder.
            </p>
          </div>
          <button
            type='button'
            onClick={openForNew}
            className='rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700'
          >
            New task
          </button>
        </div>

        <section className='mb-6 rounded-lg border border-dashed border-gray-300 bg-white p-4 shadow-sm'>
          <h2 className='text-sm font-semibold text-gray-800'>
            Quick scheduled examples
          </h2>
          <p className='mt-1 text-xs text-gray-500'>
            One click to add the two example schedules you mentioned.
          </p>
          <div className='mt-3 flex flex-wrap gap-3'>
            <button
              type='button'
              disabled={hasWeatherQuickTask || !currentUser}
              onClick={() => void createQuickTask('weather')}
              className={`rounded-md px-3 py-2 text-xs font-medium ${
                hasWeatherQuickTask || !currentUser
                  ? 'cursor-not-allowed bg-gray-200 text-gray-500'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              {hasWeatherQuickTask
                ? 'Daily weather at 8:00 AM added'
                : 'Add: Weather at 8:00 AM daily'}
            </button>
            <button
              type='button'
              disabled={hasBeerQuickTask || !currentUser}
              onClick={() => void createQuickTask('beer')}
              className={`rounded-md px-3 py-2 text-xs font-medium ${
                hasBeerQuickTask || !currentUser
                  ? 'cursor-not-allowed bg-gray-200 text-gray-500'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              {hasBeerQuickTask
                ? 'Beer reminder Fridays at 3:00 PM added'
                : 'Add: Beer at 3:00 PM every Friday'}
            </button>
          </div>
        </section>

        <section className='rounded-lg bg-white p-4 shadow-sm'>
          <h2 className='mb-3 text-sm font-semibold text-gray-800'>
            Your scheduled tasks
          </h2>
          {isLoading ? (
            <div className='flex items-center justify-center py-10'>
              <div className='h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600' />
            </div>
          ) : tasks.length === 0 ? (
            <p className='text-sm text-gray-600'>
              No scheduled tasks yet. Use{' '}
              <span className='font-medium'>New task</span> or the quick
              examples above to get started.
            </p>
          ) : (
            <ul className='space-y-3'>
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className='flex items-start justify-between rounded-md border border-gray-200 bg-white p-3 shadow-sm'
                >
                  <div>
                    <h3 className='text-sm font-semibold text-gray-900'>
                      {task.name || 'Untitled task'}
                    </h3>
                    <p className='mt-1 text-xs text-gray-600'>
                      {task.instructions}
                    </p>
                    <p className='mt-1 text-xs text-gray-500'>
                      {formatSchedule(task)}
                    </p>
                    <p className='mt-1 text-xs font-medium'>
                      Status:{' '}
                      <span
                        className={
                          task.paused
                            ? 'text-orange-600'
                            : 'text-green-600'
                        }
                      >
                        {task.paused ? 'Paused' : 'Active'}
                      </span>
                    </p>
                  </div>
                  <div className='flex flex-col items-end gap-2'>
                    <button
                      type='button'
                      onClick={() => openForEdit(task)}
                      className='rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50'
                    >
                      Edit
                    </button>
                    <button
                      type='button'
                      onClick={() => void togglePause(task)}
                      className='rounded-md border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50'
                    >
                      {task.paused ? 'Resume' : 'Pause'}
                    </button>
                    <button
                      type='button'
                      onClick={() => void deleteTask(task.id)}
                      className='rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50'
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className='mt-4 text-xs text-gray-500'>
          This page stores schedules and metadata. Running the actual jobs
          (fetching weather or sending reminders) should be handled by a backend
          worker or mobile background task that reads these settings.
        </p>

        {open && (
          <div className='fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4'>
            <div className='w-full max-w-lg rounded-lg bg-white p-6 shadow-xl'>
              <h2 className='mb-4 text-lg font-semibold text-gray-900'>
                {editingId ? 'Edit task' : 'New task'}
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget as HTMLFormElement;
                  if (!form.checkValidity()) {
                    form.reportValidity();
                    return;
                  }
                  void saveTask();
                }}
                className='space-y-3'
              >
                <div>
                  <label className='block text-sm font-medium text-gray-700'>
                    Name
                  </label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className='mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none'
                    placeholder='e.g., Get weather'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700'>
                    Instructions
                  </label>
                  <textarea
                    required
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    className='mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none'
                    rows={3}
                    placeholder='Describe what this task should do.'
                  />
                </div>
                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700'>
                      Schedule
                    </label>
                    <select
                      value={scheduleType}
                      onChange={(e) =>
                        setScheduleType(e.target.value as ScheduleType)
                      }
                      className='mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none'
                    >
                      <option value='daily'>Daily</option>
                      <option value='weekly'>Weekly</option>
                    </select>
                  </div>
                  <div>
                    {scheduleType === 'weekly' && (
                      <div className='mb-2'>
                        <label className='block text-sm font-medium text-gray-700'>
                          Day of week
                        </label>
                        <select
                          value={String(dayOfWeek)}
                          onChange={(e) =>
                            setDayOfWeek(Number(e.target.value))
                          }
                          className='mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none'
                        >
                          {weekdayNames.map((name, idx) => (
                            <option key={name} value={idx}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className='block text-sm font-medium text-gray-700'>
                        Time
                      </label>
                      <input
                        required
                        type='time'
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className='mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none'
                      />
                    </div>
                  </div>
                </div>
                <div className='flex items-center gap-2 pt-1'>
                  <input
                    id='paused'
                    type='checkbox'
                    checked={paused}
                    onChange={(e) => setPaused(e.target.checked)}
                    className='h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                  />
                  <label
                    htmlFor='paused'
                    className='text-sm text-gray-700 select-none'
                  >
                    Pause this task
                  </label>
                </div>
                <div className='mt-5 flex items-center justify-end gap-2'>
                  {editingId && (
                    <button
                      type='button'
                      onClick={() => {
                        void deleteTask(editingId);
                        setOpen(false);
                        resetForm();
                      }}
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

