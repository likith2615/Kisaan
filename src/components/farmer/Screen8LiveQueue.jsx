import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

import { 
  Users, 
  Clock, 
  ArrowLeft, 
  CheckCircle2, 
  Activity, 
  ShieldCheck,
  AlertCircle,
  Truck, 
  RefreshCw, 
  Search, 
  MapPin, 
  Sparkles, 
  ChevronRight, 
  Scale,
  PlusCircle,
  Calendar
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { translations } from '../../translations';

export default function Screen8LiveQueue({ 
  user, 
  lang, 
  booking, 
  onBack,
  onCheckInSuccess,
  onNavigate 
}) {
  const t = translations[lang] || translations.en;

  const [loadingCheckIn, setLoadingCheckIn] = useState(false);
  const [waitingList, setWaitingList] = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [locations, setLocations] = useState([]);
  const [selectedLocId, setSelectedLocId] = useState(() => {
    return booking?.location_id || booking?.location?.id || booking?.slot?.location_id || booking?.slot?.centre_id || booking?.centre_id || 'ALL';
  });
  
  // Dynamic date filter
  const [selectedDate, setSelectedDate] = useState(() => {
    return booking?.slot?.date || booking?.date || 'ALL';
  });

  const [servingToken, setServingToken] = useState('TK-STANDBY');
  const [yardStats, setYardStats] = useState({
    total_in_queue: 0,
    checked_in_count: 0,
    in_progress_count: 0,
    scheduled_count: 0,
    congestion_level: 'low',
    average_wait_minutes: 12,
    active_weighbridge_bay: 'Bay 1 (Certified Electronic)'
  });

  // Fetch locations for filter
  useEffect(() => {
    fetch('/api/locations')
      .then(r => r.json())
      .then(d => {
        if (d.success) setLocations(d.data || []);
      })
      .catch(() => {});
  }, []);

  // Fetch real-time waiting list from /api/queue/waiting-list
  const fetchWaitingList = async () => {
    setLoadingQueue(true);
    try {
      const params = new URLSearchParams();
      if (selectedDate && selectedDate !== 'ALL') {
        params.append('date', selectedDate);
      }
      if (selectedLocId && selectedLocId !== 'ALL') {
        params.append('location_id', selectedLocId);
      }
      const res = await fetch(`/api/queue/waiting-list?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setWaitingList(data.data || []);
        if (data.currently_serving) setServingToken(data.currently_serving);
        if (data.yard_stats) setYardStats(data.yard_stats);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch waiting list:', err);
    } finally {
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    fetchWaitingList();

    let channel = null;
    if (supabase) {
      channel = supabase
        .channel(`queue-realtime-${selectedLocId || 'ALL'}-${selectedDate || 'ALL'}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
          fetchWaitingList();
        })
        .subscribe();
    }

    // Responsive live polling fallback every 6 seconds
    const timer = setInterval(() => {
      fetchWaitingList();
    }, 6000);

    return () => {
      if (channel && supabase) supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [selectedLocId, selectedDate]);

  // Find user's item in the live waiting list
  const myQueueItem = useMemo(() => {
    return waitingList.find(item => 
      (booking?.id && (item.booking_id === booking.id || item.id === booking.id)) ||
      (booking?.token_number && item.token_number === booking.token_number) ||
      (user?.id && item.farmer_id === user.id)
    );
  }, [waitingList, booking, user]);

  const effectiveBooking = myQueueItem || booking;
  const isWaitingVerification = effectiveBooking?.status === 'arrived_waiting_confirmation';
  const isCheckedIn = effectiveBooking?.status === 'checked_in' || effectiveBooking?.status === 'in_progress' || effectiveBooking?.status === 'weighed' || effectiveBooking?.status === 'delivery_completed' || effectiveBooking?.status === 'completed';
  const isInProgress = effectiveBooking?.status === 'in_progress';

  // Audio chime alert when called to weighbridge
  const [hasAlerted, setHasAlerted] = useState(false);
  useEffect(() => {
    if (isInProgress && !hasAlerted) {
      setHasAlerted(true);
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
          osc.start();
          osc.stop(ctx.currentTime + 0.6);
        }
      } catch {
        // Suppress audio context restriction errors
      }
    }
  }, [isInProgress, hasAlerted]);

  // Position in queue
  const queueRank = myQueueItem 
    ? (waitingList.indexOf(myQueueItem) + 1)
    : (Number(booking?.queue_position) > 0 ? Number(booking.queue_position) : 1);

  const vehiclesAhead = Math.max(0, queueRank - 1);
  const estimatedMinutes = Math.max(5, queueRank * (yardStats.average_wait_minutes || 12));

  // Real-time second-by-second live countdown timer
  const [secondsRemaining, setSecondsRemaining] = useState(() => Math.max(60, queueRank * (yardStats.average_wait_minutes || 12) * 60));

  useEffect(() => {
    const baseSecs = queueRank === 1 ? 120 : Math.max(60, queueRank * (yardStats.average_wait_minutes || 12) * 60);
    setSecondsRemaining(baseSecs);
  }, [queueRank, yardStats.average_wait_minutes]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining(prev => Math.max(5, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatLiveCountdown = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const expectedCallTime = useMemo(() => {
    const d = new Date();
    d.setSeconds(d.getSeconds() + secondsRemaining);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [secondsRemaining]);

  // Handle self check-in upon arrival at the mandi yard
  const handleCheckIn = async () => {
    const targetBookingId = effectiveBooking?.id || effectiveBooking?.booking_id;
    if (!targetBookingId) return;
    setLoadingCheckIn(true);

    try {
      const res = await fetch('/api/queue/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: targetBookingId })
      });
      const data = await res.json();
      if (data.success) {
        if (onCheckInSuccess) onCheckInSuccess(data.data);
        await fetchWaitingList();
      }
    } catch (err) {
      if (onCheckInSuccess) {
        onCheckInSuccess({ ...effectiveBooking, status: 'checked_in', queue_position: 1 });
      }
    } finally {
      setLoadingCheckIn(false);
    }
  };

  const stages = [
    { id: 1, label: t.queueStage1 || 'Slot Booked', done: true },
    { id: 2, label: isWaitingVerification ? 'Gate Logged (Pending Admin)' : (t.queueStage2 || 'Yard Check-In'), done: isCheckedIn || isWaitingVerification },
    { id: 3, label: t.queueStage3 || 'Weighbridge Active', done: isInProgress || ['weighed', 'delivery_completed', 'completed'].includes(effectiveBooking?.status) },
    { id: 4, label: t.queueStage4 || 'Delivery Passed & Paid', done: ['delivery_completed', 'completed'].includes(effectiveBooking?.status) }
  ];

  // Filter waiting list based on search query
  const filteredList = useMemo(() => {
    return waitingList.filter(item => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.token_number?.toLowerCase().includes(q) ||
        item.farmer_name?.toLowerCase().includes(q) ||
        item.crop_type?.toLowerCase().includes(q) ||
        item.village?.toLowerCase().includes(q)
      );
    });
  }, [waitingList, searchQuery]);

  const dateChips = [
    { id: 'ALL', label: 'All Dates' },
    { id: '2026-09-07', label: 'Today (07 Sep)' },
    { id: '2026-09-08', label: 'Tomorrow (08 Sep)' },
    { id: '2026-09-09', label: 'Wed (09 Sep)' },
    { id: '2026-09-10', label: 'Thu (10 Sep)' }
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-5 animate-fadeIn pb-28">
      {/* Top Bar with Back, Title, and Manual Refresh */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
            {t.liveQueueTitle || 'Live Queue & Waiting List'}
          </h1>
          <p className="text-[11px] text-slate-500">
            Real-time mandi gate sequence & certified weighbridge queue
          </p>
        </div>

        {/* Realtime Live Pulse & Manual Refresh */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchWaitingList}
            disabled={loadingQueue}
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
            title="Refresh Waiting List"
          >
            <RefreshCw className={`w-4 h-4 ${loadingQueue ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
            <span>Live Sync</span>
          </div>
        </div>
      </div>

      {/* 1. REAL-TIME MANDI YARD STATUS & CONGESTION GAUGE */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          {/* Currently Serving */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-center">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Currently Serving
            </div>
            <div className="text-lg sm:text-xl font-mono font-black text-emerald-700 mt-0.5">
              {servingToken}
            </div>
            <div className="text-[10px] text-slate-500 font-medium mt-0.5">
              {yardStats.active_weighbridge_bay || 'Bay 1 (Active)'}
            </div>
          </div>

          {/* Yard Congestion Gauge */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-center">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Yard Congestion
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full animate-ping ${
                yardStats.congestion_level === 'low'
                  ? 'bg-emerald-500'
                  : yardStats.congestion_level === 'moderate'
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`} />
              <span className={`text-xs font-black uppercase ${
                yardStats.congestion_level === 'low'
                  ? 'text-emerald-700'
                  : yardStats.congestion_level === 'moderate'
                  ? 'text-amber-700'
                  : 'text-red-700'
              }`}>
                {yardStats.congestion_level === 'low'
                  ? 'Smooth Flow'
                  : yardStats.congestion_level === 'moderate'
                  ? 'Moderate'
                  : 'Congested'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {yardStats.checked_in_count || 0} Trucks in Yard
            </div>
          </div>

          {/* Average Turnaround */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-center">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Avg. Turnaround
            </div>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">
              ~{yardStats.average_wait_minutes || 12} mins
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Per Truck Weighing
            </div>
          </div>

          {/* Total Queue Vehicles */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-center">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Total In Line
            </div>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">
              {waitingList.length} Vehicles
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {yardStats.scheduled_count || 0} Scheduled Ahead
            </div>
          </div>
        </div>
      </div>

      {/* 2. LOGGED-IN FARMER STATUS HERO CARD */}
      {effectiveBooking ? (
        <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden text-center border border-emerald-900/40">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-40 h-40 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black mb-3 border border-emerald-500/30">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Your Token: {effectiveBooking.token_number || 'TK-934'}</span>
          </div>

          {isCheckedIn ? (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                {t.youAreNumber || 'Your Current Position in Yard'}
              </div>
              <div className="text-6xl sm:text-7xl font-black text-amber-400 tracking-tight my-1 drop-shadow-md">
                #{queueRank}
              </div>

              {/* Real-time Countdown Timer Badge */}
              <div className="inline-flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-emerald-500/40 my-1 shadow-inner">
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span>Live Countdown:</span>
                </div>
                <div className="font-mono text-xl sm:text-2xl font-black text-amber-300 tracking-wider">
                  {vehiclesAhead === 0 ? '00:00 (BAY READY)' : formatLiveCountdown(secondsRemaining)}
                </div>
                <div className="text-[10px] text-slate-400 border-l border-slate-700 pl-2">
                  Expected: <span className="text-white font-bold">{expectedCallTime}</span>
                </div>
              </div>

              <div className="text-sm font-bold text-emerald-300 flex items-center justify-center gap-1.5 pt-1">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>
                  {vehiclesAhead === 0 
                    ? '🚨 You are NEXT! Drive onto Weighbridge Bay.' 
                    : `${vehiclesAhead} vehicles ahead • ~${Math.ceil(secondsRemaining / 60)} mins remaining`}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto pt-0.5">
                Keep vehicle ready near Weighbridge Bay. Gate siren sounds when #{queueRank} is called.
              </p>
            </div>
          ) : isWaitingVerification ? (
            <div className="py-2 space-y-3 animate-fadeIn">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Gate Arrival Recorded</span>
              </div>
              <h3 className="text-lg font-black text-white">
                Awaiting Admin 1 Gate Verification
              </h3>
              <p className="text-xs text-slate-300 max-w-sm mx-auto">
                మీ రాక నమోదు చేయబడింది. అడ్మిన్ 1 భౌతిక ధృవీకరణ పూర్తయిన వెంటనే మీ క్యూ నంబర్ ఖరారవుతుంది.
              </p>
              <div className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 rounded-xl px-3 py-2 max-w-xs mx-auto">
                🚚 Vehicle at Gate · Token #{effectiveBooking?.token_number || effectiveBooking?.id}
              </div>
            </div>
          ) : (
            <div className="py-2 space-y-3">
              <h3 className="text-xl font-black text-white">
                Arrived at Mandi Yard?
              </h3>
              <p className="text-xs text-slate-300 max-w-sm mx-auto">
                Tap check-in upon arrival to notify Admin 1 for physical verification and secure your live queue position.
              </p>
              <button
                type="button"
                disabled={loadingCheckIn}
                onClick={handleCheckIn}
                className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-600/30 transition-all cursor-pointer inline-flex items-center gap-2"
              >
                {loadingCheckIn ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Mark Arrived / Gate Check-In</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Quick Progress Dots */}
          <div className="grid grid-cols-4 gap-2 mt-5 pt-4 border-t border-slate-700/60 max-w-md mx-auto">
            {stages.map((st) => (
              <div key={st.id} className="text-center">
                <div className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center text-xs font-black mb-1 transition-all ${
                  st.done 
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-sm' 
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {st.done ? '✓' : st.id}
                </div>
                <div className={`text-[10px] font-bold truncate ${st.done ? 'text-emerald-300' : 'text-slate-400'}`}>
                  {st.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-emerald-900 to-slate-900 text-white rounded-3xl p-5 border border-emerald-800 shadow-sm text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-800/80 text-emerald-300 flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-white">No Active Slot Booking for You</h3>
            <p className="text-xs text-slate-300 max-w-sm mx-auto mt-1">
              You can monitor the live mandi waiting list below, or book a guaranteed slot in advance to avoid long wait times.
            </p>
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('book_slot')}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Book a Certified Procurement Slot</span>
            </button>
          )}
        </div>
      )}

      {/* 3. REAL-TIME WAITING LIST TABLE & FILTERS */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
        {/* Header & Center Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900">
                  Live Mandi Waiting List Table
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black">
                  {filteredList.length} In Queue
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Auto-syncing every 8s • Last refreshed at {lastRefreshed.toLocaleTimeString()}
              </p>
            </div>
          </div>

          {/* Location Dropdown */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <select
                value={selectedLocId}
                onChange={(e) => setSelectedLocId(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Centers</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name} ({l.district})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Date Filter Chips (Fixes the hardcoded date bug) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {dateChips.map((chip) => {
            const isSelected = selectedDate === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setSelectedDate(chip.id)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Calendar className="w-3 h-3" />
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Token (e.g. TK-803), Farmer Name, Village or Crop..."
            className="w-full min-h-[42px] pl-10 pr-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none bg-slate-50/50"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* The Waiting List: Desktop Table / Mobile Cards */}
        {filteredList.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Scale className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700">No vehicles waiting in line for this selection</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              The weighbridge and yard are currently clear. Try switching the date chip above or select "All Dates".
            </p>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-3">Position</th>
                    <th className="py-3 px-3">Token</th>
                    <th className="py-3 px-3">Farmer & Village</th>
                    <th className="py-3 px-3">Commodity / Qty</th>
                    <th className="py-3 px-3">Date & Slot</th>
                    <th className="py-3 px-3">Yard Status</th>
                    <th className="py-3 px-3 text-right">Est. Wait</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredList.map((item, idx) => {
                    const isCurrentUser = 
                      (user?.id && item.farmer_id === user.id) ||
                      (effectiveBooking?.id && (item.booking_id === effectiveBooking.id || item.id === effectiveBooking.id)) ||
                      (effectiveBooking?.token_number && item.token_number === effectiveBooking.token_number);

                    const isFirst = idx === 0;

                    return (
                      <tr 
                        key={item.id || item.booking_id}
                        className={`transition-colors ${
                          isCurrentUser 
                            ? 'bg-emerald-50/90 font-bold border-l-4 border-emerald-600' 
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Position */}
                        <td className="py-3.5 px-3">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-xl font-black text-xs ${
                            isFirst
                              ? 'bg-amber-400 text-slate-950 shadow-xs'
                              : idx === 1
                              ? 'bg-slate-200 text-slate-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            #{idx + 1}
                          </span>
                        </td>

                        {/* Token */}
                        <td className="py-3.5 px-3 font-mono font-black text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span>{item.token_number}</span>
                            {isCurrentUser && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-black uppercase animate-pulse">
                                YOU
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Farmer & Village */}
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-slate-900">
                            {item.farmer_name || 'Registered Farmer'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {item.village ? `${item.village}, ${item.district}` : item.district || 'Mandi Zone'}
                          </div>
                        </td>

                        {/* Commodity & Qty */}
                        <td className="py-3.5 px-3">
                          <span className="font-bold text-slate-800">{item.crop_type || 'Paddy'}</span>
                          <span className="text-slate-500 text-[11px] block">{item.expected_quantity || 50} Quintals</span>
                        </td>

                        {/* Slot Time */}
                        <td className="py-3.5 px-3 text-slate-600 font-medium">
                          <div>{item.date || 'Today'}</div>
                          <div className="text-[10px] text-slate-400">{item.slot_time || '09:00 AM - 11:00 AM'}</div>
                        </td>

                        {/* Yard Status */}
                        <td className="py-3.5 px-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            item.status === 'in_progress'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'checked_in'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              item.status === 'in_progress'
                                ? 'bg-emerald-600 animate-pulse'
                                : item.status === 'checked_in'
                                ? 'bg-blue-600'
                                : 'bg-amber-600'
                            }`} />
                            {item.status === 'in_progress' 
                              ? 'Weighbridge Active' 
                              : item.status === 'checked_in' 
                              ? 'Gate Checked-In' 
                              : 'Slot Booked'}
                          </span>
                        </td>

                        {/* Est. Wait */}
                        <td className="py-3.5 px-3 text-right font-black text-slate-800">
                          {idx === 0 ? (
                            <span className="text-emerald-700 font-bold">Now Weighing</span>
                          ) : (
                            <span>~{idx * 12} mins</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="md:hidden space-y-2.5">
              {filteredList.map((item, idx) => {
                const isCurrentUser = 
                  (user?.id && item.farmer_id === user.id) ||
                  (effectiveBooking?.id && (item.booking_id === effectiveBooking.id || item.id === effectiveBooking.id)) ||
                  (effectiveBooking?.token_number && item.token_number === effectiveBooking.token_number);

                return (
                  <div
                    key={item.id || item.booking_id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isCurrentUser
                        ? 'bg-emerald-50/90 border-emerald-500 shadow-sm ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs">
                          #{idx + 1}
                        </span>
                        <div>
                          <div className="font-mono font-black text-sm text-slate-900 flex items-center gap-1.5">
                            <span>{item.token_number}</span>
                            {isCurrentUser && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-black uppercase animate-pulse">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-bold text-slate-700">
                            {item.farmer_name} • {item.village || item.district}
                          </div>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        item.status === 'in_progress'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'checked_in'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {item.status === 'in_progress' ? 'Weighing' : item.status === 'checked_in' ? 'Checked-In' : 'Booked'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 mt-2">
                      <span>{item.crop_type} ({item.expected_quantity} Q) • {item.date}</span>
                      <span className="font-bold text-slate-800">
                        {idx === 0 ? 'Now Weighing' : `~${idx * 12}m wait`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Procurement Yard Assistance Card */}
      <div className="bg-slate-50 rounded-3xl p-4 border border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Need vehicle assistance or tractor breakdown help? Contact Yard Helpdesk:</span>
        </div>
        <span className="font-bold text-slate-900 bg-white px-2.5 py-1 rounded-xl border border-slate-200">
          📞 1800-180-1551 (Toll Free)
        </span>
      </div>
    </div>
  );
}
