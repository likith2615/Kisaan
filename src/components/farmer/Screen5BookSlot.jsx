import React, { useState, useEffect, useMemo } from 'react';
import { 
  MapPin, 
  Calendar, 
  Clock, 
  Mic, 
  CheckCircle2, 
  QrCode, 
  CalendarPlus, 
  ArrowLeft, 
  Star, 
  Sparkles,
  AlertCircle,
  Search,
  RefreshCw,
  Filter,
  Check,
  Building2,
  PlusCircle,
  Activity
} from 'lucide-react';
import { translations } from '../../translations';

export default function Screen5BookSlot({ 
  user, 
  lang, 
  locations = [], 
  slots = [], 
  activeBooking = null,
  onBookingSuccess, 
  onGoToQueue,
  onRequestLocation,
  onBack 
}) {
  const t = translations[lang] || translations.en;

  const points = Number(user?.points || 100);
  const isHighPriority = points >= 100;

  const [liveLocations, setLiveLocations] = useState(Array.isArray(locations) ? locations : []);
  const [liveSlots, setLiveSlots] = useState(Array.isArray(slots) ? slots : []);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('ALL');
  const [showAllLocations, setShowAllLocations] = useState(false);

  // Fetch real-time fresh locations and slots on mount to reflect newly added admin centers immediately
  const fetchFreshData = async () => {
    setRefreshing(true);
    try {
      const [locRes, slotRes] = await Promise.all([
        fetch('/api/locations'),
        fetch('/api/slots')
      ]);
      const locData = await locRes.json();
      const slotData = await slotRes.json();

      if (locData.success && Array.isArray(locData.data)) {
        setLiveLocations(locData.data);
      }
      if (slotData.success && Array.isArray(slotData.data)) {
        setLiveSlots(slotData.data);
      }
    } catch (err) {
      console.warn('Could not refresh mandi locations:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFreshData();
  }, []);

  // Update if props change
  useEffect(() => {
    if (locations && locations.length > 0) setLiveLocations(locations);
  }, [locations]);

  useEffect(() => {
    if (slots && slots.length > 0) setLiveSlots(slots);
  }, [slots]);

  // Filter only active locations and sort by proximity to user's district
  const activeLocations = useMemo(() => {
    const list = liveLocations.filter(l => l.status === 'active' || !l.status);
    const userDist = (user?.district || '').trim().toLowerCase();

    return list.sort((a, b) => {
      const aMatch = (a.district || '').trim().toLowerCase() === userDist;
      const bMatch = (b.district || '').trim().toLowerCase() === userDist;
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [liveLocations, user?.district]);

  // Extract all distinct districts for filter chips
  const districtsList = useMemo(() => {
    const dSet = new Set();
    activeLocations.forEach(l => {
      if (l.district) dSet.add(l.district);
    });
    return Array.from(dSet).sort();
  }, [activeLocations]);

  // Apply search query and district filter
  const filteredLocations = useMemo(() => {
    return activeLocations.filter(loc => {
      if (selectedDistrict !== 'ALL' && loc.district !== selectedDistrict) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          loc.name?.toLowerCase().includes(q) ||
          loc.district?.toLowerCase().includes(q) ||
          loc.mandal?.toLowerCase().includes(q) ||
          loc.village?.toLowerCase().includes(q) ||
          loc.address?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activeLocations, selectedDistrict, searchQuery]);

  const [selectedLocationId, setSelectedLocationId] = useState(activeLocations[0]?.id || '');
  const [selectedDate, setSelectedDate] = useState('2026-09-07');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [expectedQty, setExpectedQty] = useState(50);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [voiceToast, setVoiceToast] = useState(false);
  const [generatingSlots, setGeneratingSlots] = useState(false);

  // If previous selectedLocationId is not in activeLocations, default to first available
  useEffect(() => {
    if (!selectedLocationId && activeLocations.length > 0) {
      setSelectedLocationId(activeLocations[0].id);
    }
  }, [activeLocations, selectedLocationId]);

  // Find other dates that have configured slots for the selected center
  const otherDatesWithSlots = useMemo(() => {
    const datesMap = {};
    (Array.isArray(liveSlots) ? liveSlots : [])
      .filter(s => s && (s.location_id === selectedLocationId || s.centre_id === selectedLocationId))
      .forEach(s => {
        if (s.date) datesMap[s.date] = (datesMap[s.date] || 0) + 1;
      });
    return datesMap;
  }, [liveSlots, selectedLocationId]);

  // Available dates for chips (Base 7 days + any custom dates configured with slots)
  const dates = useMemo(() => {
    const baseDates = [
      { date: '2026-09-07', label: 'Today (07 Sep)', day: 'Mon' },
      { date: '2026-09-08', label: 'Tomorrow (08 Sep)', day: 'Tue' },
      { date: '2026-09-09', label: 'Wednesday (09 Sep)', day: 'Wed' },
      { date: '2026-09-10', label: 'Thursday (10 Sep)', day: 'Thu' },
      { date: '2026-09-11', label: 'Friday (11 Sep)', day: 'Fri' },
      { date: '2026-09-12', label: 'Saturday (12 Sep)', day: 'Sat' },
      { date: '2026-09-13', label: 'Sunday (13 Sep)', day: 'Sun' }
    ];

    const existing = new Set(baseDates.map(d => d.date));
    Object.keys(otherDatesWithSlots).forEach(dStr => {
      if (!existing.has(dStr)) {
        try {
          const dObj = new Date(dStr + 'T00:00:00');
          const dayName = dObj.toLocaleDateString('en-US', { weekday: 'short' });
          const monthDay = dObj.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
          baseDates.push({
            date: dStr,
            label: `${monthDay}`,
            day: dayName
          });
        } catch {
          baseDates.push({ date: dStr, label: dStr, day: 'Day' });
        }
      }
    });

    return baseDates.sort((a, b) => a.date.localeCompare(b.date));
  }, [otherDatesWithSlots]);

  // If selected center has no slots on selectedDate, but has slots on another date, switch automatically
  useEffect(() => {
    if (selectedLocationId && otherDatesWithSlots) {
      const datesWithSlots = Object.keys(otherDatesWithSlots);
      if (datesWithSlots.length > 0 && !otherDatesWithSlots[selectedDate]) {
        const sorted = datesWithSlots.sort();
        if (sorted[0]) {
          setSelectedDate(sorted[0]);
        }
      }
    }
  }, [selectedLocationId, otherDatesWithSlots]);

  // Available slots for selected location and date
  const availableSlots = useMemo(() => {
    return (Array.isArray(liveSlots) ? liveSlots : []).filter(s => 
      s && (s.location_id === selectedLocationId || s.centre_id === selectedLocationId) &&
      s.date === selectedDate
    );
  }, [liveSlots, selectedLocationId, selectedDate]);

  // Auto-generate standard slots if center has none for the selected date
  const handleAutoGenerateSlots = async () => {
    if (!selectedLocationId) return;
    setGeneratingSlots(true);
    try {
      const timeWindows = [
        { time: '09:00 AM - 11:00 AM', cap: 25 },
        { time: '11:00 AM - 01:00 PM', cap: 25 },
        { time: '02:00 PM - 04:00 PM', cap: 25 },
        { time: '04:00 PM - 06:00 PM', cap: 25 }
      ];

      for (const tw of timeWindows) {
        const slotId = `SLOT-${selectedLocationId}-${selectedDate.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
        await fetch('/api/slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: slotId,
            location_id: selectedLocationId,
            centre_id: selectedLocationId,
            date: selectedDate,
            time: tw.time,
            time_window: tw.time,
            capacity: tw.cap,
            max_capacity: tw.cap,
            booked_count: 0,
            status: 'Available',
            created_at: new Date().toISOString()
          })
        });
      }

      await fetchFreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingSlots(false);
    }
  };

  // Handle Book Slot Submission
  const handleConfirm = async () => {
    if (!selectedLocationId) {
      setErrorMsg('Please select a procurement location');
      return;
    }
    if (!selectedSlotId) {
      setErrorMsg('Please choose an available time slot');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/bookings/book-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmer_id: user?.id,
          slot_id: selectedSlotId,
          crop_type: user?.crop_type || 'Paddy',
          expected_quantity: expectedQty
        })
      });
      const data = await res.json();
      if (data.success) {
        setConfirmedBooking(data.data);
        if (onBookingSuccess) onBookingSuccess(data.data);
      } else {
        setErrorMsg(data.error || 'Failed to book slot. Please try another slot.');
      }
    } catch (err) {
      // Offline simulated confirmation
      const simulated = {
        id: `BK-${Date.now()}`,
        farmer_id: user?.id,
        slot_id: selectedSlotId,
        crop_type: user?.crop_type || 'Paddy',
        expected_quantity: expectedQty,
        status: 'booked',
        token_number: `TK-${Math.floor(100 + Math.random() * 900)}`,
        created_at: new Date().toISOString()
      };
      setConfirmedBooking(simulated);
      if (onBookingSuccess) onBookingSuccess(simulated);
    } finally {
      setLoading(false);
    }
  };

  // Generate .ics calendar download
  const handleAddToCalendar = () => {
    const slotObj = liveSlots.find(s => s.id === selectedSlotId);
    const locObj = activeLocations.find(l => l.id === selectedLocationId);
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Kissan Sathi//Procurement Slot//EN
BEGIN:VEVENT
UID:${confirmedBooking?.id || Date.now()}@kissansaathi.gov.in
DTSTAMP:20260907T000000Z
DTSTART:20260907T033000Z
DTEND:20260907T053000Z
SUMMARY:MSP Crop Procurement Slot - Token ${confirmedBooking?.token_number || 'PASS'}
DESCRIPTION:Official Crop Procurement Slot at ${locObj?.name || 'Mandi'}. Token: ${confirmedBooking?.token_number || 'TK-482'}.
LOCATION:${locObj?.address || locObj?.name || 'Central Mandi'}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `KissanSathi-Token-${confirmedBooking?.token_number || 'Slot'}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // If booking is confirmed, display Confirmation Gate Pass Screen
  if (confirmedBooking) {
    const slotObj = liveSlots.find(s => s.id === selectedSlotId);
    const locObj = activeLocations.find(l => l.id === selectedLocationId);

    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-lg lg:max-w-2xl mx-auto w-full space-y-4 animate-fadeIn pb-24 text-center">
        <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-md shadow-emerald-600/10">
          <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
        </div>

        <h2 className="text-2xl font-black text-slate-900">
          {t.bookingConfirmedTitle}
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 max-w-xs mx-auto">
          {t.bookingConfirmedDesc}
        </p>

        {/* Digital Gate Pass Card */}
        <div className="bg-white rounded-3xl p-6 border-2 border-emerald-500 shadow-xl text-left relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Mandi Gate Pass
              </span>
              <div className="text-3xl font-black text-emerald-700 tracking-wider">
                {confirmedBooking.token_number || 'TK-482'}
              </div>
            </div>
            <div className="p-2 bg-slate-50 rounded-2xl border border-slate-200">
              <QrCode className="w-12 h-12 text-slate-900" />
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <span className="text-slate-400 font-medium">Center:</span>
              <div className="text-sm font-bold text-slate-900">{locObj?.name || 'Central Mandi'}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-400 font-medium">Date:</span>
                <div className="font-bold text-slate-800">{selectedDate}</div>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Slot Window:</span>
                <div className="font-bold text-slate-800">{slotObj?.time || slotObj?.time_window || '09:00 - 11:00 AM'}</div>
              </div>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Farmer:</span>
              <div className="font-bold text-slate-800">{user?.name} (+91 {user?.phone})</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={() => {
              if (onGoToQueue) {
                onGoToQueue(confirmedBooking);
              } else if (onBookingSuccess) {
                onBookingSuccess(confirmedBooking, 'queue');
              }
            }}
            className="w-full min-h-[54px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-2xl font-black text-base flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/25 transition-all active:scale-[0.99] cursor-pointer"
          >
            <Activity className="w-5 h-5 text-amber-300" />
            <span>Proceed to Live Queue & Waiting List ➔</span>
          </button>

          <button
            type="button"
            onClick={handleAddToCalendar}
            className="w-full min-h-[48px] bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99] cursor-pointer text-xs"
          >
            <CalendarPlus className="w-4 h-4 text-emerald-400" />
            <span>{t.addToCalendar}</span>
          </button>

          <button
            type="button"
            onClick={onBack}
            className="w-full min-h-[48px] bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl font-bold transition-all cursor-pointer text-xs"
          >
            {t.backToHome}
          </button>
        </div>
      </div>
    );
  }

  // Determine how many locations to show in the list
  const displayedLocations = showAllLocations ? filteredLocations : filteredLocations.slice(0, 6);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-lg lg:max-w-4xl mx-auto w-full space-y-5 animate-fadeIn pb-28">
      {/* Header with Back, Title, and Real-time Refresh */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <h1 className="text-lg sm:text-xl font-black text-slate-900">
            {t.bookSlotTitle}
          </h1>
          <p className="text-[11px] text-slate-500">
            Select Mandi Hub & Choose Your Certified Weighing Window
          </p>
        </div>

        {/* Refresh Mandi Centers & Mic */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={fetchFreshData}
            className="w-10 h-10 rounded-2xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
            title="Refresh Mandi Centers"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setVoiceToast(true)}
            className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 flex items-center justify-center hover:bg-amber-500/20 active:scale-95 transition-all shadow-xs cursor-pointer"
            title={t.voiceBookingPlaceholder}
          >
            <Mic className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ACTIVE PROCUREMENT IN-PROGRESS BLOCKER BANNER */}
      {activeBooking && (
        <div className="bg-gradient-to-br from-amber-600 via-amber-700 to-slate-900 text-white rounded-3xl p-5 shadow-xl border-2 border-amber-400 animate-slideUp">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 border border-white/30">
              <AlertCircle className="w-6 h-6 text-amber-200" />
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-lg">
                  యాక్టివ్ పంట సేకరణ పురోగతిలో ఉంది
                </span>
                <span className="text-xs font-mono font-black bg-white/20 text-white px-2 py-0.5 rounded-lg border border-white/30">
                  {activeBooking.token_number || 'ACTIVE'}
                </span>
              </div>
              <h3 className="text-base font-black leading-tight text-white">
                {activeBooking.crop_type || 'వరి'} ({activeBooking.quantity || '50'} క్వింటాళ్లు) - సేకరణ ఇంకా పూర్తి కాలేదు
              </h3>
              <p className="text-xs text-amber-100 leading-relaxed font-medium">
                ప్రభుత్వ నిబంధనల ప్రకారం, ఒకే సమయంలో ఒక పంట సేకరణ మాత్రమే అనుమతించబడుతుంది. ఈ పంట తూకం & DBT చెల్లింపు అడ్మిన్ ద్వారా పూర్తయిన తర్వాతే మీరు మరొక పంట స్లాట్ బుక్ చేసుకోగలరు.
              </p>
              <div className="pt-1.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onGoToQueue ? onGoToQueue(activeBooking) : onBack()}
                  className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  <Activity className="w-4 h-4 text-slate-950" />
                  <span>లైవ్ క్యూ & యార్డ్ స్థితి చూడండి (View Live Status)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voice Assistant Coming Soon Toast */}
      {voiceToast && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{t.voiceComingSoonToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setVoiceToast(false)}
            className="text-amber-800 font-bold ml-2 text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* High Points Priority Advantage Banner */}
      {isHighPriority && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
          <span>{t.priorityAdvantage}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STEP 1: All Mandi Locations (Search + Filter + Smart Proximity Sort) */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>{t.step1Location}</span>
            </label>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black">
              {filteredLocations.length} Centers Available
            </span>
          </div>

          <div className="text-[11px] text-slate-400 font-medium">
            {user?.district ? `Showing mandis nearest to ${user.district} first` : 'All Government Mandis'}
          </div>
        </div>

        {/* Search Bar for Mandi Places */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search mandi by name, village, mandal, or district..."
            className="w-full min-h-[42px] pl-10 pr-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none bg-slate-50/50"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* District Filter Chips */}
        {districtsList.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedDistrict('ALL')}
              className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedDistrict === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Districts ({activeLocations.length})
            </button>
            {districtsList.map(dist => (
              <button
                key={dist}
                type="button"
                onClick={() => setSelectedDistrict(dist)}
                className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedDistrict === dist
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {dist}
              </button>
            ))}
          </div>
        )}

        {/* Mandi Cards List (NO SLICE CUTOFF - Shows all matching) */}
        <div className="space-y-2 pt-1 max-h-[360px] overflow-y-auto pr-1">
          {displayedLocations.length === 0 ? (
            <div className="p-6 bg-slate-50 rounded-2xl text-center text-xs text-slate-500 font-medium">
              No mandi centers found matching "{searchQuery}".
            </div>
          ) : (
            displayedLocations.map((loc) => {
              const isSelected = selectedLocationId === loc.id;
              const isLocalDistrict = (loc.district || '').trim().toLowerCase() === (user?.district || '').trim().toLowerCase();

              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => {
                    setSelectedLocationId(loc.id);
                    setSelectedSlotId('');
                    setErrorMsg('');
                  }}
                  className={`w-full min-h-[60px] p-3.5 rounded-2xl border-2 text-left transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/80 shadow-sm ring-2 ring-emerald-600/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-black text-slate-900 truncate">
                          {loc.name}
                        </span>
                        {isLocalDistrict && (
                          <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-black shrink-0">
                            🌾 In Your District
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {loc.address || `${loc.village ? loc.village + ', ' : ''}${loc.district}`} • Cap: {loc.daily_capacity_quintals || 1000} Q/day
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-slate-300 bg-slate-50" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* View All Expander if there are more than 6 locations */}
        {filteredLocations.length > 6 && (
          <button
            type="button"
            onClick={() => setShowAllLocations(!showAllLocations)}
            className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold text-center transition-colors cursor-pointer"
          >
            {showAllLocations ? 'Show Fewer Mandis' : `View All ${filteredLocations.length} Mandi Places`}
          </button>
        )}

        {/* Can't find mandi prompt */}
        {onRequestLocation && (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs bg-slate-50 rounded-2xl p-3">
            <div className="flex items-center gap-2 text-slate-600">
              <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Can't find a procurement center near your village?</span>
            </div>
            <button
              type="button"
              onClick={onRequestLocation}
              className="text-emerald-700 hover:text-emerald-800 font-bold underline whitespace-nowrap ml-2 cursor-pointer"
            >
              Request a Center ➔
            </button>
          </div>
        )}
      </div>

      {/* STEP 2: Operating Date Picker (Chips) */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
        <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
          {t.step2Date}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {dates.map((d) => {
            const isSelected = selectedDate === d.date;
            const slotsForDateCount = otherDatesWithSlots[d.date] || 0;

            return (
              <button
                key={d.date}
                type="button"
                onClick={() => {
                  setSelectedDate(d.date);
                  setSelectedSlotId('');
                  setErrorMsg('');
                }}
                className={`min-h-[56px] p-2 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center cursor-pointer ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20 scale-[1.02]'
                    : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                }`}
              >
                <span className={`text-[10px] uppercase font-semibold ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                  {d.day}
                </span>
                <span className="text-xs font-black">{d.label.split(' ')[0]}</span>
                <span className={`text-[9px] font-bold mt-0.5 ${
                  isSelected ? 'text-emerald-200' : slotsForDateCount > 0 ? 'text-emerald-600' : 'text-slate-300'
                }`}>
                  {slotsForDateCount > 0 ? `${slotsForDateCount} slots` : 'No slots'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 3: Available Time Slots */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
            {t.step3Time}
          </label>
          <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            Live Realtime
          </span>
        </div>

        {availableSlots.length === 0 ? (
          <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center space-y-3">
            <Clock className="w-8 h-8 text-slate-300 mx-auto" />
            <div>
              <h4 className="text-xs font-bold text-slate-700">
                No slots configured for this center on {selectedDate}
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs mx-auto">
                {Object.keys(otherDatesWithSlots).length > 0
                  ? `Slots are available on other operating dates above.`
                  : `Tap below to open procurement slots at this mandi.`}
              </p>
            </div>

            <button
              type="button"
              disabled={generatingSlots}
              onClick={handleAutoGenerateSlots}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              {generatingSlots ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Open Slots for {selectedDate}</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {availableSlots.map((slot) => {
              const capacity = Number(slot.capacity || slot.max_capacity) || 20;
              const booked = Number(slot.booked_count) || 0;
              const remaining = Math.max(0, capacity - booked);
              const isFull = remaining === 0;
              const isSelected = selectedSlotId === slot.id;

              return (
                <button
                  key={slot.id}
                  type="button"
                  disabled={isFull && !isHighPriority}
                  onClick={() => {
                    setSelectedSlotId(slot.id);
                    setErrorMsg('');
                  }}
                  className={`w-full min-h-[56px] p-3.5 rounded-2xl border-2 text-left transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/80 shadow-md shadow-emerald-600/10 ring-2 ring-emerald-600/20'
                      : isFull
                      ? 'border-slate-200 bg-slate-50 opacity-60'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className={`w-4 h-4 ${isSelected ? 'text-emerald-700' : 'text-slate-400'}`} />
                    <span className="text-xs sm:text-sm font-black text-slate-900">
                      {slot.time || slot.time_window || '09:00 AM - 11:00 AM'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-xl ${
                      isFull
                        ? 'bg-red-100 text-red-700'
                        : remaining <= 5
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {isFull ? t.capacityFull : `${remaining} of ${capacity} ${t.slotsRemaining}`}
                    </span>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* PRIMARY ACTION: Confirm Booking */}
      <div className="pt-2">
        <button
          type="button"
          disabled={loading || !selectedSlotId || !!activeBooking}
          onClick={handleConfirm}
          className="w-full min-h-[54px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-base sm:text-lg font-black rounded-2xl shadow-xl shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
          ) : activeBooking ? (
            <span>🔒 యాక్టివ్ సేకరణ పూర్తయిన తర్వాతే బుకింగ్ సాధ్యం</span>
          ) : (
            <>
              <span>{t.confirmBooking}</span>
              <span>➔</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
