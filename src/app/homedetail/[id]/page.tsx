// src/app/homedetail/[id]/page.tsx
'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
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
import { useRouter, useSearchParams } from 'next/navigation';
import { onValue, ref, remove, set, update } from 'firebase/database';
import Layout from '../../../components/layout/Layout';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../lib/firebase';
import {
  Vehicle,
  type Maintenance,
  type Part,
  type Video,
} from '../../../models/Vehicle';
import { Calendar, Check, Pencil, Plus, Trash2, X, Play } from 'lucide-react';

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
  url: string;
  date: string;
}

interface VideoFormEntry {
  name: string;
  url: string;
}

interface GenerateDescriptionResponse {
  result?: string;
  attempts?: number;
  maxAttempts?: number;
  partial?: boolean;
  error?: string;
}

interface QuickInfoRow {
  id: string;
  event: string;
  reading: string;
  date: string;
  source: 'odometer' | 'oilChange';
  sourceIndex: number;
  rawReading: number | null;
  rawDate: string;
}

type OverviewDetailColumn = 'primary' | 'secondary';

interface OverviewDetailEntry {
  label: string;
  value: string;
  column: OverviewDetailColumn;
  alwaysShow?: boolean;
  placeholder?: string;
  displayValue?: string;
}

const MAX_AI_GENERATION_ATTEMPTS = 3;
const AI_RETRY_DELAY_MS = 800;

