import React, { useState } from 'react';
import { 
  Building2, 
  MapPin, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Phone, 
  Search, 
  Check, 
  X, 
  AlertCircle,
  ExternalLink,
  Layers,
  Map as MapIcon
} from 'lucide-react';
import ProcurementMap from '../ProcurementMap';

const AP_DISTRICTS = [
  'All Districts',
  'Kurnool',
  'Nandyal',
  'Guntur',
  'NTR',
  'Krishna',
  'Eluru',
  'East Godavari',
  'West Godavari',
  'Anantapur',
  'Sri Sathya Sai',
  'YSR Kadapa',
  'Annamayya',
  'Tirupati',
  'Chittoor',
  'SPSR Nellore',
  'Prakasam',
  'Bapatla',
  'Palnadu',
  'Visakhapatnam',
  'Anakapalli',
  'Kakinada',
  'Dr. B.R. Ambedkar Konaseema',
  'Vizianagaram',
  'Srikakulam',
  'Parvathipuram Manyam',
  'Alluri Sitharama Raju'
];

export default function AdminCentersManager({ locations = [], slots = [], onRefresh }) {
  const [activeSubTab, setActiveSubTab] = useState('active'); // 'active' | 'requests' | 'map'
  const [search, setSearch] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('All Districts');
  const [showAddModal, setShowAddModal] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });

  // Add Center Form State
  const [newCenter, setNewCenter] = useState({
    name: '',
    address: '',
    village: '',
    mandal: '',
    district: 'Kurnool',
    pincode: '518001',
    daily_capacity_quintals: 2500,
    contact_phone: '08518-220145'
  });

  const activeCenters = locations.filter(l => l.status === 'active' || !l.status);
  const requestedCenters = locations.filter(l => l.status === 'pending' || l.status === 'rejected');
  const pendingRequests = locations.filter(l => l.status === 'pending');

  const flashMsg = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ type: '', text: '' }), 4000);
  };

  const handleApprove = async (locId, locName) => {
    setActionLoading(locId);
    try {
      const res = await fetch(`/api/locations/${locId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed_by: 'ADMIN1' })
      });
      const data = await res.json();
      if (data.success) {
        flashMsg(`Mandi Center "${locName}" approved! Slots automatically generated.`);
        if (onRefresh) onRefresh();
      } else {
        flashMsg(data.error || 'Failed to approve', 'error');
      }
    } catch {
      flashMsg('Server error while approving', 'error');
    } finally {
      setActionLoading('');
    }
  };

  const handleReject = async (locId, locName) => {
    const reason = window.prompt(`Enter rejection reason for "${locName}":`, 'Location does not meet minimum road clearance or distance criteria.');
    if (reason === null) return;

    setActionLoading(locId);
    try {
      const res = await fetch(`/api/locations/${locId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, reviewed_by: 'ADMIN1' })
      });
      const data = await res.json();
      if (data.success) {
        flashMsg(`Request "${locName}" rejected.`);
        if (onRefresh) onRefresh();
      } else {
        flashMsg(data.error || 'Failed to reject', 'error');
      }
    } catch {
      flashMsg('Server error while rejecting', 'error');
    } finally {
      setActionLoading('');
    }
  };

  const handleCreateCenter = async (e) => {
    e.preventDefault();
    if (!newCenter.name.trim()) return;
    setActionLoading('create');
    try {
      const locId = `LOC-AP-${Date.now().toString().slice(-4)}`;
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: locId,
          name: newCenter.name.trim(),
          address: newCenter.address.trim(),
          village: newCenter.village.trim() || newCenter.name.trim(),
          mandal: newCenter.mandal.trim() || 'Central',
          district: newCenter.district,
          pincode: newCenter.pincode,
          daily_capacity_quintals: Number(newCenter.daily_capacity_quintals),
          contact_phone: newCenter.contact_phone,
          status: 'active',
          created_at: new Date().toISOString()
        })
      });
      const data = await res.json();
      if (data.success) {
        flashMsg(`Procurement Mandi "${newCenter.name}" created successfully!`);
        setShowAddModal(false);
        setNewCenter({
          name: '',
          address: '',
          village: '',
          mandal: '',
          district: 'Kurnool',
          pincode: '518001',
          daily_capacity_quintals: 2500,
          contact_phone: '08518-220145'
        });
        if (onRefresh) onRefresh();
      } else {
        flashMsg(data.error || 'Failed to create center', 'error');
      }
    } catch {
      flashMsg('Server error while creating center', 'error');
    } finally {
      setActionLoading('');
    }
  };

  // Filter lists based on district & search text
  const filteredActive = activeCenters.filter(c => {
    const matchDist = selectedDistrict === 'All Districts' || c.district === selectedDistrict;
    const matchSearch = !search || 
      (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.district || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.address || '').toLowerCase().includes(search.toLowerCase());
    return matchDist && matchSearch;
  });

  const filteredRequests = requestedCenters.filter(r => {
    const matchDist = selectedDistrict === 'All Districts' || r.district === selectedDistrict;
    const matchSearch = !search || 
      (r.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.district || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.address || '').toLowerCase().includes(search.toLowerCase());
    return matchDist && matchSearch;
  });

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Top Banner & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            <span>Mandi Centers & Farmer Requests</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage Andhra Pradesh government procurement hubs & approve farmer location requests
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-700/20 transition-all cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Mandi Center</span>
        </button>
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

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200 gap-4 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('active')}
          className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer shrink-0 ${
            activeSubTab === 'active'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Active Centers ({activeCenters.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('requests')}
          className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer shrink-0 ${
            activeSubTab === 'requests'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Farmer Requests</span>
          {pendingRequests.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
              {pendingRequests.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('map')}
          className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer shrink-0 ${
            activeSubTab === 'map'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MapIcon className="w-4 h-4" />
          <span>Live Map View</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
        <div className="sm:col-span-8 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by mandi name, district, address..."
            className="w-full min-h-[40px] pl-9 pr-3 rounded-xl border border-slate-300 text-xs font-semibold focus:border-emerald-600 bg-white"
          />
        </div>

        <div className="sm:col-span-4">
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs font-semibold focus:border-emerald-600 bg-white"
          >
            {AP_DISTRICTS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── 1. ACTIVE MANDI CENTERS LIST ── */}
      {activeSubTab === 'active' && (
        <div className="space-y-3">
          {filteredActive.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6 text-slate-400">
              <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="font-bold text-sm text-slate-600">No active centers found</p>
              <p className="text-xs mt-0.5">Try searching a different district or create a new mandi center</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredActive.map(center => {
                const centerSlots = slots.filter(s => (s.location_id === center.id || s.centre_id === center.id));
                return (
                  <div key={center.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:border-emerald-300 transition-all flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-black text-slate-900 text-sm">{center.name}</span>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                              {center.district || 'Andhra Pradesh'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="line-clamp-1">{center.address || `${center.village || ''}, ${center.district}`}</span>
                          </div>
                        </div>

                        <span className="text-[10px] font-black px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                          Active
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-100 text-xs">
                        <div className="text-slate-600">
                          <span className="text-[10px] text-slate-400 uppercase block font-bold">Capacity</span>
                          <span className="font-bold text-slate-800">{center.daily_capacity_quintals || 2500} qtl/day</span>
                        </div>
                        <div className="text-slate-600">
                          <span className="text-[10px] text-slate-400 uppercase block font-bold">Active Slots</span>
                          <span className="font-bold text-emerald-700">{centerSlots.length} available</span>
                        </div>
                      </div>
                    </div>

                    {center.contact_phone && (
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-slate-50 rounded-xl px-2.5 py-1.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>Helpline: {center.contact_phone}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 2. FARMER REQUESTS LIST ── */}
      {activeSubTab === 'requests' && (
        <div className="space-y-3">
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6 text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30 text-emerald-500" />
              <p className="font-bold text-sm text-slate-600">All farmer location requests reviewed!</p>
              <p className="text-xs mt-0.5">When farmers request a new mandi center from their mobile app, it appears here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map(req => {
                const isPending = req.status === 'pending';
                const isRejected = req.status === 'rejected';
                const isLoading = actionLoading === req.id;

                return (
                  <div key={req.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-900 text-sm">{req.name}</span>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                            isPending ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {req.status}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            {req.district}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{req.address || `${req.village || ''}, ${req.mandal || ''}, ${req.district}`}</span>
                        </div>

                        {req.rejection_reason && (
                          <div className="text-xs text-red-600 font-medium bg-red-50 rounded-xl p-2 mt-1">
                            <strong>Reason:</strong> {req.rejection_reason}
                          </div>
                        )}

                        <div className="text-[11px] text-slate-400">
                          Reference: {req.id} · Submitted: {new Date(req.created_at || Date.now()).toLocaleDateString('en-IN')}
                        </div>
                      </div>

                      {/* Action buttons */}
                      {isPending && (
                        <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                          <button
                            type="button"
                            onClick={() => handleApprove(req.id, req.name)}
                            disabled={isLoading}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-200 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                          >
                            {isLoading ? (
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                            <span>Approve & Generate Slots</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleReject(req.id, req.name)}
                            disabled={isLoading}
                            className="px-3 py-2 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 font-bold text-xs rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                            <span>Reject</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 3. LIVE MAP VIEW ── */}
      {activeSubTab === 'map' && (
        <div className="space-y-3 animate-fadeIn">
          <div className="bg-white p-2 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <ProcurementMap
              centres={filteredActive}
              requests={filteredRequests}
              height="500px"
              onSelectCentre={(c) => {
                alert(`Selected Mandi: ${c.name} (${c.district})\nCapacity: ${c.daily_capacity_quintals || 2500} Quintals/day\nPhone: ${c.contact_phone || '08518-220145'}`);
              }}
            />
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center justify-between">
            <span>🟢 <strong>Green Pins</strong>: Active Mandi Centers | ⏳ <strong>Amber Pins</strong>: Pending Farmer Requests</span>
            <span className="font-bold">{filteredActive.length} Active · {filteredRequests.length} Requests</span>
          </div>
        </div>
      )}

      {/* ── 3. ADD MANDI CENTER MODAL ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Add New Mandi Center</h3>
                <p className="text-xs text-slate-500">Create a government procurement yard in Andhra Pradesh</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCenter} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mandi / Center Name *</label>
                <input
                  type="text"
                  required
                  value={newCenter.name}
                  onChange={(e) => setNewCenter({ ...newCenter, name: e.target.value })}
                  placeholder="e.g. Nandyal Agricultural Market Yard"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-900 focus:border-emerald-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">District (AP) *</label>
                  <select
                    value={newCenter.district}
                    onChange={(e) => setNewCenter({ ...newCenter, district: e.target.value })}
                    className="w-full min-h-[44px] px-3 rounded-xl border-2 border-slate-200 text-xs font-semibold focus:border-emerald-600 bg-white outline-none"
                  >
                    {AP_DISTRICTS.filter(d => d !== 'All Districts').map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mandal / Taluk</label>
                  <input
                    type="text"
                    value={newCenter.mandal}
                    onChange={(e) => setNewCenter({ ...newCenter, mandal: e.target.value })}
                    placeholder="Mandal"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-900 focus:border-emerald-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Mandi Address *</label>
                <input
                  type="text"
                  required
                  value={newCenter.address}
                  onChange={(e) => setNewCenter({ ...newCenter, address: e.target.value })}
                  placeholder="e.g. Near Railway Station Road, Nandyal"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-900 focus:border-emerald-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Daily Capacity (Quintals)</label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={newCenter.daily_capacity_quintals}
                    onChange={(e) => setNewCenter({ ...newCenter, daily_capacity_quintals: Number(e.target.value) })}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-900 focus:border-emerald-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Helpline Phone</label>
                  <input
                    type="text"
                    value={newCenter.contact_phone}
                    onChange={(e) => setNewCenter({ ...newCenter, contact_phone: e.target.value })}
                    placeholder="08518-220145"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-900 focus:border-emerald-600 outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium">
                ✨ Booking slots for today and the upcoming week will be auto-generated for this new center.
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 min-h-[46px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={actionLoading === 'creating'}
                  className="flex-1 min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-200 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  {actionLoading === 'creating' ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Create & Activate Center</span>
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
