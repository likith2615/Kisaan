import React, { useState, useMemo } from 'react';
import { 
  CheckCircle2, 
  Scale, 
  Send, 
  Clock, 
  User, 
  Search, 
  ChevronDown, 
  Building2, 
  MapPin, 
  Filter, 
  Sparkles, 
  Phone, 
  Volume2, 
  Check, 
  Layers, 
  AlertCircle,
  Truck,
  Activity
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

const STATUS_ORDER = ['booked', 'arrived_waiting_confirmation', 'arrived', 'checked_in', 'in_progress', 'weighed', 'payment_ready', 'completed', 'cancelled'];
const STATUS_LABEL = {
  booked: '⏳ Scheduled Slot',
  arrived_waiting_confirmation: '🚨 Gate Check-in (Verify Arrival)',
  arrived: '🚚 Arrived at Gate',
  checked_in: '🚚 Arrived / Checked In',
  in_progress: '🔄 Weighbridge Active',
  weighed: '⚖️ Weighed & Certified',
  payment_ready: '💳 Sent to Payment',
  completed: '✔️ Completed',
  cancelled: '❌ Cancelled'
};
const STATUS_COLOR = {
  booked: 'bg-slate-100 text-slate-700 border-slate-200',
  arrived_waiting_confirmation: 'bg-rose-100 text-rose-900 border-rose-400 font-bold animate-pulse',
  arrived: 'bg-amber-100 text-amber-900 border-amber-300',
  checked_in: 'bg-amber-100 text-amber-900 border-amber-300',
  in_progress: 'bg-indigo-100 text-indigo-900 border-indigo-300',
  weighed: 'bg-purple-100 text-purple-900 border-purple-300',
  payment_ready: 'bg-blue-100 text-blue-900 border-blue-300',
  completed: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  cancelled: 'bg-rose-100 text-rose-900 border-rose-300'
};

export default function AdminQueueManager({ bookings = [], slots = [], locations = [], farmers = [], crops = [], onRefresh }) {
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

  const [selectedMandiId, setSelectedMandiId] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | booked | arrived | weighed | payment_ready
  const [weighModal, setWeighModal] = useState(null);
  const [weightInput, setWeightInput] = useState('');
  const [mspInput, setMspInput] = useState('2183');
  const [deductionsInput, setDeductionsInput] = useState('0');
  const [gradeInput, setGradeInput] = useState('Grade A Superfine');
  const [actionLoading, setActionLoading] = useState('');
  const [msg, setMsg] = useState({ text: '', type: 'success' });

  const activeLocations = locations.filter(l => l.status === 'active' || !l.status);

  // Filter bookings by Mandi and Date
  const mandiFilteredBookings = useMemo(() => {
    return bookings.filter(b => {
      // Mandi filter
      const bLocId = b.location_id || b.slot?.location_id || b.slot?.centre_id || b.centre_id;
      const matchMandi = selectedMandiId === 'ALL' || bLocId === selectedMandiId;

      // Date filter
      const bDate = b.date || b.slot?.date || (b.created_at ? b.created_at.slice(0, 10) : '');
      const matchDate = selectedDate === 'ALL' || !selectedDate || bDate === selectedDate;

      return matchMandi && matchDate;
    });
  }, [bookings, selectedMandiId, selectedDate]);

  // State for Book Farmer Modal
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookForm, setBookForm] = useState({
    farmer_name: '',
    farmer_phone: '',
    district: 'Kurnool',
    village: '',
    location_id: '',
    slot_id: '',
    crop_type: 'Paddy',
    expected_quantity: 50,
    date: new Date().toISOString().slice(0, 10),
    time: '09:00 AM - 11:00 AM'
  });
  const [bookLoading, setBookLoading] = useState(false);

  // Active (in-queue) bookings
  const activeBookings = mandiFilteredBookings.filter(b => !['completed', 'cancelled'].includes(b.status));
  const waitingArrivals = activeBookings.filter(b => b.status === 'arrived_waiting_confirmation');

  // Search & Status Filter
  const filtered = activeBookings.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      b.farmer_name?.toLowerCase().includes(q) ||
      b.farmer_phone?.toLowerCase().includes(q) ||
      b.token_number?.toString().includes(q) ||
      b.id?.toLowerCase().includes(q) ||
      (b.crop_type || '').toLowerCase().includes(q);
    const matchFilter = filter === 'all' || b.status === filter;
    return matchSearch && matchFilter;
  });

  // Sort sequentially by queue_position or priority
  const sorted = [...filtered].sort((a, b) => {
    const posA = Number(a.queue_position) || 999;
    const posB = Number(b.queue_position) || 999;
    if (posA !== posB) return posA - posB;
    const prioA = Number(a.priority) || 0;
    const prioB = Number(b.priority) || 0;
    if (prioA !== prioB) return prioB - prioA;
    return new Date(a.created_at || 0) - new Date(b.created_at || 0);
  });

  // Selected mandi center details
  const selectedMandi = activeLocations.find(l => l.id === selectedMandiId);

  const flashMsg = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: 'success' }), 4000);
  };

  // Reorder queue position (e.g. Farmer C comes first -> Make C #1 -> A becomes #2, B becomes #3)
  const handleReorder = async (booking, action) => {
    setActionLoading(`reorder-${booking.id}`);
    try {
      const res = await fetch('/api/queue/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: booking.id,
          action,
          mandi_id: selectedMandiId,
          date: selectedDate
        })
      });
      const data = await res.json();
      if (data.success) {
        flashMsg(
          action === 'make_first'
            ? `⚡ ${booking.farmer_name} moved to Position #1 in Queue! (Other farmers shifted sequentially)`
            : `Queue adjusted for ${booking.farmer_name}`
        );
        if (onRefresh) onRefresh();
      } else {
        flashMsg(data.error || 'Failed to reorder queue', 'error');
      }
    } catch {
      flashMsg('Server error while updating queue position', 'error');
    } finally {
      setActionLoading('');
    }
  };

  // Book on behalf of farmer (e.g. Farmer A, B, C)
  const handleAdminBook = async (e) => {
    e.preventDefault();
    if (!bookForm.farmer_name) {
      flashMsg('Please enter farmer name', 'error');
      return;
    }
    const locId = bookForm.location_id || selectedMandiId !== 'ALL' ? selectedMandiId : activeLocations[0]?.id;
    if (!locId) {
      flashMsg('Please select a Mandi center', 'error');
      return;
    }

    setBookLoading(true);
    try {
      const res = await fetch('/api/bookings/admin-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bookForm,
          location_id: locId,
          date: selectedDate !== 'ALL' ? selectedDate : bookForm.date
        })
      });
      const data = await res.json();
      if (data.success) {
        flashMsg(`✓ ${data.message || 'Slot booked for farmer successfully!'}`);
        setShowBookModal(false);
        setBookForm({
          farmer_name: '',
          farmer_phone: '',
          district: 'Kurnool',
          village: '',
          location_id: '',
          slot_id: '',
          crop_type: 'Paddy',
          expected_quantity: 50,
          date: new Date().toISOString().slice(0, 10),
          time: '09:00 AM - 11:00 AM'
        });
        if (onRefresh) onRefresh();
      } else {
        flashMsg(data.error || 'Failed to create booking', 'error');
      }
    } catch {
      flashMsg('Server error while creating booking', 'error');
    } finally {
      setBookLoading(false);
    }
  };

  const markArrived = async (booking, andPrioritize = false) => {
    setActionLoading(booking.id);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/mark-arrived`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        if (andPrioritize) {
          await handleReorder(booking, 'make_first');
        }
        flashMsg(`${booking.farmer_name} verified at gate entry ✓${andPrioritize ? ' and bumped to #1' : ''}`);
        if (onRefresh) onRefresh();
      } else {
        flashMsg(data.error || 'Failed to mark arrival', 'error');
      }
    } catch {
      flashMsg('Server error while marking arrival', 'error');
    } finally {
      setActionLoading('');
    }
  };

  const confirmArrival = async (booking, andPrioritize = false) => {
    setActionLoading(`verify-${booking.id}`);
    try {
      const res = await fetch('/api/admin/confirm-arrival', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: booking.id, admin_id: 'ADMIN1' })
      });
      const data = await res.json();
      if (data.success) {
        if (andPrioritize) {
          await handleReorder(booking, 'make_first');
        }
        flashMsg(`✅ Physical arrival verified for ${booking.farmer_name}!${andPrioritize ? ' Promoted to #1 in queue.' : ''}`);
        if (onRefresh) onRefresh();
      } else {
        flashMsg(data.error || 'Failed to verify arrival', 'error');
      }
    } catch {
      flashMsg('Server error while verifying arrival', 'error');
    } finally {
      setActionLoading('');
    }
  };

  const openWeighModal = (booking) => {
    const crop = booking.crop_type || 'Paddy';
    setWeighModal(booking);
    setWeightInput(String(booking.expected_quantity || 50));
    setMspInput(String(mspRates[crop] || 2183));
    setDeductionsInput('0');
    setGradeInput('Grade A Superfine');
  };

  const recordWeighment = async (e) => {
    e.preventDefault();
    if (!weighModal || !weightInput) return;
    setActionLoading(weighModal.id);
    try {
      const gross = parseFloat(weightInput);
      const ded = parseFloat(deductionsInput) || 0;
      const net = Math.max(0.1, gross - ded);
      const msp = parseFloat(mspInput) || 2183;

      const res = await fetch(`/api/bookings/${weighModal.id}/record-weighment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weight_quintals: net,
          msp_per_quintal: msp,
          crop_type: weighModal.crop_type || 'Paddy',
          quality_grade: gradeInput,
          deductions_kg: ded * 100
        })
      });
      const data = await res.json();
      if (data.success) {
        flashMsg(`Weighment certified: ${net} Qtl · ₹${data.amount?.toLocaleString('en-IN')} calculated!`);
        setWeighModal(null);
        if (onRefresh) onRefresh();
      } else {
        flashMsg(data.error || 'Failed to record weighment', 'error');
      }
    } catch {
      flashMsg('Server error recording weighment', 'error');
    } finally {
      setActionLoading('');
    }
  };

  const sendToPayment = async (booking) => {
    if (!window.confirm(`Send ${booking.farmer_name}'s weighment to Payment Manager for DBT release?`)) return;
    setActionLoading(booking.id);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/send-to-payment`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        flashMsg(`${booking.farmer_name} sent to Payment Manager! (+20 loyalty points awarded)`);
        if (onRefresh) onRefresh();
      } else {
        flashMsg(data.error || 'Failed to send to payment', 'error');
      }
    } catch {
      flashMsg('Server error sending to payment', 'error');
    } finally {
      setActionLoading('');
    }
  };

  const updateStatusDirectly = async (booking, newStatus) => {
    if (!newStatus || newStatus === booking.status) return;
    setActionLoading(`status-${booking.id}`);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        flashMsg(`Status updated to ${STATUS_LABEL[newStatus] || newStatus} for ${booking.farmer_name}`);
        if (onRefresh) onRefresh();
      } else {
        flashMsg(data.error || 'Failed to update status', 'error');
      }
    } catch {
      flashMsg('Server error updating status', 'error');
    } finally {
      setActionLoading('');
    }
  };

  // Currently serving token (first arrived or in progress)
  const currentlyServing = activeBookings.find(b => b.status === 'arrived') || activeBookings[0] || null;

  // Status counts for selected mandi & date
  const queueCounts = activeBookings.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  const arrivedCount = queueCounts['arrived'] || 0;
  const congestionLevel = arrivedCount <= 2 ? 'Low Traffic' : arrivedCount <= 6 ? 'Moderate Load' : 'High Rush';

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* ── 1. TOP MANDI SELECTOR, DATE BAR & BOOK ACTION ── */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
              Mandi-Wise Queue & Flow Control
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs font-bold text-slate-500">
              {activeBookings.length} Farmers in Queue
            </span>
          </div>
          <h2 className="text-lg font-black text-slate-900 mt-1 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            <span>{selectedMandi ? selectedMandi.name : 'All Andhra Pradesh Mandi Yards'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {selectedMandi ? `📍 ${selectedMandi.address || selectedMandi.village || ''}, ${selectedMandi.district}` : 'Select a specific Mandi procurement yard to manage on-ground token queues and prioritize arrivals'}
          </p>
        </div>

        {/* Mandi & Date Selector Controls & + Book Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Mandi Center</label>
            <select
              value={selectedMandiId}
              onChange={(e) => setSelectedMandiId(e.target.value)}
              className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-800 outline-none focus:border-emerald-600"
            >
              <option value="ALL">🏛️ All Mandi Centers ({activeLocations.length})</option>
              {activeLocations.map(l => {
                const count = bookings.filter(b => (b.location_id === l.id || b.slot?.location_id === l.id) && !['completed', 'cancelled'].includes(b.status)).length;
                return (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.district}) — {count} in queue
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Target Date</label>
              <button
                type="button"
                onClick={() => setSelectedDate(selectedDate === 'ALL' ? new Date().toISOString().slice(0, 10) : 'ALL')}
                className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
              >
                {selectedDate === 'ALL' ? 'Show Today' : 'Show All Dates'}
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={selectedDate === 'ALL' ? '' : selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-800 outline-none focus:border-emerald-600"
              />
              {selectedDate === 'ALL' && (
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
                setBookForm(prev => ({
                  ...prev,
                  location_id: selectedMandiId !== 'ALL' ? selectedMandiId : activeLocations[0]?.id || '',
                  date: selectedDate !== 'ALL' ? selectedDate : new Date().toISOString().slice(0, 10)
                }));
                setShowBookModal(true);
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <span>+ Book for Farmer</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. MANDI YARD LIVE METRICS & BROADCAST BANNER ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Now Serving Live Token Broadcast Box */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white p-4 sm:p-5 rounded-3xl shadow-md flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Weighbridge Bay 1 Live Call
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                {congestionLevel}
              </span>
            </div>

            <div className="mt-2.5">
              <div className="text-xs text-slate-300">Currently Called Token</div>
              <div className="text-2xl sm:text-3xl font-black text-amber-300 tracking-tight">
                {currentlyServing ? currentlyServing.token_number || `TK-${currentlyServing.id.slice(-4)}` : 'TK-STANDBY'}
              </div>
              <div className="text-xs text-slate-200 font-semibold mt-0.5">
                {currentlyServing ? `${currentlyServing.farmer_name} · ${currentlyServing.crop_type || 'Paddy'}` : 'All trucks processed or awaiting arrival'}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
            <span>Avg Wait: ~{Math.max(10, arrivedCount * 12)} mins</span>
            <span className="text-emerald-400 font-bold">Certified Electronic Bay</span>
          </div>
        </div>

        {/* Mandi-Wise Queue Status Cards */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => setFilter(filter === 'booked' ? 'all' : 'booked')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              filter === 'booked' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="text-[10px] font-bold uppercase text-slate-400">Scheduled</div>
            <div className="text-xl font-black mt-0.5">{queueCounts['booked'] || 0}</div>
            <div className="text-[10px] opacity-70 mt-0.5">Expected slots</div>
          </button>

          <button
            type="button"
            onClick={() => setFilter(filter === 'arrived' ? 'all' : 'arrived')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              filter === 'arrived' ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-white text-slate-800 border-slate-200 hover:border-amber-300'
            }`}
          >
            <div className={`text-[10px] font-bold uppercase ${filter === 'arrived' ? 'text-amber-100' : 'text-amber-700'}`}>At Gate</div>
            <div className="text-xl font-black mt-0.5">{queueCounts['arrived'] || 0}</div>
            <div className="text-[10px] opacity-70 mt-0.5">Ready for weigh</div>
          </button>

          <button
            type="button"
            onClick={() => setFilter(filter === 'weighed' ? 'all' : 'weighed')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              filter === 'weighed' ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white text-slate-800 border-slate-200 hover:border-purple-300'
            }`}
          >
            <div className={`text-[10px] font-bold uppercase ${filter === 'weighed' ? 'text-purple-100' : 'text-purple-700'}`}>Weighed</div>
            <div className="text-xl font-black mt-0.5">{queueCounts['weighed'] || 0}</div>
            <div className="text-[10px] opacity-70 mt-0.5">Certified net qty</div>
          </button>

          <button
            type="button"
            onClick={() => setFilter(filter === 'payment_ready' ? 'all' : 'payment_ready')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              filter === 'payment_ready' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-800 border-slate-200 hover:border-blue-300'
            }`}
          >
            <div className={`text-[10px] font-bold uppercase ${filter === 'payment_ready' ? 'text-blue-100' : 'text-blue-700'}`}>Payment Ready</div>
            <div className="text-xl font-black mt-0.5">{queueCounts['payment_ready'] || 0}</div>
            <div className="text-[10px] opacity-70 mt-0.5">Sent to DBT</div>
          </button>
        </div>
      </div>

      {/* Notifications / Toast */}
      {msg.text && (
        <div className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 animate-fadeIn ${
          msg.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          {msg.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* ── ARRIVAL VERIFICATION DESK (HIGH PRIORITY GATE ALERTS) ── */}
      {waitingArrivals.length > 0 && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-3xl p-4 sm:p-5 shadow-sm animate-fadeIn">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <h3 className="text-sm font-black text-rose-950 flex items-center gap-1.5">
                <span>🚨 Gate Arrival Verification Desk ({waitingArrivals.length} Waiting for Confirmation)</span>
              </h3>
            </div>
            <span className="text-[10px] font-bold text-rose-800 bg-rose-200/80 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Gate Physical Presence
            </span>
          </div>
          <p className="text-xs text-rose-800/80 mb-3">
            The following farmers have marked physical arrival at the mandi gate. Admin 1 must verify gate arrival to admit their truck into the weighbridge queue.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {waitingArrivals.map(b => {
              const isVerifying = actionLoading === `verify-${b.id}`;
              return (
                <div key={b.id} className="bg-white border border-rose-200 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-900 text-sm">{b.farmer_name}</span>
                      <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                        {b.token_number || b.id}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1 flex items-center gap-2 flex-wrap">
                      <span>🌾 {b.crop_type || 'Paddy'}</span>
                      <span>·</span>
                      <span>{b.actual_quantity || b.expected_quantity || 50} Qtl</span>
                      {b.farmer_phone && (
                        <>
                          <span>·</span>
                          <span>📞 {b.farmer_phone}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => confirmArrival(b, false)}
                      disabled={isVerifying}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
                    >
                      {isVerifying ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>Confirm Arrival</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmArrival(b, true)}
                      disabled={isVerifying}
                      className="py-2 px-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-black text-xs rounded-xl flex items-center gap-1 cursor-pointer shadow-xs transition-all"
                      title="Confirm arrival and immediately promote this farmer to #1 in queue"
                    >
                      <span>⚡ Confirm & Make #1</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search & Quick Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search farmer name, token #, phone, crop..."
            className="w-full min-h-[40px] pl-9 pr-3 rounded-xl border border-slate-300 text-xs font-semibold focus:border-emerald-600 bg-white"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-slate-500">Filter:</span>
          {['all', 'booked', 'arrived', 'weighed', 'payment_ready'].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filter === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s === 'all' ? 'All' : s === 'payment_ready' ? 'Ready' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── 3. MANDI-WISE SEQUENTIAL QUEUE LIST WITH DYNAMIC REORDERING ── */}
      {sorted.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-6 text-slate-400">
          <Clock className="w-12 h-12 mx-auto mb-2 opacity-30 text-slate-400" />
          <p className="font-bold text-sm text-slate-700">No active bookings in this mandi queue</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {selectedMandi ? `There are currently no active bookings for ${selectedMandi.name} on ${selectedDate}` : 'Try selecting another date or mandi center, or book a farmer using the button above'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((b, idx) => {
            const isLoading = actionLoading === b.id;
            const isReordering = actionLoading === `reorder-${b.id}`;
            const cropMsp = mspRates[b.crop_type] || 2183;
            const currentRank = idx + 1;
            const estQuintals = Number(b.actual_quantity || b.expected_quantity) || 50;
            const estValue = estQuintals * cropMsp;

            return (
              <div 
                key={b.id} 
                className={`bg-white rounded-3xl border p-4 sm:p-5 shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  currentRank === 1 
                    ? 'border-2 border-amber-400/80 ring-2 ring-amber-400/10' 
                    : 'border-slate-200 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {/* Mandi-Wise Sequential Position Badge */}
                  <div className={`w-12 h-12 rounded-2xl border-2 flex flex-col items-center justify-center shrink-0 ${
                    currentRank === 1
                      ? 'bg-amber-100 border-amber-400 text-amber-950 font-black'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}>
                    <span className="text-[9px] font-black uppercase leading-none">POS</span>
                    <span className="text-base font-black leading-none mt-0.5">#{currentRank}</span>
                  </div>

                  {/* Reordering Controls (Make #1, Up, Down) */}
                  <div className="flex flex-col gap-1 shrink-0 pt-0.5">
                    {currentRank > 1 && (
                      <button
                        type="button"
                        onClick={() => handleReorder(b, 'make_first')}
                        disabled={isReordering}
                        className="px-2 py-1 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer"
                        title="If this farmer arrived first, make them #1 (others shift down)"
                      >
                        <span>⚡ Make #1</span>
                      </button>
                    )}
                    <div className="flex items-center gap-1">
                      {currentRank > 1 && (
                        <button
                          type="button"
                          onClick={() => handleReorder(b, 'move_up')}
                          disabled={isReordering}
                          className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black flex items-center justify-center cursor-pointer"
                          title="Move up 1 position"
                        >
                          ▲
                        </button>
                      )}
                      {currentRank < sorted.length && (
                        <button
                          type="button"
                          onClick={() => handleReorder(b, 'move_down')}
                          disabled={isReordering}
                          className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black flex items-center justify-center cursor-pointer"
                          title="Move down 1 position"
                        >
                          ▼
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-slate-900 text-sm sm:text-base">{b.farmer_name}</span>
                      
                      {b.token_number && (
                        <span className="text-[10px] font-black bg-slate-900 text-amber-300 px-2.5 py-0.5 rounded-md tracking-wider">
                          {b.token_number}
                        </span>
                      )}

                      <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${STATUS_COLOR[b.status] || 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_LABEL[b.status] || b.status}
                      </span>

                      {currentRank === 1 && (
                        <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-black uppercase animate-pulse">
                          NEXT AT WEIGHBRIDGE
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                      <div className="flex items-center gap-1 font-bold text-slate-700">
                        <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{b.location_name || selectedMandi?.name || 'Mandi Center'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{b.slot?.time || b.slot?.time_window || b.time || '09:00 AM - 11:00 AM'} · {b.date || selectedDate}</span>
                      </div>
                      {b.farmer_phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{b.farmer_phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Crop & Valuation Details */}
                    <div className="mt-2.5 flex items-center gap-3 text-xs flex-wrap">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-md font-bold">
                        🌾 {b.crop_type || 'Paddy'} · {estQuintals} Quintals
                      </span>
                      <span className="font-bold text-slate-700">
                        Est. MSP: ₹{cropMsp}/qtl → <strong className="text-emerald-700 font-black">₹{estValue.toLocaleString('en-IN')}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mandi Workflow Transition Actions & Direct Status Selector */}
                <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 w-full md:w-auto justify-end flex-wrap">
                  {/* Step 0: Gate check-in arrived_waiting_confirmation */}
                  {b.status === 'arrived_waiting_confirmation' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => confirmArrival(b, false)}
                        disabled={isLoading}
                        className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer animate-pulse"
                      >
                        {isLoading ? (
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        <span>Confirm Arrival</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => confirmArrival(b, true)}
                        disabled={isLoading}
                        className="px-3 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                        title="Confirm arrival and immediately bump to #1 in line"
                      >
                        <span>Confirm & Make #1</span>
                      </button>
                    </div>
                  )}

                  {/* Step 1: Booked -> Mark Arrived */}
                  {b.status === 'booked' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => markArrived(b, false)}
                        disabled={isLoading}
                        className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        {isLoading ? (
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Truck className="w-4 h-4" />
                        )}
                        <span>Mark Arrived</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => markArrived(b, true)}
                        disabled={isLoading}
                        className="px-3 py-2.5 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 text-amber-900 border border-amber-300 text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                        title="Mark arrived and immediately bump to #1 in line"
                      >
                        <span>Arrived & Make #1</span>
                      </button>
                    </div>
                  )}

                  {/* Step 2: Arrived / Checked In / In Progress -> Record Weighment */}
                  {['arrived', 'checked_in', 'in_progress'].includes(b.status) && (
                    <button
                      type="button"
                      onClick={() => openWeighModal(b)}
                      disabled={isLoading}
                      className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md transition-all cursor-pointer animate-pulse"
                    >
                      <Scale className="w-4 h-4" />
                      <span>Record Weighment</span>
                    </button>
                  )}

                  {/* Step 3: Weighed -> Send to Payment */}
                  {b.status === 'weighed' && (
                    <button
                      type="button"
                      onClick={() => sendToPayment(b)}
                      disabled={isLoading}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                    >
                      {isLoading ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      <span>Send to Payment Manager</span>
                    </button>
                  )}

                  {/* Step 4: Payment Ready */}
                  {b.status === 'payment_ready' && (
                    <div className="flex items-center gap-1.5 text-blue-700 text-xs font-bold bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200">
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      <span>In Payment Queue (Admin 2)</span>
                    </div>
                  )}

                  {/* Step 5: Completed */}
                  {b.status === 'completed' && (
                    <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Completed & Paid</span>
                    </div>
                  )}

                  {/* Direct Status Selector / Override for Admin */}
                  <div className="flex items-center gap-1.5 pl-2 sm:border-l sm:border-slate-200">
                    <select
                      value={b.status}
                      disabled={actionLoading === `status-${b.id}`}
                      onChange={(e) => updateStatusDirectly(b, e.target.value)}
                      className="text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl px-2.5 py-2 outline-none focus:border-emerald-600 cursor-pointer shadow-2xs"
                      title="Directly update or override farmer queue status"
                    >
                      <option value="booked">⏳ Scheduled Slot</option>
                      <option value="arrived">🚚 At Gate (Arrived)</option>
                      <option value="in_progress">🔄 Weighbridge Active</option>
                      <option value="weighed">⚖️ Weighed & Certified</option>
                      <option value="payment_ready">💳 Sent to Payment</option>
                      <option value="completed">✔️ Completed</option>
                      <option value="cancelled">❌ Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 4. CERTIFIED WEIGHMENT MODAL ── */}
      {weighModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <Scale className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-black text-slate-900">Record Certified Weighment</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Mandi: <strong>{weighModal.location_name || selectedMandi?.name}</strong> · Farmer: <strong>{weighModal.farmer_name}</strong>
            </p>

            <form onSubmit={recordWeighment} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Gross Weight (Qtl) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    autoFocus
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border-2 border-purple-300 text-base font-bold focus:border-purple-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Deduction / Moisture (Qtl)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={deductionsInput}
                    onChange={(e) => setDeductionsInput(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-sm font-semibold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Quality Grade</label>
                  <select
                    value={gradeInput}
                    onChange={(e) => setGradeInput(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-semibold bg-white outline-none"
                  >
                    <option value="Grade A Superfine">Grade A Superfine</option>
                    <option value="Grade A">Grade A</option>
                    <option value="Common Standard">Common Standard</option>
                    <option value="Fair Average Quality">Fair Average Quality (FAQ)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">MSP Rate (₹/Qtl)</label>
                  <input
                    type="number"
                    value={mspInput}
                    onChange={(e) => setMspInput(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-sm font-semibold outline-none"
                  />
                </div>
              </div>

              {/* Live Certified Amount Preview */}
              {weightInput && mspInput && (
                <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl">
                  <div className="text-[10px] font-bold uppercase text-purple-700">Certified Net Payable Amount</div>
                  <div className="text-xl font-black text-purple-950 mt-0.5">
                    ₹{Math.max(0, Math.round((parseFloat(weightInput) - (parseFloat(deductionsInput) || 0)) * parseFloat(mspInput))).toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-purple-600 mt-0.5">
                    Net: {Math.max(0, (parseFloat(weightInput) - (parseFloat(deductionsInput) || 0)).toFixed(1))} Qtl × ₹{mspInput}/Qtl
                  </div>
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setWeighModal(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === weighModal.id}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:bg-slate-200 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                >
                  {actionLoading === weighModal.id ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Certify & Save Weighment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 5. BOOK FOR FARMER / WALK-IN MODAL ── */}
      {showBookModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200">
            <h3 className="text-lg font-black text-slate-900 mb-1">Book Procurement Slot for Farmer</h3>
            <p className="text-xs text-slate-500 mb-4">
              Register Farmer A, B, C or enter details to assign slot and queue token
            </p>

            <form onSubmit={handleAdminBook} className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Farmer Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Farmer A / Rajesh"
                    value={bookForm.farmer_name}
                    onChange={(e) => setBookForm({ ...bookForm, farmer_name: e.target.value })}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={bookForm.farmer_phone}
                    onChange={(e) => setBookForm({ ...bookForm, farmer_phone: e.target.value })}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mandi Center *</label>
                <select
                  required
                  value={bookForm.location_id}
                  onChange={(e) => setBookForm({ ...bookForm, location_id: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white outline-none focus:border-emerald-600"
                >
                  <option value="">Select Mandi Yard</option>
                  {activeLocations.map(l => (
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
                    value={bookForm.date}
                    onChange={(e) => setBookForm({ ...bookForm, date: e.target.value })}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Time Window *</label>
                  <select
                    value={bookForm.time}
                    onChange={(e) => setBookForm({ ...bookForm, time: e.target.value })}
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
                    value={bookForm.crop_type}
                    onChange={(e) => setBookForm({ ...bookForm, crop_type: e.target.value })}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white outline-none focus:border-emerald-600"
                  >
                    {Object.keys(mspRates).map(c => (
                      <option key={c} value={c}>{c} (₹{mspRates[c]}/qtl)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Expected Qty (Qtl)</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={bookForm.expected_quantity}
                    onChange={(e) => setBookForm({ ...bookForm, expected_quantity: e.target.value })}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Quick Preset Buttons for Farmers A, B, C */}
              <div className="pt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Quick Pre-fill Test Farmers:</span>
                <div className="grid grid-cols-3 gap-1.5 mt-1">
                  {['Farmer A', 'Farmer B', 'Farmer C'].map(name => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setBookForm({
                        ...bookForm,
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
                  onClick={() => setShowBookModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookLoading}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                >
                  {bookLoading ? (
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
}

