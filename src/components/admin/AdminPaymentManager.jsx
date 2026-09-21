import React, { useState } from 'react';
import { 
  IndianRupee, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  Search, 
  Edit3, 
  Truck, 
  PackageCheck, 
  Navigation, 
  Clock, 
  ShieldCheck, 
  MapPin, 
  Phone,
  FileText,
  Wheat,
  Scale,
  RefreshCw
} from 'lucide-react';

export default function AdminPaymentManager({ payments = [], bookings = [], farmers = [], crops = [], onRefresh }) {
  const [activeSubTab, setActiveSubTab] = useState('delivery'); // 'delivery' | 'payments' | 'logistics'
  const [search, setSearch] = useState('');
  
  // Delivery & Weighment States
  const [deliveryModal, setDeliveryModal] = useState(null);
  const [deliveryForm, setDeliveryForm] = useState({
    actual_weight: '',
    quality_grade: 'Grade A Superfine',
    moisture_content: '12%'
  });

  // Payment States
  const [payModal, setPayModal] = useState(null);
  const [utr, setUtr] = useState('');
  const [bankModal, setBankModal] = useState(null);
  const [bankForm, setBankForm] = useState({ bank_name: '', bank_account: '', ifsc: '' });
  
  // Logistics States
  const [dispatchModal, setDispatchModal] = useState(null);
  const [dispatchForm, setDispatchForm] = useState({
    lorry_id: '',
    driver_phone: '',
    destination: 'FCI Regional Buffer Silo, Kurnool',
    mill_name: 'Andhra Pradesh Civil Supplies Corporation'
  });
  const [deliverModal, setDeliverModal] = useState(null);
  const [ewhrInput, setEwhrInput] = useState('');

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const flashMsg = (text) => { setMsg(text); setTimeout(() => setMsg(''), 4000); };

  // Dynamic MSP map from crops
  const cropMspMap = {};
  if (Array.isArray(crops)) {
    crops.forEach(c => {
      const shortName = c.name.split(' ')[0].replace(/[^a-zA-Z]/g, '');
      if (c.msp_per_quintal) {
        cropMspMap[c.name] = Number(c.msp_per_quintal);
        if (shortName) cropMspMap[shortName] = Number(c.msp_per_quintal);
      }
    });
  }

  // Enrich payments with farmer and booking data
  const enrichedPayments = payments.map(p => {
    const booking = bookings.find(b => b.id === p.booking_id) || null;
    const farmer = farmers.find(f => f.id === p.farmer_id || f.id === booking?.farmer_id) || booking?.farmer || null;
    const cropType = booking?.crop_type || 'Paddy';
    return {
      ...p,
      booking,
      farmer,
      farmer_name: farmer?.name || booking?.farmer_name || p.farmer_id || 'Farmer',
      farmer_phone: farmer?.phone || booking?.farmer_phone || '',
      crop: cropType,
      bank_name: p.bank_name || farmer?.bank_name || '',
      bank_account: p.bank_account || farmer?.bank_account || '',
      ifsc: p.ifsc || farmer?.ifsc || '',
      weight: booking?.weight_quintals || booking?.actual_quantity || booking?.expected_quantity || 50,
      msp: booking?.msp_per_quintal || cropMspMap[cropType] || 2183
    };
  });

  const pendingPayments = enrichedPayments.filter(p => p.status !== 'paid');
  const paidPayments = enrichedPayments.filter(p => p.status === 'paid');

  // Bookings waiting for delivery inspection & acceptance
  const pendingDeliveries = bookings.filter(b => 
    ['checked_in', 'arrived', 'arrived_waiting_confirmation', 'in_progress', 'booked'].includes(b.status)
  );

  const filteredDeliveries = pendingDeliveries.filter(b => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.farmer_name?.toLowerCase().includes(q) ||
      b.token_number?.toLowerCase().includes(q) ||
      b.id?.toLowerCase().includes(q) ||
      (b.crop_type || b.crop || '').toLowerCase().includes(q)
    );
  });

  // Procured / ready for logistics bookings
  const logisticsBookings = bookings.filter(b => 
    ['weighed', 'payment_ready', 'delivery_completed', 'completed'].includes(b.status) || b.tracking_id
  );

  const filteredPayments = pendingPayments.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.farmer_name?.toLowerCase().includes(q) ||
      p.farmer_phone?.includes(q) ||
      p.bank_account?.includes(q) ||
      p.ifsc?.toLowerCase().includes(q)
    );
  });

  const filteredLogistics = logisticsBookings.filter(b => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.farmer_name?.toLowerCase().includes(q) ||
      b.token_number?.toLowerCase().includes(q) ||
      b.id?.toLowerCase().includes(q) ||
      b.crop_type?.toLowerCase().includes(q)
    );
  });

  const handleAcceptDelivery = async (e) => {
    e.preventDefault();
    if (!deliveryModal) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/crop-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: deliveryModal.id,
          actual_weight: deliveryForm.actual_weight || deliveryModal.expected_quantity || 50,
          quality_grade: deliveryForm.quality_grade,
          moisture_content: deliveryForm.moisture_content,
          admin_id: 'ADMIN2'
        })
      });
      const data = await res.json();
      if (data.success) {
        flashMsg(`🌾 Crop delivery accepted! Weighment certified and ₹${data.data?.total_payout?.toLocaleString('en-IN')} queued for PFMS DBT release.`);
        setDeliveryModal(null);
        if (onRefresh) onRefresh();
      } else {
        flashMsg(data.error || 'Failed to accept delivery');
      }
    } catch {
      flashMsg('Server error accepting delivery');
    } finally {
      setLoading(false);
    }
  };

  const handleInstantAcceptAndPay = async (b) => {
    setLoading(true);
    try {
      const weight = Number(b.actual_quantity) || Number(b.expected_quantity) || 50;
      // 1. Accept delivery
      const res1 = await fetch('/api/admin/crop-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: b.id,
          actual_weight: weight,
          quality_grade: 'Grade A Superfine',
          moisture_content: '12%',
          admin_id: 'ADMIN2'
        })
      });
      const data1 = await res1.json();
      if (!data1.success) {
        flashMsg(data1.error || 'Failed to accept delivery');
        return;
      }

      // 2. Disburse payment
      const res2 = await fetch('/api/admin/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: b.id,
          admin_id: 'ADMIN2'
        })
      });
      const data2 = await res2.json();
      if (data2.success) {
        flashMsg(`✅ Crop delivery accepted (${weight} Qtl) and ₹${Number(data1.data?.total_payout || 0).toLocaleString('en-IN')} disbursed via PFMS DBT (UTR: ${data2.data?.utr_number})!`);
        if (onRefresh) onRefresh();
      } else {
        flashMsg(data2.error || 'Payment disbursement failed');
      }
    } catch {
      flashMsg('Server error during processing');
    } finally {
      setLoading(false);
    }
  };

  const handleResetFarmerDb = async () => {
    if (!window.confirm('Are you sure you want to reset all farmer bookings and test records? All crop MSP fixed rates will be preserved.')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/reset-farmer-database', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        flashMsg('🧹 Farmer database cleared! Fixed MSP rates preserved.');
        if (onRefresh) onRefresh();
      } else {
        flashMsg(data.error || 'Reset failed');
      }
    } catch {
      flashMsg('Error connecting to server for DB reset');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (e) => {
    e.preventDefault();
    if (!payModal) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_id: payModal.id,
          booking_id: payModal.booking_id,
          admin_id: 'ADMIN2'
        })
      });
      const data = await res.json();
      if (data.success) {
        flashMsg(`✅ Payment of ₹${Number(payModal.amount).toLocaleString('en-IN')} disbursed via PFMS DBT (UTR: ${data.data?.utr_number || 'PFMS-DBT'})`);
        setPayModal(null); setUtr('');
        if (onRefresh) onRefresh();
      } else {
        flashMsg(data.error || 'Payment disbursement failed');
      }
    } catch { flashMsg('Error — please retry'); }
    finally { setLoading(false); }
  };

  const openBankEdit = (p) => {
    setBankModal(p);
    setBankForm({
      bank_name: p.bank_name || '',
      bank_account: p.bank_account || '',
      ifsc: p.ifsc || ''
    });
  };

  const saveBankDetails = async (e) => {
    e.preventDefault();
    if (!bankModal?.farmer_id) return;
    setLoading(true);
    try {
      await fetch(`/api/farmers/${bankModal.farmer_id}/update-bank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bankForm)
      });
      flashMsg('Bank details updated for PFMS DBT transfer');
      setBankModal(null);
      if (onRefresh) onRefresh();
    } catch { flashMsg('Error saving bank details'); }
    finally { setLoading(false); }
  };

  // Dispatch crop to Buffer Silo
  const handleDispatchCrop = async (e) => {
    e.preventDefault();
    if (!dispatchModal) return;
    setLoading(true);
    try {
      const res = await fetch('/api/logistics/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: dispatchModal.id,
          ...dispatchForm
        })
      });
      const data = await res.json();
      if (data.success) {
        flashMsg(`🚚 Lorry #${dispatchForm.lorry_id || 'AP-21-TX-9904'} dispatched to ${dispatchForm.destination}! Farmer notified.`);
        setDispatchModal(null);
        if (onRefresh) onRefresh();
      } else {
        flashMsg(data.error || 'Failed to dispatch', 'error');
      }
    } catch {
      flashMsg('Server error during dispatch', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Deliver to Warehouse
  const handleDeliverCrop = async (e) => {
    e.preventDefault();
    if (!deliverModal) return;
    setLoading(true);
    try {
      const res = await fetch('/api/logistics/deliver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: deliverModal.id,
          ewhr_number: ewhrInput.trim() || `eWHR-2026-AP${Math.floor(1000 + Math.random() * 9000)}`
        })
      });
      const data = await res.json();
      if (data.success) {
        flashMsg(`🏛️ Warehouse receipt confirmed! e-WHR Certificate: ${data.ewhr_number}`);
        setDeliverModal(null);
        setEwhrInput('');
        if (onRefresh) onRefresh();
      } else {
        flashMsg(data.error || 'Failed to confirm receipt', 'error');
      }
    } catch {
      flashMsg('Server error during delivery confirmation', 'error');
    } finally {
      setLoading(false);
    }
  };

  const totalPending = pendingPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalPaid = paidPayments.reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header & Sub-Tabs */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <span>Admin 2 Operations Hub</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Authorize DBT direct benefit payouts and dispatch harvested consignments to central silos
          </p>
        </div>

        {/* Sub-Tabs: Delivery vs Payments vs Logistics */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl flex-wrap">
          <button
            type="button"
            onClick={() => setActiveSubTab('delivery')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'delivery'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wheat className="w-3.5 h-3.5 text-emerald-600" />
            <span>Crop Delivery ({pendingDeliveries.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('payments')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'payments'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <IndianRupee className="w-3.5 h-3.5" />
            <span>DBT Payments ({pendingPayments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('logistics')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'logistics'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-blue-600" />
            <span>Transport ({logisticsBookings.length})</span>
          </button>

          <button
            type="button"
            onClick={handleResetFarmerDb}
            className="px-2.5 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-all cursor-pointer flex items-center gap-1 ml-auto"
            title="Reset Farmer Database (Crops & MSP rates preserved)"
          >
            <RefreshCw className="w-3 h-3" />
            <span className="hidden sm:inline">Reset Data</span>
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl">
          {msg}
        </div>
      )}

      {/* ── SUB-TAB 0: CROP DELIVERY & WEIGHMENT ACCEPTANCE ── */}
      {activeSubTab === 'delivery' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-slate-900 to-emerald-950 text-white p-4 sm:p-5 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block">Admin 2 Quality & Delivery Inspection</span>
              <h3 className="text-base sm:text-lg font-black text-white mt-0.5">Mandi Crop Weighment & Delivery Acceptance</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Inspect physical crop quality, verify net quintals, calculate official MSP payout, and certify delivery for PFMS DBT transfer.
              </p>
            </div>
            <div className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-xl text-xs font-black uppercase">
              {pendingDeliveries.length} Ready for Acceptance
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search farmer name, token #, phone, crop..."
              className="w-full min-h-[40px] pl-9 pr-3 rounded-xl border border-slate-300 text-xs font-semibold focus:border-emerald-600 bg-white"
            />
          </div>

          {/* Deliveries list */}
          {filteredDeliveries.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-6 text-slate-400">
              <Wheat className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-400" />
              <p className="font-bold text-slate-700">No pending crop deliveries</p>
              <p className="text-xs text-slate-500 mt-1">Bookings will appear here as farmers check in at the mandi gate</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDeliveries.map(b => {
                const cropName = b.crop_type || b.crop || 'Paddy';
                const cropRate = cropMspMap[cropName] || 2300;
                const estWeight = Number(b.actual_quantity || b.expected_quantity) || 50;
                const estPayout = estWeight * cropRate;

                return (
                  <div key={b.id} className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-sm hover:border-emerald-300 transition-all">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-sm sm:text-base">{b.farmer_name}</span>
                          <span className="text-[10px] font-black bg-slate-900 text-amber-300 px-2 py-0.5 rounded-md">
                            {b.token_number || b.id}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase">
                            {b.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          📍 {b.location_name || 'Mandi Center'} · 🌾 {cropName} · {estWeight} Quintals
                        </div>
                        <div className="mt-2 text-xs font-semibold text-slate-700">
                          MSP Rate: ₹{cropRate.toLocaleString('en-IN')}/Qtl → Est. Payout: <strong className="text-emerald-700 font-bold">₹{estPayout.toLocaleString('en-IN')}</strong>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setDeliveryModal(b);
                            setDeliveryForm({
                              actual_weight: String(estWeight),
                              quality_grade: 'Grade A Superfine',
                              moisture_content: '12%'
                            });
                          }}
                          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        >
                          <Scale className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Inspect Weighment</span>
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleInstantAcceptAndPay(b)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        >
                          <IndianRupee className="w-3.5 h-3.5" />
                          <span>⚡ Certify & Release DBT</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SUB-TAB 1: DBT PAYMENTS PROCESSING ── */}
      {activeSubTab === 'payments' && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Pending Release</div>
              <div className="text-lg font-black text-amber-600 mt-0.5">{pendingPayments.length}</div>
              <div className="text-[10px] text-slate-500">₹{totalPending.toLocaleString('en-IN')}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Completed Transfers</div>
              <div className="text-lg font-black text-emerald-600 mt-0.5">{paidPayments.length}</div>
              <div className="text-[10px] text-slate-500">₹{totalPaid.toLocaleString('en-IN')}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Need Bank Info</div>
              <div className="text-lg font-black text-red-500 mt-0.5">
                {pendingPayments.filter(p => !p.bank_account).length}
              </div>
              <div className="text-[10px] text-slate-500">Aadhaar / IFSC missing</div>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search farmer, phone, bank account, IFSC..."
              className="w-full min-h-[42px] pl-9 pr-3 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
            />
          </div>

          {/* Pending payments list */}
          {filteredPayments.length === 0 && pendingPayments.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-6 text-slate-400">
              <IndianRupee className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="font-bold text-slate-700">No pending payments in DBT queue</p>
              <p className="text-xs text-slate-500 mt-1">Admin 1 will send bookings here after completing certified weighment</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPayments.map(p => {
                const hasBank = Boolean(p.bank_account);
                return (
                  <div key={p.id} className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-sm hover:border-emerald-300 transition-all">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-sm sm:text-base">{p.farmer_name}</span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase">
                            Ready for DBT
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {p.farmer_phone && <span>📞 {p.farmer_phone} · </span>}
                          <span>🌾 {p.crop} · {p.weight} Qtl (@ ₹{p.msp}/Qtl)</span>
                        </div>

                        {/* Bank details preview */}
                        {hasBank ? (
                          <div className="mt-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 inline-flex items-center gap-3">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{p.bank_name || 'Bank'}</span>
                            </div>
                            <div className="font-mono text-xs text-slate-600">
                              A/C: ••••{p.bank_account.slice(-4)} · IFSC: {p.ifsc}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2.5 inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            No bank details — please edit before approving payout
                          </div>
                        )}

                        <div className="text-xl font-black text-emerald-800 mt-2">
                          ₹{Number(p.amount || 0).toLocaleString('en-IN')}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => openBankEdit(p)}
                          className="px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{hasBank ? 'Edit Bank' : 'Add Bank'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPayModal({
                              ...p,
                              bank_name: p.bank_name || p.farmer?.bank_name || 'State Bank of India (Aadhaar DBT)',
                              bank_account: p.bank_account || p.farmer?.bank_account || (p.farmer_phone ? `Aadhaar-91${p.farmer_phone.slice(-4)}` : 'Aadhaar Seeded DBT'),
                              ifsc: p.ifsc || p.farmer?.ifsc || 'SBIN0001234'
                            });
                            setUtr('');
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
                        >
                          <IndianRupee className="w-3.5 h-3.5" />
                          <span>Release DBT Payment</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Completed payments */}
          {paidPayments.length > 0 && (
            <div className="pt-3">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Completed Transfers ({paidPayments.length})</h3>
              <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {paidPayments.map(p => (
                  <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-sm truncate">{p.farmer_name}</div>
                      <div className="text-slate-400 mt-0.5">Ref: {p.bank_txn_ref || 'PFMS-PAID'} · {p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-IN') : ''}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-black text-emerald-700 text-sm">₹{Number(p.amount || 0).toLocaleString('en-IN')}</div>
                      <span className="text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">DBT CREDITED</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SUB-TAB 2: CROP TRANSPORT & LOGISTICS DISPATCH ── */}
      {activeSubTab === 'logistics' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white p-4 sm:p-5 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider block">Logistics Management</span>
              <h3 className="text-base sm:text-lg font-black text-white mt-0.5">Central Warehouse Dispatch & Silo Tracking</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Dispatch weighed grain consignments via GPS lorries and issue electronic Warehouse Receipts (e-WHR)
              </p>
            </div>
            <div className="px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-xl text-xs font-black uppercase">
              {logisticsBookings.length} Active Consignments
            </div>
          </div>

          <div className="space-y-3">
            {filteredLogistics.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-6 text-slate-400">
                <Truck className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-400" />
                <p className="font-bold text-slate-700">No consignments ready for transport</p>
                <p className="text-xs text-slate-500 mt-1">Bookings will appear here after Admin 1 records weighment at Mandi Yard</p>
              </div>
            ) : (
              filteredLogistics.map((b) => {
                const isDispatched = b.tracking?.stage === 'in_transit' || b.tracking?.stage === 'delivered';
                const isDelivered = b.tracking?.stage === 'delivered';

                return (
                  <div key={b.id} className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-sm sm:text-base">{b.farmer_name}</span>
                          <span className="text-[10px] font-black bg-slate-900 text-amber-300 px-2 py-0.5 rounded-md">
                            {b.token_number || b.id}
                          </span>
                          <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                            isDelivered
                              ? 'bg-emerald-100 text-emerald-800'
                              : isDispatched
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isDelivered ? 'Stored at Silo (e-WHR)' : isDispatched ? 'In Transit / Lorry Active' : 'Procured at Mandi'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          📍 Mandi: {b.location_name || 'Central Yard'} · 🌾 {b.crop_type} ({b.actual_quantity || b.expected_quantity || 50} Qtl)
                        </div>
                      </div>

                      {/* Transit Action Buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {!isDispatched && (
                          <button
                            type="button"
                            onClick={() => {
                              setDispatchModal(b);
                              setDispatchForm({
                                lorry_id: `AP-21-TX-${Math.floor(1000 + Math.random() * 9000)}`,
                                driver_phone: '9848099881',
                                destination: 'FCI Regional Buffer Silo, Kurnool',
                                mill_name: 'AP State Civil Supplies Godown'
                              });
                            }}
                            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Dispatch to Buffer Silo</span>
                          </button>
                        )}

                        {isDispatched && !isDelivered && (
                          <button
                            type="button"
                            onClick={() => {
                              setDeliverModal(b);
                              setEwhrInput(`eWHR-2026-AP${Math.floor(1000 + Math.random() * 9000)}`);
                            }}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>Confirm Silo Delivery & e-WHR</span>
                          </button>
                        )}

                        {isDelivered && (
                          <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>e-WHR Certified ✓</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Consignment details */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Logistics Stage</span>
                        <span className="font-bold text-slate-800">
                          {isDelivered ? 'Central Warehouse Receipt Done' : isDispatched ? 'GPS In Transit' : 'Awaiting Truck Loading'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Destination</span>
                        <span className="font-bold text-slate-800">
                          {b.tracking?.destination || 'FCI Regional Buffer Silo, Kurnool'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Consignment Reference</span>
                        <span className="font-mono font-bold text-slate-800">
                          {b.tracking?.ewhr_number || b.tracking?.lorry_id || `TRK-2026-${b.id.slice(-4)}`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── MODALS ── */}

      {/* 1. Mark Paid Modal */}
      {payModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200">
            <h3 className="text-lg font-black text-slate-900 mb-1">Confirm DBT Payment</h3>
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <div className="font-bold text-slate-900">{payModal.farmer_name}</div>
              <div className="text-xs text-slate-500">{payModal.bank_name} · ••••{payModal.bank_account?.slice(-4)}</div>
              <div className="text-2xl font-black text-emerald-800 mt-1">₹{Number(payModal.amount).toLocaleString('en-IN')}</div>
            </div>
            <form onSubmit={handleMarkPaid} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">PFMS / UTR Transaction Reference</label>
                <input
                  type="text"
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  placeholder="e.g. PFMS20260907-994821"
                  className="w-full min-h-[44px] px-3 rounded-xl border-2 border-slate-300 font-mono text-xs font-bold"
                />
                <p className="text-[10px] text-slate-400 mt-1">Leave blank to auto-generate reference</p>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={loading}
                  className="flex-1 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md">
                  {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {loading ? 'Processing...' : 'Authorize DBT Transfer'}
                </button>
                <button type="button" onClick={() => setPayModal(null)}
                  className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Bank Edit Modal */}
      {bankModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200">
            <h3 className="text-lg font-black text-slate-900 mb-1">Update Bank Details</h3>
            <p className="text-xs text-slate-500 mb-4">Farmer: <strong>{bankModal.farmer_name}</strong></p>
            <form onSubmit={saveBankDetails} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name</label>
                <input type="text" value={bankForm.bank_name} onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                  placeholder="e.g. State Bank of India"
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Account Number</label>
                <input type="text" value={bankForm.bank_account} onChange={(e) => setBankForm({ ...bankForm, bank_account: e.target.value })}
                  placeholder="Account number"
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 font-mono text-xs font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">IFSC Code</label>
                <input type="text" value={bankForm.ifsc} onChange={(e) => setBankForm({ ...bankForm, ifsc: e.target.value.toUpperCase() })}
                  placeholder="e.g. SBIN0001234"
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 font-mono text-xs font-bold" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={loading}
                  className="flex-1 min-h-[44px] bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs">
                  {loading ? 'Saving...' : 'Save Bank Details'}
                </button>
                <button type="button" onClick={() => setBankModal(null)}
                  className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Dispatch Modal */}
      {dispatchModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <Truck className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-black text-slate-900">Dispatch Crop Consignment</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Farmer: <strong>{dispatchModal.farmer_name}</strong> · Qty: <strong>{dispatchModal.actual_quantity || dispatchModal.expected_quantity || 50} Qtl</strong>
            </p>

            <form onSubmit={handleDispatchCrop} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Destination Warehouse / Buffer Silo</label>
                <select
                  value={dispatchForm.destination}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, destination: e.target.value })}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                >
                  <option value="FCI Regional Buffer Silo, Kurnool">FCI Regional Buffer Silo, Kurnool</option>
                  <option value="AP State Warehousing Corp Godown, Guntur">AP State Warehousing Corp Godown, Guntur</option>
                  <option value="Central Buffer Storage Depot, Vijayawada">Central Buffer Storage Depot, Vijayawada</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lorry / Truck Number</label>
                  <input
                    type="text"
                    required
                    value={dispatchForm.lorry_id}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, lorry_id: e.target.value })}
                    placeholder="AP-21-TX-9904"
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 font-mono text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Driver Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={dispatchForm.driver_phone}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, driver_phone: e.target.value })}
                    placeholder="9848099881"
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={loading}
                  className="flex-1 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md">
                  {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Truck className="w-4 h-4" />}
                  <span>Confirm Dispatch (In Transit)</span>
                </button>
                <button type="button" onClick={() => setDispatchModal(null)}
                  className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Delivery e-WHR Modal */}
      {deliverModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <PackageCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-black text-slate-900">Confirm Warehouse Storage (e-WHR)</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Consignment for <strong>{deliverModal.farmer_name}</strong> arrived at destination.
            </p>

            <form onSubmit={handleDeliverCrop} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Electronic Warehouse Receipt (e-WHR) #</label>
                <input
                  type="text"
                  required
                  value={ewhrInput}
                  onChange={(e) => setEwhrInput(e.target.value)}
                  placeholder="eWHR-2026-AP8841"
                  className="w-full min-h-[44px] px-3 rounded-xl border-2 border-emerald-300 font-mono text-xs font-bold"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={loading}
                  className="flex-1 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md">
                  {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>Generate e-WHR & Store</span>
                </button>
                <button type="button" onClick={() => setDeliverModal(null)}
                  className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Crop Delivery Acceptance Modal */}
      {deliveryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-100">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Admin 2 Weighbridge Inspection</span>
              <h3 className="text-base font-black text-slate-900 mt-0.5">Accept Crop Delivery: {deliveryModal.farmer_name}</h3>
              <p className="text-xs text-slate-500">Token #{deliveryModal.token_number || deliveryModal.id} · {deliveryModal.crop_type || 'Paddy'}</p>
            </div>

            <form onSubmit={handleAcceptDelivery} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Actual Net Weight (Quintals) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={deliveryForm.actual_weight}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, actual_weight: e.target.value })}
                  className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-300 text-sm font-black text-slate-900 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Quality Grade</label>
                  <select
                    value={deliveryForm.quality_grade}
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, quality_grade: e.target.value })}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-800 outline-none focus:border-emerald-600"
                  >
                    <option value="Grade A Superfine">Grade A Superfine</option>
                    <option value="Common Standard">Common Standard</option>
                    <option value="FAQ Quality">FAQ Quality</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Moisture Content</label>
                  <input
                    type="text"
                    value={deliveryForm.moisture_content}
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, moisture_content: e.target.value })}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600"
                    placeholder="12%"
                  />
                </div>
              </div>

              {/* Instant MSP Payout calculation box */}
              {(() => {
                const cropName = deliveryModal.crop_type || deliveryModal.crop || 'Paddy';
                const cropRate = cropMspMap[cropName] || 2300;
                const weight = Number(deliveryForm.actual_weight) || Number(deliveryModal.expected_quantity) || 50;
                const total = Math.round(weight * cropRate);
                return (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">Locked MSP Rate:</span>
                      <strong className="text-slate-900">₹{cropRate.toLocaleString('en-IN')}/Qtl</strong>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-slate-600">Calculated PFMS DBT Payout:</span>
                      <strong className="text-emerald-800 text-base font-black">₹{total.toLocaleString('en-IN')}</strong>
                    </div>
                  </div>
                );
              })()}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeliveryModal(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Confirm Acceptance & Queue DBT</span>
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