export default function HomeDetailPage({ params }: PageProps) {
  const { id } = params;
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
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
    tireSize: '',
    tirePressure: '',
    oilType: '',
    category: searchParams.get('category') ?? '',
    warranty: false,
    warrantyNumber: '',
    warrantyPhone: '',
    warrantyNotes: '',
    warrantyExpiry: '',
    insuranceCompany: '',
    insurancePolicyNumber: '',
    insuranceExpirationDate: '',
  });
  const [quickInfoError, setQuickInfoError] = useState<string | null>(null);
  const [editingQuickInfoRowId, setEditingQuickInfoRowId] = useState<
    string | null
  >(null);
  const [quickInfoRowDraft, setQuickInfoRowDraft] = useState({
    reading: '',
    date: '',
  });
  const [isSavingQuickInfoRow, setIsSavingQuickInfoRow] = useState(false);
  const [isQuickInfoAddMenuOpen, setIsQuickInfoAddMenuOpen] = useState(false);
  const [quickInfoAddType, setQuickInfoAddType] = useState<
    'odometer' | 'oilChange' | null
  >(null);
  const [quickInfoAddForm, setQuickInfoAddForm] = useState({
    reading: '',
    date: '',
  });
  const [isSavingQuickInfoAddition, setIsSavingQuickInfoAddition] =
    useState(false);
  const [isDeletingQuickInfoRow, setIsDeletingQuickInfoRow] = useState(false);
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
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [partFormState, setPartFormState] = useState<PartFormEntry[]>([]);
  const [editingPartRowId, setEditingPartRowId] = useState<number | null>(null);
  const [editingPartDraft, setEditingPartDraft] =
    useState<PartFormEntry | null>(null);

  // Videos state
  const [videoAddUrl, setVideoAddUrl] = useState('');
  const [videoAddTitle, setVideoAddTitle] = useState('');
  const [videoAddError, setVideoAddError] = useState<string | null>(null);
  const [isAddingVideo, setIsAddingVideo] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [editingVideoRowId, setEditingVideoRowId] = useState<number | null>(
    null
  );
  const [editingVideoDraft, setEditingVideoDraft] =
    useState<VideoFormEntry | null>(null);
  const [isUpdatingVideo, setIsUpdatingVideo] = useState(false);
  const [updateVideoError, setUpdateVideoError] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [isUpdatingPart, setIsUpdatingPart] = useState(false);
  const [updatePartError, setUpdatePartError] = useState<string | null>(null);
  const [partSorting, setPartSorting] = useState<SortingState>([]);
  const [quickInfoSorting, setQuickInfoSorting] = useState<SortingState>([]);
  const [videoSorting, setVideoSorting] = useState<SortingState>([]);
  const [aiDescription, setAiDescription] = useState<string | null>(null);
  const [isGeneratingAiDescription, setIsGeneratingAiDescription] =
    useState(false);
  const [aiDescriptionError, setAiDescriptionError] = useState<string | null>(
    null
  );
  const [aiGenerationStats, setAiGenerationStats] = useState<{
    attempts: number;
    maxAttempts: number;
  } | null>(null);
  const [descriptionSourceOverride, setDescriptionSourceOverride] = useState<
    string | null
  >(null);
  const [activeAiPartName, setActiveAiPartName] = useState<string | null>(null);
  const [deleteModalMode, setDeleteModalMode] = useState<
    'asset' | 'part' | 'quickInfo' | 'video' | null
  >(null);
  const [pendingPartDeleteIndex, setPendingPartDeleteIndex] = useState<
    number | null
  >(null);
  const [pendingPartDeleteName, setPendingPartDeleteName] = useState<
    string | null
  >(null);
  const [pendingQuickInfoDeleteRow, setPendingQuickInfoDeleteRow] =
    useState<QuickInfoRow | null>(null);

  const [pendingVideoDeleteIndex, setPendingVideoDeleteIndex] = useState<
    number | null
  >(null);
  const [pendingVideoDeleteName, setPendingVideoDeleteName] = useState<
    string | null
  >(null);
  const [pendingVideoDeleteKey, setPendingVideoDeleteKey] = useState<
    string | null
  >(null);

  // Part notes modal state
  const [isPartNoteModalOpen, setIsPartNoteModalOpen] = useState(false);
  const [activePartNoteIndex, setActivePartNoteIndex] = useState<number | null>(
    null
  );
  const [partNoteDraft, setPartNoteDraft] = useState('');
  const [partNoteError, setPartNoteError] = useState<string | null>(null);
  const [isSavingPartNote, setIsSavingPartNote] = useState(false);

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
        tireSize: '',
        tirePressure: '',
        oilType: '',
        category: searchParams.get('category') ?? '',
        warranty: false,
        warrantyNumber: '',
        warrantyPhone: '',
        warrantyNotes: '',
        warrantyExpiry: '',
        insuranceCompany: '',
        insurancePolicyNumber: '',
        insuranceExpirationDate: '',
      });
      setMaintenanceFormState([]);
      setEditingQuickInfoRowId(null);
      setQuickInfoRowDraft({ reading: '', date: '' });
      setIsSavingQuickInfoRow(false);
      setIsEditingMaintenance(searchParams.get('edit') === 'maintenance');
      setIsEditingParts(false);
      setIsEditingNotes(false);
      setIsSavingNotes(false);
      setNotesError(null);
      setNotesDraft('');
      setIsNotesExpanded(false);
      setQuickInfoError(null);
      setIsQuickInfoAddMenuOpen(false);
      setQuickInfoAddType(null);
      setQuickInfoAddForm({ reading: '', date: '' });
      setIsSavingQuickInfoAddition(false);
      setIsDeletingQuickInfoRow(false);
      setMaintenanceError(null);
      setIsDeleting(false);
      setPartFormState([]);
      setPartsError(null);
      setEditingPartRowId(null);
      setEditingPartDraft(null);
      setIsUpdatingPart(false);
      setUpdatePartError(null);
      setPartSorting([]);
      setQuickInfoSorting([]);
      setIsDeleteModalOpen(false);
      setDeleteModalMode(null);
      setPendingPartDeleteIndex(null);
      setPendingPartDeleteName(null);
      setPendingQuickInfoDeleteRow(null);
      // Reset videos state
      setVideoAddUrl('');
      setVideoAddTitle('');
      setVideoAddError(null);
      setIsAddingVideo(false);
      setSelectedVideoId(null);
      setEditingVideoRowId(null);
      setEditingVideoDraft(null);
      setIsUpdatingVideo(false);
      setUpdateVideoError(null);
      setVideoSorting([]);
      setPendingVideoDeleteIndex(null);
      setPendingVideoDeleteName(null);
      setPendingVideoDeleteKey(null);
      return;
    }

    setFormState({
      make: asset.make ?? '',
      model: asset.model ?? '',
      year: asset.year?.toString() ?? '',
      vin: asset.vin ?? '',
      plate: asset.plate ?? '',
      tires: asset.tires ?? '',
      tireSize: asset.tireSize ?? '',
      tirePressure: asset.tirePressure ?? '',
      oilType: asset.oilType ?? '',
      category: asset.category ?? searchParams.get('category') ?? '',
      warranty: Boolean(asset.warranty),
      warrantyNumber: asset.warrantyNumber ?? '',
      warrantyPhone: asset.warrantyPhone ?? '',
      warrantyNotes: asset.warrantyNotes ?? '',
      warrantyExpiry:
        asset.warrantyExpiry &&
        !Number.isNaN(new Date(asset.warrantyExpiry as any).getTime())
          ? new Date(asset.warrantyExpiry as any).toISOString().split('T')[0]
          : '',
      insuranceCompany: asset.insuranceCompany ?? '',
      insurancePolicyNumber: asset.insurancePolicyNumber ?? '',
      insuranceExpirationDate:
        asset.insuranceExpirationDate &&
        !Number.isNaN(new Date(asset.insuranceExpirationDate as any).getTime())
          ? new Date(asset.insuranceExpirationDate as any)
              .toISOString()
              .split('T')[0]
          : '',
    });
    const nextMaintenanceState = buildMaintenanceFormState(asset);
    if (
      searchParams.get('edit') === 'maintenance' &&
      nextMaintenanceState.length === 0
    ) {
      setMaintenanceFormState([
        { maintenanceType: '', maintenanceDesc: '', maintenanceEndDate: '' },
      ]);
    } else {
      setMaintenanceFormState(nextMaintenanceState);
    }
    setEditingQuickInfoRowId(null);
    setQuickInfoRowDraft({ reading: '', date: '' });
    setIsSavingQuickInfoRow(false);
    setIsEditingMaintenance(searchParams.get('edit') === 'maintenance');
    setIsEditingParts(false);
    setIsEditingNotes(false);
    setIsSavingNotes(false);
    setNotesError(null);
    setNotesDraft(asset.notes ?? '');
    setIsNotesExpanded(false);
    setQuickInfoError(null);
    setIsQuickInfoAddMenuOpen(false);
    setQuickInfoAddType(null);
    setQuickInfoAddForm({ reading: '', date: '' });
    setIsSavingQuickInfoAddition(false);
    setIsDeletingQuickInfoRow(false);
    setMaintenanceError(null);
    setIsDeleting(false);
    setPartFormState([]);
    setPartsError(null);
    setEditingPartRowId(null);
    setEditingPartDraft(null);
    setIsUpdatingPart(false);
    setUpdatePartError(null);
    setIsDeleteModalOpen(false);
    setDeleteModalMode(null);
    setPendingPartDeleteIndex(null);
    setPendingPartDeleteName(null);
    setPendingQuickInfoDeleteRow(null);
    // Initialize videos state
    setVideoAddUrl('');
    setVideoAddTitle('');
    setVideoAddError(null);
    setIsAddingVideo(false);
    setEditingVideoRowId(null);
    setEditingVideoDraft(null);
    setIsUpdatingVideo(false);
    setUpdateVideoError(null);
    setVideoSorting([]);
    setPendingVideoDeleteIndex(null);
    setPendingVideoDeleteName(null);
    setPendingVideoDeleteKey(null);
    // Do not auto-select a YouTube video by default.
    setSelectedVideoId(null);
  }, [asset]);

  // Open the Part Note modal for a specific row
  const openPartNoteModal = useCallback(
    (index: number) => {
      setPartNoteError(null);
      setActivePartNoteIndex(index);
      const existing = asset?.partNumber?.[index]?.note ?? '';
      setPartNoteDraft(typeof existing === 'string' ? existing : '');
      setIsPartNoteModalOpen(true);
    },
    [asset]
  );

  // Save the Part Note for the active row
  const handleSavePartNote = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!asset || !currentUser || activePartNoteIndex === null) return;
      if (isSavingPartNote) return;

      setIsSavingPartNote(true);
      setPartNoteError(null);
      try {
        const trimmed = partNoteDraft.trim();
        const noteRef = ref(
          db,
          `assets/${currentUser.UserId}/${id}/partNumber/${activePartNoteIndex}`
        );
        await update(noteRef, { note: trimmed ? trimmed : null });
        setIsPartNoteModalOpen(false);
        setActivePartNoteIndex(null);
      } catch (error) {
        console.error('Failed to save part note', error);
        setPartNoteError('Unable to save note. Please try again.');
      } finally {
        setIsSavingPartNote(false);
      }
    },
    [
      asset,
      currentUser,
      id,
      activePartNoteIndex,
      isSavingPartNote,
      partNoteDraft,
    ]
  );

  // Scroll maintenance section into view when linked with ?edit=maintenance
  useEffect(() => {
    if (searchParams.get('edit') === 'maintenance') {
      if (typeof window !== 'undefined') {
        const section = document.getElementById('maintenance-section');
        section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [asset, searchParams]);

  // Load Pro membership from localStorage (set by subscription flow)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem(
        'assetmanagement-settings-preferences'
      );
      if (!saved) {
        setIsPro(false);
        return;
      }
      const parsed = JSON.parse(saved);
      setIsPro(Boolean(parsed?.proPlanActive));
    } catch {
      setIsPro(false);
    }
  }, []);

  const handleRecallClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (!isPro) {
        event.preventDefault();
        router.push('/asset-manager-pro');
      }
    },
    [isPro, router]
  );

  // Helpers: YouTube ID extractor
  const extractYouTubeId = (input: string): string | null => {
    const url = input?.trim();
    if (!url) return null;
    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      // youtu.be/<id>
      if (host.includes('youtu.be')) {
        const parts = u.pathname.split('/').filter(Boolean);
        return parts[0] || null;
      }
      // youtube.com URLs
      if (host.includes('youtube.com')) {
        // /watch?v=<id>
        if (u.pathname.startsWith('/watch')) {
          const v = u.searchParams.get('v');
          if (v) return v;
        }
        const parts = u.pathname.split('/').filter(Boolean);
        // /embed/<id>
        const embedIndex = parts.indexOf('embed');
        if (embedIndex !== -1 && parts[embedIndex + 1]) {
          return parts[embedIndex + 1];
        }
        // /shorts/<id>
        const shortsIndex = parts.indexOf('shorts');
        if (shortsIndex !== -1 && parts[shortsIndex + 1]) {
          return parts[shortsIndex + 1];
        }
      }
      return null;
    } catch {
      return null;
    }
  };

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

      // Build a shallow patch and use update() to avoid overwriting unrelated fields.
      const toIsoOrNull = (v: string): string | null => {
        if (!v) return null;
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
      };

      const warrantyOn = Boolean(formState.warranty);
      const patch: Record<string, unknown> = {
        make: formState.make.trim(),
        model: formState.model.trim(),
        year: formState.year ? Number(formState.year) : null,
        vin: formState.vin.trim(),
        plate: formState.plate.trim(),
        tires: formState.tires.trim(),
        tireSize: formState.tireSize.trim(),
        tirePressure: formState.tirePressure.trim(),
        oilType: formState.oilType.trim(),
        category: formState.category.trim(),
        warranty: warrantyOn,
        warrantyNumber: warrantyOn
          ? formState.warrantyNumber.trim() || null
          : null,
        warrantyPhone: warrantyOn
          ? formState.warrantyPhone.trim() || null
          : null,
        warrantyNotes: warrantyOn
          ? formState.warrantyNotes.trim() || null
          : null,
        warrantyExpiry: warrantyOn
          ? toIsoOrNull(formState.warrantyExpiry)
          : null,
        insuranceCompany: formState.insuranceCompany.trim(),
        insurancePolicyNumber: formState.insurancePolicyNumber.trim(),
        insuranceExpirationDate: toIsoOrNull(formState.insuranceExpirationDate),
      };

      await update(targetRef, patch);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update asset', error);
      setErrorMessage('Unable to save changes. Please try again.');
    } finally {
      setIsSaving(false);
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
    setDeleteModalMode('asset');
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
      setDeleteModalMode(null);
      router.push('/home');
    } catch (error) {
      console.error('Failed to delete asset', error);
      setErrorMessage('Unable to delete this asset. Please try again later.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    if (deleteModalMode === 'asset' && isDeleting) {
      return;
    }
    if (deleteModalMode === 'part' && isUpdatingPart) {
      return;
    }
    if (deleteModalMode === 'quickInfo' && isDeletingQuickInfoRow) {
      return;
    }
    if (deleteModalMode === 'video' && isUpdatingVideo) {
      return;
    }
    setIsDeleteModalOpen(false);
    setDeleteModalMode(null);
    setPendingPartDeleteIndex(null);
    setPendingPartDeleteName(null);
    setPendingQuickInfoDeleteRow(null);
    setPendingVideoDeleteIndex(null);
    setPendingVideoDeleteName(null);
    setPendingVideoDeleteKey(null);
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

  const openPartDeleteModal = useCallback(
    (index: number) => {
      if (isUpdatingPart) return;
      setUpdatePartError(null);

      const targetPart = asset?.partNumber?.[index] ?? null;
      const partLabel =
        targetPart?.part?.trim() || targetPart?.type?.trim() || null;

      setPendingPartDeleteIndex(index);
      setPendingPartDeleteName(partLabel);
      setDeleteModalMode('part');
      setIsDeleteModalOpen(true);
    },
    [asset, isUpdatingPart]
  );

  const handleAddPartEntry = () => {
    setIsEditingParts(true);
    setPartsError(null);
    setEditingPartRowId(null);
    setEditingPartDraft(null);
    setUpdatePartError(null);
    setPartFormState((prev) => {
      const base = isEditingParts ? prev : [];
      return [...base, { part: '', url: '', date: '' }];
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

  const handleNotesSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser || !asset) return;

    setIsSavingNotes(true);
    setNotesError(null);
    try {
      const targetRef = ref(db, `assets/${currentUser.UserId}/${id}`);
      const updatedAsset: Vehicle & Record<string, unknown> = {
        ...asset,
        notes: notesDraft.trim() ? notesDraft.trim() : undefined,
      };
      const sanitizedAsset = JSON.parse(JSON.stringify(updatedAsset));
      await set(targetRef, sanitizedAsset);
      setIsEditingNotes(false);
      setIsNotesModalOpen(false);
    } catch (error) {
      console.error('Failed to save notes', error);
      setNotesError('Unable to save notes. Please try again.');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handlePartsSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser || !asset) return;

    const sanitizedEntries: Part[] = [];
    for (const entry of partFormState) {
      const trimmedPart = entry.part.trim();
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

      if (trimmedPart || trimmedUrl || isoDate) {
        sanitizedEntries.push({
          part: trimmedPart || undefined,
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

      const sanitizedAsset = JSON.parse(JSON.stringify(updatedAsset));
      await set(targetRef, sanitizedAsset);
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

      if (!trimmedPart && !trimmedUrl && !isoDate) {
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
          ...updatedParts[index],
          part: trimmedPart || undefined,
          url: trimmedUrl || undefined,
          date: isoDate,
        };

        const targetRef = ref(db, `assets/${currentUser.UserId}/${id}`);
        const updatedAsset = { ...asset, partNumber: updatedParts } as Vehicle &
          Record<string, unknown>;
        const sanitizedAsset = JSON.parse(JSON.stringify(updatedAsset));
        await set(targetRef, sanitizedAsset);

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

  const handleDeleteQuickInfoRow = useCallback(
    async (row: QuickInfoRow) => {
      if (!asset || !currentUser || isDeletingQuickInfoRow) {
        return;
      }

      setIsDeletingQuickInfoRow(true);
      setQuickInfoError(null);

      try {
        const odometerEntries = [...(asset.odometer ?? [])];
        const oilChangeEntries = [...(asset.oilChange ?? [])];

        if (row.source === 'odometer') {
          if (!odometerEntries[row.sourceIndex]) {
            setQuickInfoError(
              'Unable to locate this odometer record. Please refresh and try again.'
            );
            setIsDeletingQuickInfoRow(false);
            return;
          }
          odometerEntries.splice(row.sourceIndex, 1);
        } else {
          if (!oilChangeEntries[row.sourceIndex]) {
            setQuickInfoError(
              'Unable to locate this oil change record. Please refresh and try again.'
            );
            setIsDeletingQuickInfoRow(false);
            return;
          }
          oilChangeEntries.splice(row.sourceIndex, 1);
        }

        const targetRef = ref(db, `assets/${currentUser.UserId}/${id}`);
        const updatedAsset: Vehicle & Record<string, unknown> = {
          ...asset,
          odometer: odometerEntries.length > 0 ? odometerEntries : undefined,
          oilChange: oilChangeEntries.length > 0 ? oilChangeEntries : undefined,
        };

        const sanitizedAsset = JSON.parse(
          JSON.stringify(updatedAsset)
        ) as Vehicle;

        await set(targetRef, sanitizedAsset);
        setAsset(sanitizedAsset);
        if (editingQuickInfoRowId === row.id) {
          setEditingQuickInfoRowId(null);
          setQuickInfoRowDraft({ reading: '', date: '' });
        }
        setPendingQuickInfoDeleteRow(null);
        setDeleteModalMode(null);
        setIsDeleteModalOpen(false);
      } catch (error) {
        console.error('Failed to delete quick info entry', error);
        setQuickInfoError('Unable to delete this entry. Please try again.');
      } finally {
        setIsDeletingQuickInfoRow(false);
      }
    },
    [
      asset,
      currentUser,
      id,
      isDeletingQuickInfoRow,
      editingQuickInfoRowId,
      setAsset,
      setEditingQuickInfoRowId,
      setQuickInfoRowDraft,
      setQuickInfoError,
    ]
  );

  const openQuickInfoAddForm = useCallback((type: 'odometer' | 'oilChange') => {
    setQuickInfoError(null);
    setQuickInfoAddForm({ reading: '', date: '' });
    setQuickInfoAddType(type);
    setIsQuickInfoAddMenuOpen(false);
    setEditingQuickInfoRowId(null);
    setQuickInfoRowDraft({ reading: '', date: '' });
  }, []);

  const openQuickInfoDeleteModal = useCallback(
    (row: QuickInfoRow) => {
      if (isDeletingQuickInfoRow) return;
      setQuickInfoError(null);
      setQuickInfoAddType(null);
      setQuickInfoAddForm({ reading: '', date: '' });
      setIsQuickInfoAddMenuOpen(false);
      if (editingQuickInfoRowId === row.id) {
        setEditingQuickInfoRowId(null);
        setQuickInfoRowDraft({ reading: '', date: '' });
      }
      setPendingQuickInfoDeleteRow(row);
      setDeleteModalMode('quickInfo');
      setIsDeleteModalOpen(true);
    },
    [editingQuickInfoRowId, isDeletingQuickInfoRow]
  );

  const handleQuickInfoAddFieldChange = useCallback(
    (field: 'reading' | 'date', value: string) => {
      setQuickInfoAddForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleQuickInfoAddCancel = useCallback(() => {
    if (isSavingQuickInfoAddition) return;
    setQuickInfoAddType(null);
    setQuickInfoAddForm({ reading: '', date: '' });
    setQuickInfoError(null);
    setIsQuickInfoAddMenuOpen(false);
  }, [isSavingQuickInfoAddition]);

  const handleQuickInfoAddSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!asset || !currentUser || !quickInfoAddType) {
        return;
      }

      const trimmedReading = quickInfoAddForm.reading.trim();
      const trimmedDate = quickInfoAddForm.date.trim();

      if (!trimmedDate) {
        setQuickInfoError('Please provide a date for this entry.');
        return;
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
        setQuickInfoError('Please provide a valid date.');
        return;
      }
      const parsedTimestamp = Date.parse(`${trimmedDate}T00:00:00Z`);
      if (Number.isNaN(parsedTimestamp)) {
        setQuickInfoError('Please provide a valid date.');
        return;
      }
      const isoDate = `${trimmedDate}T00:00:00.000Z`;

      let numericReading: number | undefined;
      if (trimmedReading) {
        const numeric = Number(trimmedReading);
        if (Number.isNaN(numeric)) {
          setQuickInfoError('Odometer reading must be a valid number.');
          return;
        }
        numericReading = numeric;
      }

      if (quickInfoAddType === 'odometer' && numericReading === undefined) {
        setQuickInfoError('Odometer reading is required for this entry.');
        return;
      }

      setIsSavingQuickInfoAddition(true);
      setQuickInfoError(null);

      try {
        const odometerEntries = [...(asset.odometer ?? [])];
        const oilChangeEntries = [...(asset.oilChange ?? [])];

        if (quickInfoAddType === 'odometer') {
          odometerEntries.push({
            odometer: numericReading,
            date: isoDate,
          });
        } else {
          oilChangeEntries.push({
            date: isoDate,
            odometer: numericReading,
          });
        }

        const targetRef = ref(db, `assets/${currentUser.UserId}/${id}`);
        const updatedAsset: Vehicle & Record<string, unknown> = {
          ...asset,
          odometer: odometerEntries.length > 0 ? odometerEntries : undefined,
          oilChange: oilChangeEntries.length > 0 ? oilChangeEntries : undefined,
        };

        const sanitizedAsset = JSON.parse(
          JSON.stringify(updatedAsset)
        ) as Vehicle;

        await set(targetRef, sanitizedAsset);
        setAsset(sanitizedAsset);
        setQuickInfoAddType(null);
        setQuickInfoAddForm({ reading: '', date: '' });
      } catch (error) {
        console.error('Failed to add quick info entry', error);
        setQuickInfoError('Unable to add this entry. Please try again.');
      } finally {
        setIsSavingQuickInfoAddition(false);
      }
    },
    [
      asset,
      currentUser,
      id,
      quickInfoAddForm.date,
      quickInfoAddForm.reading,
      quickInfoAddType,
    ]
  );

  const startEditingQuickInfoRow = useCallback(
    (row: QuickInfoRow) => {
      if (isSavingQuickInfoRow || isDeletingQuickInfoRow) {
        return;
      }
      setQuickInfoError(null);
      setEditingQuickInfoRowId(row.id);
      setQuickInfoRowDraft({
        reading: row.rawReading !== null ? String(row.rawReading) : '',
        date: row.rawDate,
      });
      setQuickInfoAddType(null);
      setQuickInfoAddForm({ reading: '', date: '' });
      setIsQuickInfoAddMenuOpen(false);
    },
    [isDeletingQuickInfoRow, isSavingQuickInfoRow]
  );

  const cancelEditingQuickInfoRow = useCallback(() => {
    if (isSavingQuickInfoRow) return;
    setEditingQuickInfoRowId(null);
    setQuickInfoRowDraft({ reading: '', date: '' });
    setQuickInfoError(null);
  }, [isSavingQuickInfoRow]);

  const handleQuickInfoRowDraftChange = useCallback(
    (field: 'reading' | 'date', value: string) => {
      setQuickInfoRowDraft((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const saveQuickInfoRow = useCallback(
    async (row: QuickInfoRow) => {
      if (
        !asset ||
        !currentUser ||
        editingQuickInfoRowId !== row.id ||
        isSavingQuickInfoRow
      ) {
        return;
      }

      const trimmedReading = quickInfoRowDraft.reading.trim();
      const trimmedDate = quickInfoRowDraft.date.trim();

      if (!trimmedDate) {
        setQuickInfoError('Please provide a date for this entry.');
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
        setQuickInfoError('Please provide a valid date.');
        return;
      }
      const parsedTimestamp = Date.parse(`${trimmedDate}T00:00:00Z`);
      if (Number.isNaN(parsedTimestamp)) {
        setQuickInfoError('Please provide a valid date.');
        return;
      }
      const isoDate = `${trimmedDate}T00:00:00.000Z`;

      let numericReading: number | undefined;
      if (trimmedReading) {
        const numeric = Number(trimmedReading);
        if (Number.isNaN(numeric)) {
          setQuickInfoError('Odometer reading must be a valid number.');
          return;
        }
        numericReading = numeric;
      }

      if (row.source === 'odometer' && numericReading === undefined) {
        setQuickInfoError('Odometer reading is required for this entry.');
        return;
      }

      setIsSavingQuickInfoRow(true);
      setQuickInfoError(null);

      try {
        const odometerEntries = [...(asset.odometer ?? [])];
        const oilChangeEntries = [...(asset.oilChange ?? [])];

        if (row.source === 'odometer') {
          if (!odometerEntries[row.sourceIndex]) {
            setQuickInfoError(
              'Unable to locate this odometer record. Please refresh and try again.'
            );
            return;
          }
          const nextEntry: Record<string, unknown> = {
            ...odometerEntries[row.sourceIndex],
          };
          nextEntry.odometer = numericReading;
          nextEntry.date = isoDate;
          odometerEntries[row.sourceIndex] = nextEntry;
        } else {
          if (!oilChangeEntries[row.sourceIndex]) {
            setQuickInfoError(
              'Unable to locate this oil change record. Please refresh and try again.'
            );
            return;
          }
          const nextEntry: Record<string, unknown> = {
            ...oilChangeEntries[row.sourceIndex],
          };
          nextEntry.date = isoDate;
          if (numericReading !== undefined) {
            nextEntry.odometer = numericReading;
          } else {
            delete nextEntry.odometer;
          }
          oilChangeEntries[row.sourceIndex] = nextEntry;
        }

        const targetRef = ref(db, `assets/${currentUser.UserId}/${id}`);
        const updatedAsset: Vehicle & Record<string, unknown> = {
          ...asset,
          odometer: odometerEntries.length > 0 ? odometerEntries : undefined,
          oilChange: oilChangeEntries.length > 0 ? oilChangeEntries : undefined,
        };

        const sanitizedAsset = JSON.parse(
          JSON.stringify(updatedAsset)
        ) as Vehicle;

        await set(targetRef, sanitizedAsset);
        setAsset(sanitizedAsset);
        setEditingQuickInfoRowId(null);
        setQuickInfoRowDraft({ reading: '', date: '' });
      } catch (error) {
        console.error('Failed to update quick info entry', error);
        setQuickInfoError('Unable to save this entry. Please try again.');
      } finally {
        setIsSavingQuickInfoRow(false);
      }
    },
    [
      asset,
      currentUser,
      editingQuickInfoRowId,
      id,
      isSavingQuickInfoRow,
      quickInfoRowDraft.date,
      quickInfoRowDraft.reading,
    ]
  );

  const numberFormatter = useMemo(() => new Intl.NumberFormat(), []);

  const quickInfoVehicleLabel = useMemo(() => {
    if (!asset) return 'Vehicle';

    const parts = [asset.year, asset.make, asset.model]
      .filter(
        (value) =>
          value !== undefined &&
          value !== null &&
          String(value).trim().length > 0
      )
      .map((value) => String(value).trim());

    if (parts.length > 0) {
      return parts.join(' ');
    }

    if (asset.vin && asset.vin.trim().length > 0) {
      return asset.vin.trim();
    }

    return asset.category?.trim() || 'Vehicle';
  }, [asset]);

  const headerModelYear = useMemo(() => {
    if (!asset) return '';

    const parts = [asset.model, asset.year]
      .filter(
        (value) =>
          value !== undefined &&
          value !== null &&
          String(value).trim().length > 0
      )
      .map((value) => String(value).trim());

    return parts.join(' / ');
  }, [asset]);

  const quickInfoRows = useMemo<QuickInfoRow[]>(() => {
    if (!asset) return [];

    const formatReading = (value: unknown): string => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return numberFormatter.format(value);
      }

      if (
        typeof value === 'string' &&
        value.trim().length > 0 &&
        !Number.isNaN(Number(value))
      ) {
        return numberFormatter.format(Number(value));
      }

      return 'N/A';
    };

    const toInputDate = (input: unknown): string => {
      if (input === null || input === undefined || input === '') {
        return '';
      }

      if (typeof input === 'string') {
        const match = input.match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/);
        if (match) {
          return match[1];
        }
      }

      const parsed =
        input instanceof Date ? input : new Date(input as string | number);

      if (Number.isNaN(parsed.getTime())) {
        return '';
      }

      return parsed.toISOString().split('T')[0] ?? '';
    };

    const formatWithUtc = (date: Date) =>
      new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(date);

    const formatDate = (input: unknown): string => {
      const inputDate = toInputDate(input);
      if (!inputDate) {
        return 'N/A';
      }
      const [year, month, day] = inputDate.split('-').map(Number);
      if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
        return 'N/A';
      }
      return formatWithUtc(new Date(Date.UTC(year, month - 1, day)));
    };

    const resolveNumeric = (value: unknown): number | null => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (
        typeof value === 'string' &&
        value.trim().length > 0 &&
        !Number.isNaN(Number(value))
      ) {
        return Number(value);
      }
      return null;
    };

    const rows: QuickInfoRow[] = [];

    (asset.odometer ?? []).forEach((entry, index) => {
      const rawReading = resolveNumeric(entry.odometer);
      const rawDate = toInputDate(entry.date ?? entry.reading);

      rows.push({
        id: `odometer-${index}`,
        event: entry.type?.trim() || 'Odometer Reading',
        reading: formatReading(entry.odometer),
        date: formatDate(entry.date ?? entry.reading),
        source: 'odometer',
        sourceIndex: index,
        rawReading,
        rawDate,
      });
    });

    (asset.oilChange ?? []).forEach((entry, index) => {
      const rawReading = resolveNumeric(entry.odometer);
      const rawDate = toInputDate(entry.date);

      rows.push({
        id: `oil-change-${index}`,
        event: 'Oil Change',
        reading: formatReading(entry.odometer),
        date: formatDate(entry.date),
        source: 'oilChange',
        sourceIndex: index,
        rawReading,
        rawDate,
      });
    });

    return rows;
  }, [asset, numberFormatter]);

  const quickInfoColumns = useMemo<ColumnDef<QuickInfoRow>[]>(() => {
    const sortingIndicator = (direction: 'asc' | 'desc' | false) => {
      if (direction === 'asc') return '^';
      if (direction === 'desc') return 'v';
      return '';
    };

    const formatNextActionDate = (inputRawDate: string): string => {
      if (!inputRawDate) return 'N/A';
      const parts = inputRawDate.split('-');
      if (parts.length !== 3) return 'N/A';
      const [yStr, mStr, dStr] = parts;
      const y = Number(yStr);
      const m = Number(mStr);
      const d = Number(dStr);
      if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) {
        return 'N/A';
      }
      const next = new Date(Date.UTC(y, m - 1 + 8, d));
      return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(next);
    };

    const isNextActionDateOverdue = (inputRawDate: string): boolean => {
      if (!inputRawDate) return false;
      const parts = inputRawDate.split('-');
      if (parts.length !== 3) return false;
      const [yStr, mStr, dStr] = parts;
      const y = Number(yStr);
      const m = Number(mStr);
      const d = Number(dStr);
      if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return false;
      const nextTs = Date.UTC(y, m - 1 + 8, d);
      if (!Number.isFinite(nextTs)) return false;
      const now = new Date();
      const todayTs = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate()
      );
      return todayTs > nextTs;
    };

    // Determine the latest raw date per source to avoid flagging older rows
    const latestRawBySource: Record<
      'odometer' | 'oilChange',
      string | undefined
    > = {
      odometer: undefined,
      oilChange: undefined,
    };
    for (const r of quickInfoRows) {
      const raw = r.rawDate;
      if (!raw) continue;
      const prev = latestRawBySource[r.source];
      if (!prev || raw > prev) {
        latestRawBySource[r.source] = raw;
      }
    }

    return [
      {
        accessorKey: 'event',
        header: ({ column }) => (
          <button
            type='button'
            onClick={column.getToggleSortingHandler()}
            className='flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600'
          >
            Event
            <span className='text-gray-400'>
              {sortingIndicator(column.getIsSorted())}
            </span>
          </button>
        ),
        cell: ({ row }) => (
          <span className='text-sm font-medium text-gray-900'>
            {row.original.event}
          </span>
        ),
      },
      {
        accessorKey: 'reading',
        header: ({ column }) => (
          <button
            type='button'
            onClick={column.getToggleSortingHandler()}
            className='flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600'
          >
            Reading
            <span className='text-gray-400'>
              {sortingIndicator(column.getIsSorted())}
            </span>
          </button>
        ),
        cell: ({ row }) => {
          const isEditingRow = editingQuickInfoRowId === row.original.id;
          if (isEditingRow) {
            return (
              <input
                type='number'
                step='any'
                value={quickInfoRowDraft.reading}
                onChange={(event) =>
                  handleQuickInfoRowDraftChange('reading', event.target.value)
                }
                className='w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900'
                placeholder='Enter reading'
              />
            );
          }
          return (
            <span className='text-sm text-gray-700'>
              {row.original.reading}
            </span>
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
            Date
            <span className='text-gray-400'>
              {sortingIndicator(column.getIsSorted())}
            </span>
          </button>
        ),
        cell: ({ row }) => {
          const isEditingRow = editingQuickInfoRowId === row.original.id;
          if (isEditingRow) {
            return (
              <div className='relative'>
                <Calendar
                  className='absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400'
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.parentElement?.querySelector(
                      "input[type='date']"
                    ) as HTMLInputElement | null;
                    if (input) {
                      try {
                        (input as any).showPicker?.();
                      } catch {}
                      input.focus();
                      input.click();
                    }
                  }}
                />
                <input
                  type='date'
                  value={quickInfoRowDraft.date}
                  onChange={(event) =>
                    handleQuickInfoRowDraftChange('date', event.target.value)
                  }
                  onClick={(e) => {
                    try {
                      (e.currentTarget as any).showPicker?.();
                    } catch {}
                  }}
                  className='w-full rounded-md border border-gray-300 bg-white pl-8 pr-2 py-1 text-sm text-gray-900'
                />
              </div>
            );
          }
          return (
            <span className='text-sm text-gray-700'>{row.original.date}</span>
          );
        },
      },
      {
        id: 'nextActionDate',
        enableSorting: false,
        header: () => (
          <span className='text-xs font-semibold uppercase tracking-wide text-gray-600'>
            Action Date
          </span>
        ),
        cell: ({ row }) => {
          const isEditingRow = editingQuickInfoRowId === row.original.id;
          const baseRaw = isEditingRow
            ? quickInfoRowDraft.date
            : row.original.rawDate;
          const display = formatNextActionDate(baseRaw);
          const overdue = isNextActionDateOverdue(baseRaw);
          const isLatestForSource =
            !!baseRaw && baseRaw === latestRawBySource[row.original.source];
          const shouldWarn = overdue && display !== 'N/A' && isLatestForSource;
          if (shouldWarn) {
            return (
              <span className='inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700'>
                {display}
              </span>
            );
          }
          return <span className='text-sm text-gray-700'>{display}</span>;
        },
      },
      {
        id: 'note',
        enableSorting: false,
        header: () => (
          <span className='text-xs font-semibold uppercase tracking-wide text-gray-600'>
            Note
          </span>
        ),
        cell: () => (
          <div className='flex justify-center'>
            <button
              type='button'
              onClick={() => {
                setNotesError(null);
                setNotesDraft(asset?.notes ?? '');
                setIsNotesModalOpen(true);
              }}
              className='inline-flex items-center rounded-full border border-gray-300 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-700'
              aria-label='Open notes'
            >
              Note
            </button>
          </div>
        ),
      },
      {
        id: 'actions',
        header: () => (
          <div className='text-center text-xs font-semibold uppercase tracking-wide text-gray-600'>
            Action
          </div>
        ),
        cell: ({ row }) => {
          const isEditingRow = editingQuickInfoRowId === row.original.id;
          return (
            <div className='flex items-center justify-center gap-2'>
              {!isEditingRow && (
                <button
                  type='button'
                  onClick={() => {
                    setQuickInfoError(null);
                    startEditingQuickInfoRow(row.original);
                  }}
                  className='rounded-full border border-gray-300 p-1 text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50'
                  aria-label='Edit quick info entry'
                  disabled={isSavingQuickInfoRow || isDeletingQuickInfoRow}
                >
                  <Pencil className='h-4 w-4' />
                </button>
              )}
              {isEditingRow && (
                <button
                  type='button'
                  onClick={() => {
                    setQuickInfoError(null);
                    cancelEditingQuickInfoRow();
                  }}
                  className='rounded-full border border-gray-300 p-1 text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50'
                  aria-label='Cancel quick info edit'
                  disabled={isSavingQuickInfoRow}
                >
                  <X className='h-4 w-4' />
                </button>
              )}
              {isEditingRow && (
                <button
                  type='button'
                  onClick={() => {
                    setQuickInfoError(null);
                    void saveQuickInfoRow(row.original);
                  }}
                  className='rounded-full border border-green-400 bg-green-50 p-1 text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50'
                  aria-label='Save quick info entry'
                  disabled={isSavingQuickInfoRow || isDeletingQuickInfoRow}
                >
                  <Check className='h-4 w-4' />
                </button>
              )}
              <button
                type='button'
                onClick={() => {
                  setQuickInfoError(null);
                  openQuickInfoDeleteModal(row.original);
                }}
                className='rounded-full border border-red-400 bg-red-50 p-1 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50'
                aria-label='Delete quick info entry'
                disabled={isDeletingQuickInfoRow || isSavingQuickInfoRow}
              >
                <Trash2 className='h-4 w-4' />
              </button>
            </div>
          );
        },
      },
    ];
  }, [
    cancelEditingQuickInfoRow,
    editingQuickInfoRowId,
    handleQuickInfoRowDraftChange,
    isDeletingQuickInfoRow,
    isSavingQuickInfoRow,
    openQuickInfoDeleteModal,
    quickInfoRowDraft.date,
    quickInfoRowDraft.reading,
    saveQuickInfoRow,
    startEditingQuickInfoRow,
    quickInfoRows,
  ]);

  const detailEntries = useMemo(() => {
    if (!asset) {
      return {
        primary: [] as OverviewDetailEntry[],
        secondary: [] as OverviewDetailEntry[],
      };
    }

    const normalizeValue = (value: unknown): string => {
      if (value === undefined || value === null) {
        return '';
      }
      return String(value).trim();
    };

    const isHousehold =
      (asset.category ?? '').toString().toLowerCase().trim() === 'household';
    const entries: OverviewDetailEntry[] = [];

    if (!isHousehold) {
      entries.push(
        {
          label: 'Tire Size',
          value: normalizeValue(asset.tireSize),
          column: 'primary',
          placeholder: 'Not set',
          alwaysShow: true,
        },
        {
          label: 'Tire Pressure',
          value: normalizeValue(asset.tirePressure),
          column: 'primary',
          placeholder: 'Not set',
          alwaysShow: true,
        },
        {
          label: 'Oil Type',
          value: normalizeValue(asset.oilType),
          column: 'primary',
          placeholder: 'Not set',
          alwaysShow: true,
        }
      );
    } else {
      const warrantyValue =
        typeof asset.warranty === 'boolean'
          ? asset.warranty
            ? 'Yes'
            : 'No'
          : '';
      let warrantyExpiry = '';
      if (asset.warrantyExpiry) {
        const d = new Date(asset.warrantyExpiry as any);
        if (!Number.isNaN(d.getTime())) {
          warrantyExpiry = d.toLocaleDateString();
        }
      }
      entries.push({
        label: 'Under Warranty',
        value: warrantyValue,
        column: 'primary',
        placeholder: 'Not set',
        alwaysShow: true,
      });
      if (asset.warranty) {
        if (asset.warrantyPhone) {
          entries.push({
            label: 'Warranty Phone',
            value: normalizeValue(asset.warrantyPhone),
            column: 'primary',
            placeholder: 'Not set',
          });
        }
        entries.push({
          label: 'Warranty Expiry',
          value: warrantyExpiry,
          column: 'primary',
          placeholder: 'Not set',
        });
        if (asset.warrantyNotes) {
          entries.push({
            label: 'Warranty Notes',
            value: normalizeValue(asset.warrantyNotes),
            column: 'primary',
            placeholder: 'Not set',
          });
        }
      }
    }

    entries.push(
      {
        label: 'VIN',
        value: normalizeValue(asset.vin),
        column: 'secondary',
      },
      {
        label: 'Plate',
        value: normalizeValue(asset.plate),
        column: 'secondary',
      }
    );

    const filtered = entries
      .filter((entry) => entry.alwaysShow || entry.value.length > 0)
      .map<OverviewDetailEntry>((entry) => ({
        ...entry,
        displayValue:
          entry.value.length > 0 ? entry.value : entry.placeholder ?? 'Not set',
      }));

    return {
      primary: filtered.filter((entry) => entry.column === 'primary'),
      secondary: filtered.filter((entry) => entry.column === 'secondary'),
    };
  }, [asset]);

  const hasDetailEntries =
    detailEntries.primary.length > 0 || detailEntries.secondary.length > 0;
  const hasSecondaryDetailEntries = detailEntries.secondary.length > 0;

  const descriptionSource = useMemo(() => {
    const override = descriptionSourceOverride?.trim();
    if (override) {
      return override;
    }
    if (!asset) return '';

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
  }, [asset, descriptionSourceOverride]);

  const hasDescriptionPrompt = descriptionSource.length > 0;

  useEffect(() => {
    setAiDescription(null);
    setAiDescriptionError(null);
    setAiGenerationStats(null);
  }, [id, descriptionSource]);

  useEffect(() => {
    setDescriptionSourceOverride(null);
    setActiveAiPartName(null);
  }, [id]);

  const generateAiDescription = useCallback(
    async (prompt: string, emptyPromptError?: string) => {
      const trimmedPrompt = prompt.trim();
      if (!trimmedPrompt) {
        setAiDescriptionError(
          emptyPromptError ??
            'Add some asset details or a short description first.'
        );
        return;
      }
      if (isGeneratingAiDescription) {
        return;
      }

      setIsGeneratingAiDescription(true);
      setAiDescriptionError(null);
      setAiDescription(null);
      setAiGenerationStats(null);

      let lastError: string | null = null;

      try {
        for (
          let attempt = 1;
          attempt <= MAX_AI_GENERATION_ATTEMPTS;
          attempt++
        ) {
          setAiGenerationStats({
            attempts: attempt,
            maxAttempts: MAX_AI_GENERATION_ATTEMPTS,
          });

          try {
            const response = await fetch('/api/generate-description', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Client-Retry': '1',
              },
              body: JSON.stringify({ prompt: trimmedPrompt }),
            });

            const payload = (await response
              .json()
              .catch(() => null)) as GenerateDescriptionResponse | null;

            if (!response.ok || !payload) {
              lastError =
                payload && typeof payload.error === 'string'
                  ? payload.error
                  : 'Unable to generate a detailed description right now.';
            } else {
              const text =
                typeof payload.result === 'string' ? payload.result.trim() : '';

              if (text) {
                setAiDescription(text);

                if (payload.partial) {
                  setAiDescriptionError(
                    'The AI response may be incomplete. Try refining the prompt.'
                  );
                } else {
                  setAiDescriptionError(null);
                }

                return;
              }

              lastError =
                payload && typeof payload.error === 'string'
                  ? payload.error
                  : 'The AI response did not include any content.';
            }
          } catch (error) {
            console.error('Failed to generate AI description', error);
            lastError =
              'We could not reach Google Generative AI. Please try again later.';
          }

          if (attempt < MAX_AI_GENERATION_ATTEMPTS) {
            await new Promise<void>((resolve) =>
              setTimeout(resolve, AI_RETRY_DELAY_MS * attempt)
            );
          }
        }

        setAiDescriptionError(
          lastError ?? 'Unable to generate a detailed description right now.'
        );
      } finally {
        setIsGeneratingAiDescription(false);
      }
    },
    [isGeneratingAiDescription]
  );

  const handleGenerateDetailedDescription = useCallback(() => {
    void generateAiDescription(
      descriptionSource,
      'Add some asset details or a short description first.'
    );
  }, [descriptionSource, generateAiDescription]);

  const handleAskAiAboutPart = useCallback(
    (part: Part) => {
      const partName = part.part?.trim() ?? '';
      const partType = part.type?.trim() ?? '';
      const partDescription =
        typeof part.description === 'string' ? part.description.trim() : '';

      const promptSegments: string[] = [];

      if (partDescription) {
        promptSegments.push(partDescription);
      }

      if (partName) {
        promptSegments.push(`Part Name: ${partName}`);
      }

      if (partType) {
        promptSegments.push(`Part Type: ${partType}`);
      }

      const prompt = promptSegments.join('\n').trim();

      if (prompt) {
        setDescriptionSourceOverride(prompt);
        setActiveAiPartName(partName || partType || null);
        void generateAiDescription(
          prompt,
          'Add some details about this part before asking AI.'
        );
      } else {
        setDescriptionSourceOverride(null);
        setActiveAiPartName(null);
        setAiDescription(null);
        setAiDescriptionError('No details are available for this part yet.');
      }
    },
    [generateAiDescription]
  );

  const handleDeletePart = useCallback(async () => {
    if (
      !asset ||
      !currentUser ||
      isUpdatingPart ||
      pendingPartDeleteIndex === null
    ) {
      return;
    }

    const sourceParts = asset.partNumber ?? [];

    if (!sourceParts[pendingPartDeleteIndex]) {
      setUpdatePartError(
        'Unable to locate this part. Please refresh and try again.'
      );
      setIsDeleteModalOpen(false);
      setDeleteModalMode(null);
      setPendingPartDeleteIndex(null);
      setPendingPartDeleteName(null);
      return;
    }

    setIsUpdatingPart(true);
    setUpdatePartError(null);

    try {
      const updatedParts = sourceParts.filter(
        (_, partIndex) => partIndex !== pendingPartDeleteIndex
      );
      const targetRef = ref(db, `assets/${currentUser.UserId}/${id}`);

      await set(targetRef, {
        ...asset,
        partNumber: updatedParts.length > 0 ? updatedParts : undefined,
      });

      if (editingPartRowId === pendingPartDeleteIndex) {
        setEditingPartRowId(null);
        setEditingPartDraft(null);
      }

      setIsDeleteModalOpen(false);
      setDeleteModalMode(null);
      setPendingPartDeleteIndex(null);
      setPendingPartDeleteName(null);
    } catch (error) {
      console.error('Failed to delete part', error);
      setUpdatePartError('Unable to delete this part. Please try again.');
    } finally {
      setIsUpdatingPart(false);
    }
  }, [
    asset,
    currentUser,
    editingPartRowId,
    id,
    isUpdatingPart,
    pendingPartDeleteIndex,
  ]);

  // Videos: edit/save/delete handlers
  const startEditingVideo = useCallback((index: number, video: Video) => {
    setEditingVideoRowId(index);
    setEditingVideoDraft({ name: video.name ?? '', url: video.url ?? '' });
    setUpdateVideoError(null);
  }, []);

  const cancelEditingVideo = useCallback(() => {
    setEditingVideoRowId(null);
    setEditingVideoDraft(null);
    setUpdateVideoError(null);
  }, []);

  const saveEditingVideo = useCallback(
    async (index: number) => {
      if (
        editingVideoRowId !== index ||
        !editingVideoDraft ||
        !asset ||
        !currentUser
      ) {
        return;
      }

      const trimmedName = editingVideoDraft.name.trim();
      const trimmedUrl = editingVideoDraft.url.trim();
      const ytId = extractYouTubeId(trimmedUrl);
      if (!ytId) {
        setUpdateVideoError('Please provide a valid YouTube URL.');
        return;
      }

      setIsUpdatingVideo(true);
      setUpdateVideoError(null);

      try {
        const updatedVideos: Video[] = [...(asset.videos ?? [])];
        if (!updatedVideos[index]) {
          setUpdateVideoError(
            'Unable to locate this video. Please refresh and try again.'
          );
          setIsUpdatingVideo(false);
          return;
        }

        updatedVideos[index] = {
          ...updatedVideos[index],
          name: trimmedName || undefined,
          url: trimmedUrl,
        };

        const targetRef = ref(db, `assets/${currentUser.UserId}/${id}`);
        const updatedAsset = { ...asset, videos: updatedVideos } as Vehicle &
          Record<string, unknown>;
        const sanitizedAsset = JSON.parse(JSON.stringify(updatedAsset));
        await set(targetRef, sanitizedAsset);

        setEditingVideoRowId(null);
        setEditingVideoDraft(null);
      } catch (error) {
        console.error('Failed to update video', error);
        setUpdateVideoError('Unable to save this video. Please try again.');
      } finally {
        setIsUpdatingVideo(false);
      }
    },
    [asset, currentUser, editingVideoDraft, editingVideoRowId, id]
  );

  const openVideoDeleteModal = useCallback(
    (index: number) => {
      if (isUpdatingVideo) return;
      setUpdateVideoError(null);

      const target = asset?.videos?.[index] ?? null;
      const titleLabel = target?.name?.trim() || null;

      setPendingVideoDeleteIndex(index);
      setPendingVideoDeleteName(titleLabel);
      if (target) {
        const key = `${(target.url ?? '').trim()}|${(
          target.name ?? ''
        ).trim()}`;
        setPendingVideoDeleteKey(key);
      } else {
        setPendingVideoDeleteKey(null);
      }
      setDeleteModalMode('video');
      setIsDeleteModalOpen(true);
    },
    [asset, isUpdatingVideo]
  );

  const handleDeleteVideo = useCallback(async () => {
    if (
      !asset ||
      !currentUser ||
      isUpdatingVideo ||
      pendingVideoDeleteIndex === null
    ) {
      return;
    }

    const sourceVideos = asset.videos ?? [];
    let deleteIndex = pendingVideoDeleteIndex;
    if (
      (deleteIndex === null || !sourceVideos[deleteIndex]) &&
      pendingVideoDeleteKey
    ) {
      deleteIndex = sourceVideos.findIndex(
        (v) =>
          `${(v.url ?? '').trim()}|${(v.name ?? '').trim()}` ===
          pendingVideoDeleteKey
      );
    }
    if (deleteIndex === null || deleteIndex < 0 || !sourceVideos[deleteIndex]) {
      setUpdateVideoError(
        'Unable to locate this video. Please refresh and try again.'
      );
      setIsDeleteModalOpen(false);
      setDeleteModalMode(null);
      setPendingVideoDeleteIndex(null);
      setPendingVideoDeleteName(null);
      setPendingVideoDeleteKey(null);
      return;
    }

    setIsUpdatingVideo(true);
    setUpdateVideoError(null);

    try {
      const updatedVideos = sourceVideos.filter(
        (_, vIndex) => vIndex !== deleteIndex
      );
      const targetRef = ref(db, `assets/${currentUser.UserId}/${id}`);
      const updatedAsset = {
        ...asset,
        videos: updatedVideos.length > 0 ? updatedVideos : undefined,
      } as Vehicle & Record<string, unknown>;
      const sanitized = JSON.parse(JSON.stringify(updatedAsset));
      await set(targetRef, sanitized);

      if (editingVideoRowId === deleteIndex) {
        setEditingVideoRowId(null);
        setEditingVideoDraft(null);
      }

      setIsDeleteModalOpen(false);
      setDeleteModalMode(null);
      setPendingVideoDeleteIndex(null);
      setPendingVideoDeleteName(null);
      setPendingVideoDeleteKey(null);
    } catch (error) {
      console.error('Failed to delete video', error);
      setUpdateVideoError('Unable to delete this video. Please try again.');
    } finally {
      setIsUpdatingVideo(false);
    }
  }, [
    asset,
    currentUser,
    editingVideoRowId,
    id,
    isUpdatingVideo,
    pendingVideoDeleteIndex,
    pendingVideoDeleteKey,
  ]);

  const handleResetDescriptionOverride = useCallback(() => {
    setDescriptionSourceOverride(null);
    setActiveAiPartName(null);
    setAiGenerationStats(null);
  }, []);

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
          if (isEditing) {
            return (
              <input
                value={editingPartDraft.part}
                onChange={(event) =>
                  handlePartDraftChange('part', event.target.value)
                }
                className='w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900'
              />
            );
          }

          const { part, url } = row.original;
          const partName = part?.trim();
          if (!partName) {
            return '-';
          }

          const href =
            url?.trim() ||
            `https://www.amazon.com/s?k=${encodeURIComponent(partName)}`;

          return (
            <a
              href={href}
              target='_blank'
              rel='noopener noreferrer'
              className='text-sm font-medium text-blue-600 hover:text-blue-700'
            >
              {partName}
            </a>
          );
        },
      },
      // Type column removed
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
              <div className='relative'>
                <Calendar
                  className='absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400'
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.parentElement?.querySelector(
                      "input[type='date']"
                    ) as HTMLInputElement | null;
                    if (input) {
                      try {
                        (input as any).showPicker?.();
                      } catch {}
                      input.focus();
                      input.click();
                    }
                  }}
                />
                <input
                  type='date'
                  value={editingPartDraft.date}
                  onChange={(event) =>
                    handlePartDraftChange('date', event.target.value)
                  }
                  onClick={(e) => {
                    try {
                      (e.currentTarget as any).showPicker?.();
                    } catch {}
                  }}
                  className='w-full rounded-md border border-gray-300 bg-white pl-8 pr-2 py-1 text-sm text-gray-900'
                />
              </div>
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
            className='mx-auto flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600'
          >
            ASK AI
            <span className='text-gray-400'>
              {sortingIndicator(column.getIsSorted())}
            </span>
          </button>
        ),
        cell: ({ row }) => {
          const isEditing = editingPartRowId === row.index && editingPartDraft;
          if (isEditing) {
            return (
              <div className='flex justify-center'>
                <input
                  value={editingPartDraft.url}
                  onChange={(event) =>
                    handlePartDraftChange('url', event.target.value)
                  }
                  className='w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900'
                  placeholder='https://'
                />
              </div>
            );
          }

          const { part, description } = row.original;
          const hasAskAiDetails = Boolean(
            (part && part.trim()) ||
              (typeof description === 'string' && description.trim())
          );

          if (!hasAskAiDetails) {
            return (
              <div className='flex justify-center'>
                <span className='text-gray-400'>-</span>
              </div>
            );
          }

          return (
            <div className='flex justify-center'>
              <button
                type='button'
                onClick={() => handleAskAiAboutPart(row.original)}
                className='text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none'
              >
                About this Product
              </button>
            </div>
          );
        },
      },
      {
        id: 'note',
        enableSorting: false,
        header: () => (
          <div className='text-center text-xs font-semibold uppercase tracking-wide text-gray-600'>
            Note
          </div>
        ),
        cell: ({ row }) => {
          const p = row.original as Part;
          const hasNote =
            typeof p.note === 'string' && p.note.trim().length > 0;
          const badgeClass = hasNote
            ? 'inline-flex items-center rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700'
            : 'inline-flex items-center rounded-full border border-gray-300 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-700';
          return (
            <div className='flex justify-center'>
              <button
                type='button'
                onClick={() => openPartNoteModal(row.index)}
                className={badgeClass}
                aria-label='Add or edit note'
              >
                Note
              </button>
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: () => (
          <div className='text-center text-xs font-semibold uppercase tracking-wide text-gray-600'>
            Action
          </div>
        ),
        cell: ({ row }) => {
          const isEditing = editingPartRowId === row.index && editingPartDraft;
          return (
            <div className='flex items-center justify-center gap-2'>
              {!isEditing && (
                <button
                  type='button'
                  onClick={() => startEditingPart(row.index, row.original)}
                  className='rounded-full border border-gray-300 p-1 text-gray-600 transition hover:bg-gray-100'
                  aria-label='Edit part'
                  disabled={isUpdatingPart}
                >
                  <Pencil className='h-4 w-4' />
                </button>
              )}
              {isEditing && (
                <button
                  type='button'
                  onClick={cancelEditingPart}
                  className='rounded-full border border-gray-300 p-1 text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50'
                  aria-label='Cancel edit'
                  disabled={isUpdatingPart}
                >
                  <X className='h-4 w-4' />
                </button>
              )}
              {isEditing && (
                <button
                  type='button'
                  onClick={() => saveEditingPart(row.index)}
                  className='rounded-full border border-green-400 bg-green-50 p-1 text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50'
                  aria-label='Save part'
                  disabled={isUpdatingPart}
                >
                  <Check className='h-4 w-4' />
                </button>
              )}
              <button
                type='button'
                onClick={() => openPartDeleteModal(row.index)}
                className='rounded-full border border-red-400 bg-red-50 p-1 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50'
                aria-label='Delete part'
                disabled={isUpdatingPart}
              >
                <Trash2 className='h-4 w-4' />
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
    handleAskAiAboutPart,
    openPartDeleteModal,
    openPartNoteModal,
  ]);

  const partData = useMemo<Part[]>(() => asset?.partNumber ?? [], [asset]);

  const quickInfoTable = useReactTable<QuickInfoRow>({
    data: quickInfoRows,
    columns: quickInfoColumns,
    state: {
      sorting: quickInfoSorting,
    },
    onSortingChange: setQuickInfoSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const partTable = useReactTable<Part>({
    data: partData,
    columns: partColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting: partSorting,
    },
    onSortingChange: setPartSorting,
  });

  // Videos table
  const videoColumns = useMemo<ColumnDef<Video>[]>(() => {
    const sortingIndicator = (direction: 'asc' | 'desc' | false) => {
      if (direction === 'asc') return '^';
      if (direction === 'desc') return 'v';
      return '';
    };

    return [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <button
            type='button'
            onClick={column.getToggleSortingHandler()}
            className='flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600'
          >
            Title
            <span className='text-gray-400'>
              {sortingIndicator(column.getIsSorted())}
            </span>
          </button>
        ),
        cell: ({ row }) => {
          const isEditing =
            editingVideoRowId === row.index && editingVideoDraft;
          if (isEditing) {
            return (
              <input
                value={editingVideoDraft.name}
                onChange={(event) =>
                  setEditingVideoDraft((prev) =>
                    prev ? { ...prev, name: event.target.value } : prev
                  )
                }
                className='w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900'
                placeholder='Video title (optional)'
              />
            );
          }
          const name = row.original.name?.trim() || 'Untitled';
          const url = row.original.url?.trim();
          if (url) {
            return (
              <a
                href={url}
                target='_blank'
                rel='noopener noreferrer'
                className='text-sm font-medium text-blue-600 hover:text-blue-700'
              >
                {name}
              </a>
            );
          }
          return <span className='text-sm text-gray-900'>{name}</span>;
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
            URL
            <span className='text-gray-400'>
              {sortingIndicator(column.getIsSorted())}
            </span>
          </button>
        ),
        cell: ({ row }) => {
          const isEditing =
            editingVideoRowId === row.index && editingVideoDraft;
          if (isEditing) {
            return (
              <input
                value={editingVideoDraft.url}
                onChange={(event) =>
                  setEditingVideoDraft((prev) =>
                    prev ? { ...prev, url: event.target.value } : prev
                  )
                }
                className='w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900'
                placeholder='https://www.youtube.com/watch?v=...'
              />
            );
          }
          const href = row.original.url?.trim();
          if (!href) return <span className='text-gray-400'>-</span>;
          return (
            <a
              href={href}
              target='_blank'
              rel='noopener noreferrer'
              className='text-sm text-blue-600 hover:text-blue-700'
            >
              {href}
            </a>
          );
        },
      },
      {
        id: 'play',
        enableSorting: false,
        header: () => (
          <div className='text-center text-xs font-semibold uppercase tracking-wide text-gray-600'>
            Play
          </div>
        ),
        cell: ({ row }) => {
          const ytId = extractYouTubeId(row.original.url ?? '');
          return (
            <div className='flex items-center justify-center'>
              <button
                type='button'
                onClick={() => setSelectedVideoId(ytId)}
                disabled={!ytId}
                className='rounded-full border border-gray-300 p-1 text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50'
                aria-label='Play video'
                title={ytId ? 'Play' : 'Invalid URL'}
              >
                <Play className='h-4 w-4' />
              </button>
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: () => (
          <div className='text-center text-xs font-semibold uppercase tracking-wide text-gray-600'>
            Action
          </div>
        ),
        cell: ({ row }) => {
          const isEditing =
            editingVideoRowId === row.index && editingVideoDraft;
          return (
            <div className='flex items-center justify-center gap-2'>
              {!isEditing && (
                <button
                  type='button'
                  onClick={() => startEditingVideo(row.index, row.original)}
                  className='rounded-full border border-gray-300 p-1 text-gray-600 transition hover:bg-gray-100'
                  aria-label='Edit video'
                  disabled={isUpdatingVideo}
                >
                  <Pencil className='h-4 w-4' />
                </button>
              )}
              {isEditing && (
                <button
                  type='button'
                  onClick={cancelEditingVideo}
                  className='rounded-full border border-gray-300 p-1 text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50'
                  aria-label='Cancel edit'
                  disabled={isUpdatingVideo}
                >
                  <X className='h-4 w-4' />
                </button>
              )}
              {isEditing && (
                <button
                  type='button'
                  onClick={() => saveEditingVideo(row.index)}
                  className='rounded-full border border-green-400 bg-green-50 p-1 text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50'
                  aria-label='Save video'
                  disabled={isUpdatingVideo}
                >
                  <Check className='h-4 w-4' />
                </button>
              )}
              <button
                type='button'
                onClick={() => openVideoDeleteModal(row.index)}
                className='rounded-full border border-red-400 bg-red-50 p-1 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50'
                aria-label='Delete video'
                disabled={isUpdatingVideo}
              >
                <Trash2 className='h-4 w-4' />
              </button>
            </div>
          );
        },
      },
    ];
  }, [
    editingVideoDraft,
    editingVideoRowId,
    isUpdatingVideo,
    startEditingVideo,
    cancelEditingVideo,
    saveEditingVideo,
    openVideoDeleteModal,
  ]);

  const videoData = useMemo<Video[]>(() => asset?.videos ?? [], [asset]);

  const videoTable = useReactTable<Video>({
    data: videoData,
    columns: videoColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting: videoSorting,
    },
    onSortingChange: setVideoSorting,
  });

  const isDeleteModalPart = deleteModalMode === 'part';
  const isDeleteModalQuickInfo = deleteModalMode === 'quickInfo';
  const isDeleteModalVideo = deleteModalMode === 'video';
  const quickInfoEntryLabel = pendingQuickInfoDeleteRow
    ? `${pendingQuickInfoDeleteRow.event}${
        pendingQuickInfoDeleteRow.date &&
        pendingQuickInfoDeleteRow.date !== 'N/A'
          ? ` (${pendingQuickInfoDeleteRow.date})`
          : ''
      }`
    : 'this entry';
  const deleteModalTitle = isDeleteModalPart
    ? 'Delete part?'
    : isDeleteModalQuickInfo
    ? 'Delete entry?'
    : isDeleteModalVideo
    ? 'Delete video?'
    : 'Delete asset?';
  const deleteModalMessage = isDeleteModalPart
    ? `Are you sure you want to delete ${
        pendingPartDeleteName ? `"${pendingPartDeleteName}"` : 'this part'
      }? This action cannot be undone.`
    : isDeleteModalQuickInfo
    ? `Are you sure you want to delete ${quickInfoEntryLabel}? This action cannot be undone.`
    : isDeleteModalVideo
    ? `Are you sure you want to delete ${
        pendingVideoDeleteName ? `"${pendingVideoDeleteName}"` : 'this video'
      }? This action cannot be undone.`
    : 'Are you sure you want to delete this asset? This action cannot be undone.';
  const deleteModalInFlight = isDeleteModalPart
    ? isUpdatingPart
    : isDeleteModalQuickInfo
    ? isDeletingQuickInfoRow
    : isDeleteModalVideo
    ? isUpdatingVideo
    : isDeleting;
  const deleteModalConfirmLabel = isDeleteModalPart
    ? isUpdatingPart
      ? 'Deleting...'
      : 'Delete Part'
    : isDeleteModalQuickInfo
    ? isDeletingQuickInfoRow
      ? 'Deleting...'
      : 'Delete Entry'
    : isDeleteModalVideo
    ? isUpdatingVideo
      ? 'Deleting...'
      : 'Delete Video'
    : isDeleting
    ? 'Deleting...'
    : 'Delete Asset';
  const handleDeleteConfirm = () => {
    if (isDeleteModalPart) {
      void handleDeletePart();
      return;
    }
    if (isDeleteModalQuickInfo) {
      if (pendingQuickInfoDeleteRow) {
        void handleDeleteQuickInfoRow(pendingQuickInfoDeleteRow);
      }
      return;
    }
    if (isDeleteModalVideo) {
      void handleDeleteVideo();
      return;
    }
    void handleDeleteAsset();
  };

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
          <div className='mx-auto max-w-6xl px-4 sm:px-6 lg:px-8'>
            <div className='mb-6 flex items-center justify-between'>
              <div>
                <h1 className='mt-2 text-3xl font-semibold text-gray-900'>
                  {asset?.make || 'Asset Detail'}
                </h1>
                {headerModelYear && (
                  <p className='mt-1 text-sm text-gray-600'>
                    {headerModelYear}
                  </p>
                )}
              </div>
              <div className='flex items-center gap-3'>
                <Link
                  href='/home'
                  className='inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700'
                >
                  Back to My Assets
                </Link>
                <button
                  type='button'
                  onClick={openDeleteModal}
                  disabled={isDeleting}
                  className='inline-flex items-center rounded-md border border-red-400 bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  {isDeleting ? 'Deleting...' : 'Delete Asset'}
                </button>
              </div>
            </div>

            {asset ? (
              <div className='space-y-6'>
                <section className='w-full rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
                  <div className='flex items-center justify-between'>
                    <h2 className='text-xl font-semibold text-gray-900'>
                      Overview
                    </h2>
                    <div className='flex flex-col items-end gap-2'>
                      {!isEditing && (
                        <button
                          type='button'
                          onClick={() => setIsEditing(true)}
                          className='rounded-md border border-green-400 bg-green-100 px-3 py-1 text-sm font-medium text-green-700 transition hover:bg-green-200'
                        >
                          Edit Asset
                        </button>
                      )}
                      {asset?.vin && asset.vin.trim().length > 0 && (
                        <a
                          href={`https://www.nhtsa.gov/recalls?vymm=${encodeURIComponent(
                            asset.vin.trim()
                          )}`}
                          target='_blank'
                          rel='noopener noreferrer'
                          onClick={handleRecallClick}
                          className='inline-flex items-center rounded-md border border-blue-400 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 transition hover:bg-blue-100'
                        >
                          <span>Check for recall</span>
                          <span className='ml-2 inline-flex items-center rounded-full border border-yellow-300 bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-800'>
                            Pro
                          </span>
                        </a>
                      )}
                      <button
                        type='button'
                        onClick={() => {
                          setNotesError(null);
                          setNotesDraft(asset?.notes ?? '');
                          setIsNotesModalOpen(true);
                        }}
                        className='inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 transition hover:bg-gray-100'
                      >
                        Notes
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
                            className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
                            placeholder='e.g. Toyota'
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
                            className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
                            placeholder='e.g. RAV4'
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
                            inputMode='numeric'
                            min='1900'
                            max='2099'
                            value={formState.year}
                            onChange={handleFieldChange}
                            className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
                            placeholder='e.g. 2018'
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
                            className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
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
                            className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
                          />
                        </div>
                        {formState.category.trim().toLowerCase() !==
                        'household' ? (
                          <>
                            <div>
                              <label
                                htmlFor='tireSize'
                                className='block text-sm font-medium text-gray-700'
                              >
                                Tire Size
                              </label>
                              <input
                                id='tireSize'
                                name='tireSize'
                                value={formState.tireSize}
                                onChange={handleFieldChange}
                                className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
                                placeholder='e.g. 225/65R17'
                              />
                            </div>
                            <div>
                              <label
                                htmlFor='tirePressure'
                                className='block text-sm font-medium text-gray-700'
                              >
                                Tire Pressure
                              </label>
                              <input
                                id='tirePressure'
                                name='tirePressure'
                                value={formState.tirePressure}
                                onChange={handleFieldChange}
                                className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
                                placeholder='e.g. 35 PSI'
                              />
                            </div>
                            <div>
                              <label
                                htmlFor='oilType'
                                className='block text-sm font-medium text-gray-700'
                              >
                                Oil Type
                              </label>
                              <input
                                id='oilType'
                                name='oilType'
                                value={formState.oilType}
                                onChange={handleFieldChange}
                                className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
                                placeholder='e.g. 5W-30 Synthetic'
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className='flex items-center gap-2'>
                              <input
                                id='warranty'
                                name='warranty'
                                type='checkbox'
                                checked={formState.warranty}
                                onChange={(e) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    warranty: e.target.checked,
                                  }))
                                }
                                className='h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                              />
                              <label
                                htmlFor='warranty'
                                className='text-sm font-medium text-gray-700'
                              >
                                Under Warranty
                              </label>
                            </div>
                            {formState.warranty && (
                              <div>
                                <label
                                  htmlFor='warrantyNumber'
                                  className='block text-sm font-medium text-gray-700'
                                >
                                  Warranty Number
                                </label>
                                <input
                                  id='warrantyNumber'
                                  name='warrantyNumber'
                                  value={formState.warrantyNumber}
                                  onChange={handleFieldChange}
                                  className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
                                  placeholder='e.g. ABC-1234567'
                                />
                              </div>
                            )}
                            {formState.warranty && (
                              <div>
                                <label
                                  htmlFor='warrantyPhone'
                                  className='block text-sm font-medium text-gray-700'
                                >
                                  Warranty Phone
                                </label>
                                <input
                                  id='warrantyPhone'
                                  name='warrantyPhone'
                                  type='tel'
                                  value={formState.warrantyPhone}
                                  onChange={handleFieldChange}
                                  className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
                                  placeholder='e.g. (800) 555-1234'
                                />
                              </div>
                            )}
                            {formState.warranty && (
                              <div>
                                <label
                                  htmlFor='warrantyExpiry'
                                  className='block text-sm font-medium text-gray-700'
                                >
                                  Warranty Expiry
                                </label>
                                <input
                                  id='warrantyExpiry'
                                  name='warrantyExpiry'
                                  type='date'
                                  value={formState.warrantyExpiry}
                                  onChange={(e) =>
                                    setFormState((prev) => ({
                                      ...prev,
                                      warrantyExpiry: e.target.value,
                                    }))
                                  }
                                  className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
                                />
                              </div>
                            )}
                            {formState.warranty && (
                              <div className='sm:col-span-2'>
                                <label
                                  htmlFor='warrantyNotes'
                                  className='block text-sm font-medium text-gray-700'
                                >
                                  Warranty Notes
                                </label>
                                <textarea
                                  id='warrantyNotes'
                                  name='warrantyNotes'
                                  rows={3}
                                  value={formState.warrantyNotes}
                                  onChange={handleFieldChange}
                                  className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
                                  placeholder='Any additional warranty details'
                                />
                              </div>
                            )}
                          </>
                        )}
                        {formState.category.trim().toLowerCase() !==
                          'household' && (
                          <>
                            <div className='flex items-center gap-2'>
                              <input
                                id='warranty'
                                name='warranty'
                                type='checkbox'
                                checked={formState.warranty}
                                onChange={(e) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    warranty: e.target.checked,
                                  }))
                                }
                                className='h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                              />
                              <label
                                htmlFor='warranty'
                                className='text-sm font-medium text-gray-700'
                              >
                                Under Warranty
                              </label>
                            </div>
                            {formState.warranty && (
                              <div>
                                <label
                                  htmlFor='warrantyNumber'
                                  className='block text-sm font-medium text-gray-700'
                                >
                                  Warranty Number
                                </label>
                                <input
                                  id='warrantyNumber'
                                  name='warrantyNumber'
                                  value={formState.warrantyNumber}
                                  onChange={handleFieldChange}
                                  className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
                                  placeholder='e.g. ABC-1234567'
                                />
                              </div>
                            )}
                            {formState.warranty && (
                              <div>
                                <label
                                  htmlFor='warrantyPhone'
                                  className='block text-sm font-medium text-gray-700'
                                >
                                  Warranty Phone
                                </label>
                                <input
                                  id='warrantyPhone'
                                  name='warrantyPhone'
                                  type='tel'
                                  value={formState.warrantyPhone}
                                  onChange={handleFieldChange}
                                  className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
                                  placeholder='e.g. (800) 555-1234'
                                />
                              </div>
                            )}
                            {formState.warranty && (
                              <div>
                                <label
                                  htmlFor='warrantyExpiry'
                                  className='block text-sm font-medium text-gray-700'
                                >
                                  Warranty Expiry
                                </label>
                                <input
                                  id='warrantyExpiry'
                                  name='warrantyExpiry'
                                  type='date'
                                  value={formState.warrantyExpiry}
                                  onChange={(e) =>
                                    setFormState((prev) => ({
                                      ...prev,
                                      warrantyExpiry: e.target.value,
                                    }))
                                  }
                                  className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
                                />
                              </div>
                            )}
                            {formState.warranty && (
                              <div className='sm:col-span-2'>
                                <label
                                  htmlFor='warrantyNotes'
                                  className='block text-sm font-medium text-gray-700'
                                >
                                  Warranty Notes
                                </label>
                                <textarea
                                  id='warrantyNotes'
                                  name='warrantyNotes'
                                  rows={3}
                                  value={formState.warrantyNotes}
                                  onChange={handleFieldChange}
                                  className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
                                  placeholder='Any additional warranty details'
                                />
                              </div>
                            )}
                          </>
                        )}
                        <div>
                          <label
                            htmlFor='insuranceCompany'
                            className='block text-sm font-medium text-gray-700'
                          >
                            Insurance Company
                          </label>
                          <input
                            id='insuranceCompany'
                            name='insuranceCompany'
                            value={formState.insuranceCompany}
                            onChange={handleFieldChange}
                            className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
                            placeholder='e.g. State Farm'
                          />
                        </div>
                        <div>
                          <label
                            htmlFor='insurancePolicyNumber'
                            className='block text-sm font-medium text-gray-700'
                          >
                            Insurance Policy Number
                          </label>
                          <input
                            id='insurancePolicyNumber'
                            name='insurancePolicyNumber'
                            value={formState.insurancePolicyNumber}
                            onChange={handleFieldChange}
                            className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
                            placeholder='e.g. ABC-1234567'
                          />
                        </div>
                        <div>
                          <label
                            htmlFor='insuranceExpirationDate'
                            className='block text-sm font-medium text-gray-700'
                          >
                            Insurance Expiration Date
                          </label>
                          <input
                            id='insuranceExpirationDate'
                            name='insuranceExpirationDate'
                            type='date'
                            value={formState.insuranceExpirationDate}
                            onChange={handleFieldChange}
                            className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
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
                              tireSize: asset.tireSize ?? '',
                              tirePressure: asset.tirePressure ?? '',
                              oilType: asset.oilType ?? '',
                              category: asset.category ?? '',
                              warrantyNumber: asset.warrantyNumber ?? '',
                              warrantyPhone: asset.warrantyPhone ?? '',
                              warrantyNotes: asset.warrantyNotes ?? '',
                              insuranceCompany: asset.insuranceCompany ?? '',
                              insurancePolicyNumber:
                                asset.insurancePolicyNumber ?? '',
                              insuranceExpirationDate:
                                asset.insuranceExpirationDate &&
                                !Number.isNaN(
                                  new Date(
                                    asset.insuranceExpirationDate as any
                                  ).getTime()
                                )
                                  ? new Date(
                                      asset.insuranceExpirationDate as any
                                    )
                                      .toISOString()
                                      .split('T')[0]
                                  : '',
                              warranty: Boolean(asset.warranty),
                              warrantyExpiry:
                                asset.warrantyExpiry &&
                                !Number.isNaN(
                                  new Date(
                                    asset.warrantyExpiry as any
                                  ).getTime()
                                )
                                  ? new Date(asset.warrantyExpiry as any)
                                      .toISOString()
                                      .split('T')[0]
                                  : '',
                            });
                          }}
                          className='inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100'
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className='mt-3 space-y-3'>
                      {hasDetailEntries ? (
                        <dl
                          className={`grid gap-3${
                            hasSecondaryDetailEntries ? ' sm:grid-cols-2' : ''
                          }`}
                        >
                          {detailEntries.primary.length > 0 && (
                            <div className='space-y-2'>
                              {detailEntries.primary.map((entry) => (
                                <div
                                  key={entry.label}
                                  className='grid gap-1 sm:grid-cols-[140px,1fr]'
                                >
                                  <dt className='text-sm leading-none font-medium text-gray-500'>
                                    {entry.label}
                                  </dt>
                                  <dd className='text-sm leading-none text-gray-900'>
                                    {entry.displayValue ?? entry.value}
                                  </dd>
                                </div>
                              ))}
                            </div>
                          )}
                          {hasSecondaryDetailEntries && (
                            <div className='space-y-2'>
                              {detailEntries.secondary.map((entry) => (
                                <div
                                  key={entry.label}
                                  className='grid gap-1 sm:grid-cols-[140px,1fr]'
                                >
                                  <dt className='text-sm leading-none font-medium text-gray-500'>
                                    {entry.label}
                                  </dt>
                                  <dd className='text-sm leading-none text-gray-900'>
                                    {entry.displayValue ?? entry.value}
                                  </dd>
                                </div>
                              ))}
                            </div>
                          )}
                        </dl>
                      ) : (
                        <p className='text-sm text-gray-500'>
                          This asset doesn&apos;t have additional details yet.
                        </p>
                      )}
                      {asset?.warranty ? (
                        <div className='rounded-md border border-blue-200 bg-blue-50/60 p-4 text-sm text-gray-700'>
                          <div className='flex items-center justify-between'>
                            <h3 className='text-sm font-semibold text-blue-800'>
                              Warranty
                            </h3>
                            <span className='text-xs font-medium text-blue-800'>
                              {asset.warrantyExpiry &&
                              !Number.isNaN(
                                new Date(asset.warrantyExpiry as any).getTime()
                              )
                                ? `Expires ${new Date(
                                    asset.warrantyExpiry as any
                                  ).toLocaleDateString()}`
                                : 'Active'}
                            </span>
                          </div>
                          <dl className='mt-2 space-y-1'>
                            {asset.warrantyNumber ? (
                              <div className='grid gap-1 sm:grid-cols-[140px,1fr]'>
                                <dt className='text-xs font-medium text-gray-500'>
                                  Number
                                </dt>
                                <dd className='text-sm text-gray-900'>
                                  {String(asset.warrantyNumber).trim()}
                                </dd>
                              </div>
                            ) : null}
                            {asset.warrantyPhone ? (
                              <div className='grid gap-1 sm:grid-cols-[140px,1fr]'>
                                <dt className='text-xs font-medium text-gray-500'>
                                  Phone
                                </dt>
                                <dd className='text-sm text-gray-900'>
                                  {String(asset.warrantyPhone).trim()}
                                </dd>
                              </div>
                            ) : null}
                            {asset.warrantyNotes ? (
                              <div className='grid gap-1 sm:grid-cols-[140px,1fr]'>
                                <dt className='text-xs font-medium text-gray-500'>
                                  Notes
                                </dt>
                                <dd className='text-sm text-gray-900'>
                                  {String(asset.warrantyNotes).trim()}
                                </dd>
                              </div>
                            ) : null}
                          </dl>
                        </div>
                      ) : null}
                    </div>
                  )}
                </section>

                <div className='mb-4 rounded-md border-2 border-dotted border-red-400 p-4'>
                  <h3 className='text-sm font-semibold text-red-700'>
                    Notifier
                  </h3>
                </div>

                <section className='rounded-lg border border-gray-200 bg-white p-4 shadow-sm'>
                  <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                    <div>
                      <h2 className='text-xl font-semibold text-gray-900'>
                        Quick Info
                      </h2>
                      <h3 className='text-sm font-semibold text-gray-600'>
                        {quickInfoVehicleLabel}
                      </h3>
                    </div>
                    <div className='flex items-center gap-2'>
                      <button
                        type='button'
                        onClick={() => {
                          setQuickInfoError(null);
                          setIsQuickInfoAddMenuOpen((prev) => !prev);
                          setQuickInfoAddType(null);
                          cancelEditingQuickInfoRow();
                        }}
                        className='inline-flex items-center justify-center rounded-full border border-green-400 bg-green-50 p-2 text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50'
                        aria-label='Add quick info entry'
                        disabled={
                          isSavingQuickInfoRow || isDeletingQuickInfoRow
                        }
                      >
                        <Plus className='h-4 w-4' />
                      </button>
                    </div>
                  </div>
                  {isQuickInfoAddMenuOpen && (
                    <div className='mt-3 flex flex-wrap gap-2 text-xs sm:text-sm'>
                      <button
                        type='button'
                        onClick={() => openQuickInfoAddForm('odometer')}
                        className='rounded-md border border-gray-300 px-3 py-1 font-medium text-gray-700 transition hover:bg-gray-100'
                      >
                        Add Odometer Reading
                      </button>
                      <button
                        type='button'
                        onClick={() => openQuickInfoAddForm('oilChange')}
                        className='rounded-md border border-gray-300 px-3 py-1 font-medium text-gray-700 transition hover:bg-gray-100'
                      >
                        Add Oil Change
                      </button>
                    </div>
                  )}
                  {quickInfoAddType && (
                    <form
                      onSubmit={handleQuickInfoAddSubmit}
                      className='mt-4 space-y-4 rounded-md border border-dashed border-blue-300 bg-blue-50/60 p-4 text-sm text-gray-700'
                    >
                      <div className='flex items-center justify-between'>
                        <h3 className='text-sm font-semibold text-blue-700'>
                          {quickInfoAddType === 'odometer'
                            ? 'Add Odometer Reading'
                            : 'Add Oil Change'}
                        </h3>
                        <button
                          type='button'
                          onClick={handleQuickInfoAddCancel}
                          disabled={isSavingQuickInfoAddition}
                          className='text-xs font-medium text-blue-600 transition hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
                        >
                          Cancel
                        </button>
                      </div>
                      {quickInfoError && (
                        <p className='text-sm text-red-600'>{quickInfoError}</p>
                      )}
                      <div className='grid gap-3 sm:grid-cols-2'>
                        <div>
                          <label
                            htmlFor='quickInfoAddReading'
                            className='block text-xs font-medium uppercase tracking-wide text-gray-700'
                          >
                            {quickInfoAddType === 'odometer'
                              ? 'Odometer Reading'
                              : 'Odometer (optional)'}
                          </label>
                          <input
                            id='quickInfoAddReading'
                            type='number'
                            value={quickInfoAddForm.reading}
                            onChange={(event) =>
                              handleQuickInfoAddFieldChange(
                                'reading',
                                event.target.value
                              )
                            }
                            className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
                            placeholder={
                              quickInfoAddType === 'odometer'
                                ? 'Enter mileage'
                                : 'Mileage at oil change'
                            }
                          />
                        </div>
                        <div>
                          <label
                            htmlFor='quickInfoAddDate'
                            className='block text-xs font-medium uppercase tracking-wide text-gray-700'
                          >
                            Date
                          </label>
                          <div className='relative mt-1'>
                            <Calendar
                              className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400'
                              onMouseDown={(e) => {
                                e.preventDefault();
                                const input =
                                  e.currentTarget.parentElement?.querySelector(
                                    "input[type='date']"
                                  ) as HTMLInputElement | null;
                                if (input) {
                                  try {
                                    (input as any).showPicker?.();
                                  } catch {}
                                  input.focus();
                                  input.click();
                                }
                              }}
                            />
                            <input
                              id='quickInfoAddDate'
                              type='date'
                              value={quickInfoAddForm.date}
                              onChange={(event) =>
                                handleQuickInfoAddFieldChange(
                                  'date',
                                  event.target.value
                                )
                              }
                              onClick={(e) => {
                                try {
                                  (e.currentTarget as any).showPicker?.();
                                } catch {}
                              }}
                              className='w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm text-gray-900'
                            />
                          </div>
                        </div>
                      </div>
                      <div className='flex items-center gap-3 pt-2'>
                        <button
                          type='submit'
                          disabled={isSavingQuickInfoAddition}
                          className='inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
                        >
                          {isSavingQuickInfoAddition
                            ? 'Adding...'
                            : 'Add Entry'}
                        </button>
                      </div>
                    </form>
                  )}
                  {!quickInfoAddType && quickInfoError && (
                    <p className='mt-4 text-sm text-red-600'>
                      {quickInfoError}
                    </p>
                  )}
                  <div
                    className={`mt-4 space-y-4 text-sm text-gray-700${
                      quickInfoAddType ? ' border-t border-gray-200 pt-4' : ''
                    }`}
                  >
                    {quickInfoRows.length > 0 ? (
                      <div className='overflow-x-auto rounded-lg border border-gray-200'>
                        <table className='min-w-full divide-y divide-gray-200 text-left'>
                          <thead className='bg-gray-50'>
                            {quickInfoTable
                              .getHeaderGroups()
                              .map((headerGroup) => (
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
                          <tbody className='divide-y divide-gray-200 bg-white'>
                            {quickInfoTable.getRowModel().rows.map((row) => (
                              <tr key={row.id} className='hover:bg-gray-50'>
                                {row.getVisibleCells().map((cell) => (
                                  <td
                                    key={cell.id}
                                    className='px-4 py-2 text-gray-700'
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
                      <p className='text-sm text-gray-500'>
                        No odometer or oil change records yet.
                      </p>
                    )}
                  </div>
                </section>

                <section
                  id='maintenance-section'
                  className='rounded-lg border border-gray-200 bg-white p-6 shadow-sm'
                >
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
                                className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
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
                                className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
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
                              <div className='relative mt-1'>
                                <Calendar
                                  className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400'
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    const input =
                                      e.currentTarget.parentElement?.querySelector(
                                        "input[type='date']"
                                      ) as HTMLInputElement | null;
                                    if (input) {
                                      try {
                                        (input as any).showPicker?.();
                                      } catch {}
                                      input.focus();
                                      input.click();
                                    }
                                  }}
                                />
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
                                  onClick={(e) => {
                                    try {
                                      (e.currentTarget as any).showPicker?.();
                                    } catch {}
                                  }}
                                  className='w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm text-gray-900'
                                />
                              </div>
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
                      Videos
                    </h2>
                  </div>
                  <div className='mt-4'>
                    {selectedVideoId ? (
                      <div
                        className='relative w-full overflow-hidden rounded-md border border-gray-200 bg-black'
                        style={{ paddingTop: '56.25%' }}
                      >
                        <iframe
                          className='absolute left-0 top-0 h-full w-full'
                          src={`https://www.youtube.com/embed/${selectedVideoId}`}
                          title='YouTube video player'
                          allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <p className='text-sm text-gray-500'>
                        Paste a YouTube URL and add it, or use the table below
                        to select a video to play.
                      </p>
                    )}
                  </div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!asset || !currentUser) return;
                      const trimmedUrl = videoAddUrl.trim();
                      const ytId = extractYouTubeId(trimmedUrl);
                      if (!trimmedUrl || !ytId) {
                        setVideoAddError('Please enter a valid YouTube URL.');
                        return;
                      }
                      setIsAddingVideo(true);
                      setVideoAddError(null);
                      try {
                        const newEntry: Video = {
                          name: videoAddTitle.trim() || undefined,
                          url: trimmedUrl,
                        };
                        const nextVideos: Video[] = [
                          ...(asset.videos ?? []),
                          newEntry,
                        ];
                        const targetRef = ref(
                          db,
                          `assets/${currentUser.UserId}/${id}`
                        );
                        const updatedAsset = {
                          ...asset,
                          videos: nextVideos,
                        } as Vehicle & Record<string, unknown>;
                        const sanitized = JSON.parse(
                          JSON.stringify(updatedAsset)
                        );
                        await set(targetRef, sanitized);
                        setVideoAddUrl('');
                        setVideoAddTitle('');
                        // Do not auto-play newly added video; wait for user click.
                      } catch (error) {
                        console.error('Failed to add video', error);
                        setVideoAddError(
                          'Unable to add video. Please try again.'
                        );
                      } finally {
                        setIsAddingVideo(false);
                      }
                    }}
                    className='mt-4 space-y-3'
                  >
                    {videoAddError && (
                      <p className='text-sm text-red-600'>{videoAddError}</p>
                    )}
                    <div className='grid gap-3 sm:grid-cols-3'>
                      <div className='sm:col-span-2'>
                        <label
                          htmlFor='video-url'
                          className='block text-sm font-medium text-gray-700'
                        >
                          YouTube URL
                        </label>
                        <input
                          id='video-url'
                          value={videoAddUrl}
                          onChange={(e) => setVideoAddUrl(e.target.value)}
                          placeholder='https://www.youtube.com/watch?v=...'
                          className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
                        />
                      </div>
                      <div>
                        <label
                          htmlFor='video-title'
                          className='block text-sm font-medium text-gray-700'
                        >
                          Title (optional)
                        </label>
                        <input
                          id='video-title'
                          value={videoAddTitle}
                          onChange={(e) => setVideoAddTitle(e.target.value)}
                          className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
                        />
                      </div>
                    </div>
                    <div className='flex items-center gap-3'>
                      <button
                        type='submit'
                        disabled={isAddingVideo}
                        className='inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
                      >
                        {isAddingVideo ? 'Adding...' : 'Add Video'}
                      </button>
                      <button
                        type='button'
                        onClick={() => {
                          setVideoAddUrl('');
                          setVideoAddTitle('');
                          setVideoAddError(null);
                        }}
                        disabled={isAddingVideo}
                        className='inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50'
                      >
                        Clear
                      </button>
                    </div>
                  </form>
                  <div className='mt-4'>
                    {!editingVideoRowId && updateVideoError && (
                      <p className='mb-2 text-sm text-red-600'>
                        {updateVideoError}
                      </p>
                    )}
                    {videoData.length > 0 ? (
                      <div className='overflow-x-auto rounded-lg border border-gray-200'>
                        <table className='min-w-full divide-y divide-gray-200 text-left'>
                          <thead className='bg-gray-50'>
                            {videoTable.getHeaderGroups().map((headerGroup) => (
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
                          <tbody className='divide-y divide-gray-200 bg-white'>
                            {videoTable.getRowModel().rows.map((row) => (
                              <tr key={row.id} className='hover:bg-gray-50'>
                                {row.getVisibleCells().map((cell) => (
                                  <td
                                    key={cell.id}
                                    className='px-4 py-2 text-gray-700'
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
                      <p className='text-sm text-gray-500'>
                        No videos added yet.
                      </p>
                    )}
                  </div>
                </section>

                <section className='rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
                  <div className='flex flex-wrap items-center justify-between gap-3'>
                    <h2 className='text-xl font-semibold text-gray-900'>
                      AI Description
                    </h2>
                  </div>
                  <div className='mt-4 space-y-3'>
                    <div
                      className={`flex items-center text-sm text-gray-600 overflow-hidden transition-all duration-500 ${
                        isGeneratingAiDescription
                          ? 'opacity-100 max-h-8'
                          : 'opacity-0 max-h-0'
                      }`}
                    >
                      <span className='mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent' />
                      <span className='ai-fade'>
                        Generating AI description...
                      </span>
                    </div>
                    {hasDescriptionPrompt ? (
                      descriptionSourceOverride ? (
                        <div className='space-y-1 text-sm text-gray-600'>
                          {activeAiPartName && (
                            <p className='font-medium text-gray-900'>
                              {activeAiPartName}
                            </p>
                          )}
                          <p className='whitespace-pre-line'>
                            {descriptionSource}
                          </p>
                        </div>
                      ) : asset?.description ? (
                        <p className='text-sm text-gray-600 whitespace-pre-line'>
                          {asset.description}
                        </p>
                      ) : (
                        <p className='text-sm text-gray-500'>
                          We&apos;ll use the overview details above to ask AI
                          for more context.
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
                    {aiGenerationStats && (
                      <p className='text-xs text-gray-500'>
                        AI attempts used: {aiGenerationStats.attempts} of{' '}
                        {aiGenerationStats.maxAttempts}
                      </p>
                    )}
                    {aiDescription && (
                      <div className='rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 whitespace-pre-line'>
                        {aiDescription}
                      </div>
                    )}
                  </div>
                </section>

                <section className='rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
                  <div className='flex items-center justify-between'>
                    <h2 className='text-xl font-semibold text-gray-900'>
                      General Notes
                    </h2>
                    {!isEditingNotes && (
                      <button
                        type='button'
                        onClick={() => {
                          setIsEditingNotes(true);
                          setNotesError(null);
                          setNotesDraft(asset?.notes ?? '');
                        }}
                        className='rounded-md border border-green-400 bg-green-100 px-3 py-1 text-sm font-medium text-green-700 transition hover:bg-green-200'
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {isEditingNotes ? (
                    <form onSubmit={handleNotesSave} className='mt-4 space-y-3'>
                      {notesError && (
                        <p className='text-sm text-red-600'>{notesError}</p>
                      )}
                      <div>
                        <label
                          htmlFor='general-notes'
                          className='block text-sm font-medium text-gray-700'
                        >
                          Notes
                        </label>
                        <textarea
                          id='general-notes'
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          rows={5}
                          className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
                        />
                      </div>
                      <div className='flex items-center gap-3'>
                        <button
                          type='submit'
                          disabled={isSavingNotes}
                          className='inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
                        >
                          {isSavingNotes ? 'Saving...' : 'Save Notes'}
                        </button>
                        <button
                          type='button'
                          onClick={() => {
                            setIsEditingNotes(false);
                            setNotesError(null);
                            setNotesDraft(asset?.notes ?? '');
                          }}
                          className='inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100'
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : asset?.notes && asset.notes.trim().length > 0 ? (
                    (() => {
                      const full = asset.notes as string;
                      const MAX_PREVIEW = 280;
                      const shouldTruncate = full.length > MAX_PREVIEW;
                      const preview = shouldTruncate
                        ? full.slice(0, MAX_PREVIEW).trimEnd() + '…'
                        : full;
                      return (
                        <p className='mt-2 whitespace-pre-line text-sm text-gray-700'>
                          {isNotesExpanded
                            ? preview && shouldTruncate
                              ? // When expanded and truncated exists, show full content
                                full
                              : full
                            : preview}
                          {shouldTruncate && (
                            <>
                              {' '}
                              {isNotesExpanded ? (
                                <button
                                  type='button'
                                  onClick={() => setIsNotesExpanded(false)}
                                  className='text-blue-600 underline hover:text-blue-700'
                                  aria-label='Show less notes'
                                  title='Show less'
                                >
                                  Show less
                                </button>
                              ) : (
                                <button
                                  type='button'
                                  onClick={() => setIsNotesExpanded(true)}
                                  className='text-blue-600 underline hover:text-blue-700'
                                  aria-label='Show more notes'
                                  title='Show more'
                                >
                                  Show more
                                </button>
                              )}
                            </>
                          )}
                        </p>
                      );
                    })()
                  ) : (
                    <p className='mt-2 text-sm text-gray-500'>
                      No notes yet. Add any general details, reminders, or
                      context here.
                    </p>
                  )}
                </section>

                <section className='rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
                  <div className='flex items-center justify-between'>
                    <h2 className='text-xl font-semibold text-gray-900'>
                      List of Parts/Links
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
                                className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
                              />
                            </div>

                            <div>
                              <label
                                htmlFor={`part-url-${index}`}
                                className='block text-sm font-medium text-gray-700'
                              >
                                Vendor URL
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
                                className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
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
                              <div className='relative mt-1'>
                                <Calendar
                                  className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400'
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    const input =
                                      e.currentTarget.parentElement?.querySelector(
                                        "input[type='date']"
                                      ) as HTMLInputElement | null;
                                    if (input) {
                                      try {
                                        (input as any).showPicker?.();
                                      } catch {}
                                      input.focus();
                                      input.click();
                                    }
                                  }}
                                />
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
                                  onClick={(e) => {
                                    try {
                                      (e.currentTarget as any).showPicker?.();
                                    } catch {}
                                  }}
                                  className='w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm text-gray-900'
                                />
                              </div>
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
      {isNotesModalOpen && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 px-4'
          role='dialog'
          aria-modal='true'
          aria-labelledby='notes-modal-title'
        >
          <div className='w-full max-w-3xl rounded-lg bg-white p-8 shadow-xl md:max-h-[85vh] overflow-auto'>
            <div className='mb-4'>
              <h2
                id='notes-modal-title'
                className='text-lg font-semibold text-gray-900'
              >
                Asset Notes
              </h2>
              <p className='mt-1 text-sm text-gray-600'>
                View and edit notes linked to this asset.
              </p>
            </div>
            <form onSubmit={handleNotesSave} className='space-y-3'>
              {notesError && (
                <p className='text-sm text-red-600'>{notesError}</p>
              )}
              <div>
                <label
                  htmlFor='notes-modal-textarea'
                  className='block text-sm font-medium text-gray-700'
                >
                  Notes
                </label>
                <textarea
                  id='notes-modal-textarea'
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  rows={12}
                  className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 min-h-[300px]'
                />
              </div>
              <div className='mt-2 flex justify-end gap-3'>
                <button
                  type='button'
                  onClick={() => {
                    setIsNotesModalOpen(false);
                    setNotesError(null);
                    setNotesDraft(asset?.notes ?? '');
                  }}
                  disabled={isSavingNotes}
                  className='inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={isSavingNotes}
                  className='inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  {isSavingNotes ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isPartNoteModalOpen && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 px-4'
          role='dialog'
          aria-modal='true'
          aria-labelledby='part-note-modal-title'
        >
          <div className='w-full max-w-xl rounded-lg bg-white p-6 shadow-xl'>
            <h2
              id='part-note-modal-title'
              className='text-lg font-semibold text-gray-900'
            >
              Part Note
            </h2>
            <p className='mt-1 text-sm text-gray-600'>
              {(() => {
                try {
                  const p = asset?.partNumber?.[activePartNoteIndex ?? -1];
                  const label = (p?.part || p?.type || '').toString().trim();
                  return label ? `For: ${label}` : '';
                } catch {
                  return '';
                }
              })()}
            </p>
            <form onSubmit={handleSavePartNote} className='mt-4 space-y-3'>
              {partNoteError && (
                <p className='text-sm text-red-600'>{partNoteError}</p>
              )}
              <div>
                <label
                  htmlFor='part-note-textarea'
                  className='block text-sm font-medium text-gray-700'
                >
                  Note
                </label>
                <textarea
                  id='part-note-textarea'
                  value={partNoteDraft}
                  onChange={(e) => setPartNoteDraft(e.target.value)}
                  rows={8}
                  className='mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'
                  placeholder='Add a note about this part'
                />
              </div>
              <div className='mt-2 flex justify-end gap-3'>
                <button
                  type='button'
                  onClick={() => {
                    setIsPartNoteModalOpen(false);
                    setPartNoteError(null);
                    setPartNoteDraft(
                      asset?.partNumber?.[activePartNoteIndex ?? -1]?.note ?? ''
                    );
                  }}
                  disabled={isSavingPartNote}
                  className='inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={isSavingPartNote}
                  className='inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  {isSavingPartNote ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isDeleteModalOpen && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 px-4'
          role='dialog'
          aria-modal='true'
          aria-labelledby='delete-modal-title'
        >
          <div className='w-full max-w-md rounded-lg bg-white p-6 shadow-xl'>
            <h2
              id='delete-modal-title'
              className='text-lg font-semibold text-gray-900'
            >
              {deleteModalTitle}
            </h2>
            <p className='mt-2 text-sm text-gray-600'>{deleteModalMessage}</p>
            <div className='mt-6 flex justify-end gap-3'>
              <button
                type='button'
                onClick={handleCancelDelete}
                disabled={deleteModalInFlight}
                className='inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={handleDeleteConfirm}
                disabled={deleteModalInFlight}
                className='inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50'
              >
                {deleteModalConfirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
