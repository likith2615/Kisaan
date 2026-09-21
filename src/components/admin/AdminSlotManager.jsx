import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  MapPin, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Building2, 
  Wheat, 
  Filter, 
  Layers, 
  Check, 
  Info,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

const DEFAULT_MSP_RATES = {
  'Paddy': 2183,
  'Wheat': 2275,
  'Maize': 2090,
  'Cotton': 6620,
  'Pulses': 7000,
  'Chilli': 5000,
  'Groundnut': 6377,
  'Soybean': 4600
};

const TIME_WINDOWS = [
  '06:00 AM - 08:00 AM',
  '08:00 AM - 10:00 AM',
  '09:00 AM - 11:00 AM',
  '10:00 AM - 12:00 PM',
  '11:00 AM - 01:00 PM',
  '02:00 PM - 04:00 PM',
  '04:00 PM - 06:00 PM'
];

export default function AdminSlotManager({ locations = [], slots = [], crops = [], onRefresh }) {
  const mspRates = useMemo(() => {
    const map = { ...DEFAULT_MSP_RATES };
    if (Array.isArray(crops)) {
      crops.forEach(c => {
        const shortName = c.name.split(' ')[0].replace(/[^a-zA-Z]/g, '');
        if (c.msp_per_quintal) {
          map[c.name] = Number(c.msp_per_quintal);
          if (shortName) map[shortName] = Number(c.msp_per_quintal);
        }
      });
    }
    return map;
  }, [crops]);

  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedLocationFilter, setSelectedLocationFilter] = useState('ALL');
  const [selectedCropFilter, setSelectedCropFilter] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Single Slot Form State
  const [form, setForm] = useState({
    location_id: '',
    date: new Date().toISOString().slice(0, 10),
    time: '09:00 AM - 11:00 AM',
    capacity: 50,
    crop_type: 'Paddy'
  });

  // Bulk Day Schedule Form State
  const [bulkForm, setBulkForm] = useState({
    location_id: '',
    date: new Date().toISOString().slice(0, 10),
    crop_type: 'Paddy',
    capacity_per_slot: 40,
    windows: ['09:00 AM - 11:00 AM', '11:00 AM - 01:00 PM', '02:00 PM - 04:00 PM', '04:00 PM - 06:00 PM']
  });

  const activeLocations = locations.filter(l => l.status === 'active' || !l.status);

  // Group slots by date for calendar dots & counts
  const slotsCountByDate = useMemo(() => {
    const map = {};
    for (const s of slots) {
      const d = s.date;
      if (d) {
        map[d] = (map[d] || 0) + 1;
      }
    }
    return map;
  }, [slots]);

  // Calendar Grid Builder for currentMonth
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sun
    const totalDays = lastDay.getDate();

    const days = [];
    // Pad previous month days
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ day: null, dateStr: null });
    }
    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${year}-${mStr}-${dStr}`;
      days.push({
        day: d,
        dateStr,
        slotCount: slotsCountByDate[dateStr] || 0,
        isToday: dateStr === new Date().toISOString().slice(0, 10),
        isSelected: dateStr === selectedDate
      });
    }
    return days;
  }, [currentMonth, selectedDate, slotsCountByDate]);

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const flashSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  // Create Single Slot
  const handleCreateSlot = async (e) => {
    e.preventDefault();
    const locId = form.location_id || activeLocations[0]?.id;
    if (!locId) { setError('Please select an Andhra Pradesh mandi center'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await fetch('/api/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locId,
          centre_id: locId,
          date: form.date,
          time: form.time,
          time_window: form.time,
          capacity: Number(form.capacity),
          available: Number(form.capacity),
          crop_type: form.crop_type,
          msp_per_quintal: mspRates[form.crop_type] || 2183,
          status: 'active',
          created_at: new Date().toISOString()
        })
      });
      const data = await res.json();
      if (data.success) {
        flashSuccess(`Slot created successfully for ${form.date} (${form.time})!`);
        setShowCreateModal(false);
        if (onRefresh) onRefresh();
      } else {
        setError(data.error || 'Failed to create slot');
      }
    } catch {
      setError('Server error while creating slot');
    } finally {
      setLoading(false);
    }
  };

  // Bulk Generate Day Schedule
  const handleBulkGenerate = async (e) => {
    e.preventDefault();
    const locId = bulkForm.location_id || activeLocations[0]?.id;
    if (!locId) { setError('Please select a mandi center'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      let createdCount = 0;
      let dupCount = 0;
      for (const tw of bulkForm.windows) {
        const slotId = `SLOT-${locId}-${bulkForm.date.replace(/-/g, '')}-${Date.now().toString().slice(-4)}-${Math.floor(Math.random()*1000)}`;
        const res = await fetch('/api/slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: slotId,
            location_id: locId,
            centre_id: locId,
            date: bulkForm.date,
            time: tw,
            time_window: tw,
            capacity: Number(bulkForm.capacity_per_slot),
            available: Number(bulkForm.capacity_per_slot),
            crop_type: bulkForm.crop_type,
            msp_per_quintal: mspRates[bulkForm.crop_type] || 2183,
            status: 'active',
            created_at: new Date().toISOString()
          })
        });
        const data = await res.json();
        if (data.success) {
          createdCount++;
        } else if (res.status === 409) {
          dupCount++;
        }
      }
      if (createdCount > 0) {
        flashSuccess(`Generated ${createdCount} operational shifts for ${bulkForm.date}!${dupCount > 0 ? ` (${dupCount} already existed)` : ''}`);
        setShowBulkModal(false);
        if (onRefresh) onRefresh();
      } else if (dupCount > 0) {
        setError(`All ${dupCount} slots for this timing already exist on ${bulkForm.date}.`);
      } else {
        setError('Could not generate bulk slots. Please try again.');
      }
    } catch {
      setError('Server error during bulk generation');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSlot = async (slotId) => {
    if (!window.confirm('Are you sure you want to cancel and remove this slot?')) return;
    try {
      await fetch(`/api/slots/${slotId}`, { method: 'DELETE' });
      flashSuccess('Slot removed successfully');
      if (onRefresh) onRefresh();
    } catch {}
  };

  const getLocation = (id) => {
    return locations.find(l => l.id === id);
  };

  // Filter slots for the selected calendar date
  const dateSlots = useMemo(() => {
    return slots.filter(s => {
      const matchDate = s.date === selectedDate;
      const matchLoc = selectedLocationFilter === 'ALL' || s.location_id === selectedLocationFilter || s.centre_id === selectedLocationFilter;
      const matchCrop = selectedCropFilter === 'ALL' || (s.crop_type || 'Paddy') === selectedCropFilter;
      return matchDate && matchLoc && matchCrop;
    });
  }, [slots, selectedDate, selectedLocationFilter, selectedCropFilter]);

  // Context summary metrics for selected date
  const totalDateCapacity = dateSlots.reduce((sum, s) => sum + (Number(s.capacity) || 0), 0);
  const totalDateBooked = dateSlots.reduce((sum, s) => sum + (Number(s.booked_count) || (Number(s.capacity) - (Number(s.available) ?? Number(s.capacity)))), 0);
  const totalEstimatedProcurementValue = dateSlots.reduce((sum, s) => {
    const cropMsp = Number(s.msp_per_quintal) || mspRates[s.crop_type || 'Paddy'] || 2183;
    const estQuintals = (Number(s.capacity) || 0) * 15; // average 15 quintals per booked farmer
    return sum + (estQuintals * cropMsp);
  }, 0);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-emerald-600" />
            <span>Calendar Slot Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {slots.length} total procurement slots scheduled across Andhra Pradesh
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setBulkForm({ ...bulkForm, date: selectedDate });
              setShowBulkModal(true);
            }}
            className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Bulk Day Generator</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setForm({ ...form, date: selectedDate });
              setShowCreateModal(true);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Slot</span>
          </button>
        </div>
      </div>

      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Grid: Left Calendar Picker vs Right Date Schedule & Context */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* ── LEFT COLUMN: Interactive Monthly Calendar & Filters (5 Cols) ── */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Interactive Calendar Card */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3.5">
            {/* Month Header */}
            <div className="flex items-center justify-between">
              <div className="font-black text-slate-900 text-sm">
                {currentMonth.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Days of Week */}
            <div className="grid grid-cols-7 text-center text-[10px] font-black text-slate-400 uppercase tracking-wider">
              <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((item, idx) => {
                if (!item.day) {
                  return <div key={`empty-${idx}`} className="h-10 rounded-xl" />;
                }

                const isSelected = item.dateStr === selectedDate;

                return (
                  <button
                    key={item.dateStr}
                    type="button"
                    onClick={() => {
                      setSelectedDate(item.dateStr);
                      setForm(prev => ({ ...prev, date: item.dateStr }));
                    }}
                    className={`h-11 rounded-2xl flex flex-col items-center justify-center relative transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white font-black shadow-sm ring-2 ring-slate-900/20'
                        : item.isToday
                        ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-300'
                        : 'hover:bg-slate-100 text-slate-700 font-semibold'
                    }`}
                  >
                    <span className="text-xs leading-none">{item.day}</span>
                    {item.slotCount > 0 && (
                      <span className={`text-[9px] font-bold mt-0.5 leading-none px-1 rounded-full ${
                        isSelected
                          ? 'bg-emerald-400 text-slate-950 font-black'
                          : 'text-emerald-700 bg-emerald-100 font-bold'
                      }`}>
                        {item.slotCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Today quick select button */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Click any date to view scheduled slots</span>
              <button
                type="button"
                onClick={() => {
                  const todayStr = new Date().toISOString().slice(0, 10);
                  setSelectedDate(todayStr);
                  setCurrentMonth(new Date());
                }}
                className="text-emerald-700 font-bold hover:underline cursor-pointer"
              >
                Go to Today
              </button>
            </div>
          </div>

          {/* Quick Filters Card */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3 text-xs">
            <div className="font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>Filter Slots on Date</span>
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">Mandi Center</label>
              <select
                value={selectedLocationFilter}
                onChange={(e) => setSelectedLocationFilter(e.target.value)}
                className="w-full min-h-[38px] px-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white outline-none"
              >
                <option value="ALL">All Andhra Pradesh Mandis ({activeLocations.length})</option>
                {activeLocations.map(l => (
                  <option key={l.id} value={l.id}>{l.name} — {l.district}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">Crop Type</label>
              <select
                value={selectedCropFilter}
                onChange={(e) => setSelectedCropFilter(e.target.value)}
                className="w-full min-h-[38px] px-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white outline-none"
              >
                <option value="ALL">All Crops</option>
                {Object.keys(mspRates).map(c => (
                  <option key={c} value={c}>{c} (MSP: ₹{mspRates[c]}/qtl)</option>
                ))}
              </select>
            </div>
          </div>

        </div>

        {/* ── RIGHT COLUMN: Context Metrics & Scheduled Slots for Selected Date (7 Cols) ── */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Selected Date Context Banner */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/60 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                  Operating Date Overview
                </span>
                <h3 className="text-xl font-black text-white mt-0.5">
                  📅 {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </h3>
              </div>

              <div className="px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-black rounded-xl uppercase tracking-wider self-start sm:self-auto">
                {dateSlots.length} Slots Scheduled
              </div>
            </div>

            {/* Context Metrics Row */}
            <div className="grid grid-cols-3 gap-3 pt-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Capacity</span>
                <span className="text-base font-black text-white">{totalDateCapacity} farmers</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Booked / Available</span>
                <span className="text-base font-black text-emerald-400">{totalDateBooked} / {totalDateCapacity - totalDateBooked}</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Est. Procurement</span>
                <span className="text-base font-black text-amber-300">
                  ₹{(totalEstimatedProcurementValue / 100000).toFixed(1)} L
                </span>
              </div>
            </div>
          </div>

          {/* Slots List for Date */}
          <div className="space-y-3">
            {dateSlots.length === 0 ? (
              <div className="text-center py-14 bg-white rounded-3xl border border-slate-200 p-6 text-slate-400 space-y-3">
                <CalendarIcon className="w-10 h-10 mx-auto opacity-30 text-slate-500" />
                <div>
                  <p className="font-bold text-sm text-slate-700">No slots scheduled for this date</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Generate the standard 4-window day schedule or create a custom slot above.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setBulkForm({ ...bulkForm, date: selectedDate });
                    setShowBulkModal(true);
                  }}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Full Day Schedule</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {dateSlots.map((slot) => {
                  const loc = getLocation(slot.location_id || slot.centre_id);
                  const booked = Number(slot.booked_count) || (Number(slot.capacity) - (Number(slot.available) ?? Number(slot.capacity)));
                  const pct = slot.capacity > 0 ? Math.round((booked / slot.capacity) * 100) : 0;
                  const cropMsp = Number(slot.msp_per_quintal) || mspRates[slot.crop_type || 'Paddy'] || 2183;

                  return (
                    <div
                      key={slot.id}
                      className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:border-emerald-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-900 text-sm">
                            {loc?.name || 'Mandi Center'}
                          </span>
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                            {loc?.district || 'Andhra Pradesh'}
                          </span>
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                            {slot.crop_type || 'Paddy'} · ₹{cropMsp}/qtl
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          <div className="flex items-center gap-1 font-bold text-slate-700">
                            <Clock className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{slot.time || slot.time_window}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span>{booked} / {slot.capacity} farmers booked</span>
                          </div>
                        </div>

                        {/* Capacity Load Bar */}
                        <div className="mt-2 w-full max-w-xs h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-400' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.max(4, pct)}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteSlot(slot.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Cancel / Delete Slot"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* ── CREATE SINGLE SLOT MODAL ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <h3 className="text-lg font-black text-slate-900 mb-1">Create Mandi Slot</h3>
            <p className="text-xs text-slate-500 mb-4">Set operating window for Andhra Pradesh procurement yard</p>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateSlot} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mandi Procurement Center *</label>
                <select
                  required
                  value={form.location_id}
                  onChange={(e) => setForm({ ...form, location_id: e.target.value })}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-semibold bg-white outline-none"
                >
                  <option value="">Select mandi center</option>
                  {activeLocations.map(l => (
                    <option key={l.id} value={l.id}>{l.name} — {l.district}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-semibold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Time Window *</label>
                  <select
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-semibold bg-white outline-none"
                  >
                    {TIME_WINDOWS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Crop Type</label>
                  <select
                    value={form.crop_type}
                    onChange={(e) => setForm({ ...form, crop_type: e.target.value })}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-semibold bg-white outline-none"
                  >
                    {Object.keys(mspRates).map(c => (
                      <option key={c} value={c}>{c} (₹{mspRates[c]}/qtl)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Capacity (Farmers)</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-semibold outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                <strong>Context:</strong> Estimated throughput ~{(Number(form.capacity) || 0) * 15} quintals · MSP rate: ₹{mspRates[form.crop_type] || 2183}/quintal.
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-200 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Create Slot</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── BULK FULL DAY SCHEDULE GENERATOR MODAL ── */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-black text-slate-900">Bulk Day Schedule Generator</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Instantly create morning, noon, and afternoon procurement shifts for the selected date
            </p>

            <form onSubmit={handleBulkGenerate} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mandi Center *</label>
                <select
                  required
                  value={bulkForm.location_id}
                  onChange={(e) => setBulkForm({ ...bulkForm, location_id: e.target.value })}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-semibold bg-white outline-none"
                >
                  <option value="">Select mandi center</option>
                  {activeLocations.map(l => (
                    <option key={l.id} value={l.id}>{l.name} — {l.district}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Date *</label>
                  <input
                    type="date"
                    required
                    value={bulkForm.date}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setBulkForm({ ...bulkForm, date: e.target.value })}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-semibold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Crop Type</label>
                  <select
                    value={bulkForm.crop_type}
                    onChange={(e) => setBulkForm({ ...bulkForm, crop_type: e.target.value })}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-semibold bg-white outline-none"
                  >
                    {Object.keys(mspRates).map(c => (
                      <option key={c} value={c}>{c} (₹{mspRates[c]}/qtl)</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Capacity Per Window (Farmers)</label>
                <input
                  type="number"
                  min="10"
                  max="200"
                  value={bulkForm.capacity_per_slot}
                  onChange={(e) => setBulkForm({ ...bulkForm, capacity_per_slot: Number(e.target.value) })}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-semibold outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">4 Standard Operational Windows</label>
                <div className="grid grid-cols-2 gap-2">
                  {bulkForm.windows.map(w => (
                    <div key={w} className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 text-emerald-900 text-xs font-bold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">{w}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-200 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate 4 Time Slots</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
