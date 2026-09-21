import React, { useState, useEffect } from 'react';
import ProcurementMap from './ProcurementMap';
import { supabase } from '../supabaseClient';
import { translations } from '../translations';

export default function AdminPortal({ user, lang = 'te', onLanguageChange, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'center_requests', 'map', 'broadcast', 'verification', 'weighment', 'payments', 'crud'
  const [bookings, setBookings] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [centres, setCentres] = useState([]);
  const [crops, setCrops] = useState([]);
  const [slots, setSlots] = useState([]);
  const [weighments, setWeighments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [centerRequests, setCenterRequests] = useState([]);
  const [notificationsList, setNotificationsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState(new Date());

  const t = translations[lang] || translations.en;

  // Center Request Approval State
  const [approvingReqId, setApprovingReqId] = useState(null);

  // Broadcast Alert Form State
  const [broadcastData, setBroadcastData] = useState({
    title: 'Kharif/Rabi 2026 Procurement Schedule Notification',
    message: 'Official MSP Procurement is operational across all district mandis. Farmers are requested to book digital slots in advance.',
    target: 'ALL',
    priority: 'High'
  });
  const [broadcastStatus, setBroadcastStatus] = useState(null);

  // CRUD Entity Manager State
  const [selectedEntity, setSelectedEntity] = useState('farmers');
  const [entityItems, setEntityItems] = useState([]);
  const [isEditingItem, setIsEditingItem] = useState(null);
  const [formData, setFormData] = useState({});

  // Weighment Entry Form State
  const [selectedBookingForWeighment, setSelectedBookingForWeighment] = useState('');
  const [weighmentData, setWeighmentData] = useState({
    gross_qty: 100,
    bag_count: 200,
    deductions_kg: 2.5,
    deduction_reason: '2.0 kg moisture + 0.5 kg tare weight (CACP Norms)',
    quality_grade: 'Grade A Superfine'
  });

  // Payment Reconciliation State
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState('');
  const [paymentData, setPaymentData] = useState({
    amount: 227500,
    bank_txn_ref: 'PFMS20260907-889921'
  });

  const fetchAllAdminData = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const [bRes, fRes, cRes, crRes, sRes, wRes, pRes, reqRes, notifRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/farmers'),
        fetch('/api/centres'),
        fetch('/api/crops'),
        fetch('/api/slots'),
        fetch('/api/weighments'),
        fetch('/api/payments'),
        fetch('/api/centerRequests'),
        fetch('/api/notifications')
      ]);

      const b = await bRes.json();
      const f = await fRes.json();
      const c = await cRes.json();
      const cr = await crRes.json();
      const s = await sRes.json();
      const w = await wRes.json();
      const p = await pRes.json();
      const reqs = await reqRes.json();
      const notifs = await notifRes.json();

      if (b.success) setBookings(b.data);
      if (f.success) setFarmers(f.data);
      if (c.success) setCentres(c.data);
      if (cr.success) setCrops(cr.data);
      if (s.success) setSlots(s.data);
      if (w.success) setWeighments(w.data);
      if (p.success) setPayments(p.data);
      if (reqs.success) setCenterRequests(reqs.data || []);
      if (notifs.success) setNotificationsList(notifs.data || []);

      setLastSyncTime(new Date());
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllAdminData(true);

    const syncInterval = setInterval(() => {
      fetchAllAdminData(false);
    }, 4000);

    const channel = supabase
      .channel('kisan-admin-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => fetchAllAdminData(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'center_requests' }, () => fetchAllAdminData(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchAllAdminData(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => fetchAllAdminData(false))
      .subscribe();

    return () => {
      clearInterval(syncInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchEntityItems = async (entityName) => {
    try {
      const res = await fetch(`/api/${entityName}`);
      const json = await res.json();
      if (json.success) setEntityItems(json.data);
    } catch (err) {
      console.error(`Error fetching entity ${entityName}:`, err);
    }
  };

  useEffect(() => {
    if (activeTab === 'crud') {
      fetchEntityItems(selectedEntity);
    }
  }, [activeTab, selectedEntity]);

  const handleUpdateBookingStatus = async (bookingId, newStatus) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const json = await res.json();
      if (json.success) {
        fetchAllAdminData();
      }
    } catch (err) {
      console.error('Error updating booking:', err);
    }
  };

  const handleCreateWeighment = async (e) => {
    e.preventDefault();
    if (!selectedBookingForWeighment) return;
    const bkg = bookings.find(b => b.id === selectedBookingForWeighment);
    const crp = crops.find(c => c.id === bkg?.crop_id);
    const msp = crp?.msp_per_quintal || 2275;

    const netQty = Number(weighmentData.gross_qty) - (Number(weighmentData.deductions_kg) / 100);
    const totalPaymentAmount = netQty * msp;

    try {
      await fetch('/api/weighments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: selectedBookingForWeighment,
          gross_qty: Number(weighmentData.gross_qty),
          bag_count: Number(weighmentData.bag_count),
          deductions_kg: Number(weighmentData.deductions_kg),
          deduction_reason: weighmentData.deduction_reason,
          net_qty: netQty,
          quality_grade: weighmentData.quality_grade,
          timestamp: new Date().toISOString()
        })
      });

      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: selectedBookingForWeighment,
          amount: totalPaymentAmount,
          status: 'initiated',
          bank_txn_ref: `PFMS${Date.now()}`,
          initiated_at: new Date().toISOString()
        })
      });

      await handleUpdateBookingStatus(selectedBookingForWeighment, 'completed');

      alert('✅ Digital weighment recorded & PFMS payment initiated successfully!');
      setSelectedBookingForWeighment('');
      fetchAllAdminData();
    } catch (err) {
      console.error('Error saving weighment:', err);
    }
  };

  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    if (!selectedBookingForPayment) return;
    const existingPay = payments.find(p => p.booking_id === selectedBookingForPayment);

    try {
      if (existingPay) {
        await fetch(`/api/payments/${existingPay.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'confirmed',
            bank_txn_ref: paymentData.bank_txn_ref,
            confirmed_at: new Date().toISOString()
          })
        });
      } else {
        await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            booking_id: selectedBookingForPayment,
            amount: Number(paymentData.amount),
            status: 'confirmed',
            bank_txn_ref: paymentData.bank_txn_ref,
            initiated_at: new Date().toISOString(),
            confirmed_at: new Date().toISOString()
          })
        });
      }
      alert('🎉 Payment status updated to PFMS Bank Confirmed!');
      setSelectedBookingForPayment('');
      fetchAllAdminData();
    } catch (err) {
      console.error('Payment confirm error:', err);
    }
  };

  const handleSaveCrudItem = async (e) => {
    e.preventDefault();
    try {
      if (isEditingItem && isEditingItem.id) {
        await fetch(`/api/${selectedEntity}/${isEditingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      } else {
        await fetch(`/api/${selectedEntity}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }
      setIsEditingItem(null);
      setFormData({});
      fetchEntityItems(selectedEntity);
    } catch (err) {
      console.error('CRUD save error:', err);
    }
  };

  const handleDeleteCrudItem = async (id) => {
    if (!confirm(`Are you sure you want to delete ${id}?`)) return;
    try {
      await fetch(`/api/${selectedEntity}/${id}`, { method: 'DELETE' });
      fetchEntityItems(selectedEntity);
    } catch (err) {
      console.error('CRUD delete error:', err);
    }
  };

  const handleApproveCenterRequest = async (reqId, remarks) => {
    try {
      setApprovingReqId(reqId);
      const res = await fetch(`/api/centerRequests/approve/${reqId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_remarks: remarks || 'Sanctioned and approved by District Procurement Committee',
          create_as_centre: true
        })
      });
      const json = await res.json();
      if (json.success) {
        alert('🎉 Center sanction granted! Mandi operationalized and SMS dispatched to farmer.');
        fetchAllAdminData(false);
      } else {
        alert(json.error || 'Failed to approve center request');
      }
    } catch {
      alert('Network error approving center request');
    } finally {
      setApprovingReqId(null);
    }
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    try {
      setBroadcastStatus({ type: 'loading', text: 'Dispatching notification broadcast...' });
      const res = await fetch('/api/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(broadcastData)
      });
      const json = await res.json();
      if (json.success) {
        setBroadcastStatus({
          type: 'success',
          text: `✅ Broadcast sent to ${json.count} registered farmers successfully!`
        });
        fetchAllAdminData(false);
      } else {
        setBroadcastStatus({ type: 'error', text: json.error || 'Failed to broadcast alert' });
      }
    } catch {
      setBroadcastStatus({ type: 'error', text: 'Network error broadcasting alert' });
    }
  };

  const pendingBookings = bookings.filter(b => b.status === 'booked');
  const arrivedBookings = bookings.filter(b => b.status === 'arrived');
  const completedBookings = bookings.filter(b => b.status === 'completed');

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50 font-sans">
      {/* 1. Official Government Command Sidebar Navigator */}
      <nav className="hidden md:flex flex-col h-full py-5 px-3.5 bg-[#0B2545] text-slate-200 w-64 shrink-0 shadow-gov-lg z-20 border-r border-gov-navy-700">
        <div className="mb-5 px-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 text-gov-navy flex items-center justify-center text-xl font-black shadow-md shrink-0">
              🏛️
            </div>
            <div>
              <h2 className="text-sm font-black text-white leading-tight">Nodal Command</h2>
              <p className="text-[10px] text-amber-300 font-semibold">Food & Civil Supplies</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto w-full pr-1 space-y-1 text-xs font-bold">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-left ${
              activeTab === 'dashboard' ? 'bg-amber-500 text-slate-950 font-black shadow-xs' : 'text-slate-300 hover:bg-gov-navy-800'
            }`}
          >
            <span className="material-symbols-outlined text-base">dashboard</span>
            <span>{t.adminDashboard}</span>
          </button>

          <button
            onClick={() => setActiveTab('center_requests')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-left ${
              activeTab === 'center_requests' ? 'bg-amber-500 text-slate-950 font-black shadow-xs' : 'text-slate-300 hover:bg-gov-navy-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-base">add_location_alt</span>
              <span>{t.adminCenterRequests}</span>
            </div>
            {centerRequests.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-black bg-amber-200 text-gov-navy">
                {centerRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('verification')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-left ${
              activeTab === 'verification' ? 'bg-amber-500 text-slate-950 font-black shadow-xs' : 'text-slate-300 hover:bg-gov-navy-800'
            }`}
          >
            <span className="material-symbols-outlined text-base">pin_drop</span>
            <span>{t.adminVerification}</span>
          </button>

          <button
            onClick={() => setActiveTab('weighment')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-left ${
              activeTab === 'weighment' ? 'bg-amber-500 text-slate-950 font-black shadow-xs' : 'text-slate-300 hover:bg-gov-navy-800'
            }`}
          >
            <span className="material-symbols-outlined text-base">scale</span>
            <span>{t.adminWeighment}</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-left ${
              activeTab === 'payments' ? 'bg-amber-500 text-slate-950 font-black shadow-xs' : 'text-slate-300 hover:bg-gov-navy-800'
            }`}
          >
            <span className="material-symbols-outlined text-base">account_balance</span>
            <span>{t.adminPayments}</span>
          </button>

          <button
            onClick={() => setActiveTab('broadcast')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-left ${
              activeTab === 'broadcast' ? 'bg-amber-500 text-slate-950 font-black shadow-xs' : 'text-slate-300 hover:bg-gov-navy-800'
            }`}
          >
            <span className="material-symbols-outlined text-base">campaign</span>
            <span>{t.adminBroadcast}</span>
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-left ${
              activeTab === 'map' ? 'bg-amber-500 text-slate-950 font-black shadow-xs' : 'text-slate-300 hover:bg-gov-navy-800'
            }`}
          >
            <span className="material-symbols-outlined text-base">map</span>
            <span>{t.navMap}</span>
          </button>

          <button
            onClick={() => setActiveTab('crud')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-left ${
              activeTab === 'crud' ? 'bg-amber-500 text-slate-950 font-black shadow-xs' : 'text-slate-300 hover:bg-gov-navy-800'
            }`}
          >
            <span className="material-symbols-outlined text-base">database</span>
            <span>{t.adminCrud}</span>
          </button>
        </div>

        {onLogout && (
          <div className="mt-auto pt-3 border-t border-gov-navy-700">
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-red-400/40 text-red-300 bg-red-950/40 rounded-lg text-xs font-bold hover:bg-red-900 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              <span>Logout Officer</span>
            </button>
          </div>
        )}
      </nav>

      {/* 2. Main Work Canvas */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Mobile Navigation Tabs (Sticky Navigator) */}
        <div className="flex md:hidden overflow-x-auto bg-white border-b border-slate-200 px-3 py-2 gap-1.5 shrink-0 text-xs font-bold sticky top-0 z-10 shadow-xs">
          {[
            { id: 'dashboard', label: t.adminDashboard, icon: 'dashboard' },
            { id: 'center_requests', label: t.adminCenterRequests, icon: 'add_location_alt' },
            { id: 'weighment', label: t.adminWeighment, icon: 'scale' },
            { id: 'payments', label: t.adminPayments, icon: 'account_balance' },
            { id: 'broadcast', label: t.adminBroadcast, icon: 'campaign' },
            { id: 'verification', label: t.adminVerification, icon: 'pin_drop' },
            { id: 'map', label: t.navMap, icon: 'map' },
            { id: 'crud', label: t.adminCrud, icon: 'database' }
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

        {/* Dynamic Canvas Views */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
              {/* Executive Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border-t-4 border-t-amber-500 border-x border-b border-slate-200 rounded-xl p-5 shadow-gov">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Mandi Arrivals Today</p>
                      <p className="text-2xl sm:text-3xl font-black text-gov-navy mt-1">{pendingBookings.length + arrivedBookings.length}</p>
                      <span className="text-[11px] text-amber-700 font-bold">{pendingBookings.length} Queued</span>
                    </div>
                    <div className="bg-amber-100 text-amber-900 p-2.5 rounded-lg">
                      <span className="material-symbols-outlined text-2xl">schedule</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border-t-4 border-t-blue-600 border-x border-b border-slate-200 rounded-xl p-5 shadow-gov">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">In Weighment Queue</p>
                      <p className="text-2xl sm:text-3xl font-black text-blue-900 mt-1">{arrivedBookings.length}</p>
                      <span className="text-[11px] text-blue-700 font-bold">At Weighbridges</span>
                    </div>
                    <div className="bg-blue-100 text-blue-900 p-2.5 rounded-lg">
                      <span className="material-symbols-outlined text-2xl">scale</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border-t-4 border-t-emerald-600 border-x border-b border-slate-200 rounded-xl p-5 shadow-gov">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Procured & Settled</p>
                      <p className="text-2xl sm:text-3xl font-black text-emerald-800 mt-1">{completedBookings.length}</p>
                      <span className="text-[11px] text-emerald-700 font-bold">100% PFMS Cleared</span>
                    </div>
                    <div className="bg-emerald-100 text-emerald-900 p-2.5 rounded-lg">
                      <span className="material-symbols-outlined text-2xl">check_circle</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border-t-4 border-t-gov-navy border-x border-b border-slate-200 rounded-xl p-5 shadow-gov">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Active Mandis</p>
                      <p className="text-2xl sm:text-3xl font-black text-gov-navy mt-1">{centres.length}</p>
                      <span className="text-[11px] text-slate-600 font-bold">{farmers.length} Farmers Registered</span>
                    </div>
                    <div className="bg-slate-100 text-gov-navy p-2.5 rounded-lg">
                      <span className="material-symbols-outlined text-2xl">store</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Farmer Arrival Queue Table */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-gov overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <h3 className="text-sm font-black text-gov-navy uppercase tracking-wider">
                    Live Farmer Procurement Queue & Token Dispatch
                  </h3>
                  <span className="bg-amber-100 text-gov-navy text-[10px] font-black px-2.5 py-0.5 rounded">
                    Auto-Refreshing
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="p-3.5">Token & Farmer</th>
                        <th className="p-3.5">Crop & Expected Qty</th>
                        <th className="p-3.5">Mandi Hub</th>
                        <th className="p-3.5">Scheduled Slot</th>
                        <th className="p-3.5">Current Status</th>
                        <th className="p-3.5 text-right">Officer Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bookings.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-slate-400 italic">
                            No active procurement bookings in queue.
                          </td>
                        </tr>
                      ) : (
                        bookings.map((b) => {
                          const f = farmers.find(farm => farm.id === b.farmer_id);
                          const c = crops.find(crp => crp.id === b.crop_id);
                          const cen = centres.find(cent => cent.id === b.slot?.centre_id);

                          return (
                            <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-3.5">
                                <div className="font-bold text-gov-navy">{f?.name || b.farmer_id}</div>
                                <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-mono font-bold">
                                  {b.token_number}
                                </span>
                              </td>
                              <td className="p-3.5">
                                <div className="font-bold text-slate-900">{c?.name || b.crop_id}</div>
                                <div className="text-[11px] text-emerald-800 font-bold">{b.expected_quantity} Quintals</div>
                              </td>
                              <td className="p-3.5 text-slate-700">
                                <div className="font-semibold">{cen?.name || 'District Mandi'}</div>
                                <div className="text-[10px] text-slate-500">{cen?.district}</div>
                              </td>
                              <td className="p-3.5 text-slate-700">
                                <div>{b.slot?.date}</div>
                                <div className="text-[10px] text-slate-500">{b.slot?.time_window}</div>
                              </td>
                              <td className="p-3.5">
                                <span className={`text-[10px] px-2.5 py-0.5 rounded font-black uppercase ${
                                  b.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-900'
                                    : b.status === 'arrived'
                                    ? 'bg-blue-100 text-blue-900'
                                    : 'bg-amber-100 text-amber-900'
                                }`}>
                                  {b.status}
                                </span>
                              </td>
                              <td className="p-3.5 text-right space-x-1.5">
                                {b.status === 'booked' && (
                                  <button
                                    onClick={() => handleUpdateBookingStatus(b.id, 'arrived')}
                                    className="bg-gov-navy hover:bg-gov-navy-700 text-white px-3 py-1 rounded text-xs font-bold shadow-xs"
                                  >
                                    Mark Mandi Gate Arrival
                                  </button>
                                )}
                                {b.status === 'arrived' && (
                                  <button
                                    onClick={() => {
                                      setSelectedBookingForWeighment(b.id);
                                      setActiveTab('weighment');
                                    }}
                                    className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1 rounded text-xs font-bold shadow-xs"
                                  >
                                    Record Electronic Weighment
                                  </button>
                                )}
                                {b.status === 'completed' && (
                                  <button
                                    onClick={() => {
                                      setSelectedBookingForPayment(b.id);
                                      setActiveTab('payments');
                                    }}
                                    className="bg-slate-100 hover:bg-slate-200 text-gov-navy border border-slate-300 px-3 py-1 rounded text-xs font-bold"
                                  >
                                    Reconcile PFMS
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CENTER SANCTIONS & PETITIONS */}
          {activeTab === 'center_requests' && (
            <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-xl font-black text-gov-navy tracking-tight">
                    District Procurement Center Sanction Petitions
                  </h3>
                  <p className="text-xs text-slate-600">
                    Review and sanction new mandi points proposed by local gram panchayats and farmer clusters.
                  </p>
                </div>
              </div>

              {/* Spatial Map */}
              <div className="border-2 border-slate-300 rounded-xl overflow-hidden shadow-gov">
                <ProcurementMap
                  centres={centres}
                  requests={centerRequests}
                  height="340px"
                  lang={lang}
                />
              </div>

              {/* Proposals Table */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-gov overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Proposed Mandi</th>
                      <th className="p-3.5">Catchment Area</th>
                      <th className="p-3.5">Estimated Volume</th>
                      <th className="p-3.5">Farmer Bottleneck</th>
                      <th className="p-3.5">Sanction Status</th>
                      <th className="p-3.5 text-right">District Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {centerRequests.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="p-6 text-center text-slate-400 italic">
                          No pending center requests.
                        </td>
                      </tr>
                    ) : (
                      centerRequests.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5">
                            <div className="font-black text-gov-navy">{r.proposed_name}</div>
                            <span className="text-[10px] text-slate-500 font-mono">By: {r.farmer_name || r.farmer_id} ({r.farmer_phone})</span>
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900">{r.district}</div>
                            <div className="text-[10px] text-slate-500">{r.mandal}, {r.village}</div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-emerald-800">{r.estimated_harvest_quintals || 2500} Q</div>
                            <div className="text-[10px] text-slate-500">{r.crops_grown}</div>
                          </td>
                          <td className="p-3.5 max-w-xs text-slate-600 text-[11px]">
                            "{r.reason}"
                          </td>
                          <td className="p-3.5">
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded uppercase ${
                              r.status === 'Approved' ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'
                            }`}>
                              {r.status || 'Pending'}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            {r.status !== 'Approved' ? (
                              <button
                                onClick={() => handleApproveCenterRequest(r.id, 'Sanctioned by District Collectorate')}
                                disabled={approvingReqId === r.id}
                                className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded text-xs font-bold shadow-xs transition-all flex items-center gap-1 ml-auto active:scale-95"
                              >
                                <span className="material-symbols-outlined text-sm">verified</span>
                                <span>{approvingReqId === r.id ? 'Sanctioning...' : 'Sanction Center'}</span>
                              </button>
                            ) : (
                              <span className="text-emerald-800 font-bold text-xs inline-flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                <span>Sanctioned</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: ELECTRONIC WEIGHBRIDGE RECEIPT GENERATOR */}
          {activeTab === 'weighment' && (
            <div className="max-w-2xl mx-auto bg-white border-t-4 border-t-amber-500 border-x border-b border-slate-200 rounded-xl p-6 sm:p-8 shadow-gov space-y-5 animate-fade-in">
              <div className="border-b border-slate-200 pb-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 text-[11px] font-bold mb-1">
                  <span>⚖️</span>
                  <span>National Weighbridge Standard</span>
                </div>
                <h3 className="text-xl font-black text-gov-navy tracking-tight">
                  Record Certified Electronic Weighment Slip
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Itemized calculation of tare deductions and moisture percentages under CACP Fair Average Quality (FAQ) norms.
                </p>
              </div>

              <form onSubmit={handleCreateWeighment} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Select Active Token *</label>
                  <select
                    value={selectedBookingForWeighment}
                    onChange={(e) => setSelectedBookingForWeighment(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-slate-900 outline-none"
                    required
                  >
                    <option value="">-- Choose Token in Mandi Queue --</option>
                    {bookings.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.token_number} — Farmer: {b.farmer_id} ({b.expected_quantity} Qty Expected)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Gross Weighbridge Weight (Q) *</label>
                    <input
                      type="number"
                      step="0.1"
                      value={weighmentData.gross_qty}
                      onChange={(e) => setWeighmentData({ ...weighmentData, gross_qty: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-slate-900 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Total Jute/HDPE Bags *</label>
                    <input
                      type="number"
                      value={weighmentData.bag_count}
                      onChange={(e) => setWeighmentData({ ...weighmentData, bag_count: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-slate-900 outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-red-700 mb-1">Total Deductions (Kg) *</label>
                    <input
                      type="number"
                      step="0.1"
                      value={weighmentData.deductions_kg}
                      onChange={(e) => setWeighmentData({ ...weighmentData, deductions_kg: e.target.value })}
                      className="w-full bg-slate-50 border border-red-300 rounded-lg p-2.5 text-xs font-bold text-red-700 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Quality Grade</label>
                    <select
                      value={weighmentData.quality_grade}
                      onChange={(e) => setWeighmentData({ ...weighmentData, quality_grade: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-slate-900 outline-none"
                    >
                      <option value="Grade A Superfine">Grade A Superfine</option>
                      <option value="Grade I Standard">Grade I Standard</option>
                      <option value="Grade II">Grade II</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Deduction Reason (Mandatory Transparency Notice) *</label>
                  <input
                    type="text"
                    value={weighmentData.deduction_reason}
                    onChange={(e) => setWeighmentData({ ...weighmentData, deduction_reason: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-semibold text-slate-900 outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-gov-navy hover:bg-gov-navy-700 text-white py-3 rounded-lg font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base text-amber-300">verified</span>
                  <span>Issue Certified Weighment Receipt & Release PFMS Order</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 4: PFMS PAYMENT RECONCILIATION */}
          {activeTab === 'payments' && (
            <div className="max-w-2xl mx-auto bg-white border-t-4 border-t-emerald-600 border-x border-b border-slate-200 rounded-xl p-6 sm:p-8 shadow-gov space-y-5 animate-fade-in">
              <div className="border-b border-slate-200 pb-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-300 text-[11px] font-bold mb-1">
                  <span>💰</span>
                  <span>PFMS Direct Benefit Transfer</span>
                </div>
                <h3 className="text-xl font-black text-gov-navy tracking-tight">
                  Direct Bank Payment Settlement & UTR Confirmation
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Authorize bank transfer reference numbers to confirm direct DBT credit into farmer accounts.
                </p>
              </div>

              <form onSubmit={handleConfirmPayment} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Select Completed Weighment *</label>
                  <select
                    value={selectedBookingForPayment}
                    onChange={(e) => setSelectedBookingForPayment(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-slate-900 outline-none"
                    required
                  >
                    <option value="">-- Choose Weighment --</option>
                    {bookings.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.id} ({b.token_number}) — Farmer: {b.farmer_id}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">PFMS / Bank UTR Transaction Reference *</label>
                  <input
                    type="text"
                    value={paymentData.bank_txn_ref}
                    onChange={(e) => setPaymentData({ ...paymentData, bank_txn_ref: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-mono font-bold text-slate-900 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Disbursement Amount (₹) *</label>
                  <input
                    type="number"
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-slate-900 outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-3 rounded-lg font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  <span>Confirm Bank Transfer & Send Farmer SMS Confirmation</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 5: PUBLIC BROADCAST DISPATCH */}
          {activeTab === 'broadcast' && (
            <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-xl font-black text-gov-navy tracking-tight">
                  District Farmer Broadcast & Mandi Advisory Console
                </h3>
                <p className="text-xs text-slate-600">
                  Dispatch official gazette advisories, mandi timing alerts, and weather notifications to registered farmers.
                </p>
              </div>

              {broadcastStatus && (
                <div className={`p-3 rounded-lg text-xs font-bold ${
                  broadcastStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-blue-50 text-blue-900 border border-blue-300'
                }`}>
                  {broadcastStatus.text}
                </div>
              )}

              <div className="bg-white border-t-4 border-t-amber-500 border-x border-b border-slate-200 rounded-xl p-6 shadow-gov">
                <form onSubmit={handleSendBroadcast} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Target Audience</label>
                      <select
                        value={broadcastData.target}
                        onChange={(e) => setBroadcastData({ ...broadcastData, target: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold outline-none"
                      >
                        <option value="ALL">All District Farmers ({farmers.length} Farmers)</option>
                        <option value="Kurnool">Kurnool District Mandis</option>
                        <option value="Guntur">Guntur / Tenali District Mandis</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Priority Classification</label>
                      <select
                        value={broadcastData.priority}
                        onChange={(e) => setBroadcastData({ ...broadcastData, priority: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold outline-none"
                      >
                        <option value="High">High Priority (Urgent Mandi Advisory)</option>
                        <option value="Normal">General Procurement Notice</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Announcement Title *</label>
                    <input
                      type="text"
                      value={broadcastData.title}
                      onChange={(e) => setBroadcastData({ ...broadcastData, title: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Message Body *</label>
                    <textarea
                      rows={3}
                      value={broadcastData.message}
                      onChange={(e) => setBroadcastData({ ...broadcastData, message: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold outline-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gov-navy hover:bg-gov-navy-700 text-white py-3 rounded-lg font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base text-amber-300">send</span>
                    <span>Dispatch Public Broadcast via SMS & In-App Alert</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 6: LOCATION VERIFICATION */}
          {activeTab === 'verification' && (
            <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
              <div className="flex justify-between items-end border-b border-slate-200 pb-3">
                <div>
                  <h2 className="text-xl font-black text-gov-navy">Farmer Land Record Verification</h2>
                  <p className="text-xs text-slate-600">
                    Verify submitted farm GPS locations and land survey numbers against state land registry.
                  </p>
                </div>
                <span className="bg-amber-100 text-amber-900 px-3 py-1 rounded text-xs font-bold">
                  {farmers.length} Registered Farmers
                </span>
              </div>

              {farmers.map((f) => (
                <div key={f.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-gov flex flex-col sm:flex-row justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-gov-navy text-base">{f.name}</span>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded font-bold">
                        {f.status || 'Verified'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      📍 {f.village}, {f.mandal}, {f.district} • Land Holding: <strong>{f.land_hectares || 0} Hectares</strong>
                    </p>
                    <p className="text-xs text-slate-500 font-mono">
                      Phone: +91 {f.phone} • Bank: {f.bank_account || 'N/A'} ({f.ifsc || 'N/A'})
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <button
                      onClick={() => alert(`Verified land record for ${f.name} (${f.id})`)}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded text-xs font-bold shadow-xs"
                    >
                      Approve Record
                    </button>
                    <button
                      onClick={() => alert(`Flagged inspection for ${f.name}`)}
                      className="border border-slate-300 text-slate-700 hover:bg-slate-100 px-3 py-1.5 rounded text-xs font-bold"
                    >
                      Inspect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 7: STATEWIDE MAP */}
          {activeTab === 'map' && (
            <div className="space-y-4 max-w-7xl mx-auto animate-fade-in">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-xl font-black text-gov-navy tracking-tight">
                  Statewide Procurement Network Spatial Command
                </h3>
                <p className="text-xs text-slate-600">
                  OpenStreetMap real-time tracking of active mandi yards, daily arrival capacities, and farmer sanction petitions.
                </p>
              </div>

              <div className="border-2 border-slate-300 rounded-xl overflow-hidden shadow-gov">
                <ProcurementMap
                  centres={centres}
                  requests={centerRequests}
                  height="600px"
                  lang={lang}
                />
              </div>
            </div>
          )}

          {/* TAB 8: DATABASE CRUD MANAGER */}
          {activeTab === 'crud' && (
            <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <h2 className="text-xl font-black text-gov-navy">Database Entity CRUD Manager</h2>
                  <p className="text-xs text-slate-600">
                    Real-time Create, Read, Update, and Delete across all Supabase database tables with audit trails.
                  </p>
                </div>

                {/* Entity Selector */}
                <div className="flex flex-wrap gap-1 bg-slate-200 p-1 rounded-lg">
                  {['farmers', 'crops', 'centres', 'slots', 'bookings', 'weighments', 'payments', 'centerRequests', 'notifications'].map((eName) => (
                    <button
                      key={eName}
                      onClick={() => setSelectedEntity(eName)}
                      className={`px-3 py-1 rounded text-xs font-bold uppercase transition-all ${
                        selectedEntity === eName ? 'bg-gov-navy text-white shadow-xs' : 'text-slate-700 hover:bg-white'
                      }`}
                    >
                      {eName}
                    </button>
                  ))}
                </div>
              </div>

              {/* CRUD Items Table */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-gov">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="font-black text-gov-navy text-sm uppercase">
                    Entity: {selectedEntity} ({entityItems.length} records)
                  </h3>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setIsEditingItem({});
                        setFormData({});
                      }}
                      className="bg-gov-navy hover:bg-gov-navy-700 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      <span>Create New {selectedEntity.slice(0, -1)}</span>
                    </button>
                    <button
                      onClick={() => fetchEntityItems(selectedEntity)}
                      className="bg-slate-100 hover:bg-slate-200 p-1.5 rounded text-slate-700"
                      title="Refresh"
                    >
                      <span className="material-symbols-outlined text-sm">refresh</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="p-3">Primary ID</th>
                        <th className="p-3">Summary / Key Attributes</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {entityItems.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="p-6 text-center text-slate-400 italic">
                            No records found in {selectedEntity}.
                          </td>
                        </tr>
                      ) : (
                        entityItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono font-bold text-gov-navy whitespace-nowrap">
                              {item.id}
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-slate-900">
                                {item.name && <span className="font-bold mr-2 text-sm">{item.name}</span>}
                                {item.phone && <span className="text-slate-600 mr-2 font-mono">📞 {item.phone}</span>}
                                {item.msp_per_quintal && <span className="text-emerald-800 font-bold mr-2">₹{item.msp_per_quintal}/Q</span>}
                                {item.district && <span className="text-slate-500 mr-2">📍 {item.district}</span>}
                                {item.status && <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">{item.status}</span>}
                              </div>
                            </td>
                            <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                onClick={() => {
                                  setIsEditingItem(item);
                                  setFormData(item);
                                }}
                                className="bg-slate-100 hover:bg-slate-200 text-gov-navy px-2.5 py-1 rounded font-bold text-xs"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteCrudItem(item.id)}
                                className="bg-red-50 hover:bg-red-100 text-red-700 px-2.5 py-1 rounded font-bold text-xs"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Edit / Create Modal */}
              {isEditingItem !== null && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h3 className="font-black text-gov-navy text-sm">
                        {isEditingItem.id ? `Edit ${selectedEntity}: ${isEditingItem.id}` : `Create New ${selectedEntity.slice(0, -1)}`}
                      </h3>
                      <button onClick={() => setIsEditingItem(null)} className="text-slate-400 hover:text-slate-700">
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>

                    <form onSubmit={handleSaveCrudItem} className="space-y-3 text-xs">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Entity Name / Title</label>
                        <input
                          type="text"
                          value={formData.name || formData.title || formData.proposed_name || ''}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-none font-semibold"
                        />
                      </div>

                      <details className="pt-2 border-t border-slate-100">
                        <summary className="cursor-pointer font-bold text-slate-700 hover:text-gov-navy">
                          Advanced: Edit Raw JSON Payload
                        </summary>
                        <textarea
                          rows={6}
                          value={typeof formData === 'string' ? formData : JSON.stringify(formData, null, 2)}
                          onChange={(e) => {
                            try {
                              setFormData(JSON.parse(e.target.value));
                            } catch {
                              setFormData(e.target.value);
                            }
                          }}
                          className="w-full mt-2 bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-xs text-slate-800"
                        />
                      </details>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="submit"
                          className="flex-1 bg-gov-navy hover:bg-gov-navy-700 text-white py-2.5 rounded-lg font-bold"
                        >
                          Save Record
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingItem(null)}
                          className="flex-1 border border-slate-300 hover:bg-slate-50 py-2.5 rounded-lg font-bold text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
