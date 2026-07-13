'use client';

import { useState, useEffect, useMemo } from 'react';
import { useT } from '@/hooks/use-t';
import { useApp } from '@/lib/store';
import { GlassCard } from '@/components/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import { motion } from 'framer-motion';
import {
  Loader2,
  Building2,
  CalendarDays,
  Clock,
  Users,
  FileText,
  Tag,
  Wrench,
  StickyNote,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  Save,
  Send,
  X,
  Lightbulb,
  MapPin,
  Monitor,
  GraduationCap,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/* ============================================================
   BookingFormView — FR-01 Permohonan Tempahan
   Sistem e-Tempahan PLTT-JTM
   - Glassmorphism, teal/emerald/amber palette
   - Bilingual (BM/BI) via useT()
   - Real-time conflict check + capacity warning
   - Save-as-draft + official submit
   ============================================================ */

interface Facility {
  id: string;
  name: string;
  category: 'COMPUTER_ROOM' | 'LECTURE_HALL' | string;
  capacity: number;
  location?: string | null;
  equipment?: string | null;
  operatingStart: string;
  operatingEnd: string;
  colorCode: string;
  status: string;
}

interface ConflictAlternative {
  startTime: string;
  endTime: string;
  facilityId: string;
  facilityName: string;
}

interface ConflictResult {
  hasConflict: boolean;
  conflictingBookings: Array<{
    id: string;
    bookingRef: string;
    startTime: string;
    endTime: string;
    status: string;
    programName: string | null;
  }>;
  alternatives: ConflictAlternative[];
}

type CategoryFilter = 'all' | 'COMPUTER_ROOM' | 'LECTURE_HALL';

export function BookingFormView() {
  const { t, lang } = useT();
  const { bookingPrefill, setBookingPrefill, setView } = useApp();

  /* ---------------- form state ---------------- */
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [facilityId, setFacilityId] = useState('');
  const [date, setDate] = useState<Date | undefined>();
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [programName, setProgramName] = useState('');
  const [participantCount, setParticipantCount] = useState('');
  const [equipmentNeeded, setEquipmentNeeded] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [conflictResult, setConflictResult] = useState<ConflictResult | null>(null);
  const [validated, setValidated] = useState(false);
  const [prefillApplied, setPrefillApplied] = useState(false);

  /* ---------------- fetch facilities ---------------- */
  const { data: facilities, isLoading: loadingFacilities } = useQuery<Facility[]>({
    queryKey: ['facilities'],
    queryFn: async () => {
      const r = await fetch('/api/facilities');
      const j = await r.json();
      return j.data as Facility[];
    },
  });

  const filteredFacilities = useMemo(() => {
    if (!facilities) return [];
    if (category === 'all') return facilities;
    return facilities.filter((f) => f.category === category);
  }, [facilities, category]);

  const selectedFacility = useMemo(
    () => facilities?.find((f) => f.id === facilityId) ?? null,
    [facilities, facilityId],
  );

  /* ---------------- pre-fill from AI parse ---------------- */
  useEffect(() => {
    if (prefillApplied || !bookingPrefill) return;
    const p = bookingPrefill;
    if (typeof p.facilityId === 'string' && p.facilityId) {
      setFacilityId(p.facilityId);
      const f = facilities?.find((x) => x.id === p.facilityId);
      if (f) setCategory(f.category as CategoryFilter);
    }
    if (typeof p.date === 'string' && p.date) {
      const d = new Date(p.date);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        setDate(d);
      }
    }
    if (typeof p.startTime === 'string' && p.startTime) setStartTime(p.startTime);
    if (typeof p.endTime === 'string' && p.endTime) setEndTime(p.endTime);
    if (typeof p.participants === 'number' && p.participants > 0) {
      setParticipantCount(String(p.participants));
    }
    if (typeof p.purpose === 'string' && p.purpose) setPurpose(p.purpose);
    setPrefillApplied(true);
    setBookingPrefill(null);
    toast.info(
      lang === 'bm'
        ? 'Borang diisi automatik dari AI'
        : 'Form auto-filled from AI',
    );
  }, [bookingPrefill, facilities, prefillApplied, setBookingPrefill, lang]);

  /* ---------------- time options ---------------- */
  const timeOptions = useMemo(() => {
    const start = selectedFacility?.operatingStart ?? '08:00';
    const end = selectedFacility?.operatingEnd ?? '22:00';
    const startMin = parseInt(start.slice(0, 2), 10) * 60 + parseInt(start.slice(3, 5), 10);
    const endMin = parseInt(end.slice(0, 2), 10) * 60 + parseInt(end.slice(3, 5), 10);
    const opts: { value: string; label: string }[] = [];
    for (let m = startMin; m < endMin; m += 30) {
      const h = Math.floor(m / 60).toString().padStart(2, '0');
      const min = (m % 60).toString().padStart(2, '0');
      opts.push({ value: `${h}:${min}`, label: `${h}:${min}` });
    }
    return opts;
  }, [selectedFacility]);

  /* ---------------- derived: capacity + time validity ---------------- */
  const participants = parseInt(participantCount, 10);
  const capacityExceeded =
    !!selectedFacility && !isNaN(participants) && participants > selectedFacility.capacity;
  const invalidTime = !!startTime && !!endTime && startTime >= endTime;

  /* ---------------- real-time conflict check (debounced) ---------------- */
  useEffect(() => {
    if (!facilityId || !date || !startTime || !endTime || invalidTime) {
      setConflictResult(null);
      setCheckingConflict(false);
      return;
    }
    let cancelled = false;
    setCheckingConflict(true);
    const iso = new Date(date);
    iso.setHours(0, 0, 0, 0);
    const timer = setTimeout(async () => {
      try {
        const r = await fetch('/api/bookings/check-conflict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            facilityId,
            eventDate: iso.toISOString(),
            startTime,
            endTime,
          }),
        });
        const j = await r.json();
        if (!cancelled && j?.data) setConflictResult(j.data as ConflictResult);
      } catch {
        /* network error — silent */
      } finally {
        if (!cancelled) setCheckingConflict(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [facilityId, date, startTime, endTime, invalidTime]);

  /* ---------------- validation ---------------- */
  const errors = useMemo<Record<string, string>>(() => {
    const e: Record<string, string> = {};
    if (!facilityId) e.facilityId = lang === 'bm' ? 'Sila pilih kemudahan' : 'Please select a facility';
    if (!date) e.date = lang === 'bm' ? 'Sila pilih tarikh' : 'Please select a date';
    if (!startTime) e.startTime = lang === 'bm' ? 'Sila pilih masa mula' : 'Please select start time';
    if (!endTime) e.endTime = lang === 'bm' ? 'Sila pilih masa tamat' : 'Please select end time';
    if (invalidTime) e.time = lang === 'bm' ? 'Masa tamat mesti selepas masa mula' : 'End time must be after start time';
    if (!purpose.trim() || purpose.trim().length < 3)
      e.purpose = lang === 'bm' ? 'Tujuan diperlukan (minimum 3 aksara)' : 'Purpose required (min 3 chars)';
    if (!participantCount || isNaN(participants) || participants < 1)
      e.participants = lang === 'bm' ? 'Bilangan peserta diperlukan' : 'Participant count required';
    return e;
  }, [facilityId, date, startTime, endTime, purpose, participantCount, participants, invalidTime, lang]);

  const hasErrors = Object.keys(errors).length > 0;
  const showErrors = validated;
  const hasConflict = !!conflictResult?.hasConflict;
  const canSubmit = !hasErrors && !capacityExceeded && !hasConflict && !checkingConflict;

  /* ---------------- alternative slot click ---------------- */
  const applyAlternative = (alt: ConflictAlternative) => {
    setStartTime(alt.startTime);
    setEndTime(alt.endTime);
    toast.success(
      lang === 'bm'
        ? `Slot alternatif dipilih: ${alt.startTime} – ${alt.endTime}`
        : `Alternative slot applied: ${alt.startTime} – ${alt.endTime}`,
    );
  };

  /* ---------------- build payload helper ---------------- */
  const buildPayload = (asDraft: boolean) => {
    const iso = date ? new Date(date) : new Date();
    iso.setHours(0, 0, 0, 0);
    return {
      facilityId,
      eventDate: iso.toISOString(),
      startTime: startTime || (selectedFacility?.operatingStart ?? '08:00'),
      endTime: endTime || (selectedFacility?.operatingStart ?? '10:00'),
      purpose: purpose.trim() || (lang === 'bm' ? 'Draf Permohonan' : 'Draft Booking'),
      programName: programName.trim() || undefined,
      participantCount: !isNaN(participants) && participants > 0 ? participants : 1,
      equipmentNeeded: equipmentNeeded.trim() || undefined,
      notes: notes.trim() || undefined,
      isDraft: asDraft,
    };
  };

  /* ---------------- submit handler ---------------- */
  const handleSubmit = async (asDraft: boolean) => {
    setValidated(true);
    if (hasErrors) {
      toast.error(lang === 'bm' ? 'Sila lengkapkan borang' : 'Please complete the form');
      return;
    }
    if (asDraft) {
      setSavingDraft(true);
    } else {
      if (capacityExceeded) {
        toast.error(t('form_capacity_warn'));
        return;
      }
      setSubmitting(true);
      // Real-time conflict re-check before submission
      try {
        const iso = new Date(date!);
        iso.setHours(0, 0, 0, 0);
        const checkR = await fetch('/api/bookings/check-conflict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            facilityId,
            eventDate: iso.toISOString(),
            startTime,
            endTime,
          }),
        });
        const checkJ = await checkR.json();
        if (checkJ?.data?.hasConflict) {
          setConflictResult(checkJ.data as ConflictResult);
          toast.error(t('form_conflict_warn'));
          setSubmitting(false);
          return;
        }
      } catch {
        toast.error(lang === 'bm' ? 'Ralat semakan konflik' : 'Conflict check error');
        setSubmitting(false);
        return;
      }
    }

    try {
      const payload = buildPayload(asDraft);
      const r = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        const msg = j?.message ?? (lang === 'bm' ? 'Permohonan gagal dihantar' : 'Submission failed');
        toast.error(msg);
        return;
      }
      if (asDraft) {
        toast.info(lang === 'bm' ? 'Draf berjaya disimpan.' : 'Draft saved successfully.');
      } else {
        toast.success(t('form_success'));
      }
      setView('dashboard');
    } catch {
      toast.error(lang === 'bm' ? 'Ralat rangkaian. Cuba lagi.' : 'Network error. Try again.');
    } finally {
      setSubmitting(false);
      setSavingDraft(false);
    }
  };

  /* ---------------- helpers ---------------- */
  const equipmentList = useMemo(() => {
    if (!selectedFacility?.equipment) return [];
    try {
      const parsed = JSON.parse(selectedFacility.equipment);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return selectedFacility.equipment
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }, [selectedFacility]);

  const locale = lang === 'bm' ? 'ms-MY' : 'en-GB';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hasAlternatives = hasConflict && (conflictResult?.alternatives?.length ?? 0) > 0;

  /* ---------------- render ---------------- */
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4 pb-8"
    >
      {/* ===== HERO ===== */}
      <GlassCard className="p-5 lg:p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground uppercase tracking-wider mb-2">
            <Sparkles className="w-3 h-3 text-teal-500" />
            <span>{lang === 'bm' ? 'Borang Permohonan' : 'Booking Application'}</span>
          </div>
          <h2 className="text-xl lg:text-2xl font-bold gradient-text mb-1">
            {t('nav_book')}
          </h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            {lang === 'bm'
              ? 'Isi borang di bawah untuk memohon tempahan kemudahan. Semakan konflik & kapasiti dibuat secara automatik.'
              : 'Complete the form below to apply for a facility booking. Conflict and capacity checks run automatically.'}
          </p>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
        {/* ===== MAIN FORM (2 cols) ===== */}
        <GlassCard className="lg:col-span-2 p-5 lg:p-6 space-y-5 min-w-0 overflow-visible">
          {/* Category + Facility */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Tag className="w-3 h-3 text-teal-500" />
                {lang === 'bm' ? 'Jenis Kemudahan' : 'Facility Type'}
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <CategoryChip
                  active={category === 'all'}
                  onClick={() => {
                    setCategory('all');
                    setFacilityId('');
                  }}
                  icon={<Building2 className="w-3.5 h-3.5" />}
                  label={lang === 'bm' ? 'Semua' : 'All'}
                />
                <CategoryChip
                  active={category === 'COMPUTER_ROOM'}
                  onClick={() => {
                    setCategory('COMPUTER_ROOM');
                    setFacilityId('');
                  }}
                  icon={<Monitor className="w-3.5 h-3.5" />}
                  label={lang === 'bm' ? 'Bilik Komputer' : 'Computer Room'}
                />
                <CategoryChip
                  active={category === 'LECTURE_HALL'}
                  onClick={() => {
                    setCategory('LECTURE_HALL');
                    setFacilityId('');
                  }}
                  icon={<GraduationCap className="w-3.5 h-3.5" />}
                  label={lang === 'bm' ? 'Dewan Kuliah' : 'Lecture Hall'}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="facility" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 className="w-3 h-3 text-teal-500" />
                {t('form_facility')} <span className="text-destructive">*</span>
              </Label>
              <Select value={facilityId} onValueChange={setFacilityId}>
                <SelectTrigger
                  id="facility"
                  className={cn('glass-input w-full min-w-0', showErrors && errors.facilityId && 'border-destructive ring-destructive/30')}
                >
                  <SelectValue placeholder={
                    loadingFacilities
                      ? t('loading')
                      : lang === 'bm'
                        ? 'Pilih kemudahan…'
                        : 'Select facility…'
                  } />
                </SelectTrigger>
                <SelectContent className="glass-strong max-h-72">
                  {filteredFacilities.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      {lang === 'bm' ? 'Tiada kemudahan' : 'No facilities'}
                    </div>
                  ) : (
                    filteredFacilities.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        <span className="flex items-center gap-2 min-w-0 w-full">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: f.colorCode }}
                          />
                          <span className="truncate">{f.name}</span>
                          <span className="text-muted-foreground text-[10px] shrink-0">
                            · {lang === 'bm' ? 'Kapasiti' : 'Cap.'} {f.capacity}
                          </span>
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {showErrors && errors.facilityId && (
                <p className="text-[11px] text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.facilityId}
                </p>
              )}
            </div>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="w-3 h-3 text-teal-500" />
              {t('form_date')} <span className="text-destructive">*</span>
            </Label>
            <div className="flex flex-col sm:flex-row gap-3 items-start min-w-0 w-full overflow-visible">
              <div className="glass-input rounded-lg p-1 inline-block overflow-visible shrink-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => d < today}
                  locale={locale === 'ms-MY' ? undefined : undefined}
                  className="text-xs"
                />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                {date ? (
                  <div className="glass-input rounded-md px-3 py-2.5 text-sm flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-teal-500" />
                    <span className="font-medium">
                      {date.toLocaleDateString(locale, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                ) : (
                  <div className="glass-input rounded-md px-3 py-2.5 text-sm text-muted-foreground italic">
                    {lang === 'bm' ? 'Pilih tarikh dari kalendar' : 'Pick a date from the calendar'}
                  </div>
                )}
                {showErrors && errors.date && (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.date}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-teal-500" />
                {t('form_start')} <span className="text-destructive">*</span>
              </Label>
              <Select value={startTime} onValueChange={setStartTime} disabled={timeOptions.length === 0}>
                <SelectTrigger className={cn('glass-input w-full min-w-0', showErrors && errors.startTime && 'border-destructive ring-destructive/30')}>
                  <SelectValue placeholder={lang === 'bm' ? 'Mula' : 'Start'} />
                </SelectTrigger>
                <SelectContent className="glass-strong max-h-64">
                  {timeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {showErrors && errors.startTime && (
                <p className="text-[11px] text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.startTime}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-teal-500" />
                {t('form_end')} <span className="text-destructive">*</span>
              </Label>
              <Select value={endTime} onValueChange={setEndTime} disabled={timeOptions.length === 0}>
                <SelectTrigger className={cn('glass-input w-full min-w-0', showErrors && errors.endTime && 'border-destructive ring-destructive/30')}>
                  <SelectValue placeholder={lang === 'bm' ? 'Tamat' : 'End'} />
                </SelectTrigger>
                <SelectContent className="glass-strong max-h-64">
                  {timeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {showErrors && errors.endTime && (
                <p className="text-[11px] text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.endTime}
                </p>
              )}
            </div>
          </div>
          {invalidTime && (
            <p className="text-[11px] text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.time}
            </p>
          )}

          {/* Purpose */}
          <div className="space-y-2">
            <Label htmlFor="purpose" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="w-3 h-3 text-teal-500" />
              {t('form_purpose')} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder={lang === 'bm' ? 'cth: Latihan pengaturcaraan staf baru' : 'e.g. Programming training for new staff'}
              className={cn('glass-input resize-none w-full min-h-[64px]', showErrors && errors.purpose && 'border-destructive ring-destructive/30')}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{showErrors && errors.purpose ? errors.purpose : ''}</span>
              <span>{purpose.length}/300</span>
            </div>
          </div>

          {/* Program name + participants */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="program" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Tag className="w-3 h-3 text-teal-500" />
                {t('form_program')}
              </Label>
              <Input
                id="program"
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                maxLength={200}
                placeholder={lang === 'bm' ? 'cth: Kursus Python Asas' : 'e.g. Basic Python Course'}
                className="glass-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="participants" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users className="w-3 h-3 text-teal-500" />
                {t('form_participants')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="participants"
                type="number"
                min={1}
                max={1000}
                value={participantCount}
                onChange={(e) => setParticipantCount(e.target.value)}
                placeholder="0"
                className={cn('glass-input text-center', showErrors && errors.participants && 'border-destructive ring-destructive/30')}
              />
              {showErrors && errors.participants && (
                <p className="text-[11px] text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.participants}
                </p>
              )}
            </div>
          </div>

          {/* Equipment */}
          <div className="space-y-2">
            <Label htmlFor="equipment" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Wrench className="w-3 h-3 text-teal-500" />
              {t('form_equipment')}
            </Label>
            <Textarea
              id="equipment"
              value={equipmentNeeded}
              onChange={(e) => setEquipmentNeeded(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder={lang === 'bm' ? 'cth: 30 set komputer, projektor, mikrofon' : 'e.g. 30 computers, projector, microphone'}
              className="glass-input resize-none"
            />
            {selectedFacility && equipmentList.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {equipmentList.slice(0, 6).map((eq: string, i: number) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      const cur = equipmentNeeded.trim();
                      setEquipmentNeeded(cur ? `${cur}, ${eq}` : eq);
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 transition-colors"
                  >
                    + {eq}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <StickyNote className="w-3 h-3 text-teal-500" />
              {t('form_notes')}
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder={lang === 'bm' ? 'Catatan tambahan untuk pentadbir…' : 'Additional notes for the admin…'}
              className="glass-input resize-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/40">
            <Button
              onClick={() => handleSubmit(false)}
              disabled={submitting || savingDraft}
              className="flex-1 gradient-primary text-primary-foreground hover:opacity-90"
              size="lg"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {t('form_submit')}
            </Button>
            <Button
              onClick={() => handleSubmit(true)}
              disabled={submitting || savingDraft}
              variant="outline"
              className="flex-1 glass-input border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
              size="lg"
            >
              {savingDraft ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {t('form_save_draft')}
            </Button>
            <Button
              onClick={() => setView('dashboard')}
              variant="ghost"
              size="lg"
              disabled={submitting || savingDraft}
              className="sm:w-auto"
            >
              <X className="w-4 h-4" />
              {t('form_cancel')}
            </Button>
          </div>
        </GlassCard>

        {/* ===== SIDE PANEL (1 col) ===== */}
        <div className="space-y-4">
          {/* Selected facility info */}
          {selectedFacility ? (
            <GlassCard strong className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ background: selectedFacility.colorCode }}
                />
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {selectedFacility.category === 'COMPUTER_ROOM'
                    ? lang === 'bm' ? 'Bilik Komputer' : 'Computer Room'
                    : lang === 'bm' ? 'Dewan Kuliah' : 'Lecture Hall'}
                </span>
              </div>
              <h3 className="text-lg font-bold gradient-text leading-tight">{selectedFacility.name}</h3>
              {selectedFacility.location && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  <span>{selectedFacility.location}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="glass-input rounded-md p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Users className="w-2.5 h-2.5" /> {lang === 'bm' ? 'Kapasiti' : 'Capacity'}
                  </div>
                  <div className="text-base font-bold text-teal-600 dark:text-teal-400">{selectedFacility.capacity}</div>
                </div>
                <div className="glass-input rounded-md p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> {lang === 'bm' ? 'Operasi' : 'Hours'}
                  </div>
                  <div className="text-base font-bold text-teal-600 dark:text-teal-400">
                    {selectedFacility.operatingStart}–{selectedFacility.operatingEnd}
                  </div>
                </div>
              </div>
              {equipmentList.length > 0 && (
                <div className="pt-1">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Wrench className="w-2.5 h-2.5" /> {lang === 'bm' ? 'Peralatan Tersedia' : 'Equipment Available'}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {equipmentList.map((eq: string, i: number) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                        {eq}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </GlassCard>
          ) : (
            <GlassCard className="p-5 text-center text-sm text-muted-foreground">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>{lang === 'bm' ? 'Pilih kemudahan untuk lihat butiran.' : 'Select a facility to see details.'}</p>
            </GlassCard>
          )}

          {/* Capacity warning */}
          {capacityExceeded && selectedFacility && (
            <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle className="text-amber-800 dark:text-amber-200">
                {lang === 'bm' ? 'Amaran Kapasiti' : 'Capacity Warning'}
              </AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-300 text-xs">
                {t('form_capacity_warn')} ({participants} / {selectedFacility.capacity})
              </AlertDescription>
            </Alert>
          )}

          {/* Conflict checking indicator */}
          {checkingConflict && (
            <div className="glass-card rounded-lg p-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-500" />
              <span>{lang === 'bm' ? 'Memeriksa konflik masa…' : 'Checking for time conflicts…'}</span>
            </div>
          )}

          {/* Conflict warning */}
          {hasConflict && conflictResult && (
            <Alert variant="destructive" className="border-destructive/40 bg-destructive/10">
              <AlertCircle className="w-4 h-4" />
              <AlertTitle>
                {lang === 'bm' ? 'Konflik Dikesan' : 'Conflict Detected'}
              </AlertTitle>
              <AlertDescription className="space-y-2">
                <p className="text-xs">{t('form_conflict_warn')}</p>
                {conflictResult.conflictingBookings.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {conflictResult.conflictingBookings.slice(0, 3).map((b) => (
                      <div
                        key={b.id}
                        className="text-[10px] px-2 py-1 rounded bg-destructive/10 border border-destructive/20 flex items-center justify-between gap-2"
                      >
                        <span className="font-mono">{b.bookingRef}</span>
                        <span className="font-semibold">
                          {b.startTime}–{b.endTime}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Alternative slots */}
          {hasAlternatives && conflictResult && (
            <GlassCard className="p-4 space-y-2 border-emerald-500/30">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <Lightbulb className="w-3.5 h-3.5" />
                <span>{lang === 'bm' ? 'Slot Alternatif Tersedia' : 'Alternative Slots Available'}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {conflictResult.alternatives.map((alt, i) => (
                  <button
                    key={`${alt.startTime}-${i}`}
                    onClick={() => applyAlternative(alt)}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/25 transition-colors border border-emerald-500/30 font-medium"
                  >
                    {alt.startTime}–{alt.endTime}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {lang === 'bm' ? 'Klik untuk guna slot alternatif.' : 'Click to apply an alternative slot.'}
              </p>
            </GlassCard>
          )}

          {/* Tips */}
          <GlassCard className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 dark:text-teal-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{lang === 'bm' ? 'Tip Permohonan' : 'Booking Tips'}</span>
            </div>
            <ul className="text-[11px] text-muted-foreground space-y-1.5 leading-relaxed">
              <li className="flex gap-1.5">
                <span className="text-teal-500">•</span>
                <span>
                  {lang === 'bm'
                    ? 'Semakan konflik dibuat secara real-time semasa anda mengisi.'
                    : 'Conflict check runs in real-time as you fill the form.'}
                </span>
              </li>
              <li className="flex gap-1.5">
                <span className="text-teal-500">•</span>
                <span>
                  {lang === 'bm'
                    ? 'Draf boleh disimpan dan dihantar kemudian.'
                    : 'Drafts can be saved and submitted later.'}
                </span>
              </li>
              <li className="flex gap-1.5">
                <span className="text-teal-500">•</span>
                <span>
                  {lang === 'bm'
                    ? 'Tempahan dewan kuliah > 100 peserta memerlukan kelulusan berperingkat.'
                    : 'Lecture hall bookings > 100 pax require multi-level approval.'}
                </span>
              </li>
            </ul>
          </GlassCard>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================
   Category chip — small toggle for facility type filter
   ============================================================ */
function CategoryChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs font-medium transition-all border',
        active
          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
          : 'glass-input border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/50',
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
