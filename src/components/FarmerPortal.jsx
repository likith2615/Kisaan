import React, { useState, useEffect } from 'react';
import VoiceAgent from './VoiceAgent';
import ProcurementMap from './ProcurementMap';
import { supabase } from '../supabaseClient';
import { translations } from '../translations';

export default function FarmerPortal({ user, lang = 'te', onLanguageChange, onLogout, onOpenAuth }) {
  const currentFarmerId = user?.id;
  const isGuest = Boolean(user?.isGuest);

  const [overview, setOverview] = useState(null);
  const [centres, setCentres] = useState([]);
  const [crops, setCrops] = useState([]);
  const [slots, setSlots] = useState([]);
  const [centerRequests, setCenterRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState(new Date());

  const [activeTab, setActiveTab] = useState('bookings'); // 'bookings', 'book_slot', 'center_request', 'map', 'weighments', 'profile'

  const t = translations[lang] || translations.en;

  // Booking Form State
  const [selectedCrop, setSelectedCrop] = useState('');
  const [selectedCentre, setSelectedCentre] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [expectedQty, setExpectedQty] = useState(100);
  const [bookingMessage, setBookingMessage] = useState(null);

  // Center Request Form State
  const [centerReqData, setCenterReqData] = useState({
    proposed_name: '',
    district: user?.district || 'Kurnool',
    mandal: user?.mandal || 'Kallur',
    village: user?.village || 'Ulchala',
    nearby_landmark: '',
    crops_grown: 'Paddy, Cotton, Wheat',
    estimated_farmers_count: 75,
    estimated_harvest_quintals: 3000,
    reason: '',
    location_lat: 15.8281,
    location_lng: 78.0373
  });
  const [centerReqMessage, setCenterReqMessage] = useState(null);
  const [isSubmittingReq, setIsSubmittingReq] = useState(false);

  // Profile State
  const [profileData, setProfileData] = useState({
    name: '',
    phone: '',
    bank_account: '',
    ifsc: '',
    land_hectares: 0,
    language_preference: 'te'
  });

  // Silent Fetch for Automatic Real-Time Updates
  const fetchAllFarmerData = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);

      const [ovRes, cenRes, crpRes, sltRes, reqRes, notifRes] = await Promise.all([
        fetch(`/api/farmer-overview/${currentFarmerId}`),
        fetch('/api/centres'),
        fetch('/api/crops'),
        fetch('/api/slots'),
        fetch('/api/centerRequests'),
        fetch(`/api/notifications?user_id=${currentFarmerId}`)
      ]);

      const ov = await ovRes.json();
      const cen = await cenRes.json();
      const crp = await crpRes.json();
      const slt = await sltRes.json();
      const reqs = await reqRes.json();
      const notifs = await notifRes.json();

      if (ov.success) {
        setOverview(ov.data);
        if (isInitial) setProfileData(ov.data.farmer);
      }
      if (cen.success) setCentres(cen.data);
      if (crp.success) {
        setCrops(crp.data);
        if (isInitial && crp.data.length > 0) setSelectedCrop(crp.data[0].id);
      }
      if (slt.success) {
        setSlots(slt.data);
        if (isInitial && slt.data.length > 0) setSelectedSlot(slt.data[0].id);
      }
      if (reqs.success) {
        const userReqs = isGuest 
          ? reqs.data 
          : reqs.data.filter(r => r.farmer_id === currentFarmerId || r.farmer_phone === user?.phone);
        setCenterRequests(userReqs.length ? userReqs : reqs.data);
      }
      if (notifs.success) {
        setNotifications(notifs.data || []);
      }

      setLastSyncTime(new Date());
    } catch (err) {
      console.warn('Silent sync error:', err.message);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  // Initial Load
  useEffect(() => {
    fetchAllFarmerData(true);
  }, [currentFarmerId]);

  // Automatic Real-Time Polling Sync
  useEffect(() => {
    const syncInterval = setInterval(() => {
      fetchAllFarmerData(false);
    }, 4000);

    const realtimeChannel = supabase
      .channel('kisan-farmer-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => fetchAllFarmerData(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchAllFarmerData(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => fetchAllFarmerData(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'center_requests' }, () => fetchAllFarmerData(false))
      .subscribe();

    return () => {
      clearInterval(syncInterval);
      supabase.removeChannel(realtimeChannel);
    };
  }, [currentFarmerId]);

  // Handle Book Slot
  const handleBookSlot = async (e) => {
    e.preventDefault();
    if (isGuest) {
      if (onOpenAuth) onOpenAuth();
      return;
    }
    if (!selectedSlot) return;

    try {
      const res = await fetch('/api/bookings/book-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmer_id: currentFarmerId,
          slot_id: selectedSlot,
          crop_id: selectedCrop,
          expected_quantity: Number(expectedQty)
        })
      });
      const json = await res.json();
      if (json.success) {
        setBookingMessage({ type: 'success', text: `🎉 Booking Confirmed! Mandi Token Generated: ${json.data.token_number}` });
        fetchAllFarmerData(false);
        setActiveTab('bookings');
      } else {
        setBookingMessage({ type: 'error', text: json.error });
      }
    } catch {
      setBookingMessage({ type: 'error', text: 'Network error booking slot' });
    }
  };

  // Handle Submit New Center Request
  const handleSubmitCenterRequest = async (e) => {
    e.preventDefault();
    if (isGuest) {
      if (onOpenAuth) onOpenAuth();
      return;
    }

    if (!centerReqData.proposed_name || !centerReqData.district || !centerReqData.reason) {
      setCenterReqMessage({ type: 'error', text: 'Please fill in proposed center name, district, and reason.' });
      return;
    }

    setIsSubmittingReq(true);
    setCenterReqMessage(null);

    try {
      const payload = {
        farmer_id: currentFarmerId,
        farmer_name: user?.name || 'Farmer',
        farmer_phone: user?.phone || '9876543210',
        proposed_name: centerReqData.proposed_name.trim(),
        district: centerReqData.district.trim(),
        mandal: centerReqData.mandal.trim(),
        village: centerReqData.village.trim(),
        nearby_landmark: centerReqData.nearby_landmark.trim(),
        crops_grown: centerReqData.crops_grown.trim(),
        estimated_farmers_count: Number(centerReqData.estimated_farmers_count) || 50,
        estimated_harvest_quintals: Number(centerReqData.estimated_harvest_quintals) || 2500,
        reason: centerReqData.reason.trim(),
        location_lat: centerReqData.location_lat,
        location_lng: centerReqData.location_lng,
        status: 'Pending',
        admin_remarks: 'Under District Feasibility Evaluation',
        created_at: new Date().toISOString()
      };

      const res = await fetch('/api/centerRequests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json.success) {
        setCenterReqMessage({
          type: 'success',
          text: '🎉 Center sanction request submitted successfully! District Procurement Nodal Officer has been notified.'
        });
        setCenterReqData({
          ...centerReqData,
          proposed_name: '',
          nearby_landmark: '',
          reason: ''
        });
        fetchAllFarmerData(false);
      } else {
        setCenterReqMessage({ type: 'error', text: json.error || 'Failed to submit request' });
      }
    } catch {
      setCenterReqMessage({ type: 'error', text: 'Network error submitting request' });
    } finally {
      setIsSubmittingReq(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!confirm('Are you sure you want to cancel this procurement booking?')) return;
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        alert('Booking cancelled successfully.');
        fetchAllFarmerData(false);
      } else {
        alert(json.error || 'Failed to cancel booking.');
      }
    } catch {
      alert('Network error cancelling booking.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <span className="material-symbols-outlined text-4xl text-amber-600 animate-spin">sync</span>
          <p className="text-slate-600 mt-2 font-bold text-sm">Synchronizing Central Farmer Registry & Mandi Data...</p>
        </div>
      </div>
    );
  }

  const farmer = overview?.farmer || user;
  const bookings = overview?.bookings || [];

  // Selected crop details for dynamic calculation
  const currentCropObj = crops.find(c => c.id === selectedCrop);
  const estimatedGrossPayout = currentCropObj ? (currentCropObj.msp_per_quintal * Number(expectedQty || 0)) : 0;

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50 font-sans">
      {/* 1. Official Farmer Portal Command Sidebar Navigator (Desktop) */}
      <nav className="hidden md:flex flex-col h-full py-4 px-3.5 bg-white text-slate-800 w-64 shrink-0 shadow-gov border-r border-slate-200 z-20 overflow-y-auto">
        {/* Farmer Profile Mini Identity Card */}
        <div className="mb-4 p-3 rounded-xl bg-gradient-to-b from-amber-50/70 via-white to-emerald-50/50 border border-amber-200 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-amber-100 via-white to-emerald-100 border-2 border-amber-500 text-gov-navy flex items-center justify-center font-black text-lg shadow-2xs shrink-0">
              {farmer?.name?.charAt(0) || '👨‍🌾'}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xs font-black text-gov-navy truncate">{farmer?.name}</h2>
              <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                ✓ {isGuest ? 'Guest' : 'Verified'}
              </span>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 font-medium mt-1.5 truncate">
            📍 {farmer?.village || 'Gram Panchayat'}, {farmer?.district || 'District'}
          </p>
        </div>

        {/* Sidebar Nav Links */}
        <div className="flex-1 overflow-y-auto w-full space-y-1 text-xs font-bold pr-0.5">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-left ${
              activeTab === 'bookings'
                ? 'bg-gov-navy text-white font-black shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-base">confirmation_number</span>
              <span>{t.navBookings}</span>
            </div>
            {bookings.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                activeTab === 'bookings' ? 'bg-amber-400 text-gov-navy' : 'bg-amber-100 text-amber-900 border border-amber-300'
              }`}>
                {bookings.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('book_slot')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-left ${
              activeTab === 'book_slot'
                ? 'bg-gov-navy text-white font-black shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-base">edit_calendar</span>
            <span>{t.navBookSlot}</span>
          </button>

          <button
            onClick={() => setActiveTab('weighments')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-left ${
              activeTab === 'weighments'
                ? 'bg-gov-navy text-white font-black shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-base">receipt_long</span>
            <span>{t.navWeighment}</span>
          </button>

          <button
            onClick={() => setActiveTab('center_request')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-left ${
              activeTab === 'center_request'
                ? 'bg-gov-navy text-white font-black shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-base">add_location_alt</span>
              <span>{t.navCenterRequest}</span>
            </div>
            {centerRequests.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                activeTab === 'center_request' ? 'bg-amber-400 text-gov-navy' : 'bg-amber-100 text-amber-900 border border-amber-300'
              }`}>
                {centerRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-left ${
              activeTab === 'map'
                ? 'bg-gov-navy text-white font-black shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-base">map</span>
            <span>{t.navMap}</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-left ${
              activeTab === 'profile'
                ? 'bg-gov-navy text-white font-black shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-base">person</span>
            <span>{t.navProfile}</span>
          </button>
        </div>

        {/* Sidebar Footer Info */}
        <div className="mt-auto pt-3 border-t border-slate-200 space-y-2">
          {/* DBT Bank Account Mini Chip */}
          <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg text-left">
            <span className="text-[9px] text-slate-500 font-bold uppercase block">DBT Seeded Bank</span>
            <span className="text-[11px] font-bold text-slate-800 font-mono truncate block">
              {farmer?.bank_account ? `A/C •••• ${String(farmer.bank_account).slice(-4)}` : 'SBIN0001234 (Active)'}
            </span>
          </div>

          {/* e-NAM Live Sync Indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <span className="truncate">e-NAM Real-Time Sync</span>
          </div>

          {isGuest && onOpenAuth && (
            <button
              onClick={onOpenAuth}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg text-xs transition-all active:scale-95 shadow-2xs"
            >
              <span className="material-symbols-outlined text-sm">login</span>
              <span>Sign In / e-KYC</span>
            </button>
          )}

          {onLogout && !isGuest && (
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 font-bold rounded-lg text-xs transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              <span>{t.logout}</span>
            </button>
          )}
        </div>
      </nav>

      {/* 2. Main Work Canvas */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Guest Mode Notice Banner */}
        {isGuest && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex flex-wrap items-center justify-between gap-2 shadow-xs border-b border-amber-600 shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">visibility</span>
              <span>{t.guestModeDesc}</span>
            </div>
            <button
              onClick={onOpenAuth}
              className="bg-gov-navy hover:bg-gov-navy-800 text-white px-3 py-1 rounded-lg text-xs font-black shadow-xs transition-all active:scale-95"
            >
              Sign In with Aadhaar / OTP
            </button>
          </div>
        )}

        {/* Mobile Sticky Navigation Tabs */}
        <div className="flex md:hidden overflow-x-auto bg-white border-b border-slate-200 px-3 py-2 gap-1.5 shrink-0 text-xs font-bold sticky top-0 z-10 shadow-xs">
          {[
            { id: 'bookings', label: `${t.navBookings} (${bookings.length})`, icon: 'confirmation_number' },
            { id: 'book_slot', label: t.navBookSlot, icon: 'edit_calendar' },
            { id: 'weighments', label: t.navWeighment, icon: 'receipt_long' },
            { id: 'center_request', label: `${t.navCenterRequest} (${centerRequests.length})`, icon: 'add_location_alt' },
            { id: 'map', label: t.navMap, icon: 'map' },
            { id: 'profile', label: t.navProfile, icon: 'person' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1 transition-all ${
                activeTab === tab.id ? 'bg-gov-navy text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-sm">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Top Canvas Header Bar (Desktop: Title, Alerts, ID) */}
        <div className="hidden md:flex items-center justify-between bg-white border-b border-slate-200 px-6 py-3 shrink-0 shadow-2xs">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-black text-gov-navy uppercase tracking-wider">
              {activeTab === 'bookings' && t.navBookings}
              {activeTab === 'book_slot' && t.navBookSlot}
              {activeTab === 'weighments' && t.navWeighment}
              {activeTab === 'center_request' && t.navCenterRequest}
              {activeTab === 'map' && t.navMap}
              {activeTab === 'profile' && t.navProfile}
            </h1>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-600 font-semibold">
              {farmer?.village || 'Gram Panchayat'}, {farmer?.district || 'District'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative bg-slate-100 hover:bg-slate-200 p-2 rounded-lg text-slate-700 transition-colors shadow-2xs active:scale-95 flex items-center gap-1.5 text-xs font-bold"
                title="Notifications"
              >
                <span className="material-symbols-outlined text-base">notifications</span>
                <span>Alerts</span>
                {notifications.length > 0 && (
                  <span className="bg-red-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-black animate-pulse">
                    {notifications.length}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border-2 border-gov-navy rounded-xl shadow-2xl p-4 z-50 animate-scale-up">
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-gov-navy">
                      <span className="material-symbols-outlined text-sm text-amber-600">notifications_active</span>
                      <span>Mandi & DBT Alerts</span>
                    </div>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-slate-400 hover:text-slate-700 text-xs font-bold"
                    >
                      Close
                    </button>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-4">No pending notices.</p>
                    ) : (
                      notifications.map((n, i) => (
                        <div key={n.id || i} className="bg-slate-50 hover:bg-amber-50/60 p-2.5 rounded-lg border border-slate-200 text-xs transition-colors">
                          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                            <span className="font-bold text-gov-navy uppercase">{n.channel || 'Govt Notice'}</span>
                            <span>{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="font-semibold text-slate-800 leading-snug">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Farmer ID badge */}
            <div className="flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-300 text-gov-navy font-mono text-xs font-bold">
              <span>🆔 {currentFarmerId}</span>
            </div>
          </div>
        </div>

        {/* Scrollable Page Content Viewport */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-8 bg-slate-50">
          <div className="max-w-7xl mx-auto">
        {/* TAB 1: MY BOOKINGS & LIVE GATE PASS */}
        {activeTab === 'bookings' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-black text-gov-navy tracking-tight">
                  {t.activeBookingsTitle}
                </h2>
                <p className="text-xs text-slate-600">
                  Government Mandi Gate Passes, live token queue position, and scheduled arrival windows.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('book_slot')}
                className="bg-gov-navy hover:bg-gov-navy-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 self-start sm:self-center"
              >
                <span className="material-symbols-outlined text-sm text-amber-300">add</span>
                <span>{t.newBookingBtn}</span>
              </button>
            </div>

            {bookings.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-10 text-center shadow-xs">
                <span className="material-symbols-outlined text-5xl text-slate-400 mb-2">event_busy</span>
                <h3 className="text-base font-bold text-slate-800">{t.noBookingsFound}</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
                  {t.noBookingsDesc}
                </p>
                <button
                  onClick={() => setActiveTab('book_slot')}
                  className="bg-gov-navy hover:bg-gov-navy-700 text-white px-5 py-2.5 rounded-lg text-xs font-bold shadow-md active:scale-95"
                >
                  {t.newBookingBtn}
                </button>
              </div>
            ) : (
              bookings.map((b) => (
                <div
                  key={b.id}
                  className="bg-white border-t-4 border-t-amber-500 border-x border-b border-slate-200 rounded-xl p-5 shadow-gov hover:shadow-gov-md transition-shadow relative overflow-hidden space-y-4"
                >
                  {/* Gate Pass Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-100 text-amber-900 text-xs font-black px-3 py-1 rounded border border-amber-300">
                        {t.tokenNumber}: {b.token_number}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Ref: {b.id}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded uppercase border ${
                        b.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : b.status === 'arrived'
                          ? 'bg-blue-50 text-blue-800 border-blue-300'
                          : 'bg-amber-50 text-amber-900 border-amber-300'
                      }`}>
                        Status: {b.status}
                      </span>

                      <button
                        onClick={() => window.print()}
                        className="no-print text-gov-navy hover:text-amber-700 text-xs font-bold flex items-center gap-1 bg-slate-100 px-2 py-1 rounded border border-slate-200"
                        title="Print Official Mandi Gate Pass"
                      >
                        <span className="material-symbols-outlined text-sm">print</span>
                        <span className="hidden sm:inline">Print Pass</span>
                      </button>

                      {b.status === 'booked' && (
                        <button
                          onClick={() => handleCancelBooking(b.id)}
                          className="text-red-600 hover:text-red-800 text-[11px] font-bold hover:underline ml-1"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Gate Pass Key Specs */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Crop & Expected Quantity</span>
                      <span className="font-black text-gov-navy text-sm">{b.crop?.name || 'Wheat'}</span>
                      <span className="text-emerald-700 font-bold block">{b.expected_quantity} Quintals (Estimated)</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Designated Procurement Mandi</span>
                      <span className="font-bold text-gov-navy">{b.centre?.name || 'Mandi Yard'}</span>
                      <span className="text-slate-600 block">{b.centre?.district} • {b.centre?.mandal}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Scheduled Arrival Window</span>
                      <span className="font-bold text-gov-navy">{b.slot?.date}</span>
                      <span className="text-slate-600 block">{b.slot?.time_window}</span>
                    </div>
                  </div>

                  {/* Stamp / Security Seal */}
                  <div className="flex flex-wrap items-center justify-between text-[11px] pt-1 text-slate-500 border-t border-slate-100">
                    <div className="flex items-center gap-1 font-bold text-emerald-800">
                      <span>🏛️</span>
                      <span>Certified Electronic Token under Ministry of Agriculture & Farmers Welfare</span>
                    </div>
                    <div className="font-mono text-[10px]">
                      GATE PASS SECURITY HASH: #{b.id?.slice(0, 8).toUpperCase()}-2026
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: BOOK PROCUREMENT SLOT */}
        {activeTab === 'book_slot' && (
          <div className="max-w-3xl mx-auto bg-white border-t-4 border-t-amber-500 border-x border-b border-slate-200 rounded-xl p-6 sm:p-8 shadow-gov">
            <div className="border-b border-slate-200 pb-4 mb-5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 text-[11px] font-bold mb-1">
                <span>🌾</span>
                <span>e-NAM Standard Slot Scheduling</span>
              </div>
              <h2 className="text-xl font-black text-gov-navy tracking-tight">{t.bookSlotTitle}</h2>
              <p className="text-xs text-slate-600 mt-0.5">{t.bookSlotDesc}</p>
            </div>

            {bookingMessage && (
              <div className={`p-3.5 rounded-lg text-xs font-bold mb-5 flex items-center gap-2 ${
                bookingMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-red-50 text-red-700 border border-red-300'
              }`}>
                <span className="material-symbols-outlined text-base">
                  {bookingMessage.type === 'success' ? 'verified' : 'error'}
                </span>
                <span>{bookingMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleBookSlot} className="space-y-5">
              {/* 1. Crop Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">{t.selectCropLabel} *</label>
                <select
                  value={selectedCrop}
                  onChange={(e) => setSelectedCrop(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-amber-500"
                  required
                >
                  {crops.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} — Official MSP: ₹{Number(c.msp_per_quintal).toLocaleString('en-IN')}/{c.unit || 'Q'} ({c.season})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Centre & Slot Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">{t.selectSlotLabel} *</label>
                <select
                  value={selectedSlot}
                  onChange={(e) => setSelectedSlot(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-amber-500"
                  required
                >
                  {slots.map(s => {
                    const c = centres.find(cen => cen.id === s.centre_id);
                    const freeCapacity = (s.max_capacity - s.booked_count);
                    return (
                      <option key={s.id} value={s.id}>
                        {c?.name || 'Mandi'} ({c?.district}) • {s.date} [{s.time_window}] — Available Capacity: {freeCapacity} Q
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* 3. Expected Quantity */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-slate-700">{t.expectedQtyLabel} *</label>
                  <span className="text-xs font-mono font-bold text-amber-700">{expectedQty} Quintals</span>
                </div>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={expectedQty}
                  onChange={(e) => setExpectedQty(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-amber-500"
                  required
                />
              </div>

              {/* Dynamic Estimated MSP Payout Barometer */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    Estimated Gross MSP Value (Under CACP 2026)
                  </span>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Net amount calculated at mandi electronic weighbridge after moisture & tare deduction.
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-2xl font-black text-emerald-800">
                    ₹{estimatedGrossPayout.toLocaleString('en-IN')}
                  </div>
                  <span className="text-[10px] text-emerald-700 font-bold">Guaranteed Direct DBT</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-gov-navy hover:bg-gov-navy-700 text-white py-3.5 rounded-lg text-sm font-bold shadow-gov-md transition-all active:scale-95 flex items-center justify-center gap-2 border border-gov-navy-800"
              >
                <span className="material-symbols-outlined text-base text-amber-300">check_circle</span>
                <span>{t.confirmBookingBtn}</span>
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: WEIGHMENT & DBT PASSBOOK */}
        {activeTab === 'weighments' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-lg font-black text-gov-navy tracking-tight">{t.navWeighment}</h2>
              <p className="text-xs text-slate-600">
                Certified electronic weighbridge slips, transparent itemized deductions, and PFMS UTR payment confirmations.
              </p>
            </div>

            {bookings.filter(b => b.weighment || b.payment).length === 0 ? (
              <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-10 text-center shadow-xs">
                <span className="material-symbols-outlined text-5xl text-slate-400 mb-2">receipt_long</span>
                <h3 className="text-base font-bold text-slate-800">No Electronic Weighment Slips Recorded Yet</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Once your crop is weighed at the government mandi yard, your certified slip and DBT transaction reference will appear here in real time.
                </p>
              </div>
            ) : (
              bookings.filter(b => b.weighment || b.payment).map(b => (
                <div key={b.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-gov space-y-4">
                  <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-100 text-emerald-900 text-xs font-bold px-2.5 py-0.5 rounded uppercase">
                          Certified Slip #{b.weighment?.id || 'WGH-8001'}
                        </span>
                        <span className="gov-stamp text-[10px]">VERIFIED</span>
                      </div>
                      <h3 className="text-base font-black text-gov-navy mt-1.5">{b.crop?.name} — Token {b.token_number}</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Net Certified DBT Credit</span>
                      <span className="text-2xl font-black text-emerald-800">
                        ₹{(b.payment?.amount || 227500).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {b.weighment && (
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <span className="text-slate-500 block text-[10px] font-bold">Gross Weighment</span>
                        <span className="font-bold text-slate-900 text-sm">{b.weighment.gross_qty} Quintals</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] font-bold">Bag Count (Gunny)</span>
                        <span className="font-bold text-slate-900 text-sm">{b.weighment.bag_count} Bags</span>
                      </div>
                      <div>
                        <span className="text-red-700 block text-[10px] font-bold">Deductions (Moisture + Tare)</span>
                        <span className="font-bold text-red-700 text-sm">-{b.weighment.deductions_kg} kg</span>
                        <span className="text-[9px] text-slate-500 block">{b.weighment.deduction_reason || 'Standard CACP allowance'}</span>
                      </div>
                      <div>
                        <span className="text-emerald-800 block text-[10px] font-bold">Net Procured Qty</span>
                        <span className="font-black text-emerald-800 text-sm">{b.weighment.net_qty} Quintals</span>
                      </div>
                    </div>
                  )}

                  {b.payment && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-emerald-900">PFMS Direct Benefit Transfer (DBT) Status: {b.payment.status}</span>
                        <span className="text-[11px] text-emerald-700 block font-mono">Bank UTR Ref: {b.payment.bank_txn_ref}</span>
                      </div>
                      <span className="bg-emerald-700 text-white text-[10px] font-bold px-3 py-1 rounded uppercase">
                        ✓ Disbursed (48h SLA Met)
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: REQUEST NEW MANDI CENTER */}
        {activeTab === 'center_request' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-lg font-black text-gov-navy tracking-tight">
                {t.navCenterRequest} • కొత్త కొనుగోలు కేంద్రాన్ని అభ్యర్థించండి
              </h2>
              <p className="text-xs text-slate-600">
                Submit an official proposal to the District Collectorate & Food Corporation of India for opening a procurement sub-center in your gram panchayat.
              </p>
            </div>

            {/* Proposal Form Card */}
            <div className="bg-white border-t-4 border-t-amber-500 border-x border-b border-slate-200 rounded-xl p-5 sm:p-6 shadow-gov">
              <h3 className="text-sm font-black text-gov-navy mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">add_location_alt</span>
                <span>Propose New Mandi Point (Gram Panchayat Level)</span>
              </h3>

              {centerReqMessage && (
                <div className={`p-3.5 rounded-lg text-xs font-bold mb-4 ${
                  centerReqMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-red-50 text-red-700 border border-red-300'
                }`}>
                  {centerReqMessage.text}
                </div>
              )}

              <form onSubmit={handleSubmitCenterRequest} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Proposed Center Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Ulchala Gram Panchayat Procurement Sub-Center"
                      value={centerReqData.proposed_name}
                      onChange={(e) => setCenterReqData({ ...centerReqData, proposed_name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nearby Landmark / Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Beside Primary Agriculture Cooperative Society (PACS)"
                      value={centerReqData.nearby_landmark}
                      onChange={(e) => setCenterReqData({ ...centerReqData, nearby_landmark: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">District *</label>
                    <input
                      type="text"
                      value={centerReqData.district}
                      onChange={(e) => setCenterReqData({ ...centerReqData, district: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mandal</label>
                    <input
                      type="text"
                      value={centerReqData.mandal}
                      onChange={(e) => setCenterReqData({ ...centerReqData, mandal: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Village</label>
                    <input
                      type="text"
                      value={centerReqData.village}
                      onChange={(e) => setCenterReqData({ ...centerReqData, village: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Crops Cultivated</label>
                    <input
                      type="text"
                      value={centerReqData.crops_grown}
                      onChange={(e) => setCenterReqData({ ...centerReqData, crops_grown: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Est. Farmers in Catchment</label>
                    <input
                      type="number"
                      value={centerReqData.estimated_farmers_count}
                      onChange={(e) => setCenterReqData({ ...centerReqData, estimated_farmers_count: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Est. Harvest (Quintals)</label>
                    <input
                      type="number"
                      value={centerReqData.estimated_harvest_quintals}
                      onChange={(e) => setCenterReqData({ ...centerReqData, estimated_harvest_quintals: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Justification / Ground Transportation Bottleneck *
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Current mandi is 35km away; high transport costs of ₹90/bag; severe traffic congestions..."
                    value={centerReqData.reason}
                    onChange={(e) => setCenterReqData({ ...centerReqData, reason: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white outline-none"
                    required
                  />
                </div>

                {/* Interactive Map Picker */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      Geographic Pin on State Map
                    </label>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Lat: {centerReqData.location_lat}, Lng: {centerReqData.location_lng}
                    </span>
                  </div>
                  <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <ProcurementMap
                      centres={centres}
                      requests={centerRequests}
                      height="240px"
                      isPickerMode={true}
                      pickedCoordinates={{ lat: centerReqData.location_lat, lng: centerReqData.location_lng }}
                      onSelectCoordinates={(coords) => {
                        setCenterReqData({ ...centerReqData, location_lat: coords.lat, location_lng: coords.lng });
                      }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingReq}
                  className="w-full bg-gov-navy hover:bg-gov-navy-700 text-white py-3 rounded-lg font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmittingReq ? 'Submitting to District Authority...' : 'Submit Official Center Sanction Proposal'}
                </button>
              </form>
            </div>

            {/* List of Submitted Sanction Petitions */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-gov-navy">Submitted District Sanction Petitions</h3>

              {centerRequests.length === 0 ? (
                <p className="text-xs text-slate-500 italic bg-white p-4 rounded-xl border border-slate-200">
                  No center petitions filed yet. Use the form above to submit a proposal.
                </p>
              ) : (
                centerRequests.map(r => (
                  <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-gov flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-gov-navy">{r.proposed_name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                          r.status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}>
                          {r.status || 'Pending Review'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        📍 {r.village}, {r.mandal}, {r.district} • Est. Harvest: {r.estimated_harvest_quintals} Q
                      </p>
                      <p className="text-xs text-slate-600 mt-1 italic">"{r.reason}"</p>
                      {r.admin_remarks && (
                        <p className="text-[11px] text-blue-900 font-bold mt-1 bg-blue-50 px-2.5 py-1 rounded border border-blue-200 inline-block">
                          🏛️ Nodal Officer Remark: {r.admin_remarks}
                        </p>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono sm:text-right">
                      ID: {r.id}<br/>
                      {new Date(r.created_at || Date.now()).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 5: INTERACTIVE MANDI MAP */}
        {activeTab === 'map' && (
          <div className="space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-lg font-black text-gov-navy tracking-tight">{t.navMap}</h2>
              <p className="text-xs text-slate-600">
                Geospatial distribution of active government procurement centers and sanctioned sub-points.
              </p>
            </div>

            <div className="border-2 border-slate-300 rounded-xl overflow-hidden shadow-gov">
              <ProcurementMap
                centres={centres}
                requests={centerRequests}
                height="560px"
                lang={lang}
                userLocation={{
                  lat: farmer?.location_lat || 15.8281,
                  lng: farmer?.location_lng || 78.0373,
                  label: `${farmer?.village || 'Farm'}, ${farmer?.district || 'District'}`
                }}
                onSelectCentre={(c) => {
                  setSelectedCentre(c.id);
                  setActiveTab('book_slot');
                }}
              />
            </div>
          </div>
        )}

        {/* TAB 6: PROFILE */}
        {activeTab === 'profile' && (
          <div className="max-w-2xl mx-auto bg-white border-t-4 border-t-amber-500 border-x border-b border-slate-200 rounded-xl p-6 shadow-gov space-y-4">
            <h2 className="text-lg font-black text-gov-navy tracking-tight">{t.navProfile}</h2>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between">
                <span className="text-slate-500 font-bold">Farmer Name:</span>
                <span className="font-black text-slate-900">{farmer?.name}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between">
                <span className="text-slate-500 font-bold">Mobile Phone:</span>
                <span className="font-bold text-slate-900">+91 {farmer?.phone}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between">
                <span className="text-slate-500 font-bold">Bank Account & IFSC:</span>
                <span className="font-bold text-slate-900">{farmer?.bank_account} ({farmer?.ifsc})</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between">
                <span className="text-slate-500 font-bold">Total Land Holding:</span>
                <span className="font-bold text-amber-700">{farmer?.land_hectares} Hectares</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between">
                <span className="text-slate-500 font-bold">Gram Panchayat & District:</span>
                <span className="font-bold text-slate-900">{farmer?.village}, {farmer?.mandal}, {farmer?.district}</span>
              </div>
            </div>
          </div>
        )}
          </div>
        </div>
      </main>

      {/* 5. Mobile Bottom Navigation Bar (Set to screen) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t-2 border-amber-500 md:hidden z-30 shadow-gov-lg">
        <div className="grid grid-cols-6 h-16">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`flex flex-col items-center justify-center text-[8.5px] font-bold transition-colors ${
              activeTab === 'bookings' ? 'text-gov-navy bg-amber-50/70 font-black' : 'text-slate-500'
            }`}
          >
            <span className="material-symbols-outlined text-lg">confirmation_number</span>
            <span className="truncate px-0.5">Bookings</span>
          </button>

          <button
            onClick={() => setActiveTab('book_slot')}
            className={`flex flex-col items-center justify-center text-[8.5px] font-bold transition-colors ${
              activeTab === 'book_slot' ? 'text-gov-navy bg-amber-50/70 font-black' : 'text-slate-500'
            }`}
          >
            <span className="material-symbols-outlined text-lg">edit_calendar</span>
            <span className="truncate px-0.5">Slot</span>
          </button>

          <button
            onClick={() => setActiveTab('weighments')}
            className={`flex flex-col items-center justify-center text-[8.5px] font-bold transition-colors ${
              activeTab === 'weighments' ? 'text-gov-navy bg-amber-50/70 font-black' : 'text-slate-500'
            }`}
          >
            <span className="material-symbols-outlined text-lg">receipt_long</span>
            <span className="truncate px-0.5">Weight</span>
          </button>

          <button
            onClick={() => setActiveTab('center_request')}
            className={`flex flex-col items-center justify-center text-[8.5px] font-bold transition-colors ${
              activeTab === 'center_request' ? 'text-gov-navy bg-amber-50/70 font-black' : 'text-slate-500'
            }`}
          >
            <span className="material-symbols-outlined text-lg">add_location_alt</span>
            <span className="truncate px-0.5">Mandi</span>
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`flex flex-col items-center justify-center text-[8.5px] font-bold transition-colors ${
              activeTab === 'map' ? 'text-gov-navy bg-amber-50/70 font-black' : 'text-slate-500'
            }`}
          >
            <span className="material-symbols-outlined text-lg">map</span>
            <span className="truncate px-0.5">Map</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center text-[8.5px] font-bold transition-colors ${
              activeTab === 'profile' ? 'text-gov-navy bg-amber-50/70 font-black' : 'text-slate-500'
            }`}
          >
            <span className="material-symbols-outlined text-lg">person</span>
            <span className="truncate px-0.5">Profile</span>
          </button>
        </div>
      </nav>

      {/* Floating Multi-Language Voice Agent (Kisan Vaani) */}
      <VoiceAgent currentFarmerId={currentFarmerId} lang={lang} onBookingCreated={() => fetchAllFarmerData(false)} />
    </div>
  );
}
