import React, { useState } from 'react';
import { 
  IndianRupee, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  Edit3, 
  ExternalLink,
  Building2,
  CreditCard,
  AlertTriangle,
  User,
  ShieldCheck
} from 'lucide-react';
import { translations } from '../../translations';
import FarmerPaymentModal from './FarmerPaymentModal';

export default function AdminScreen7Payments({ 
  user, 
  lang, 
  payments = [], 
  bookings = [], 
  farmers = [],
  onRefresh 
}) {
  const t = translations[lang] || translations.en;

  const [search, setSearch] = useState('');
  const [paymentModalBooking, setPaymentModalBooking] = useState(null);
  const [paymentModalFarmer, setPaymentModalFarmer] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [newStatus, setNewStatus] = useState('paid');
  const [bankRef, setBankRef] = useState('');
  const [loading, setLoading] = useState(false);

  const enrichedPayments = payments.map(p => {
    const b = bookings.find(item => item.id === p.booking_id);
    const f = farmers.find(farm => farm.id === p.farmer_id || farm.id === b?.farmer_id);
    const bookingObj = b ? {
      ...b,
      payment: p,
      farmer: f || b.farmer
    } : {
      id: p.booking_id,
      farmer_id: p.farmer_id,
      expected_quantity: 50,
      actual_quantity: 50,
      crop_type: 'Paddy',
      payment: p,
      farmer: f
    };

    return {
      ...p,
      booking: bookingObj,
      farmer: f || b?.farmer,
      token: b?.token_number || p.token_number || 'TK-482',
      tracking_id: b?.tracking_id || p.tracking_id || 'TRK-2026-8942',
      farmer_name: f?.name || b?.farmer?.name || p.farmer_id || 'Farmer Profile',
      farmer_phone: f?.phone || b?.farmer?.phone || '',
      crop: b?.crop_type || 'Paddy',
      bank_name: p.bank_name || f?.bank_name || '',
      bank_account: p.bank_account || f?.bank_account || '',
      ifsc: p.ifsc || f?.ifsc || ''
    };
  });

  const filtered = enrichedPayments.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.token?.toLowerCase().includes(q) ||
      p.tracking_id?.toLowerCase().includes(q) ||
      p.bank_txn_ref?.toLowerCase().includes(q) ||
      p.farmer_name?.toLowerCase().includes(q) ||
      p.bank_name?.toLowerCase().includes(q) ||
      p.bank_account?.toLowerCase().includes(q) ||
      p.ifsc?.toLowerCase().includes(q)
    );
  });

  const handleUpdatePayment = async (e) => {
    e.preventDefault();
    if (!selectedPayment) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/payments/${selectedPayment.id}/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          bank_txn_ref: bankRef || `PFMS${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`
        })
      });
      const data = await res.json();
      if (data.success && onRefresh) onRefresh();
      setSelectedPayment(null);
    } catch (err) {
      console.error(err);
      setSelectedPayment(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <span>{t.paymentsTableTitle}</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
              PFMS DBT
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Direct Benefit Transfer (DBT) reconciliation ledger connected with PFMS banking gate & Farmer bank profiles
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search farmer, token, bank, A/C..."
            className="w-full min-h-[40px] pl-9 pr-3 rounded-xl border border-slate-300 text-xs font-semibold focus:border-slate-900 bg-white"
          />
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Settlements</div>
          <div className="text-lg font-black text-slate-900 mt-0.5">{enrichedPayments.length} Payments</div>
        </div>
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Disbursed (Paid)</div>
          <div className="text-lg font-black text-emerald-700 mt-0.5">
            ₹{enrichedPayments.filter(p => p.status === 'paid').reduce((acc, c) => acc + Number(c.amount || 0), 0).toLocaleString('en-IN')}
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">In Process (PFMS)</div>
          <div className="text-lg font-black text-blue-700 mt-0.5">
            {enrichedPayments.filter(p => p.status === 'processing').length} Farmers
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Missing Bank Info</div>
          <div className="text-lg font-black text-amber-600 mt-0.5">
            {enrichedPayments.filter(p => !p.bank_account).length} Records
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-black">
              <tr>
                <th className="py-3 px-4">Pass / Tracking</th>
                <th className="py-3 px-4">Farmer Details</th>
                <th className="py-3 px-4">Farmer Bank Profile</th>
                <th className="py-3 px-4">Amount (₹)</th>
                <th className="py-3 px-4">PFMS Reference</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No payment ledger records found.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const hasBank = Boolean(p.bank_account);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-black text-slate-900">{p.token}</div>
                        <div className="font-mono text-[10px] text-emerald-700 font-bold">{p.tracking_id}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{p.farmer_name}</div>
                        <div className="text-[10px] text-slate-400">
                          {p.crop} {p.farmer_phone ? `• ${p.farmer_phone}` : ''}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {hasBank ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 font-bold text-slate-800 text-[11px]">
                              <Building2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="truncate max-w-[150px]">{p.bank_name || 'Bank Added'}</span>
                            </div>
                            <div className="font-mono text-[10px] text-slate-500 flex items-center gap-1.5">
                              <span>••••{p.bank_account.slice(-4)}</span>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-400">{p.ifsc}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>No Bank Added</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-black text-sm text-slate-900">
                        ₹{Number(p.amount || 113750).toLocaleString('en-IN')}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                        {p.bank_txn_ref || 'Pending UTR'}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                          p.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.status === 'processing'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {p.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentModalBooking(p.booking);
                              setPaymentModalFarmer(p.farmer);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                            title="Inspect & Edit Bank Details or Initiate Payment"
                          >
                            <IndianRupee className="w-3.5 h-3.5" />
                            <span>{hasBank ? 'Bank / Pay' : 'Add Bank & Pay'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPayment(p);
                              setNewStatus(p.status === 'paid' ? 'processing' : 'paid');
                              setBankRef(p.bank_txn_ref || '');
                            }}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xs transition-colors cursor-pointer"
                            title="Quick Status Update"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comprehensive PFMS Payment & Bank Verification Modal */}
      <FarmerPaymentModal
        isOpen={Boolean(paymentModalBooking)}
        onClose={() => {
          setPaymentModalBooking(null);
          setPaymentModalFarmer(null);
        }}
        booking={paymentModalBooking}
        farmer={paymentModalFarmer}
        onSuccess={() => {
          if (onRefresh) onRefresh();
        }}
        lang={lang}
      />

      {/* Quick Status Update Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4 animate-scaleUp">
            <h3 className="text-lg font-black text-slate-900">
              Update PFMS Payment Status
            </h3>
            <p className="text-xs text-slate-500">
              Token {selectedPayment.token} • ₹{Number(selectedPayment.amount).toLocaleString('en-IN')}
            </p>

            <form onSubmit={handleUpdatePayment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Payment Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                >
                  <option value="pending">Pending</option>
                  <option value="processing">Processing in PFMS</option>
                  <option value="paid">Directly Paid to Bank</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Bank UTR / Transaction Ref
                </label>
                <input
                  type="text"
                  value={bankRef}
                  onChange={(e) => setBankRef(e.target.value)}
                  placeholder="e.g. PFMS20260907-991204"
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-mono font-semibold"
                />
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[46px] bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center"
                >
                  {loading ? 'Updating...' : 'Save Payment Status'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPayment(null)}
                  className="w-full min-h-[42px] bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
