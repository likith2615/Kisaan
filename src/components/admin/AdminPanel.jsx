import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  LogOut, 
  Calendar, 
  Clock, 
  CreditCard, 
  ListOrdered, 
  Building2, 
  MapPin, 
  Map as MapIcon,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Users,
  Phone,
  Layers,
  Sparkles,
  Search,
  Wheat,
  Bell,
  Send
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import AdminSlotManager from './AdminSlotManager';
import AdminCentersManager from './AdminCentersManager';
import AdminQueueManager from './AdminQueueManager';
import AdminPaymentManager from './AdminPaymentManager';
import AdminMspManager from './AdminMspManager';
import AdminNotifications from './AdminNotifications';
import AdminScreen1Login from './AdminScreen1Login';
import ProcurementMap from '../ProcurementMap';


export default function AdminPanel({ user, lang, onLoginSuccess, onLogout }) {
  const [activeTab, setActiveTab] = useState('slots');
  const [bookings, setBookings] = useState([]);
  const [locations, setLocations] = useState([]);
  const [slots, setSlots] = useState([]);
  const [payments, setPayments] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [crops, setCrops] = useState([]);
  const [selectedMapCenter, setSelectedMapCenter] = useState(null);
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState('ALL');
  const [bookingMandiFilter, setBookingMandiFilter] = useState('ALL');
  const [bookingDateFilter, setBookingDateFilter] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('ALL');
  const [bookingSearch, setBookingSearch] = useState('');
  const [lastSync, setLastSync] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [showAdminBookModal, setShowAdminBookModal] = useState(false);
  const [adminBookForm, setAdminBookForm] = useState({
    farmer_name: '',
    farmer_phone: '',
    district: 'Kurnool',
    village: '',
    location_id: '',
    crop_type: 'Paddy',
    expected_quantity: 50,
    date: new Date().toISOString().slice(0, 10),
    time: '09:00 AM - 11:00 AM'
  });
  const [adminBookLoading, setAdminBookLoading] = useState(false);
  const [adminBookMsg, setAdminBookMsg] = useState('');

  const handleAdminBookSubmit = async (e) => {
    e.preventDefault();
    if (!adminBookForm.farmer_name) return;
    const locId = adminBookForm.location_id || (bookingMandiFilter !== 'ALL' ? bookingMandiFilter : locations[0]?.id);
    setAdminBookLoading(true);
    try {
      const res = await fetch('/api/bookings/admin-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...adminBookForm,
          location_id: locId
        })
      });
      const data = await res.json();
      if (data.success) {
        setAdminBookMsg(`✓ Slot booked for ${adminBookForm.farmer_name}! Token: ${data.data?.token_number}`);
        setTimeout(() => setAdminBookMsg(''), 4000);
        setShowAdminBookModal(false);
        setAdminBookForm({
          farmer_name: '',
          farmer_phone: '',
          district: 'Kurnool',
          village: '',
          location_id: '',
          crop_type: 'Paddy',
          expected_quantity: 50,
          date: new Date().toISOString().slice(0, 10),
          time: '09:00 AM - 11:00 AM'
        });
        fetchData();
      }
    } catch {
      setAdminBookMsg('Server error creating booking');
    } finally {
      setAdminBookLoading(false);
    }
  };

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [bRes, lRes, sRes, pRes, fRes, cRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/locations'),
        fetch('/api/slots'),
        fetch('/api/payments'),
        fetch('/api/farmers'),
        fetch('/api/crops')
      ]);
      const [b, l, s, p, f, c] = await Promise.all([
        bRes.json(), lRes.json(), sRes.json(), pRes.json(), fRes.json(), cRes.json()
      ]);

      const rawFarmers = f.success ? f.data : [];
      const rawSlots = s.success ? s.data : [];
      const rawLocations = l.success ? l.data : [];
      const rawCrops = c.success ? c.data : [];

      const enriched = (b.success ? b.data : []).map(bk => {
        const slot = rawSlots.find(sl => sl.id === bk.slot_id) || null;
        const farmer = rawFarmers.find(fm => fm.id === bk.farmer_id || fm.phone === bk.farmer_id) || null;
        const location = rawLocations.find(loc => loc.id === (slot?.location_id || bk.location_id)) || null;
        return {
          ...bk,
          farmer,
          farmer_name: farmer?.name || bk.farmer_name || bk.farmer_id || 'Farmer',
          farmer_phone: farmer?.phone || '',
          slot,
          location,
          location_name: location?.name || 'Mandi Center',
          date: bk.date || slot?.date || (bk.created_at ? bk.created_at.slice(0, 10) : ''),
          time: bk.time || slot?.time_window || slot?.time || '08:00 AM - 10:00 AM'
        };
      });

      setBookings(enriched);
      setLocations(rawLocations);
      setSlots(rawSlots);
      setPayments(p.success ? p.data : []);
      setFarmers(rawFarmers);
      setCrops(rawCrops);
      setLastSync(new Date());
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let channel = null;
    if (supabase) {
      channel = supabase
        .channel('admin-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'slots' }, fetchData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, fetchData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'farmers' }, fetchData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, fetchData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'crops' }, fetchData)
        .subscribe();
    }
    const poll = setInterval(fetchData, 15000);
    return () => {
      if (channel && supabase) supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [user]);

  if (!user) {
    return <AdminScreen1Login onLoginSuccess={(u) => onLoginSuccess(u, 'admin')} />;
  }

  const isSlotManager = user.role === 'slot_manager';
  const isPaymentManager = user.role === 'payment_manager';

  const pendingRequestsCount = locations.filter(l => l.status === 'pending').length;
  const activeCenters = locations.filter(l => l.status === 'active' || !l.status);
  const pendingRequests = locations.filter(l => l.status === 'pending');

  // Tab config based on role
  const tabs = isSlotManager ? [
    { id: 'slots', label: 'Slots', icon: Calendar },
    { id: 'centers', label: 'Mandi Centers', icon: Building2, badge: pendingRequestsCount },
    { id: 'map', label: 'Live Map', icon: MapPin },
    { id: 'queue', label: 'Queue', icon: Clock },
    { id: 'bookings', label: 'Bookings', icon: ListOrdered },
    { id: 'msp', label: 'MSP Rates', icon: Wheat },
    { id: 'notifications', label: 'Notify', icon: Bell }
  ] : [
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'map', label: 'Live Map', icon: MapPin },
    { id: 'msp', label: 'MSP Rates', icon: Wheat },
    { id: 'notifications', label: 'Notify', icon: Bell }
  ];


  // Default tab by role
  const defaultTab = isSlotManager ? 'slots' : 'payments';
  const tab = tabs.find(t => t.id === activeTab) ? activeTab : defaultTab;

  // Filtered locations for Live Map view
  const mapFilteredCentres = selectedDistrictFilter === 'ALL' 
    ? activeCenters 
    : activeCenters.filter(c => (c.district || '').toLowerCase() === selectedDistrictFilter.toLowerCase());

  const mapFilteredRequests = selectedDistrictFilter === 'ALL'
    ? pendingRequests
    : pendingRequests.filter(r => (r.district || '').toLowerCase() === selectedDistrictFilter.toLowerCase());

  // Distinct districts from locations for map filter
  const districts = Array.from(new Set(locations.map(l => l.district).filter(Boolean)));

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      {/* Admin sub-header */}
      <div className={`text-white px-4 sm:px-6 py-3 flex items-center justify-between ${
        isSlotManager ? 'bg-slate-800' : 'bg-emerald-700'
      }`}>
        <div>
          <div className="text-sm font-black">
            {isSlotManager ? '📋 Slot & Queue Manager' : '💳 Payment Manager'}
          </div>
          <div className="text-xs opacity-70 mt-0.5">{user.name} · {user.district}</div>
        </div>
        <div className="flex items-center gap-2">
          {lastSync && (
            <span className="hidden sm:inline text-[10px] opacity-50">
              Synced {lastSync.toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={fetchData}
            disabled={refreshing}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      {tabs.length > 1 && (
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6">
          <div className="flex items-center gap-1 py-2 overflow-x-auto">
            {tabs.map(({ id, label, icon: Icon, badge }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                  tab === id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
                {badge > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    tab === id ? 'bg-amber-400 text-slate-950' : 'bg-amber-500 text-white'
                  }`}>
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Screen Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-5xl mx-auto w-full">
        {isSlotManager && tab === 'slots' && (
          <AdminSlotManager
            locations={locations}
            slots={slots}
            crops={crops}
            onRefresh={fetchData}
          />
        )}
        {isSlotManager && tab === 'centers' && (
          <AdminCentersManager
            locations={locations}
            slots={slots}
            onRefresh={fetchData}
          />
        )}
        {tab === 'map' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Map Header & Summary Statistics */}
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                  <span>Andhra Pradesh Live Procurement Network</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time geographic distribution of Mandi centers, farmer requests, and active operational hubs
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live GPS
                </span>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase">Active Mandis</div>
                <div className="text-xl font-black text-emerald-700 mt-0.5">{activeCenters.length}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Operating yards</div>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase">Pending Requests</div>
                <div className="text-xl font-black text-amber-600 mt-0.5">{pendingRequests.length}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Awaiting nodal review</div>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase">Scheduled Slots</div>
                <div className="text-xl font-black text-blue-700 mt-0.5">{slots.length}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Across all districts</div>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase">Registered Farmers</div>
                <div className="text-xl font-black text-purple-700 mt-0.5">{farmers.length}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Aadhaar verified</div>
              </div>
            </div>

            {/* District Quick Filter Chips */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-1.5 overflow-x-auto">
              <span className="text-xs font-bold text-slate-500 px-2 shrink-0">Filter District:</span>
              <button
                type="button"
                onClick={() => setSelectedDistrictFilter('ALL')}
                className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  selectedDistrictFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Districts ({activeCenters.length})
              </button>
              {districts.map(d => {
                const count = activeCenters.filter(c => (c.district || '').toLowerCase() === d.toLowerCase()).length;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDistrictFilter(d)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                      selectedDistrictFilter === d
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {d} ({count})
                  </button>
                );
              })}
            </div>

            {/* Interactive Leaflet Procurement Map */}
            <div className="bg-white p-2 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <ProcurementMap
                centres={mapFilteredCentres}
                requests={mapFilteredRequests}
                height="520px"
                onSelectCentre={(c) => {
                  setSelectedMapCenter(c);
                }}
              />
            </div>

            {/* Selected Mandi Center Quick View Drawer/Card */}
            {selectedMapCenter && (
              <div className="bg-white p-4 sm:p-5 rounded-3xl border-2 border-emerald-500/30 shadow-md animate-fadeIn">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase">
                        Selected Mandi Yard
                      </span>
                      <span className="text-xs font-bold text-slate-500">ID: {selectedMapCenter.id}</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                      {selectedMapCenter.name}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      📍 {selectedMapCenter.address || selectedMapCenter.village || ''}, {selectedMapCenter.district} · Contact: {selectedMapCenter.contact_phone || '08518-220145'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMapCenter(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
                    <div>
                      <span className="text-slate-400">Scheduled Slots: </span>
                      <strong className="text-slate-800">
                        {slots.filter(s => s.location_id === selectedMapCenter.id || s.centre_id === selectedMapCenter.id).length}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Daily Capacity: </span>
                      <strong className="text-slate-800">{selectedMapCenter.daily_capacity_quintals || 2500} Q/day</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('slots');
                      }}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Manage Slots for this Mandi</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {isSlotManager && tab === 'queue' && (
          <AdminQueueManager
            bookings={bookings}
            slots={slots}
            locations={locations}
            farmers={farmers}
            crops={crops}
            onRefresh={fetchData}
          />
        )}
        {isSlotManager && tab === 'bookings' && (() => {
          const activeLocs = locations.filter(l => l.status === 'active' || !l.status);
          const filteredBookings = bookings.filter(b => {
            const bLocId = b.location_id || b.slot?.location_id || b.slot?.centre_id || b.centre_id;
            const matchMandi = bookingMandiFilter === 'ALL' || bLocId === bookingMandiFilter;
            const bDate = b.date || b.slot?.date || (b.created_at ? b.created_at.slice(0, 10) : '');
            const matchDate = !bookingDateFilter || bookingDateFilter === 'ALL' || bDate === bookingDateFilter;
            const matchStatus = bookingStatusFilter === 'ALL' || b.status === bookingStatusFilter;
            const q = bookingSearch.toLowerCase();
            const matchSearch = !q ||
              (b.farmer_name || '').toLowerCase().includes(q) ||
              (b.farmer_phone || '').toLowerCase().includes(q) ||
              (b.token_number || '').toLowerCase().includes(q) ||
              (b.crop_type || '').toLowerCase().includes(q);

            return matchMandi && matchDate && matchStatus && matchSearch;
          });

          const selectedMandi = activeLocs.find(l => l.id === bookingMandiFilter);
          const totalQuintals = filteredBookings.reduce((sum, b) => sum + (Number(b.actual_quantity || b.expected_quantity) || 50), 0);
          const totalEstValue = filteredBookings.reduce((sum, b) => {
            const msp = b.crop_type === 'Cotton' ? 6620 : b.crop_type === 'Pulses' ? 7000 : b.crop_type === 'Wheat' ? 2275 : b.crop_type === 'Chilli' ? 5000 : 2183;
            const qty = Number(b.actual_quantity || b.expected_quantity) || 50;
            return sum + (qty * msp);
          }, 0);

          return (
            <div className="space-y-4 animate-fadeIn">
              {/* Header & Mandi Filter */}
              <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                      Mandi-Wise Procurement Bookings
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs font-bold text-slate-500">
                      {filteredBookings.length} Total Bookings
                    </span>
                  </div>
                  <h2 className="text-lg font-black text-slate-900 mt-1 flex items-center gap-2">
                    <ListOrdered className="w-5 h-5 text-emerald-600" />
                    <span>{selectedMandi ? selectedMandi.name : 'All Andhra Pradesh Mandi Centers'}</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedMandi ? `📍 ${selectedMandi.address || selectedMandi.village || ''}, ${selectedMandi.district}` : 'Filter and inspect procurement tokens and slotted farmer volumes per center'}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Select Mandi</label>
                    <select
                      value={bookingMandiFilter}
                      onChange={(e) => setBookingMandiFilter(e.target.value)}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-800 outline-none focus:border-emerald-600"
                    >
                      <option value="ALL">🏛️ All Mandi Centers ({activeLocs.length})</option>
                      {activeLocs.map(l => {
                        const count = bookings.filter(b => b.location_id === l.id || b.slot?.location_id === l.id).length;
                        return (
                          <option key={l.id} value={l.id}>
                            {l.name} ({l.district}) — {count} bookings
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Filter Date</label>
                      <button
                        type="button"
                        onClick={() => setBookingDateFilter(bookingDateFilter === 'ALL' ? new Date().toISOString().slice(0, 10) : 'ALL')}
                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
                      >
                        {bookingDateFilter === 'ALL' ? 'Show Today' : 'Show All Dates'}
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={bookingDateFilter === 'ALL' ? '' : bookingDateFilter}
                        onChange={(e) => setBookingDateFilter(e.target.value)}
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-800 outline-none focus:border-emerald-600"
                      />
                      {bookingDateFilter === 'ALL' && (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-lg whitespace-nowrap">
                          All Dates
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="self-end sm:self-auto pt-4 sm:pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setAdminBookForm(prev => ({
                          ...prev,
                          location_id: bookingMandiFilter !== 'ALL' ? bookingMandiFilter : activeLocs[0]?.id || '',
                          date: bookingDateFilter || new Date().toISOString().slice(0, 10)
                        }));
                        setShowAdminBookModal(true);
                      }}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
                    >
                      <span>+ Book for Farmer</span>
                    </button>
                  </div>
                </div>
              </div>

              {adminBookMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{adminBookMsg}</span>
                </div>
              )}

              {/* Summary Metrics for Selected Mandi */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Bookings Count</div>
                  <div className="text-xl font-black text-slate-900 mt-0.5">{filteredBookings.length}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Slotted tokens</div>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Total Harvest Volume</div>
                  <div className="text-xl font-black text-emerald-700 mt-0.5">{totalQuintals.toLocaleString()} Qtl</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Committed crop</div>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Procurement MSP Value</div>
                  <div className="text-xl font-black text-purple-700 mt-0.5">₹{(totalEstValue / 100000).toFixed(2)} Lakhs</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Gross payout estimate</div>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Completed / Paid</div>
                  <div className="text-xl font-black text-blue-700 mt-0.5">
                    {filteredBookings.filter(b => b.status === 'completed' || b.status === 'payment_ready').length}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Processed successfully</div>
                </div>
              </div>

              {/* Search & Status Filters */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    placeholder="Search farmer name, token #, phone, crop..."
                    className="w-full min-h-[40px] pl-9 pr-3 rounded-xl border border-slate-300 text-xs font-semibold focus:border-emerald-600 bg-white"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto shrink-0">
                  <span className="text-xs font-bold text-slate-500 px-1">Status:</span>
                  {['ALL', 'booked', 'arrived', 'weighed', 'payment_ready', 'completed'].map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setBookingStatusFilter(st)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        bookingStatusFilter === st
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {st === 'ALL' ? 'All' : st === 'payment_ready' ? 'Payment Ready' : st.charAt(0).toUpperCase() + st.slice(1)}
                    </button>
                  ))}
                  {bookingDateFilter && (
                    <button
                      type="button"
                      onClick={() => setBookingDateFilter('')}
                      className="px-2 py-1 text-xs text-red-600 font-bold hover:underline"
                    >
                      Clear Date
                    </button>
                  )}
                </div>
              </div>

              {/* Mandi-Wise Bookings Cards List */}
              {filteredBookings.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-6 text-slate-400">
                  <ListOrdered className="w-12 h-12 mx-auto mb-2 opacity-30 text-slate-400" />
                  <p className="font-bold text-sm text-slate-700">No bookings match the selected filters</p>
                  <p className="text-xs text-slate-500 mt-0.5">Try choosing another mandi center, date, or clear search</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredBookings.map((b) => {
                    const msp = b.crop_type === 'Cotton' ? 6620 : b.crop_type === 'Pulses' ? 7000 : b.crop_type === 'Wheat' ? 2275 : b.crop_type === 'Chilli' ? 5000 : 2183;
                    const qty = Number(b.actual_quantity || b.expected_quantity) || 50;
                    const val = qty * msp;

                    return (
                      <div
                        key={b.id}
                        className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-sm hover:border-emerald-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-slate-900 text-sm sm:text-base">{b.farmer_name}</span>
                            {b.token_number && (
                              <span className="text-[10px] font-black bg-slate-900 text-amber-300 px-2.5 py-0.5 rounded-md tracking-wider">
                                {b.token_number}
                              </span>
                            )}
                            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                              b.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                              b.status === 'payment_ready' ? 'bg-blue-100 text-blue-800' :
                              b.status === 'weighed' ? 'bg-purple-100 text-purple-800' :
                              b.status === 'arrived' ? 'bg-amber-100 text-amber-800' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {b.status === 'payment_ready' ? 'Sent to Payment' : b.status}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                            <div className="flex items-center gap-1 font-bold text-slate-700">
                              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{b.location_name || 'Mandi Center'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>{b.date || b.slot?.date || 'Scheduled'} · {b.slot?.time || b.slot?.time_window || '09:00 AM - 11:00 AM'}</span>
                            </div>
                            {b.farmer_phone && (
                              <div className="flex items-center gap-1">
                                <Phone className="w-3.5 h-3.5 text-slate-400" />
                                <span>{b.farmer_phone}</span>
                              </div>
                            )}
                          </div>

                          <div className="mt-2 flex items-center gap-3 text-xs flex-wrap">
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md font-bold">
                              🌾 {b.crop_type || 'Paddy'} · {qty} Quintals
                            </span>
                            <span className="font-bold text-slate-700">
                              Est. Value: <strong className="text-emerald-700 font-black">₹{val.toLocaleString('en-IN')}</strong> (@ ₹{msp}/qtl)
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 text-right self-end sm:self-center">
                          <span className="text-[10px] font-bold text-slate-400 block">Booking ID</span>
                          <span className="text-xs font-mono font-bold text-slate-700">{b.id}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Admin Book Modal */}
              {showAdminBookModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
                  <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200">
                    <h3 className="text-lg font-black text-slate-900 mb-1">Book Procurement Slot for Farmer</h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Directly slot Farmer A, B, C or enter details to assign Mandi procurement token
                    </p>

                    <form onSubmit={handleAdminBookSubmit} className="space-y-3">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Farmer Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Farmer A / Rajesh"
                            value={adminBookForm.farmer_name}
                            onChange={(e) => setAdminBookForm({ ...adminBookForm, farmer_name: e.target.value })}
                            className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number</label>
                          <input
                            type="tel"
                            placeholder="9876543210"
                            value={adminBookForm.farmer_phone}
                            onChange={(e) => setAdminBookForm({ ...adminBookForm, farmer_phone: e.target.value })}
                            className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Mandi Center *</label>
                        <select
                          required
                          value={adminBookForm.location_id}
                          onChange={(e) => setAdminBookForm({ ...adminBookForm, location_id: e.target.value })}
                          className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white outline-none focus:border-emerald-600"
                        >
                          <option value="">Select Mandi Yard</option>
                          {activeLocs.map(l => (
                            <option key={l.id} value={l.id}>{l.name} ({l.district})</option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Booking Date *</label>
                          <input
                            type="date"
                            required
                            value={adminBookForm.date}
                            onChange={(e) => setAdminBookForm({ ...adminBookForm, date: e.target.value })}
                            className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Time Window *</label>
                          <select
                            value={adminBookForm.time}
                            onChange={(e) => setAdminBookForm({ ...adminBookForm, time: e.target.value })}
                            className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white outline-none focus:border-emerald-600"
                          >
                            <option value="09:00 AM - 11:00 AM">09:00 AM - 11:00 AM</option>
                            <option value="11:00 AM - 01:00 PM">11:00 AM - 01:00 PM</option>
                            <option value="02:00 PM - 04:00 PM">02:00 PM - 04:00 PM</option>
                            <option value="04:00 PM - 06:00 PM">04:00 PM - 06:00 PM</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Crop Type</label>
                          <select
                            value={adminBookForm.crop_type}
                            onChange={(e) => setAdminBookForm({ ...adminBookForm, crop_type: e.target.value })}
                            className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white outline-none focus:border-emerald-600"
                          >
                            <option value="Paddy">Paddy (MSP: ₹2,183/qtl)</option>
                            <option value="Wheat">Wheat (MSP: ₹2,275/qtl)</option>
                            <option value="Cotton">Cotton (MSP: ₹6,620/qtl)</option>
                            <option value="Pulses">Pulses (MSP: ₹7,000/qtl)</option>
                            <option value="Chilli">Chilli (MSP: ₹5,000/qtl)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Expected Qty (Qtl)</label>
                          <input
                            type="number"
                            min="1"
                            max="1000"
                            value={adminBookForm.expected_quantity}
                            onChange={(e) => setAdminBookForm({ ...adminBookForm, expected_quantity: e.target.value })}
                            className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600"
                          />
                        </div>
                      </div>

                      {/* Preset Quick Fill */}
                      <div className="pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Quick Pre-fill Test Farmers:</span>
                        <div className="grid grid-cols-3 gap-1.5 mt-1">
                          {['Farmer A', 'Farmer B', 'Farmer C'].map(name => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => setAdminBookForm({
                                ...adminBookForm,
                                farmer_name: name,
                                farmer_phone: `98480112${name.slice(-1) === 'A' ? '11' : name.slice(-1) === 'B' ? '22' : '33'}`
                              })}
                              className="py-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold transition-all cursor-pointer"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2.5 pt-3">
                        <button
                          type="button"
                          onClick={() => setShowAdminBookModal(false)}
                          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={adminBookLoading}
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                        >
                          {adminBookLoading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <span>Create & Assign Token</span>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
        {isPaymentManager && tab === 'payments' && (
          <AdminPaymentManager
            payments={payments}
            bookings={bookings}
            farmers={farmers}
            crops={crops}
            onRefresh={fetchData}
          />
        )}
        {tab === 'msp' && (
          <AdminMspManager
            crops={crops}
            onRefresh={fetchData}
            user={user}
          />
        )}
        {tab === 'notifications' && (
          <AdminNotifications user={user} />
        )}
      </div>
    </div>
  );
}

