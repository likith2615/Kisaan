import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  Activity, 
  Check, 
  X, 
  MapPin, 
  QrCode, 
  Search, 
  IndianRupee, 
  Star,
  Calendar,
  Truck,
  Scale,
  Sparkles,
  AlertCircle,
  Building2,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { translations } from '../../translations';
import FarmerPaymentModal from './FarmerPaymentModal';

export default function AdminScreen5Queue({ 
  user, 
  lang, 
  bookings = [], 
  locations = [],
  slots = [],
  farmers = [],
  onRefresh 
}) {
  const t = translations[lang] || translations.en;

  const [selectedStation, setSelectedStation] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [paymentModalBooking, setPaymentModalBooking] = useState(null);
  const [completeModalBooking, setCompleteModalBooking] = useState(null);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenMsg, setTokenMsg] = useState('');
  const [stationSummaries, setStationSummaries] = useState([]);
  const [loadingSummaries, setLoadingSummaries] = useState(false);

  const [completeData, setCompleteData] = useState({
    actual_quantity: 50,
    quality_grade: 'Grade A Superfine'
  });

  const todayIso = new Date().toISOString().slice(0, 10);
  const tomorrowIso = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const day3Iso = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const day4Iso = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

  const dateChips = [
    { id: 'ALL', label: 'All Dates' },
    { id: todayIso, label: `Today (${todayIso.slice(5)})` },
    { id: tomorrowIso, label: `Tomorrow (${tomorrowIso.slice(5)})` },
    { id: day3Iso, label: `Day 3 (${day3Iso.slice(5)})` },
    { id: day4Iso, label: `Day 4 (${day4Iso.slice(5)})` }
  ];

  // Fetch real-time multi-station summary from backend
  const fetchStationSummaries = async () => {
    try {
      setLoadingSummaries(true);
      const url = selectedDate && selectedDate !== 'ALL'
        ? `/api/queue/stations-summary?date=${selectedDate}`
        : '/api/queue/stations-summary';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setStationSummaries(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch station summaries:', err);
    } finally {
      setLoadingSummaries(false);
    }
  };

  useEffect(() => {
    fetchStationSummaries();
    const interval = setInterval(fetchStationSummaries, 8000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  // Unified stations list
  const allStationsList = useMemo(() => {
    const map = new Map();
    stationSummaries.forEach(s => {
      if (s && s.id && !map.has(s.id)) {
        map.set(s.id, {
          id: s.id,
          name: s.name,
          district: s.district,
          daily_capacity_quintals: s.daily_capacity_quintals,
          activeQueue: s.total_in_queue,
          checkedIn: s.checked_in_count,
          inProgress: s.in_progress_count,
          serving: s.currently_serving,
          congestion: s.congestion_level,
          activeBay: s.active_weighbridge_bay
        });
      }
    });
    locations.forEach(loc => {
      if (loc && loc.id && !map.has(loc.id)) {
        map.set(loc.id, {
          id: loc.id,
          name: loc.name,
          district: loc.district || 'Kurnool',
          daily_capacity_quintals: loc.daily_capacity_quintals || 500,
          activeQueue: 0,
          checkedIn: 0,
          inProgress: 0,
          serving: 'TK-STANDBY',
          congestion: 'low',
          activeBay: `${loc.name?.slice(0, 14)} Bay 1`
        });
      }
    });
    return Array.from(map.values());
  }, [stationSummaries, locations]);

  // Current active station details
  const currentStationObj = useMemo(() => {
    if (selectedStation === 'ALL') return null;
    return allStationsList.find(s => s.id === selectedStation) || null;
  }, [allStationsList, selectedStation]);

  // Filter bookings by selected station, date, and search
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const bDate = b.slot?.date || b.date;
      if (selectedDate !== 'ALL' && bDate && bDate !== selectedDate) return false;

      const bLocId = b.location_id || b.slot?.location_id || b.slot?.centre_id;
      if (selectedStation !== 'ALL' && bLocId !== selectedStation) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        b.token_number?.toLowerCase().includes(q) ||
        b.farmer_name?.toLowerCase().includes(q) ||
        b.farmer_phone?.includes(q) ||
        b.farmer_id?.toLowerCase().includes(q) ||
        b.id?.toLowerCase().includes(q) ||
        b.farmer?.name?.toLowerCase().includes(q) ||
        b.location_name?.toLowerCase().includes(q)
      );
    }).sort((a, b) => {
      const prio = { in_progress: 1, checked_in: 2, booked: 3, completed: 4, no_show: 5 };
      const diff = (prio[a.status] || 99) - (prio[b.status] || 99);
      if (diff !== 0) return diff;
      return (Number(a.queue_position) || 999) - (Number(b.queue_position) || 999);
    });
  }, [bookings, selectedStation, selectedDate, searchQuery]);

  // Station-Scoped Yard Stats
  const yardStats = useMemo(() => {
    const relevant = bookings.filter(b => {
      const bDate = b.slot?.date || b.date;
      if (selectedDate !== 'ALL' && bDate && bDate !== selectedDate) return false;
      const bLocId = b.location_id || b.slot?.location_id || b.slot?.centre_id;
      if (selectedStation !== 'ALL' && bLocId !== selectedStation) return false;
      return true;
    });

    const checkedInCount = relevant.filter(b => b.status === 'checked_in').length;
    const inProgressCount = relevant.filter(b => b.status === 'in_progress').length;
    const completedCount = relevant.filter(b => b.status === 'completed').length;
    const scheduledCount = relevant.filter(b => b.status === 'booked').length;
    const congestionLevel = checkedInCount <= 3 ? 'low' : checkedInCount <= 8 ? 'moderate' : 'high';

    const servingItem = relevant.find(b => b.status === 'in_progress') || relevant.find(b => b.status === 'checked_in');

    return {
      totalInQueue: checkedInCount + inProgressCount + scheduledCount,
      checkedInCount,
      inProgressCount,
      completedCount,
      scheduledCount,
      congestionLevel,
      servingToken: servingItem ? servingItem.token_number : 'TK-STANDBY',
      averageWait: Math.max(8, checkedInCount * 12)
    };
  }, [bookings, selectedStation, selectedDate]);

  // Action: Check-in
  const handleCheckIn = async (bookingId) => {
    setActionLoadingId(bookingId);
    try {
      const res = await fetch('/api/queue/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId })
      });
      const data = await res.json();
      if (data.success) {
        fetchStationSummaries();
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Action: Mark In Progress (Call to Weighbridge)
  const handleInProgress = async (bookingId) => {
    setActionLoadingId(bookingId);
    try {
      const res = await fetch('/api/queue/in-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId })
      });
      const data = await res.json();
      if (data.success) {
        fetchStationSummaries();
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Action: Complete Weighment & Issue WHR/J-Form
  const handleConfirmComplete = async () => {
    if (!completeModalBooking) return;
    setActionLoadingId(completeModalBooking.id);
    try {
      const res = await fetch('/api/queue/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: completeModalBooking.id,
          actual_quantity: completeData.actual_quantity,
          quality_grade: completeData.quality_grade
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchStationSummaries();
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
      setCompleteModalBooking(null);
    }
  };

  // Action: No-Show
  const handleNoShow = async (bookingId) => {
    setActionLoadingId(bookingId);
    try {
      const res = await fetch('/api/queue/no-show', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId })
      });
      const data = await res.json();
      if (data.success) {
        fetchStationSummaries();
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Quick Manual Token Check-In
  const handleManualTokenCheckIn = async (e) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    const cleanToken = tokenInput.trim().toUpperCase();
    const match = bookings.find(b => 
      (b.token_number && b.token_number.toUpperCase() === cleanToken) ||
      (b.id && b.id.toUpperCase() === cleanToken)
    );

    if (!match) {
      setTokenMsg(`No booking found for token "${cleanToken}"`);
      setTimeout(() => setTokenMsg(''), 4000);
      return;
    }

    if (match.status === 'checked_in') {
      setTokenMsg(`Token ${cleanToken} is already checked in at position #${match.queue_position}`);
      setTimeout(() => setTokenMsg(''), 4000);
      return;
    }

    await handleCheckIn(match.id);
    setTokenMsg(`✓ Token ${cleanToken} successfully checked in!`);
    setTokenInput('');
    setTimeout(() => setTokenMsg(''), 4000);
  };

  return (
    <div className="space-y-5 animate-fadeIn pb-12">
      {/* Top Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {t.queueManagerTitle || 'Day-of Mandi Queue & Weighbridge Manager'}
            </h1>
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              Station Isolated
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Monitor real-time queues for each procurement center individually or overview all mandis side-by-side
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Token Check-In */}
          <form onSubmit={handleManualTokenCheckIn} className="flex items-center gap-1.5">
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Pass Token (e.g. TK-670)..."
              className="min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono font-bold uppercase focus:border-slate-900"
            />
            <button
              type="submit"
              className="min-h-[40px] px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
            >
              Gate Check-In
            </button>
          </form>

          {/* Search */}
          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search token / farmer..."
              className="w-full min-h-[40px] pl-9 pr-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold focus:border-slate-900"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              if (onRefresh) onRefresh();
              fetchStationSummaries();
            }}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer"
            title="Refresh All Station Queues"
          >
            <RefreshCw className={`w-4 h-4 ${loadingSummaries ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {tokenMsg && (
        <div className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn ${
          tokenMsg.startsWith('✓') 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
            : 'bg-amber-50 text-amber-800 border border-amber-300'
        }`}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{tokenMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STATION SELECTOR BAR: Allows 1-tap switching between Stations */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Procurement Center / Station Selector:
            </span>
          </div>

          {/* Quick Dropdown on Mobile */}
          <div className="sm:hidden">
            <select
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="ALL">🌐 All Stations Overview ({bookings.length} Total)</option>
              {allStationsList.map(station => (
                <option key={station.id} value={station.id}>
                  {station.name} ({station.district})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Desktop Interactive Station Chips */}
        <div className="hidden sm:flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedStation('ALL')}
            className={`px-3.5 py-2 rounded-2xl font-black text-xs whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
              selectedStation === 'ALL'
                ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/30'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <span>🌐 All Stations Overview</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-700 dark:bg-slate-900 text-white text-[10px]">
              {allStationsList.length} Mandis
            </span>
          </button>

          {allStationsList.map(station => {
            const isSelected = selectedStation === station.id;
            const summary = stationSummaries.find(s => s.id === station.id);
            const activeVehicles = summary?.checked_in_count || 0;
            return (
              <button
                key={station.id}
                type="button"
                onClick={() => setSelectedStation(station.id)}
                className={`px-3 py-2 rounded-2xl font-bold text-xs whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-400'
                    : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${
                    summary?.congestion_level === 'high' ? 'bg-red-500' : summary?.congestion_level === 'moderate' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                  <span className="truncate max-w-[150px]">{station.name}</span>
                </div>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  isSelected ? 'bg-white text-emerald-900' : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                }`}>
                  {activeVehicles} in yard
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Date Filter Chips */}
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
                  ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>{chip.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: ALL STATIONS OVERVIEW MATRIX (When 'ALL' is selected) */}
      {/* ========================================================================= */}
      {selectedStation === 'ALL' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>Live Procurement Station Queues ({allStationsList.length} Active Hubs)</span>
            </h2>
            <span className="text-xs text-slate-500">
              Click any station to manage its isolated electronic weighbridge queue
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {allStationsList.map((station) => {
              const summary = stationSummaries.find(s => s.id === station.id);
              const checkedIn = summary?.checked_in_count || 0;
              const inProgress = summary?.in_progress_count || 0;
              const completed = summary?.completed_count || 0;
              const scheduled = summary?.scheduled_count || 0;
              const serving = summary?.currently_serving || 'TK-STANDBY';
              const congestion = summary?.congestion_level || 'low';

              return (
                <div 
                  key={station.id}
                  className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-emerald-500 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base font-black text-slate-900 dark:text-white leading-tight">
                          {station.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        District: <strong className="text-slate-700 dark:text-slate-300">{station.district}</strong> • Capacity: {station.daily_capacity_quintals || 500} Q/day
                      </p>
                    </div>

                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      congestion === 'high' 
                        ? 'bg-red-50 text-red-700 border-red-300' 
                        : congestion === 'moderate' 
                        ? 'bg-amber-50 text-amber-700 border-amber-300' 
                        : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    }`}>
                      {congestion === 'high' ? '🔴 Congested' : congestion === 'moderate' ? '🟡 Moderate' : '🟢 Smooth'}
                    </span>
                  </div>

                  {/* Serving Token Banner */}
                  <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase">Weighbridge Bay 1</div>
                      <div className="font-mono font-black text-sm text-purple-700 dark:text-purple-400">
                        {serving !== 'TK-STANDBY' ? `Serving ${serving}` : 'Standby / Ready'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-bold text-slate-400 uppercase">Avg Wait</div>
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        ~{Math.max(8, checkedIn * 12)} mins
                      </div>
                    </div>
                  </div>

                  {/* Mini Stats Bar */}
                  <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                    <div className="bg-blue-50/70 dark:bg-blue-950/40 p-2 rounded-xl border border-blue-100 dark:border-blue-900">
                      <div className="font-black text-blue-700 dark:text-blue-400 text-sm">{checkedIn}</div>
                      <div className="text-[9px] text-slate-500">In Yard</div>
                    </div>
                    <div className="bg-purple-50/70 dark:bg-purple-950/40 p-2 rounded-xl border border-purple-100 dark:border-purple-900">
                      <div className="font-black text-purple-700 dark:text-purple-400 text-sm">{inProgress}</div>
                      <div className="text-[9px] text-slate-500">Weighing</div>
                    </div>
                    <div className="bg-amber-50/70 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-100 dark:border-amber-900">
                      <div className="font-black text-amber-700 dark:text-amber-400 text-sm">{scheduled}</div>
                      <div className="text-[9px] text-slate-500">Slots</div>
                    </div>
                    <div className="bg-emerald-50/70 dark:bg-emerald-950/40 p-2 rounded-xl border border-emerald-100 dark:border-emerald-900">
                      <div className="font-black text-emerald-700 dark:text-emerald-400 text-sm">{completed}</div>
                      <div className="text-[9px] text-slate-500">Done</div>
                    </div>
                  </div>

                  {/* Action to drill down into this station */}
                  <button
                    type="button"
                    onClick={() => setSelectedStation(station.id)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-emerald-600 text-slate-700 hover:text-white dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-emerald-600 text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <span>Manage {station.name.slice(0, 18)} Queue</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: SINGLE STATION LIVE QUEUE BOARD (When a station is selected) */}
      {/* ========================================================================= */}
      {selectedStation !== 'ALL' && currentStationObj && (
        <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-900 text-white p-4 sm:p-5 rounded-3xl shadow-md space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-400 shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black">{currentStationObj.name}</h2>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                    Active Station
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  District: <strong className="text-white">{currentStationObj.district}</strong> • Weighbridge: <strong className="text-emerald-400">{currentStationObj.activeBay}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedStation('ALL')}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>View All Stations Overview</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Station-Scoped Yard Health & Congestion Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Awaiting Weighment</div>
          <div className="text-xl font-black text-blue-700 dark:text-blue-400 mt-0.5">{yardStats.checkedInCount} Trucks</div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {selectedStation === 'ALL' ? 'Total in Yards' : 'In This Yard'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">At Weighbridge</div>
          <div className="text-xl font-black text-purple-700 dark:text-purple-400 mt-0.5">{yardStats.inProgressCount} Trucks</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Tare / Gross Weighing</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completed Today</div>
          <div className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-0.5">{yardStats.completedCount} Trucks</div>
          <div className="text-[10px] text-slate-500 mt-0.5">WHR & J-Form Issued</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scheduled Slots</div>
          <div className="text-xl font-black text-slate-800 dark:text-slate-200 mt-0.5">{yardStats.scheduledCount} Trucks</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Upcoming Today</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs col-span-2 sm:col-span-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Congestion Status</div>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span className={`w-2.5 h-2.5 rounded-full animate-ping ${
              yardStats.congestionLevel === 'low' ? 'bg-emerald-500' : yardStats.congestionLevel === 'moderate' ? 'bg-amber-500' : 'bg-red-500'
            }`} />
            <span className={`text-xs font-black uppercase ${
              yardStats.congestionLevel === 'low' ? 'text-emerald-700 dark:text-emerald-400' : yardStats.congestionLevel === 'moderate' ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400'
            }`}>
              {yardStats.congestionLevel === 'low' ? 'Smooth Flow' : yardStats.congestionLevel === 'moderate' ? 'Moderate' : 'Congested'}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">~{yardStats.averageWait}m wait avg</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* QUEUE TABLE: Filtered specifically for the selected station */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              {selectedStation === 'ALL'
                ? 'All Mandi Arrival Queue & Scheduled Vehicles'
                : `Live Queue for: ${currentStationObj?.name || 'Selected Station'}`}
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">
              {filteredBookings.length} Vehicles
            </span>
          </div>

          {selectedStation !== 'ALL' && (
            <span className="text-xs text-slate-500 hidden sm:inline">
              Rank indicates vehicles ahead in line for <strong>{currentStationObj?.name}</strong>
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-black">
              <tr>
                <th className="py-3 px-4">Station Rank / Token</th>
                <th className="py-3 px-4">Mandi Center Station</th>
                <th className="py-3 px-4">Farmer / Crop</th>
                <th className="py-3 px-4">Slot Date & Time</th>
                <th className="py-3 px-4">Yard Status</th>
                <th className="py-3 px-4 text-right">Day-of Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-1">
                      <p className="font-bold">No scheduled vehicle arrivals found.</p>
                      <p className="text-[11px]">There are no vehicles in the waiting list matching this station and date filter.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b, idx) => {
                  const isActionLoading = actionLoadingId === b.id;
                  const isServing = b.status === 'in_progress';
                  const stationName = b.location_name || b.station_name || 'Central Mandi Yard';
                  return (
                    <tr 
                      key={b.id} 
                      className={`transition-colors ${
                        isServing 
                          ? 'bg-purple-50/70 dark:bg-purple-950/30 border-l-4 border-purple-600 font-semibold' 
                          : b.status === 'checked_in'
                          ? 'bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50/80'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-7 h-7 rounded-full font-black text-xs flex items-center justify-center ${
                            isServing 
                              ? 'bg-purple-600 text-white shadow-xs' 
                              : b.status === 'checked_in' 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                          }`}>
                            #{b.queue_position || idx + 1}
                          </span>
                          <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                            {b.token_number || 'TK-482'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate max-w-[180px]" title={stationName}>
                            {stationName}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {b.station_district || 'APMC Yard'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{b.farmer_name || b.farmer?.name || b.farmer_id || 'Farmer'}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          {b.farmer_phone ? `📞 ${b.farmer_phone} • ` : ''}{b.crop_type || 'Paddy'} • {b.expected_quantity || 50} Q
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-700 dark:text-slate-300">
                          {b.date || b.slot?.date || 'Today'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {b.time || b.slot?.time || b.slot?.time_window || '09:00 - 11:00 AM'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 ${
                          b.status === 'completed'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                            : b.status === 'in_progress'
                            ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 ring-2 ring-purple-500/20'
                            : b.status === 'checked_in'
                            ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                            : b.status === 'no_show'
                            ? 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            b.status === 'in_progress' ? 'bg-purple-600 animate-pulse' : b.status === 'checked_in' ? 'bg-blue-600' : 'bg-amber-600'
                          }`} />
                          {b.status === 'in_progress'
                            ? 'At Weighbridge'
                            : b.status === 'checked_in'
                            ? 'In Yard Queue'
                            : b.status === 'completed'
                            ? 'Procured & Certified'
                            : b.status === 'no_show'
                            ? 'No-Show'
                            : 'Slot Booked'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {b.status === 'booked' && (
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => handleCheckIn(b.id)}
                              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                            >
                              Gate Check-In
                            </button>
                          )}

                          {b.status === 'checked_in' && (
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => handleInProgress(b.id)}
                              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Scale className="w-3.5 h-3.5" />
                              <span>Call to Weighbridge</span>
                            </button>
                          )}

                          {b.status === 'in_progress' && (
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => setPaymentModalBooking(b)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <IndianRupee className="w-3.5 h-3.5" />
                              <span>Weigh & Settle Payment</span>
                            </button>
                          )}

                          {b.status === 'completed' && (
                            <div className="flex items-center gap-1.5 justify-end">
                              <button
                                type="button"
                                onClick={() => setPaymentModalBooking(b)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                title="View/Edit Farmer Bank Details & PFMS Status"
                              >
                                <IndianRupee className="w-3 h-3" />
                                <span>Bank / Pay</span>
                              </button>
                              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{b.tracking_id || 'TRK-CERTIFIED'}</span>
                              </span>
                            </div>
                          )}

                          {['booked', 'checked_in'].includes(b.status) && (
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => handleNoShow(b.id)}
                              className="px-2 py-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 text-[11px] font-bold transition-colors cursor-pointer"
                              title="Mark No-Show (-20 points)"
                            >
                              No-Show
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {/* PFMS Payment & Bank Details Verification Modal */}
          <FarmerPaymentModal
            isOpen={Boolean(paymentModalBooking)}
            onClose={() => setPaymentModalBooking(null)}
            booking={paymentModalBooking}
            farmer={
              farmers.find(f => f.id === paymentModalBooking?.farmer_id || f.id === paymentModalBooking?.farmer?.id) ||
              paymentModalBooking?.farmer
            }
            onSuccess={() => {
              fetchStationSummaries();
              if (onRefresh) onRefresh();
            }}
            lang={lang}
          />
        </div>
      </div>
    </div>
  );
}
