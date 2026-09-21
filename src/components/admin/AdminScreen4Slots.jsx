import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  PlusCircle, 
  MapPin, 
  Users, 
  CheckCircle2, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
  TrendingUp,
  Trash2,
  CalendarCheck,
  ShieldAlert,
  Check
} from 'lucide-react';
import { translations } from '../../translations';

export default function AdminScreen4Slots({ 
  user, 
  lang, 
  locations = [], 
  slots = [], 
  onRefresh 
}) {
  const t = translations[lang] || translations.en;

  const activeLocations = locations.filter(l => l.status === 'active' || !l.status);
  const [selectedLocId, setSelectedLocId] = useState(activeLocations[0]?.id || 'CENTRE-101');
  
  // Year & Month navigation: defaults to September 2026 (SIH Season)
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(8); // 0-indexed: 8 = September
  const [selectedDate, setSelectedDate] = useState('2026-09-07');
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [deletingSlotId, setDeletingSlotId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [newSlotData, setNewSlotData] = useState({
    time: '04:00 PM - 06:00 PM',
    capacity: 25
  });

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Navigate Months
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleJumpToToday = () => {
    setCurrentYear(2026);
    setCurrentMonth(8);
    setSelectedDate('2026-09-07');
  };

  // Pre-calculate calendar grid cells for currentMonth & currentYear
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const cells = [];

    // Empty lead cells
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ empty: true, key: `empty-${i}` });
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const monthStr = String(currentMonth + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const dateStr = `${currentYear}-${monthStr}-${dayStr}`;

      // Filter slots for this date and selected location
      const daySlots = slots.filter(s => 
        (s.location_id === selectedLocId || s.centre_id === selectedLocId) &&
        s.date === dateStr
      );

      const totalCap = daySlots.reduce((acc, s) => acc + (Number(s.capacity || s.max_capacity) || 20), 0);
      const totalBooked = daySlots.reduce((acc, s) => acc + (Number(s.booked_count) || 0), 0);
      const pct = totalCap > 0 ? Math.min(100, Math.round((totalBooked / totalCap) * 100)) : 0;

      cells.push({
        empty: false,
        day,
        dateStr,
        slotsCount: daySlots.length,
        totalCap,
        totalBooked,
        pct,
        key: dateStr
      });
    }

    return cells;
  }, [currentYear, currentMonth, slots, selectedLocId]);

  // Slots for the active selected date
  const filteredSlots = useMemo(() => {
    return slots.filter(s => 
      (s.location_id === selectedLocId || s.centre_id === selectedLocId) &&
      s.date === selectedDate
    );
  }, [slots, selectedLocId, selectedDate]);

  // Check if any duplicates exist in filteredSlots
  const hasDuplicates = useMemo(() => {
    const seenTimes = new Set();
    for (const slot of filteredSlots) {
      const slotTime = (slot.time || slot.time_window || '').trim();
      if (seenTimes.has(slotTime)) return true;
      seenTimes.add(slotTime);
    }
    return false;
  }, [filteredSlots]);

  const selectedDayCapacity = filteredSlots.reduce((acc, s) => acc + (Number(s.capacity || s.max_capacity) || 20), 0);
  const selectedDayBooked = filteredSlots.reduce((acc, s) => acc + (Number(s.booked_count) || 0), 0);
  const selectedDayPct = selectedDayCapacity > 0 ? Math.min(100, Math.round((selectedDayBooked / selectedDayCapacity) * 100)) : 0;

  // Create slot handler with strict duplicate prevention
  const handleCreateSlot = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanTime = (newSlotData.time || '').trim();
    if (!cleanTime) {
      setErrorMsg('Please specify a valid time window');
      return;
    }

    // Check if slot with this timing already exists on selectedDate
    const existing = filteredSlots.find(s => 
      (s.time || s.time_window || '').trim().toLowerCase() === cleanTime.toLowerCase()
    );

    if (existing) {
      setErrorMsg(`⚠️ A slot for "${cleanTime}" is already configured on ${selectedDate}! You cannot add duplicate slots at the same timing.`);
      return;
    }

    setCreateLoading(true);

    try {
      const slotId = `SLOT-${selectedLocId}-${selectedDate.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
      const res = await fetch('/api/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: slotId,
          location_id: selectedLocId,
          centre_id: selectedLocId,
          date: selectedDate,
          time: cleanTime,
          time_window: cleanTime,
          capacity: Number(newSlotData.capacity) || 25,
          max_capacity: Number(newSlotData.capacity) || 25,
          booked_count: 0,
          status: 'Available',
          created_at: new Date().toISOString()
        })
      });
      const data = await res.json();
      if (data.success) {
        if (onRefresh) onRefresh();
        setSuccessMsg(`✓ Slot "${cleanTime}" opened successfully`);
        setTimeout(() => setSuccessMsg(''), 3000);
        setShowCreateModal(false);
      } else {
        setErrorMsg(data.error || 'Failed to create slot');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error creating slot');
    } finally {
      setCreateLoading(false);
    }
  };

  // Quick preset template slot adder with collision check
  const handleQuickAddTemplate = async (timeLabel, cap = 25) => {
    setErrorMsg('');
    setSuccessMsg('');

    // Check if slot already exists
    const existing = filteredSlots.find(s => 
      (s.time || s.time_window || '').trim().toLowerCase() === timeLabel.trim().toLowerCase()
    );

    if (existing) {
      setErrorMsg(`⚠️ Slot for "${timeLabel}" is already configured for ${selectedDate}! Duplicate slots at the same timing are prevented.`);
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }

    try {
      const slotId = `SLOT-${selectedLocId}-${selectedDate.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
      const res = await fetch('/api/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: slotId,
          location_id: selectedLocId,
          centre_id: selectedLocId,
          date: selectedDate,
          time: timeLabel,
          time_window: timeLabel,
          capacity: cap,
          max_capacity: cap,
          booked_count: 0,
          status: 'Available',
          created_at: new Date().toISOString()
        })
      });
      const data = await res.json();
      if (data.success) {
        if (onRefresh) onRefresh();
        setSuccessMsg(`✓ Slot "${timeLabel}" added successfully`);
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg(data.error || 'Failed to add template slot');
        setTimeout(() => setErrorMsg(''), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete slot handler
  const handleDeleteSlot = async (slotId, slotTime) => {
    if (!window.confirm(`Are you sure you want to remove the slot "${slotTime}" on ${selectedDate}?`)) {
      return;
    }
    setDeletingSlotId(slotId);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/slots/${slotId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (onRefresh) onRefresh();
        setSuccessMsg(`✓ Slot "${slotTime}" deleted successfully.`);
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg(data.error || 'Failed to delete slot');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error deleting slot');
    } finally {
      setDeletingSlotId(null);
    }
  };

  // 1-Click Deduplicate Cleanup Handler
  const handleCleanDuplicates = async () => {
    try {
      const res = await fetch('/api/slots/cleanup-duplicates', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        if (onRefresh) onRefresh();
        setSuccessMsg(`✓ ${data.message}`);
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const selectedLoc = activeLocations.find(l => l.id === selectedLocId) || activeLocations[0];

  // Helper to check if template is already configured
  const isTemplateAdded = (timeLabel) => {
    return filteredSlots.some(s => 
      (s.time || s.time_window || '').trim().toLowerCase() === timeLabel.trim().toLowerCase()
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Header & Main Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {t.slotsManagerTitle}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Live Calendar
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time monthly procurement calendar, daily gate quota allocation, and live mandi congestion control
          </p>
        </div>

        {/* Center Location Filter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-slate-300 shadow-xs">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
            <select
              value={selectedLocId}
              onChange={(e) => {
                setSelectedLocId(e.target.value);
                setErrorMsg('');
              }}
              className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer pr-1"
            >
              {activeLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.district})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setErrorMsg('');
              setShowCreateModal(true);
            }}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs flex items-center gap-2 shadow-md active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span>{t.createSlotBtn}</span>
          </button>
        </div>
      </div>

      {/* Global Alerts / Notifications */}
      {errorMsg && (
        <div className="p-3.5 bg-red-50 border-2 border-red-300 text-red-800 rounded-2xl text-xs font-bold flex items-center justify-between animate-shake">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            className="text-red-700 hover:text-red-900 font-bold ml-3 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border-2 border-emerald-300 text-emerald-900 rounded-2xl text-xs font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg('')}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-3 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Duplicate Warning Banner if any duplicates exist on this date */}
      {hasDuplicates && (
        <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-950 font-bold">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Duplicate slots detected at the same timing on {selectedDate}.</span>
          </div>
          <button
            type="button"
            onClick={handleCleanDuplicates}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            Clean Duplicate Slots
          </button>
        </div>
      )}

      {/* Main Dual-Aspect Workspace: Calendar on Left / Slots on Right (Responsive) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Full Interactive Month Calendar (7 cols on lg) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
          {/* Calendar Month Navigation Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  {monthNames[currentMonth]} {currentYear}
                </h2>
                <div className="text-[11px] text-slate-500 font-semibold">
                  Mandi: <span className="text-emerald-700">{selectedLoc?.name}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleJumpToToday}
                className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="Go to Today"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-400 uppercase tracking-wider py-1 border-b border-slate-100">
            {daysOfWeek.map(d => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          {/* Month Calendar Grid */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {calendarCells.map((cell) => {
              if (cell.empty) {
                return (
                  <div 
                    key={cell.key} 
                    className="min-h-[64px] sm:min-h-[76px] rounded-2xl bg-slate-50/40 border border-transparent"
                  />
                );
              }

              const isSelected = cell.dateStr === selectedDate;
              const isToday = cell.dateStr === '2026-09-07';
              const hasSlots = cell.slotsCount > 0;

              return (
                <div
                  key={cell.key}
                  onClick={() => {
                    setSelectedDate(cell.dateStr);
                    setErrorMsg('');
                  }}
                  className={`min-h-[68px] sm:min-h-[82px] p-1.5 sm:p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative group ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-600/30 shadow-sm'
                      : hasSlots
                      ? 'border-slate-200 hover:border-emerald-300 bg-white hover:bg-slate-50/80 shadow-xs'
                      : 'border-dashed border-slate-200 hover:border-slate-300 bg-white/60 opacity-80'
                  }`}
                >
                  {/* Day Number + Today Marker */}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs sm:text-sm font-black rounded-lg w-6 h-6 flex items-center justify-center ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : isToday
                        ? 'bg-amber-500 text-white font-bold'
                        : 'text-slate-800'
                    }`}>
                      {cell.day}
                    </span>

                    {hasSlots && (
                      <span className="text-[9px] font-black px-1 rounded-md bg-slate-100 text-slate-600">
                        {cell.slotsCount}s
                      </span>
                    )}
                  </div>

                  {/* Day Slot Capacity Bar & Metrics */}
                  {hasSlots ? (
                    <div className="space-y-1 mt-1">
                      <div className="flex items-center justify-between text-[9px] font-bold text-slate-500">
                        <span>{cell.totalBooked}/{cell.totalCap}</span>
                        <span className={`${
                          cell.pct >= 100 ? 'text-red-600' : cell.pct >= 60 ? 'text-amber-600' : 'text-emerald-700'
                        }`}>
                          {cell.pct}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            cell.pct >= 90 ? 'bg-red-500' : cell.pct >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${cell.pct}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-[9px] text-slate-300 font-medium text-center py-1">
                      No slots
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Calendar Color Legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 font-bold">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Available (&lt;60%)</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Busy (60-90%)</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span>Congested / Full (100%)</span>
              </span>
            </div>
            <div className="text-slate-400">
              Click any date to view & manage
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Selected Date Slot Manager & Congestion Monitor (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Selected Date Summary Hero */}
          <div className="bg-gradient-to-br from-slate-900 to-emerald-950 text-white rounded-3xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300">
                Selected Operating Date
              </span>
              <span className="text-xs font-bold text-slate-300">
                {selectedDate === '2026-09-07' ? 'Today' : ''}
              </span>
            </div>

            <h3 className="text-xl font-black text-white tracking-tight">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </h3>
            <p className="text-xs text-slate-300 mt-0.5 truncate">
              {selectedLoc?.name} • {selectedLoc?.district}
            </p>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-700/60 text-center">
              <div className="bg-white/10 rounded-2xl p-2 backdrop-blur-xs">
                <div className="text-lg font-black text-white">{filteredSlots.length}</div>
                <div className="text-[9px] uppercase font-bold text-slate-300">Time Windows</div>
              </div>
              <div className="bg-white/10 rounded-2xl p-2 backdrop-blur-xs">
                <div className="text-lg font-black text-amber-300">{selectedDayBooked}</div>
                <div className="text-[9px] uppercase font-bold text-slate-300">Booked Farmers</div>
              </div>
              <div className="bg-white/10 rounded-2xl p-2 backdrop-blur-xs">
                <div className="text-lg font-black text-emerald-300">{selectedDayCapacity}</div>
                <div className="text-[9px] uppercase font-bold text-slate-300">Max Capacity</div>
              </div>
            </div>

            {/* Overall Day Utilization Meter */}
            <div className="mt-3 pt-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-1">
                <span>Gate Congestion</span>
                <span>{selectedDayPct}% Booked</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    selectedDayPct >= 90 ? 'bg-red-400' : selectedDayPct >= 60 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${selectedDayPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* 1-Click Quick Slot Templates with Duplicate Detection Indicator */}
          <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                1-Click Quick Slot Templates
              </span>
              <span className="text-[10px] text-slate-400">For {selectedDate}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Template 1: Early Morning */}
              {(() => {
                const added = isTemplateAdded('07:00 AM - 09:00 AM');
                return (
                  <button
                    type="button"
                    onClick={() => handleQuickAddTemplate('07:00 AM - 09:00 AM', 30)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      added
                        ? 'border-emerald-400 bg-emerald-50/60 ring-1 ring-emerald-500/30'
                        : 'border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 active:scale-95'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-900">🌅 Early Morning</div>
                      {added && (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white text-[8px] font-black uppercase flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> Active
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">07:00 AM - 09:00 AM (30 Q)</div>
                  </button>
                );
              })()}

              {/* Template 2: Midday Batch */}
              {(() => {
                const added = isTemplateAdded('11:00 AM - 01:00 PM');
                return (
                  <button
                    type="button"
                    onClick={() => handleQuickAddTemplate('11:00 AM - 01:00 PM', 30)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      added
                        ? 'border-emerald-400 bg-emerald-50/60 ring-1 ring-emerald-500/30'
                        : 'border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 active:scale-95'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-900">☀️ Midday Batch</div>
                      {added && (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white text-[8px] font-black uppercase flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> Active
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">11:00 AM - 01:00 PM (30 Q)</div>
                  </button>
                );
              })()}

              {/* Template 3: Afternoon Batch */}
              {(() => {
                const added = isTemplateAdded('02:00 PM - 04:00 PM');
                return (
                  <button
                    type="button"
                    onClick={() => handleQuickAddTemplate('02:00 PM - 04:00 PM', 25)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      added
                        ? 'border-emerald-400 bg-emerald-50/60 ring-1 ring-emerald-500/30'
                        : 'border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 active:scale-95'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-900">🌤️ Afternoon Batch</div>
                      {added && (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white text-[8px] font-black uppercase flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> Active
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">02:00 PM - 04:00 PM (25 Q)</div>
                  </button>
                );
              })()}

              {/* Template 4: Evening Batch */}
              {(() => {
                const added = isTemplateAdded('04:00 PM - 06:00 PM');
                return (
                  <button
                    type="button"
                    onClick={() => handleQuickAddTemplate('04:00 PM - 06:00 PM', 25)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      added
                        ? 'border-emerald-400 bg-emerald-50/60 ring-1 ring-emerald-500/30'
                        : 'border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 active:scale-95'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-900">🌆 Evening Batch</div>
                      {added && (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white text-[8px] font-black uppercase flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> Active
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">04:00 PM - 06:00 PM (25 Q)</div>
                  </button>
                );
              })()}
            </div>
          </div>

          {/* List of Configured Slots for this date */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Configured Slots ({filteredSlots.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setShowCreateModal(true);
                }}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Custom Slot
              </button>
            </div>

            {filteredSlots.length === 0 ? (
              <div className="bg-white rounded-3xl p-6 border border-dashed border-slate-300 text-center space-y-2">
                <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                <h4 className="text-xs font-bold text-slate-700">No slots configured for this date</h4>
                <p className="text-[11px] text-slate-400">
                  Tap a quick template above or create a custom slot to open mandi gate bookings.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="mt-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  + Add Custom Slot
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredSlots.map((slot) => {
                  const cap = Number(slot.capacity || slot.max_capacity) || 20;
                  const booked = Number(slot.booked_count) || 0;
                  const pct = Math.min(100, Math.round((booked / cap) * 100));
                  const slotTimeStr = slot.time || slot.time_window;

                  return (
                    <div
                      key={slot.id}
                      className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs space-y-2.5 transition-all hover:border-slate-300"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                            <Clock className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs sm:text-sm font-black text-slate-900">
                            {slotTimeStr}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            pct >= 100 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {pct >= 100 ? 'Full' : 'Available'}
                          </span>

                          {/* Delete Slot Button */}
                          <button
                            type="button"
                            disabled={deletingSlotId === slot.id}
                            onClick={() => handleDeleteSlot(slot.id, slotTimeStr)}
                            className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 active:scale-95 text-red-600 flex items-center justify-center transition-all cursor-pointer"
                            title="Delete this slot"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                          <span>Booked: {booked} of {cap} farmers</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              pct >= 90 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                        <span>Slot ID: {slot.id}</span>
                        <span className="font-bold text-emerald-700">
                          {cap - booked} vacancies left
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Custom Slot Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Create Procurement Slot
                </h3>
                <p className="text-[11px] text-slate-500">
                  For {selectedDate} at {selectedLoc?.name}
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateSlot} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Operating Date
                </label>
                <input
                  type="date"
                  required
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setErrorMsg('');
                  }}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Time Window
                </label>
                <input
                  type="text"
                  required
                  value={newSlotData.time}
                  onChange={(e) => {
                    setNewSlotData({ ...newSlotData, time: e.target.value });
                    setErrorMsg('');
                  }}
                  placeholder="e.g. 04:00 PM - 06:00 PM"
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Slot Capacity (Max Farmers)
                </label>
                <input
                  type="number"
                  min={5}
                  max={150}
                  required
                  value={newSlotData.capacity}
                  onChange={(e) => setNewSlotData({ ...newSlotData, capacity: e.target.value })}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-semibold"
                />
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={createLoading}
                  className="w-full min-h-[46px] bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center cursor-pointer"
                >
                  {createLoading ? 'Creating Slot...' : 'Confirm & Open Slot'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setShowCreateModal(false);
                  }}
                  className="w-full min-h-[42px] bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
