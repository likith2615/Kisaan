import React, { useState, useEffect } from 'react';
import { 
  IndianRupee, 
  Building2, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  CreditCard, 
  User, 
  Phone, 
  MapPin, 
  Scale, 
  Edit3, 
  Save, 
  Check, 
  Clock, 
  ShieldCheck,
  Send
} from 'lucide-react';
import { translations } from '../../translations';

const POPULAR_BANKS = [
  'State Bank of India (SBI)',
  'Andhra Pragathi Grameena Bank (APGB)',
  'Chaitanya Godavari Grameena Bank',
  'Union Bank of India',
  'Canara Bank',
  'Punjab National Bank',
  'Bank of Baroda',
  'HDFC Bank',
  'ICICI Bank'
];

export default function FarmerPaymentModal({
  isOpen,
  onClose,
  booking,
  farmer: propFarmer,
  onSuccess,
  lang = 'te'
}) {
  const t = translations[lang] || translations.en;

  const [farmer, setFarmer] = useState(propFarmer || booking?.farmer || null);
  const [loadingFarmer, setLoadingFarmer] = useState(false);

  // Bank details form state
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [bankAccount, setBankAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [savingBank, setSavingBank] = useState(false);
  const [bankSaveSuccess, setBankSaveSuccess] = useState(false);

  // Weighment & MSP calculation state
  const [actualQuantity, setActualQuantity] = useState(50);
  const [qualityGrade, setQualityGrade] = useState('Grade A Superfine');
  const [ratePerQuintal, setRatePerQuintal] = useState(2369);

  // Payment transaction state
  const [paymentStatus, setPaymentStatus] = useState('processing');
  const [bankTxnRef, setBankTxnRef] = useState('');
  const [initiating, setInitiating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Sync initial state when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg('');
    setSuccessMsg('');
    setBankSaveSuccess(false);

    const initialQty = Number(booking?.actual_quantity || booking?.expected_quantity) || 50;
    setActualQuantity(initialQty);

    const grade = booking?.quality_grade || 'Grade A Superfine';
    setQualityGrade(grade);
    setRatePerQuintal(grade.includes('Grade A') ? 2369 : 2320);

    const ref = booking?.payment?.bank_txn_ref || `PFMS${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`;
    setBankTxnRef(ref);

    const currentStatus = booking?.payment?.status || (booking?.status === 'completed' ? 'paid' : 'processing');
    setPaymentStatus(currentStatus);

    // Load full farmer profile if needed
    const f = propFarmer || booking?.farmer;
    if (f) {
      setFarmer(f);
      setBankAccount(f.bank_account || '');
      setIfsc(f.ifsc || '');
      setBankName(f.bank_name || 'State Bank of India (SBI)');
      setIsEditingBank(!f.bank_account);
    } else if (booking?.farmer_id) {
      setLoadingFarmer(true);
      fetch(`/api/farmers/${booking.farmer_id}`)
        .then(r => r.json())
        .then(d => {
          if (d.success && d.data) {
            setFarmer(d.data);
            setBankAccount(d.data.bank_account || '');
            setIfsc(d.data.ifsc || '');
            setBankName(d.data.bank_name || 'State Bank of India (SBI)');
            setIsEditingBank(!d.data.bank_account);
          }
        })
        .catch(console.warn)
        .finally(() => setLoadingFarmer(false));
    }
  }, [isOpen, booking, propFarmer]);

  // Handle grade change and update rate
  const handleGradeChange = (newGrade) => {
    setQualityGrade(newGrade);
    const newRate = newGrade.includes('Grade A') ? 2369 : 2320;
    setRatePerQuintal(newRate);
  };

  const calculatedTotal = actualQuantity * ratePerQuintal;

  // Save/Update Bank Details to Farmer Profile
  const handleSaveBankDetails = async (e) => {
    if (e) e.preventDefault();
    if (!bankAccount.trim()) {
      setErrorMsg('Please enter a valid Bank Account Number');
      return;
    }
    if (!ifsc.trim()) {
      setErrorMsg('Please enter a valid Bank IFSC Code');
      return;
    }

    const farmerId = farmer?.id || booking?.farmer_id;
    if (!farmerId) return;

    setSavingBank(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/farmers/${farmerId}/bank-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bank_account: bankAccount.trim(),
          ifsc: ifsc.trim().toUpperCase(),
          bank_name: bankName.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setFarmer(data.data);
        setBankSaveSuccess(true);
        setIsEditingBank(false);
        setTimeout(() => setBankSaveSuccess(false), 3000);
      } else {
        setErrorMsg(data.error || 'Failed to save bank details');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSavingBank(false);
    }
  };

  // Initiate PFMS Payment & Finalize Procurement
  const handleInitiatePayment = async () => {
    if (!bankAccount.trim() && !farmer?.bank_account) {
      setErrorMsg('Cannot initiate payment without Farmer Bank Details. Please add and save bank account details above.');
      setIsEditingBank(true);
      return;
    }

    setInitiating(true);
    setErrorMsg('');
    try {
      const endpoint = booking?.status === 'completed' 
        ? '/api/payments/initiate'
        : '/api/queue/complete';

      const payload = {
        booking_id: booking.id,
        farmer_id: farmer?.id || booking.farmer_id,
        actual_quantity: actualQuantity,
        quality_grade: qualityGrade,
        rate_per_quintal: ratePerQuintal,
        amount: calculatedTotal,
        bank_account: bankAccount.trim() || farmer?.bank_account,
        ifsc: ifsc.trim().toUpperCase() || farmer?.ifsc,
        bank_name: bankName.trim() || farmer?.bank_name,
        payment_status: paymentStatus,
        bank_txn_ref: bankTxnRef
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`PFMS Payment of ₹${calculatedTotal.toLocaleString('en-IN')} initiated successfully! SMS and App notification dispatched.`);
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 1200);
      } else {
        setErrorMsg(data.error || 'Payment initiation failed');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setInitiating(false);
    }
  };

  if (!isOpen || !booking) return null;

  const hasExistingBank = Boolean(farmer?.bank_account);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] animate-scaleUp">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/30 border border-emerald-400/40 text-emerald-400 flex items-center justify-center font-black">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">
                  PFMS DBT Settlement & Bank Verification
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30">
                  {booking.token_number || booking.id}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Direct Benefit Transfer (DBT) via National Public Financial Management System
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          
          {/* Notifications / Alerts */}
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Section 1: Farmer Profile & Identity */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                {farmer?.name?.charAt(0) || 'F'}
              </div>
              <div>
                <div className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                  <span>{farmer?.name || booking.farmer_name || 'Registered Farmer'}</span>
                  {farmer?.status === 'Verified' && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-md font-bold">
                      Verified
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {farmer?.phone || 'Mobile N/A'}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {farmer?.village || 'Village'}, {farmer?.district || 'District'}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Farmer ID</span>
              <span className="font-mono text-xs font-bold text-slate-700">{farmer?.id || booking.farmer_id}</span>
            </div>
          </div>

          {/* Section 2: Farmer Bank Account Details (View or Edit) */}
          <div className="border border-slate-200 rounded-3xl p-4 bg-white shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-700" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Farmer DBT Bank Account Details
                </h4>
              </div>

              {hasExistingBank && !isEditingBank && (
                <button
                  type="button"
                  onClick={() => setIsEditingBank(true)}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Update Bank Details</span>
                </button>
              )}
            </div>

            {/* If bank account exists and not editing: Show verified card */}
            {hasExistingBank && !isEditingBank ? (
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50/70 to-slate-50 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900">
                      {farmer.bank_name || bankName || 'Public Sector Bank'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-200/60 text-emerald-900 text-[10px] font-black flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-700" />
                      PFMS DBT Linked
                    </span>
                  </div>
                  <div className="font-mono text-sm font-black text-slate-800 tracking-wider">
                    A/C: {farmer.bank_account}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono flex items-center gap-3">
                    <span>IFSC: <strong className="text-slate-800">{farmer.ifsc || 'SBIN0001234'}</strong></span>
                    {farmer.aadhaar && (
                      <span>Aadhaar: <strong className="text-slate-800">•••• {farmer.aadhaar.slice(-4)}</strong></span>
                    )}
                  </div>
                </div>

                <div className="text-right sm:text-right shrink-0">
                  <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100/80 px-2.5 py-1 rounded-xl border border-emerald-300 flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-700" />
                    Ready for Disbursal
                  </span>
                </div>
              </div>
            ) : (
              /* If bank account is missing or being edited: Show inputs */
              <div className="space-y-3 bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200">
                {!hasExistingBank && (
                  <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Bank details missing in farmer profile. Add bank account & IFSC to enable PFMS transfer:</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Bank Name *
                    </label>
                    <input
                      type="text"
                      list="bank-suggestions"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. State Bank of India"
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs font-semibold bg-white focus:border-emerald-600"
                    />
                    <datalist id="bank-suggestions">
                      {POPULAR_BANKS.map((b) => (
                        <option key={b} value={b} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Account Number *
                    </label>
                    <input
                      type="text"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 11-16 digit A/C number"
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs font-mono font-bold bg-white focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      IFSC Code *
                    </label>
                    <input
                      type="text"
                      value={ifsc}
                      onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                      placeholder="e.g. SBIN0001234"
                      maxLength={11}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs font-mono font-bold uppercase bg-white focus:border-emerald-600"
                    />
                  </div>

                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      disabled={savingBank || !bankAccount.trim() || !ifsc.trim()}
                      onClick={handleSaveBankDetails}
                      className="w-full min-h-[40px] px-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingBank ? 'Saving...' : 'Save Bank Details to Profile'}</span>
                    </button>
                    {hasExistingBank && (
                      <button
                        type="button"
                        onClick={() => setIsEditingBank(false)}
                        className="min-h-[40px] px-3 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {bankSaveSuccess && (
                  <div className="text-emerald-700 text-xs font-bold flex items-center gap-1 animate-fadeIn">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Bank details saved to farmer profile in real-time!</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Weighment & MSP Rate Breakdown */}
          <div className="border border-slate-200 rounded-3xl p-4 bg-white shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-emerald-700" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Certified Grain Weighment & MSP Rate
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Certified Net Qty (Quintals) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={actualQuantity}
                  onChange={(e) => setActualQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs font-black bg-white focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Quality Grade *
                </label>
                <select
                  value={qualityGrade}
                  onChange={(e) => handleGradeChange(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:border-emerald-600"
                >
                  <option value="Grade A Superfine">Grade A Superfine (MSP ₹2,369/Q)</option>
                  <option value="Common Standard">Common Standard (MSP ₹2,320/Q)</option>
                  <option value="Fair Average Quality (FAQ)">FAQ Standard (MSP ₹2,320/Q)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Effective MSP Rate
                </label>
                <div className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-black text-slate-800 flex items-center">
                  ₹{ratePerQuintal.toLocaleString('en-IN')} / Quintal
                </div>
              </div>
            </div>

            {/* Total Payable Summary Banner */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-900 text-white flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-200 block">
                  Total Direct Benefit Transfer (DBT) Amount
                </span>
                <span className="text-[11px] text-emerald-100">
                  {actualQuantity} Qtl × ₹{ratePerQuintal}/Qtl
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white">
                ₹{calculatedTotal.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Section 4: PFMS Transaction Parameters */}
          <div className="border border-slate-200 rounded-3xl p-4 bg-white shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-700" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                PFMS Gateway & Transaction Reference
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  PFMS Transaction Reference / UTR
                </label>
                <input
                  type="text"
                  value={bankTxnRef}
                  onChange={(e) => setBankTxnRef(e.target.value)}
                  placeholder="PFMS20260908-XXXXXX"
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs font-mono font-bold bg-white focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Payment Status to Set
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:border-emerald-600"
                >
                  <option value="processing">Processing (PFMS Queue Dispatched)</option>
                  <option value="paid">Directly Paid / Settled (Bank Confirmed)</option>
                  <option value="pending">Pending Admin Authorization</option>
                </select>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Govt of India DBT portal protocol • Awards +20 reliability points</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={initiating}
              className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer w-1/3 sm:w-auto"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={initiating || (!hasExistingBank && !bankAccount.trim())}
              onClick={handleInitiatePayment}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {initiating 
                  ? 'Processing Settlement...' 
                  : `Initiate PFMS Payment (₹${calculatedTotal.toLocaleString('en-IN')})`}
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
