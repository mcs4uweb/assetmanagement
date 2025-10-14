// src/app/homedetail/[id]/page.tsx
'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onValue, ref, remove, set } from 'firebase/database';
import Layout from '../../../components/layout/Layout';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../lib/firebase';
import { Vehicle, type Maintenance, type Part } from '../../../models/Vehicle';
import { Check, Pencil, Plus } from 'lucide-react';

interface PageProps {
  params: {
    id: string;
  };
}

interface MaintenanceFormEntry {
  maintenanceType: string;
  maintenanceDesc: string;
  maintenanceEndDate: string;
}

interface PartFormEntry {
  part: string;
  type: string;
  url: string;
  date: string;
}

export default function HomeDetailPage({ params }: PageProps) {
  const { id } = params;
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const [asset, setAsset] = useState<Vehicle | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    make: '',
    model: '',
    year: '',
    vin: '',
    plate: '',
    tires: '',
    category: '',
  });
  const [isEditingQuickInfo, setIsEditingQuickInfo] = useState(false);
  const [isSavingQuickInfo, setIsSavingQuickInfo] = useState(false);
  const [quickInfoError, setQuickInfoError] = useState<string | null>(null);
  const [quickInfoFormState, setQuickInfoFormState] = useState({
    category: '',
    odometer: '',
    oilChangeDate: '',
  });
  const [isEditingMaintenance, setIsEditingMaintenance] = useState(false);
  const [isSavingMaintenance, setIsSavingMaintenance] = useState(false);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const [maintenanceFormState, setMaintenanceFormState] = useState<
    MaintenanceFormEntry[]
  >([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditingParts, setIsEditingParts] = useState(false);
  const [isSavingParts, setIsSavingParts] = useState(false);
  const [partsError, setPartsError] = useState<string | null>(null);
  const [partFormState, setPartFormState] = useState<PartFormEntry[]>([]);
  const [editingPartRowId, setEditingPartRowId] = useState<number | null>(null);
  const [editingPartDraft, setEditingPartDraft] =
    useState<PartFormEntry | null>(null);
  const [isUpdatingPart, setIsUpdatingPart] = useState(false);
  const [updatePartError, setUpdatePartError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [aiDescription, setAiDescription] = useState<string | null>(null);
  const [isGeneratingAiDescription, setIsGeneratingAiDescription] =
    useState(false);
  const [aiDescriptionError, setAiDescriptionError] = useState<string | null>(
    null
  );

  const buildQuickInfoFormState = (targetAsset: Vehicle | null) => {
    const latestOdometer =
      targetAsset?.odometer && targetAsset.odometer.length > 0
        ? targetAsset.odometer[targetAsset.odometer.length - 1]?.odometer
        : undefined;
    const latestOilChange =
      targetAsset?.oilChange && targetAsset.oilChange.length > 0
        ? targetAsset.oilChange[targetAsset.oilChange.length - 1]?.date
        : undefined;
    const oilChangeDate =
      latestOilChange && !Number.isNaN(new Date(latestOilChange).getTime())
        ? new Date(latestOilChange).toISOString().split('T')[0]
        : '';

    return {
      category: targetAsset?.category ?? '',
      odometer:
        latestOdometer !== undefined && latestOdometer !== null
          ? String(latestOdometer)
          : '',
      oilChangeDate,
    };
  };

  const buildMaintenanceFormState = (
    targetAsset: Vehicle | null
  ): MaintenanceFormEntry[] => {
    if (!targetAsset?.maintenance) return [];

    return targetAsset.maintenance.map((item) => {
      const dueDate =
        item.maintenanceEndDate &&
        !Number.isNaN(new Date(item.maintenanceEndDate).getTime())
          ? new Date(item.maintenanceEndDate).toISOString().split('T')[0]
          : '';

      return {
        maintenanceType: item.maintenanceType ?? '',
        maintenanceDesc: item.maintenanceDesc ?? '',
        maintenanceEndDate: dueDate,
      };
    });
  };

  useEffect(() => {
    if (!currentUser) {
      setAsset(null);
      setIsFetching(false);
      return;
    }

    const itemRef = ref(db, `assets/${currentUser.UserId}/${id}`);
    const unsubscribe = onValue(
      itemRef,
      (snapshot) => {
        setAsset(snapshot.exists() ? snapshot.val() : null);
        setIsFetching(false);
      },
      () => {
        setAsset(null);
        setIsFetching(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, id]);

  useEffect(() => {
    if (!asset) {
      setFormState({
        make: '',
        model: '',
        year: '',
        vin: '',
        plate: '',
        tires: '',
        category: '',
      });
      setQuickInfoFormState(buildQuickInfoFormState(null));
      setMaintenanceFormState([]);
      setIsEditingQuickInfo(false);
      setIsEditingMaintenance(false);
      setIsEditingParts(false);
      setQuickInfoError(null);
      setMaintenanceError(null);
      setIsDeleting(false);
      setPartFormState([]);
      setPartsError(null);
      setEditingPartRowId(null);
      setEditingPartDraft(null);
      setIsUpdatingPart(false);
      setUpdatePartError(null);
      setSorting([]);
      setIsDeleteModalOpen(false);
      return;
    }

    setFormState({
      make: asset.make ?? '',
      model: asset.model ?? '',
      year: asset.year?.toString() ?? '',
      vin: asset.vin ?? '',
      plate: asset.plate ?? '',
      tires: asset.tires ?? '',
      category: asset.category ?? '',
    });
    setQuickInfoFormState(buildQuickInfoFormState(asset));
    setMaintenanceFormState(buildMaintenanceFormState(asset));
    setIsEditingQuickInfo(false);
    setIsEditingMaintenance(false);
    setIsEditingParts(false);
    setQuickInfoError(null);
    setMaintenanceError(null);
    setIsDeleting(false);
    setPartFormState([]);
    setPartsError(null);
    setEditingPartRowId(null);
    setEditingPartDraft(null);
    setIsUpdatingPart(false);
    setUpdatePartError(null);
    setIsDeleteModalOpen(false);
  }, [asset]);

  const handleFieldChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser || !asset) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const targetRef = ref(db, `assets/${currentUser.UserId}/${id}`);

      const updatedAsset: Vehicle = {
        ...asset,
        make: formState.make.trim(),
        model: formState.model.trim(),
        year: formState.year ? Number(formState.year) : undefined,
        vin: formState.vin.trim(),
        plate: formState.plate.trim(),
        tires: formState.tires.trim(),
        category: formState.category.trim(),
      };

      await set(targetRef, updatedAsset);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update asset', error);
      setErrorMessage('Unable to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickInfoFieldChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setQuickInfoFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleQuickInfoSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser || !asset) return;

    const trimmedCategory = quickInfoFormState.category.trim();
    const odometerValue = quickInfoFormState.odometer.trim();
    const oilChangeDateValue = quickInfoFormState.oilChangeDate.trim();

    if (odometerValue && Number.isNaN(Number(odometerValue))) {
      setQuickInfoError('Odometer must be a valid number.');
      return;
    }

    let normalizedOilChangeDate: string | undefined;
    if (oilChangeDateValue) {
      const parsedDate = new Date(oilChangeDateValue);
      if (Number.isNaN(parsedDate.getTime())) {
        setQuickInfoError('Please provide a valid oil change date.');
        return;
      }
      normalizedOilChangeDate = parsedDate.toISOString();
    }

    setIsSavingQuickInfo(true);
    setQuickInfoError(null);

    try {
      const targetRef = ref(db, `assets/${currentUser.UserId}/${id}`);

      const odometerEntries = [...(asset.odometer ?? [])];
      if (odometerValue) {
        const numericOdometer = Number(odometerValue);
        if (odometerEntries.length > 0) {
          const lastIndex = odometerEntries.length - 1;
          odometerEntries[lastIndex] = {
            ...odometerEntries[lastIndex],
            odometer: numericOdometer,
          };
        } else {
          odometerEntries.push({
            odometer: numericOdometer,
          });
        }
      }

      const oilChangeEntries = [...(asset.oilChange ?? [])];
      if (normalizedOilChangeDate) {
        if (oilChangeEntries.length > 0) {
          const lastIndex = oilChangeEntries.length - 1;
          oilChangeEntries[lastIndex] = {
            ...oilChangeEntries[lastIndex],
            date: normalizedOilChangeDate,
          };
        } else {
          oilChangeEntries.push({
            date: normalizedOilChangeDate,
          });
        }
      }

      const updatedAsset: Vehicle & Record<string, unknown> = {
        ...asset,
        odometer: odometerEntries,
        oilChange: oilChangeEntries,
      };

      if (trimmedCategory) {
        updatedAsset.category = trimmedCategory;
      } else {
        delete updatedAsset.category;
      }

      const sanitizedAsset = JSON.parse(
        JSON.stringify(updatedAsset)
      ) as Vehicle;

      await set(targetRef, sanitizedAsset);
      setAsset(sanitizedAsset);
      setQuickInfoFormState(buildQuickInfoFormState(sanitizedAsset));
      setIsEditingQuickInfo(false);
    } catch (error) {
      console.error('Failed to update quick info', error);
      setQuickInfoError('Unable to save quick info changes. Please try again.');
    } finally {
      setIsSavingQuickInfo(false);
    }
  };

  const handleMaintenanceFieldChange = (
    index: number,
    field: keyof MaintenanceFormEntry,
    value: string
  ) => {
    setMaintenanceFormState((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddMaintenanceEntry = () => {
    setMaintenanceFormState((prev) => [
      ...prev,
      { maintenanceType: '', maintenanceDesc: '', maintenanceEndDate: '' },
    ]);
  };

  const handleRemoveMaintenanceEntry = (index: number) => {
    setMaintenanceFormState((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMaintenanceSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser || !asset) return;

    const sanitizedEntries: Maintenance[] = [];
    for (const entry of maintenanceFormState) {
      const trimmedType = entry.maintenanceType.trim();
      const trimmedDesc = entry.maintenanceDesc.trim();
      const dateValue = entry.maintenanceEndDate.trim();

      let isoMaintenanceDate: string | undefined;
      if (dateValue) {
        const parsedDate = new Date(dateValue);
        if (Number.isNaN(parsedDate.getTime())) {
          setMaintenanceError(
            'Please provide valid dates for maintenance items.'
          );
          return;
        }
        isoMaintenanceDate = parsedDate.toISOString();
      }

      if (trimmedType || trimmedDesc || isoMaintenanceDate) {
        sanitizedEntries.push({
          maintenanceType: trimmedType || undefined,
          maintenanceDesc: trimmedDesc || undefined,
          maintenanceEndDate: isoMaintenanceDate,
        });
      }
    }

    setIsSavingMaintenance(true);
    setMaintenanceError(null);

    try {
      const targetRef = ref(db, `assets/${currentUser.UserId}/${id}`);
      const updatedAsset: Vehicle = {
        ...asset,
        maintenance: sanitizedEntries,
      };

      await set(targetRef, updatedAsset);
      setIsEditingMaintenance(false);
    } catch (error) {
      console.error('Failed to update maintenance entries', error);
      setMaintenanceError(
        'Unable to save maintenance changes. Please try again.'
      );
    } finally {
      setIsSavingMaintenance(false);
    }
  };

  const openDeleteModal = () => {
    if (isDeleting) return;
    setErrorMessage(null);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteAsset = async () => {
    if (!currentUser || !asset || isDeleting) return;
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const targetRef = ref(db, `assets/${currentUser.UserId}/${id}`);
      await remove(targetRef);
      setIsDeleteModalOpen(false);
      router.push('/home');
    } catch (error) {
      console.error('Failed to delete asset', error);
      setErrorMessage('Unable to delete this asset. Please try again later.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    if (isDeleting) return;
    setIsDeleteModalOpen(false);
  };

  const handlePartFieldChange = (
    index: number,
    field: keyof PartFormEntry,
    value: string
  ) => {
    setPartFormState((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddPartEntry = () => {
    setIsEditingParts(true);
    setPartsError(null);
    setEditingPartRowId(null);
    setEditingPartDraft(null);
    setUpdatePartError(null);
    setPartFormState((prev) => {
      const base = isEditingParts ? prev : [];
      return [...base, { part: '', type: '', url: '', date: '' }];
    });
  };

  const handleRemovePartEntry = (index: number) => {
    setPartFormState((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        setIsEditingParts(false);
        setPartsError(null);
      }
      return next;
    });
  };

  const handlePartsSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser || !asset) return;

    const sanitizedEntries: Part[] = [];
    for (const entry of partFormState) {
      const trimmedPart = entry.part.trim();
      const trimmedType = entry.type.trim();
      const trimmedUrl = entry.url.trim();
      const dateValue = entry.date.trim();

      let isoDate: string | undefined;
      if (dateValue) {
        const parsedDate = new Date(dateValue);
        if (Number.isNaN(parsedDate.getTime())) {
          setPartsError('Please provide valid dates for parts.');
          return;
        }
        isoDate = parsedDate.toISOString();
      }

      if (trimmedPart || trimmedType || trimmedUrl || isoDate) {
        sanitizedEntries.push({
          part: trimmedPart || undefined,
          type: trimmedType || undefined,
          url: trimmedUrl || undefined,
          date: isoDate,
        });
      }
    }

    setIsSavingParts(true);
    setPartsError(null);

    if (sanitizedEntries.length === 0) {
      setIsSavingParts(false);
      setPartsError('Please add at least one part before saving.');
      return;
    }

    try {
      const targetRef = ref(db, `assets/${currentUser.UserId}/${id}`);
      const mergedParts: Part[] = [
        ...(asset.partNumber ?? []),
        ...sanitizedEntries,
      ];
      const updatedAsset: Vehicle = {
        ...asset,
        partNumber: mergedParts,
      };

      await set(targetRef, updatedAsset);
      setIsEditingParts(false);
      setPartFormState([]);
    } catch (error) {
      console.error('Failed to update parts list', error);
      setPartsError('Unable to save parts. Please try again.');
    } finally {
      setIsSavingParts(false);
    }
  };

  const startEditingPart = useCallback((index: number, part: Part) => {
    const parsedDate =
      part.date && !Number.isNaN(new Date(part.date).getTime())
        ? new Date(part.date).toISOString().split('T')[0]
        : '';

    setEditingPartRowId(index);
    setEditingPartDraft({
      part: part.part ?? '',
      type: part.type ?? '',
      url: part.url ?? '',
      date: parsedDate,
    });
    setUpdatePartError(null);
  }, []);

  const cancelEditingPart = useCallback(() => {
    setEditingPartRowId(null);
    setEditingPartDraft(null);
    setUpdatePartError(null);
  }, []);

  const handlePartDraftChange = useCallback(
    (field: keyof PartFormEntry, value: string) => {
      setEditingPartDraft((prev) =>
        prev ? { ...prev, [field]: value } : prev
      );
    },
    []
  );

  const saveEditingPart = useCallback(
    async (index: number) => {
      if (
        editingPartRowId !== index ||
        !editingPartDraft ||
        !asset ||
        !currentUser
      ) {
        return;
      }

      const trimmedPart = editingPartDraft.part.trim();
      const trimmedType = editingPartDraft.type.trim();
      const trimmedUrl = editingPartDraft.url.trim();
      const dateValue = editingPartDraft.date.trim();

      let isoDate: string | undefined;
      if (dateValue) {
        const parsedDate = new Date(dateValue);
        if (Number.isNaN(parsedDate.getTime())) {
          setUpdatePartError('Please provide a valid date for this part.');
          return;
        }
        isoDate = parsedDate.toISOString();
      }

      if (!trimmedPart && !trimmedType && !trimmedUrl && !isoDate) {
        setUpdatePartError('Part details cannot be completely empty.');
        return;
      }

      setIsUpdatingPart(true);
      setUpdatePartError(null);

      try {
        const updatedParts: Part[] = [...(asset.partNumber ?? [])];
        if (!updatedParts[index]) {
          setUpdatePartError(
            'Unable to locate this part. Please refresh and try again.'
          );
          setIsUpdatingPart(false);
          return;
        }

        updatedParts[index] = {
          part: trimmedPart || undefined,
          type: trimmedType || undefined,
          url: trimmedUrl || undefined,
          date: isoDate,
        };

        const targetRef = ref(db, `assets/${currentUser.UserId}/${id}`);
        await set(targetRef, {
          ...asset,
          partNumber: updatedParts,
        });

        setEditingPartRowId(null);
        setEditingPartDraft(null);
      } catch (error) {
        console.error('Failed to update part', error);
        setUpdatePartError('Unable to save this part. Please try again.');
      } finally {
        setIsUpdatingPart(false);
      }
    },
    [asset, currentUser, editingPartDraft, editingPartRowId, id]
  );

  const detailEntries = useMemo(() => {
    if (!asset) return [];

    return [
      { label: 'Make', value: asset.make },
      { label: 'Model', value: asset.model },
      { label: 'Year', value: asset.year },
      { label: 'VIN', value: asset.vin },
      { label: 'Plate', value: asset.plate },
      { label: 'Tires', value: asset.tires },
      { label: 'Category', value: asset.category },
    ].filter((entry) => entry.value !== undefined && entry.value !== '');
  }, [asset]);

  const descriptionSource = useMemo(() => {
    if (!asset) return '';
    debugger;
    if (typeof asset.description === 'string') {
      const trimmed = asset.description.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }

    const summaryParts = [asset.year, asset.make, asset.model]
      .filter((value) => value !== undefined && value !== null && value !== '')
      .map((value) => String(value).trim())
      .filter((value) => value.length > 0);

    const summary = summaryParts.join(' ').trim();

    const details: string[] = [];

    if (summary) {
      details.push(`Asset: ${summary}`);
    }

    if (asset.category) {
      details.push(`Category: ${asset.category}`);
    }

    if (asset.tires) {
      details.push(`Tires: ${asset.tires}`);
    }

    return details.join('\n').trim();
  }, [asset]);

  const hasDescriptionPrompt = descriptionSource.length > 0;

  useEffect(() => {
    setAiDescription(null);
    setAiDescriptionError(null);
    setIsGeneratingAiDescription(false);
  }, [id, descriptionSource]);

  const handleGenerateDetailedDescription = useCallback(async () => {
    debugger;
    if (!hasDescriptionPrompt || isGeneratingAiDescription) {
      if (!hasDescriptionPrompt) {
        setAiDescriptionError(
          'Add some asset details or a short description first.'
        );
      }
      return;
    }

    setIsGeneratingAiDescription(true);
    setAiDescriptionError(null);
    setAiDescription(null);

    try {
      const response = await fetch('/api/generate-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: descriptionSource }),
      });

      const payload = (await response.json().catch(() => null)) as {
        result?: string;
        error?: string;
      } | null;

      if (!response.ok || !payload) {
        const message =
          payload && typeof payload.error === 'string'
            ? payload.error
            : 'Unable to generate a detailed description right now.';
        setAiDescriptionError(message);
        return;
      }

      const text =
        typeof payload.result === 'string' ? payload.result.trim() : '';

      if (!text) {
        setAiDescriptionError('The AI response did not include any content.');
        return;
      }

      setAiDescription(text);
    } catch (error) {
      console.error('Failed to generate AI description', error);
      setAiDescriptionError(
        'We could not reach Google Generative AI. Please try again later.'
      );
    } finally {
      setIsGeneratingAiDescription(false);
    }
  }, [descriptionSource, hasDescriptionPrompt, isGeneratingAiDescription]);

  const partColumns = useMemo<ColumnDef<Part>[]>(() => {
    const sortingIndicator = (direction: 'asc' | 'desc' | false) => {
      if (direction === 'asc') return '^';
      if (direction === 'desc') return 'v';
      return '';
    };

    return [
      {
        accessorKey: 'part',
        header: ({ column }) => (
          <button
            type='button'
            onClick={column.getToggleSortingHandler()}
            className='flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600'
          >
            Part
            <span className='text-gray-400'>
              {sortingIndicator(column.getIsSorted())}
            </span>
          </button>
        ),
        cell: ({ row }) => {
          const isEditing = editingPartRowId === row.index && editingPartDraft;
          return isEditing ? (
            <input
              value={editingPartDraft.part}
              onChange={(event) =>
                handlePartDraftChange('part', event.target.value)
              }
              className='w-full rounded-md border border-gray-300 px-2 py-1 text-sm'
            />
          ) : (
            row.original.part || '—'
          );
        },
      },
      {
        accessorKey: 'type',
        header: ({ column }) => (
          <button
            type='button'
            onClick={column.getToggleSortingHandler()}
            className='flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600'
          >
            Type
            <span className='text-gray-400'>
              {sortingIndicator(column.getIsSorted())}
            </span>
          </button>
        ),
        cell: ({ row }) => {
          const isEditing = editingPartRowId === row.index && editingPartDraft;
          return isEditing ? (
            <input
              value={editingPartDraft.type}
              onChange={(event) =>
                handlePartDraftChange('type', event.target.value)
              }
              className='w-full rounded-md border border-gray-300 px-2 py-1 text-sm'
            />
          ) : (
            row.original.type || '—'
          );
        },
      },
      {
        accessorKey: 'date',
        header: ({ column }) => (
          <button
            type='button'
            onClick={column.getToggleSortingHandler()}
            className='flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600'
          >
            Last Updated
            <span className='text-gray-400'>
              {sortingIndicator(column.getIsSorted())}
            </span>
          </button>
        ),
        cell: ({ row }) => {
          const isEditing = editingPartRowId === row.index && editingPartDraft;
          if (isEditing) {
            return (
              <input
                type='date'
                value={editingPartDraft.date}
                onChange={(event) =>
                  handlePartDraftChange('date', event.target.value)
                }
                className='w-full rounded-md border border-gray-300 px-2 py-1 text-sm'
              />
            );
          }

          const rawDate = row.original.date;
          if (!rawDate) return '—';
          const parsedDate = new Date(rawDate);
          return Number.isNaN(parsedDate.getTime())
            ? '—'
            : parsedDate.toLocaleDateString();
        },
      },
      {
        accessorKey: 'url',
        header: ({ column }) => (
          <button
            type='button'
            onClick={column.getToggleSortingHandler()}
            className='flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600'
          >
            Amazon
            <span className='text-gray-400'>
              {sortingIndicator(column.getIsSorted())}
            </span>
          </button>
        ),
        cell: ({ row }) => {
          const isEditing = editingPartRowId === row.index && editingPartDraft;
          if (isEditing) {
            return (
              <input
                value={editingPartDraft.url}
                onChange={(event) =>
                  handlePartDraftChange('url', event.target.value)
                }
                className='w-full rounded-md border border-gray-300 px-2 py-1 text-sm'
                placeholder='https://'
              />
            );
          }

          const { url, part } = row.original;
          const href =
            url ||
            (part
              ? `https://www.amazon.com/s?k=${encodeURIComponent(part)}`
              : '');

          if (!href) {
            return <span className='text-gray-400'>—</span>;
          }

          return (
            <a
              href={href}
              target='_blank'
              rel='noopener noreferrer'
              className='text-sm font-medium text-blue-600 hover:text-blue-700'
            >
              View
            </a>
          );
        },
      },
      {
        id: 'actions',
        header: 'Action',
        cell: ({ row }) => {
          const isEditing = editingPartRowId === row.index && editingPartDraft;
          return (
            <div className='flex items-center gap-2'>
              <button
                type='button'
                onClick={() =>
                  isEditing
                    ? cancelEditingPart()
                    : startEditingPart(row.index, row.original)
                }
                className='rounded-full border border-gray-300 p-1 text-gray-600 transition hover:bg-gray-100'
                aria-label={isEditing ? 'Cancel edit' : 'Edit part'}
                disabled={isUpdatingPart}
              >
                <Pencil className='h-4 w-4' />
              </button>
              <button
                type='button'
                onClick={() => saveEditingPart(row.index)}
                className='rounded-full border border-green-400 bg-green-50 p-1 text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50'
                aria-label='Save part'
                disabled={!isEditing || isUpdatingPart}
              >
                <Check className='h-4 w-4' />
              </button>
            </div>
          );
        },
      },
    ];
  }, [
    editingPartDraft,
    editingPartRowId,
    isUpdatingPart,
    handlePartDraftChange,
    cancelEditingPart,
    startEditingPart,
    saveEditingPart,
  ]);

  const partData = useMemo<Part[]>(() => asset?.partNumber ?? [], [asset]);

  const partTable = useReactTable<Part>({
    data: partData,
    columns: partColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    onSortingChange: setSorting,
  });

  if (loading || isFetching) {
    return (
      <Layout>
        <div className='flex min-h-screen items-center justify-center'>
          <div className='text-center'>
            <div className='mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600' />
            <p className='mt-4 text-gray-600'>Loading asset details...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!currentUser) {
    return (
      <Layout>
        <div className='mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 text-center'>
          <h1 className='text-2xl font-semibold text-gray-900'>
            You&apos;re signed out
          </h1>
          <p className='mt-3 text-gray-600'>
            Sign back in to view the details of this asset.
          </p>
          <Link
            href='/login'
            className='mt-6 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700'
          >
            Go to Login
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Layout>
        <div className='bg-gray-50 min-h-screen py-10'>
          <div className='mx-auto max-w-4xl px-4 sm:px-6 lg:px-8'>
            <div className='mb-6 flex items-center justify-between'>
              <div>
                <h1 className='mt-2 text-3xl font-semibold text-gray-900'>
                  {asset?.make || 'Asset Detail'}
                </h1>
              </div>
              <Link
                href='/home'
                className='inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700'
              >
                Back to My Assets
              </Link>
            </div>

            {asset ? (
              <div className='space-y-6'>
                <section className='w-full rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
                  <div className='flex items-center justify-between'>
                    <h2 className='text-xl font-semibold text-gray-900'>
                      Overview
                    </h2>
                    <div className='flex items-center gap-2'>
                      {!isEditing && (
                        <button
                          type='button'
                          onClick={() => setIsEditing(true)}
                          className='rounded-md border border-green-400 bg-green-100 px-3 py-1 text-sm font-medium text-green-700 transition hover:bg-green-200'
                        >
                          Edit Asset
                        </button>
                      )}
                      <button
                        type='button'
                        onClick={openDeleteModal}
                        disabled={isDeleting}
                        className='rounded-md border border-red-400 bg-red-100 px-3 py-1 text-sm font-medium text-red-700 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50'
                      >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>

                  {isEditing ? (
                    <form onSubmit={handleSave} className='mt-6 space-y-4'>
                      <div className='grid gap-4 sm:grid-cols-2'>
                        <div>
                          <label
                            htmlFor='make'
                            className='block text-sm font-medium text-gray-700'
                          >
                            Make
                          </label>
                          <input
                            id='make'
                            name='make'
                            value={formState.make}
                            onChange={handleFieldChange}
                            className='mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm'
                            required
                          />
                        </div>
                        <div>
                          <label
                            htmlFor='model'
                            className='block text-sm font-medium text-gray-700'
                          >
                            Model
                          </label>
                          <input
                            id='model'
                            name='model'
                            value={formState.model}
                            onChange={handleFieldChange}
                            className='mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm'
                            required
                          />
                        </div>
                        <div>
                          <label
                            htmlFor='year'
                            className='block text-sm font-medium text-gray-700'
                          >
                            Year
                          </label>
                          <input
                            id='year'
                            name='year'
                            type='number'
                            value={formState.year}
                            onChange={handleFieldChange}
                            className='mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm'
                          />
                        </div>
                        <div>
                          <label
                            htmlFor='vin'
                            className='block text-sm font-medium text-gray-700'
                          >
                            VIN
                          </label>
                          <input
                            id='vin'
                            name='vin'
                            value={formState.vin}
                            onChange={handleFieldChange}
                            className='mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm'
                          />
                        </div>
                        <div>
                          <label
                            htmlFor='plate'
                            className='block text-sm font-medium text-gray-700'
                          >
                            Plate
                          </label>
                          <input
                            id='plate'
                            name='plate'
                            value={formState.plate}
                            onChange={handleFieldChange}
                            className='mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm'
                          />
                        </div>
                        <div>
                          <label
                            htmlFor='tires'
                            className='block text-sm font-medium text-gray-700'
                          >
                            Tires
                          </label>
                          <input
                            id='tires'
                            name='tires'
                            value={formState.tires}
                            onChange={handleFieldChange}
                            className='mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm'
                          />
                        </div>
                      </div>

                      {errorMessage && (
                        <p className='text-sm text-red-500'>{errorMessage}</p>
                      )}

                      <div className='flex flex-wrap gap-3'>
                        <button
                          type='submit'
                          disabled={isSaving}
                          className='inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                          {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          type='button'
                          onClick={() => {
                            setIsEditing(false);
                            setErrorMessage(null);
                            setFormState({
                              make: asset.make ?? '',
                              model: asset.model ?? '',
                              year: asset.year?.toString() ?? '',
                              vin: asset.vin ?? '',
                              plate: asset.plate ?? '',
                              tires: asset.tires ?? '',
                              category: asset.category ?? '',
                            });
                          }}
                          className='inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100'
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className='mt-6 space-y-6'>
                      {detailEntries.length > 0 ? (
                        <dl className='space-y-4'>
                          {detailEntries.map((entry) => (
                            <div
                              key={entry.label}
                              className='grid gap-2 sm:grid-cols-[140px,1fr]'
                            >
                              <dt className='text-sm font-medium text-gray-500'>
                                {entry.label}
                              </dt>
                              <dd className='text-sm text-gray-900'>
                                {entry.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <p className='text-sm text-gray-500'>
                          This asset doesn&apos;t have additional details yet.
                        </p>
                      )}

                      <div className='space-y-3'>
                        <div className='flex items-center justify-between'>
                          <h3 className='text-sm font-semibold text-gray-900'>
                            Description
                          </h3>
                          <button
                            type='button'
                            onClick={handleGenerateDetailedDescription}
                            className='text-sm font-medium text-blue-600 hover:underline disabled:cursor-not-allowed disabled:text-blue-300'
                            disabled={
                              isGeneratingAiDescription || !hasDescriptionPrompt
                            }
                          >
                            {isGeneratingAiDescription
                              ? 'Generating description...'
                              : 'Ask AI for a detailed description'}
                          </button>
                        </div>
                        {hasDescriptionPrompt ? (
                          asset?.description ? (
                            <p className='text-sm text-gray-600 whitespace-pre-line'>
                              {asset.description}
                            </p>
                          ) : (
                            <p className='text-sm text-gray-500'>
                              We&apos;ll use the overview details above to ask
                              AI for more context.
                            </p>
                          )
                        ) : (
                          <p className='text-sm text-gray-500'>
                            Add basic information about this asset to enable AI
                            suggestions.
                          </p>
                        )}
                        {aiDescriptionError && (
                          <p className='text-sm text-red-600'>
                            {aiDescriptionError}
                          </p>
                        )}
                        {aiDescription && (
                          <div className='rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 whitespace-pre-line'>
                            {aiDescription}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </section>

                <section className='rounded-lg border border-gray-200 bg-white p-4 shadow-sm'>
                  <div className='flex items-center justify-between'>
                    <h2 className='text-xl font-semibold text-gray-900'>
                      Quick Info
                    </h2>
                    {!isEditingQuickInfo && (
                      <button
                        type='button'
                        onClick={() => {
                          setIsEditingQuickInfo(true);
                          setQuickInfoError(null);
                        }}
                        className='rounded-md border border-green-400 bg-green-100 px-3 py-1 text-sm font-medium text-green-700 transition hover:bg-green-200'
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {isEditingQuickInfo ? (
                    <form
                      onSubmit={handleQuickInfoSave}
                      className='mt-4 space-y-4'
                    >
                      {quickInfoError && (
                        <p className='text-sm text-red-600'>{quickInfoError}</p>
                      )}
                      <div>
                        <label
                          htmlFor='quickInfoCategory'
                          className='block text-sm font-medium text-gray-700'
                        >
                          Category
                        </label>
                        <input
                          id='quickInfoCategory'
                          name='category'
                          value={quickInfoFormState.category}
                          onChange={handleQuickInfoFieldChange}
                          className='mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm'
                        />
                      </div>
                      <div>
                        <label
                          htmlFor='quickInfoOdometer'
                          className='block text-sm font-medium text-gray-700'
                        >
                          Odometer
                        </label>
                        <input
                          id='quickInfoOdometer'
                          name='odometer'
                          type='number'
                          value={quickInfoFormState.odometer}
                          onChange={handleQuickInfoFieldChange}
                          className='mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm'
                          placeholder='Enter latest reading'
                        />
                      </div>
                      <div>
                        <label
                          htmlFor='quickInfoOilChange'
                          className='block text-sm font-medium text-gray-700'
                        >
                          Last Oil Change
                        </label>
                        <input
                          id='quickInfoOilChange'
                          name='oilChangeDate'
                          type='date'
                          value={quickInfoFormState.oilChangeDate}
                          onChange={handleQuickInfoFieldChange}
                          className='mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm'
                        />
                      </div>
                      <div className='flex items-center gap-3'>
                        <button
                          type='submit'
                          disabled={isSavingQuickInfo}
                          className='inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
                        >
                          {isSavingQuickInfo ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          type='button'
                          onClick={() => {
                            setIsEditingQuickInfo(false);
                            setQuickInfoError(null);
                            setQuickInfoFormState(
                              buildQuickInfoFormState(asset)
                            );
                          }}
                          className='inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100'
                          disabled={isSavingQuickInfo}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <dl className='mt-4 space-y-3 text-sm text-gray-700'>
                      <div className='flex justify-between'>
                        <dt>Category</dt>
                        <dd className='font-medium text-gray-900'>
                          {asset.category || 'Uncategorized'}
                        </dd>
                      </div>
                      <div className='flex justify-between'>
                        <dt>Odometer</dt>
                        <dd>
                          {asset.odometer && asset.odometer.length > 0
                            ? `${
                                asset.odometer[asset.odometer.length - 1]
                                  ?.odometer ?? 'N/A'
                              }`
                            : 'N/A'}
                        </dd>
                      </div>
                      <div className='flex justify-between'>
                        <dt>Oil Change</dt>
                        <dd>
                          {asset.oilChange && asset.oilChange.length > 0
                            ? new Date(
                                asset.oilChange[asset.oilChange.length - 1]
                                  ?.date ?? Date.now()
                              ).toLocaleDateString()
                            : 'N/A'}
                        </dd>
                      </div>
                    </dl>
                  )}
                </section>

                <section className='rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
                  <div className='flex items-center justify-between'>
                    <h2 className='text-xl font-semibold text-gray-900'>
                      Maintenance
                    </h2>
                    {!isEditingMaintenance && (
                      <button
                        type='button'
                        onClick={() => {
                          setIsEditingMaintenance(true);
                          setMaintenanceError(null);
                          if (maintenanceFormState.length === 0) {
                            setMaintenanceFormState([
                              {
                                maintenanceType: '',
                                maintenanceDesc: '',
                                maintenanceEndDate: '',
                              },
                            ]);
                          }
                        }}
                        className='rounded-md border border-green-400 bg-green-100 px-3 py-1 text-sm font-medium text-green-700 transition hover:bg-green-200'
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {isEditingMaintenance ? (
                    <form
                      onSubmit={handleMaintenanceSave}
                      className='mt-4 space-y-4'
                    >
                      {maintenanceError && (
                        <p className='text-sm text-red-600'>
                          {maintenanceError}
                        </p>
                      )}
                      {maintenanceFormState.length > 0 ? (
                        maintenanceFormState.map((entry, index) => (
                          <div
                            key={index}
                            className='space-y-3 rounded-md border border-gray-200 p-4 text-sm text-gray-700'
                          >
                            <div>
                              <label
                                htmlFor={`maintenanceType-${index}`}
                                className='block text-sm font-medium text-gray-700'
                              >
                                Maintenance Type
                              </label>
                              <input
                                id={`maintenanceType-${index}`}
                                value={entry.maintenanceType}
                                onChange={(event) =>
                                  handleMaintenanceFieldChange(
                                    index,
                                    'maintenanceType',
                                    event.target.value
                                  )
                                }
                                className='mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm'
                              />
                            </div>
                            <div>
                              <label
                                htmlFor={`maintenanceDesc-${index}`}
                                className='block text-sm font-medium text-gray-700'
                              >
                                Description
                              </label>
                              <textarea
                                id={`maintenanceDesc-${index}`}
                                value={entry.maintenanceDesc}
                                onChange={(event) =>
                                  handleMaintenanceFieldChange(
                                    index,
                                    'maintenanceDesc',
                                    event.target.value
                                  )
                                }
                                className='mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm'
                                rows={3}
                              />
                            </div>
                            <div>
                              <label
                                htmlFor={`maintenanceDue-${index}`}
                                className='block text-sm font-medium text-gray-700'
                              >
                                Due Date
                              </label>
                              <input
                                id={`maintenanceDue-${index}`}
                                type='date'
                                value={entry.maintenanceEndDate}
                                onChange={(event) =>
                                  handleMaintenanceFieldChange(
                                    index,
                                    'maintenanceEndDate',
                                    event.target.value
                                  )
                                }
                                className='mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm'
                              />
                            </div>
                            <div className='flex justify-end'>
                              <button
                                type='button'
                                onClick={() =>
                                  handleRemoveMaintenanceEntry(index)
                                }
                                className='text-sm font-medium text-red-600 hover:text-red-700'
                                disabled={isSavingMaintenance}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className='text-sm text-gray-500'>
                          No maintenance records yet. Add one below.
                        </p>
                      )}
                      <div className='flex flex-wrap items-center justify-between gap-3'>
                        <button
                          type='button'
                          onClick={handleAddMaintenanceEntry}
                          className='inline-flex items-center rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100'
                          disabled={isSavingMaintenance}
                        >
                          Add Maintenance Item
                        </button>
                      </div>
                      <div className='flex items-center gap-3'>
                        <button
                          type='submit'
                          disabled={isSavingMaintenance}
                          className='inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
                        >
                          {isSavingMaintenance ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          type='button'
                          onClick={() => {
                            setIsEditingMaintenance(false);
                            setMaintenanceError(null);
                            setMaintenanceFormState(
                              buildMaintenanceFormState(asset)
                            );
                          }}
                          className='inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100'
                          disabled={isSavingMaintenance}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : asset.maintenance && asset.maintenance.length > 0 ? (
                    <ul className='mt-4 space-y-3'>
                      {asset.maintenance.map((item, index) => {
                        const parsedDueDate = item.maintenanceEndDate
                          ? new Date(item.maintenanceEndDate)
                          : null;
                        const dueDateLabel =
                          parsedDueDate &&
                          !Number.isNaN(parsedDueDate.getTime())
                            ? parsedDueDate.toLocaleDateString()
                            : 'N/A';

                        return (
                          <li
                            key={index}
                            className='rounded-md border border-gray-200 p-4 text-sm text-gray-700'
                          >
                            <p className='font-medium text-gray-900'>
                              {item.maintenanceType || 'Maintenance Item'}
                            </p>
                            {item.maintenanceDesc && (
                              <p className='mt-1 text-gray-600'>
                                {item.maintenanceDesc}
                              </p>
                            )}
                            <p className='mt-2 text-xs uppercase tracking-wide text-gray-400'>
                              Due: {dueDateLabel}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className='mt-2 text-sm text-gray-500'>
                      No maintenance records have been added for this asset yet.
                    </p>
                  )}
                </section>

                <section className='rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
                  <div className='flex items-center justify-between'>
                    <h2 className='text-xl font-semibold text-gray-900'>
                      Parts to Order
                    </h2>
                    <button
                      type='button'
                      onClick={handleAddPartEntry}
                      disabled={
                        isSavingParts ||
                        isUpdatingPart ||
                        editingPartRowId !== null
                      }
                      className='inline-flex items-center justify-center rounded-full border border-green-400 bg-green-50 p-2 text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50'
                      aria-label='Add part'
                    >
                      <Plus className='h-4 w-4' />
                    </button>
                  </div>
                  {!isEditingParts && updatePartError && (
                    <p className='mt-2 text-sm text-red-600'>
                      {updatePartError}
                    </p>
                  )}
                  {isEditingParts ? (
                    <form onSubmit={handlePartsSave} className='mt-4 space-y-4'>
                      {partsError && (
                        <p className='text-sm text-red-600'>{partsError}</p>
                      )}
                      {partFormState.length > 0 ? (
                        partFormState.map((entry, index) => (
                          <div
                            key={index}
                            className='space-y-3 rounded-md border border-gray-200 p-4 text-sm text-gray-700'
                          >
                            <div>
                              <label
                                htmlFor={`part-name-${index}`}
                                className='block text-sm font-medium text-gray-700'
                              >
                                Part Name
                              </label>
                              <input
                                id={`part-name-${index}`}
                                value={entry.part}
                                onChange={(event) =>
                                  handlePartFieldChange(
                                    index,
                                    'part',
                                    event.target.value
                                  )
                                }
                                className='mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm'
                              />
                            </div>
                            <div>
                              <label
                                htmlFor={`part-type-${index}`}
                                className='block text-sm font-medium text-gray-700'
                              >
                                Part Type
                              </label>
                              <input
                                id={`part-type-${index}`}
                                value={entry.type}
                                onChange={(event) =>
                                  handlePartFieldChange(
                                    index,
                                    'type',
                                    event.target.value
                                  )
                                }
                                className='mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm'
                              />
                            </div>
                            <div>
                              <label
                                htmlFor={`part-url-${index}`}
                                className='block text-sm font-medium text-gray-700'
                              >
                                Amazon URL
                              </label>
                              <input
                                id={`part-url-${index}`}
                                value={entry.url}
                                onChange={(event) =>
                                  handlePartFieldChange(
                                    index,
                                    'url',
                                    event.target.value
                                  )
                                }
                                className='mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm'
                                placeholder='https://'
                              />
                            </div>
                            <div>
                              <label
                                htmlFor={`part-date-${index}`}
                                className='block text-sm font-medium text-gray-700'
                              >
                                Date Needed
                              </label>
                              <input
                                id={`part-date-${index}`}
                                type='date'
                                value={entry.date}
                                onChange={(event) =>
                                  handlePartFieldChange(
                                    index,
                                    'date',
                                    event.target.value
                                  )
                                }
                                className='mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm'
                              />
                            </div>
                            <div className='flex justify-end'>
                              <button
                                type='button'
                                onClick={() => handleRemovePartEntry(index)}
                                className='text-sm font-medium text-red-600 hover:text-red-700'
                                disabled={isSavingParts}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className='text-sm text-gray-500'>
                          No parts yet. Use the plus button to add one.
                        </p>
                      )}
                      <div className='flex items-center gap-3'>
                        <button
                          type='submit'
                          disabled={isSavingParts}
                          className='inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
                        >
                          {isSavingParts ? 'Saving...' : 'Save Parts'}
                        </button>
                        <button
                          type='button'
                          onClick={() => {
                            setIsEditingParts(false);
                            setPartsError(null);
                            setPartFormState([]);
                          }}
                          className='inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100'
                          disabled={isSavingParts}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : partData.length > 0 ? (
                    <div className='mt-4 overflow-x-auto'>
                      <table className='min-w-full divide-y divide-gray-200 text-sm'>
                        <thead className='bg-gray-50'>
                          {partTable.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                              {headerGroup.headers.map((header) => (
                                <th
                                  key={header.id}
                                  scope='col'
                                  className='px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500'
                                >
                                  {header.isPlaceholder
                                    ? null
                                    : flexRender(
                                        header.column.columnDef.header,
                                        header.getContext()
                                      )}
                                </th>
                              ))}
                            </tr>
                          ))}
                        </thead>
                        <tbody className='divide-y divide-gray-200'>
                          {partTable.getRowModel().rows.map((row) => (
                            <tr key={row.id} className='hover:bg-gray-50'>
                              {row.getVisibleCells().map((cell) => (
                                <td
                                  key={cell.id}
                                  className='px-4 py-3 text-gray-700'
                                >
                                  {flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext()
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className='mt-2 text-sm text-gray-500'>
                      No parts are currently tracked for this asset.
                    </p>
                  )}
                </section>
              </div>
            ) : (
              <div className='rounded-lg border border-gray-200 bg-white p-10 text-center shadow-sm'>
                <h2 className='text-xl font-semibold text-gray-900'>
                  Asset not found
                </h2>
                <p className='mt-2 text-sm text-gray-500'>
                  We couldn&apos;t locate details for this asset. It may have
                  been removed.
                </p>
                <Link
                  href='/home'
                  className='mt-6 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700'
                >
                  Return to My Assets
                </Link>
              </div>
            )}
          </div>
        </div>
      </Layout>
      {isDeleteModalOpen && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 px-4'
          role='dialog'
          aria-modal='true'
          aria-labelledby='delete-asset-title'
        >
          <div className='w-full max-w-md rounded-lg bg-white p-6 shadow-xl'>
            <h2
              id='delete-asset-title'
              className='text-lg font-semibold text-gray-900'
            >
              Delete asset?
            </h2>
            <p className='mt-2 text-sm text-gray-600'>
              Are you sure you want to delete this asset? This action cannot be
              undone.
            </p>
            <div className='mt-6 flex justify-end gap-3'>
              <button
                type='button'
                onClick={handleCancelDelete}
                disabled={isDeleting}
                className='inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={handleDeleteAsset}
                disabled={isDeleting}
                className='inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50'
              >
                {isDeleting ? 'Deleting...' : 'Delete Asset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
