import React, { useState } from 'react';
import { User, CheckCircle2, Building2, ArrowRight, MapPin, Wheat, ChevronLeft } from 'lucide-react';

const CROPS = [
  { id: 'Paddy',  label: 'Paddy',  icon: '🌾', msp: 2183 },
  { id: 'Cotton', label: 'Cotton', icon: '☁️', msp: 6620 },
  { id: 'Wheat',  label: 'Wheat',  icon: '🍞', msp: 2275 },
  { id: 'Maize',  label: 'Maize',  icon: '🌽', msp: 2090 },
  { id: 'Pulses', label: 'Pulses', icon: '🫘', msp: 7000 },
  { id: 'Chilli', label: 'Chilli', icon: '🌶️', msp: 5000 },
];

const AP_DISTRICTS = [
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

const STEPS = [
  { num: 1, label: 'Your Profile' },
  { num: 2, label: 'Bank Details' },
];

function StepDots({ step }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.num}>
          <div className={`flex items-center gap-1.5 text-xs font-bold transition-all ${step === s.num ? 'text-emerald-700' : step > s.num ? 'text-emerald-500' : 'text-slate-400'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
              step > s.num  ? 'bg-emerald-600 text-white' :
              step === s.num ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' :
              'bg-slate-200 text-slate-500'
            }`}>
              {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
            </div>
            <span className="hidden sm:inline">{s.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 rounded-full transition-all ${step > s.num ? 'bg-emerald-500' : 'bg-slate-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function Screen3Onboarding({ user, lang, onSaveProfile }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name:        user?.name?.startsWith('Farmer') ? '' : (user?.name || ''),
    phone:       user?.phone || '',
    village:     user?.village || '',
    mandal:      user?.mandal || '',
    district:    user?.district || 'Kurnool',
    crop_type:   user?.crop_type || 'Paddy',
    bank_name:   user?.bank_name || '',
    bank_account: user?.bank_account || '',
    ifsc:        user?.ifsc || '',
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const set = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));

  const goToStep2 = () => {
    if (!formData.name.trim())    { setErrorMsg('Please enter your full name'); return; }
    if (!formData.village.trim()) { setErrorMsg('Please enter your village name'); return; }
    if (!formData.district.trim()){ setErrorMsg('Please enter your district'); return; }
    setErrorMsg('');
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setErrorMsg('');
    try {
      if (user?.id) {
        await fetch(`/api/farmers/${user.id}/update-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (formData.bank_account) {
          await fetch(`/api/farmers/${user.id}/update-bank`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bank_name: formData.bank_name, bank_account: formData.bank_account, ifsc: formData.ifsc }),
          });
        }
      }
      onSaveProfile({ ...user, ...formData });
    } catch {
      onSaveProfile({ ...user, ...formData });
    } finally {
      setLoading(false);
    }
  };

  const selectedCrop = CROPS.find(c => c.id === formData.crop_type);

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 pb-16">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-lg">🌾</div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kisan Saathi</p>
            <h1 className="text-base font-black text-slate-900 leading-none">Complete Registration</h1>
          </div>
        </div>

        {/* Step dots */}
        <StepDots step={step} />

        {/* Error */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium flex gap-2">
            <span>⚠️</span><span>{errorMsg}</span>
          </div>
        )}

        {/* ── STEP 1: Profile ── */}
        {step === 1 && (
          <div className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  autoFocus
                  value={formData.name}
                  onChange={(e) => { set('name', e.target.value); setErrorMsg(''); }}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full min-h-[52px] pl-11 pr-4 rounded-2xl border-2 border-slate-200 text-base font-semibold text-slate-900 placeholder:text-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Location *
              </label>
              <div className="space-y-2">
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={formData.village}
                    onChange={(e) => { set('village', e.target.value); setErrorMsg(''); }}
                    placeholder="Village name *"
                    className="w-full min-h-[48px] pl-11 pr-4 rounded-2xl border-2 border-slate-200 text-sm font-semibold text-slate-900 placeholder:text-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={formData.mandal}
                    onChange={(e) => set('mandal', e.target.value)}
                    placeholder="Mandal (optional)"
                    className="w-full min-h-[48px] px-4 rounded-2xl border-2 border-slate-200 text-sm font-semibold text-slate-900 placeholder:text-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                  />
                  <select
                    value={formData.district}
                    onChange={(e) => { set('district', e.target.value); setErrorMsg(''); }}
                    className="w-full min-h-[48px] px-3 rounded-2xl border-2 border-slate-200 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none bg-white transition-all"
                  >
                    {AP_DISTRICTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Crop selection */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Primary Crop *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {CROPS.map((c) => {
                  const selected = formData.crop_type === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => set('crop_type', c.id)}
                      className={`relative flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-2xl border-2 text-center transition-all ${
                        selected
                          ? 'border-emerald-500 bg-emerald-50 shadow-sm shadow-emerald-100'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {selected && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <span className="text-2xl">{c.icon}</span>
                      <span className={`text-xs font-bold ${selected ? 'text-emerald-900' : 'text-slate-700'}`}>{c.label}</span>
                      <span className="text-[9px] font-semibold text-slate-400">₹{c.msp.toLocaleString('en-IN')}/qtl</span>
                    </button>
                  );
                })}
              </div>
              {selectedCrop && (
                <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  <span>{selectedCrop.icon}</span>
                  <span>MSP for {selectedCrop.label}: ₹{selectedCrop.msp.toLocaleString('en-IN')} per quintal</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={goToStep2}
              className="w-full min-h-[54px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-base font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
            >
              <span>Continue to Bank Details</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* ── STEP 2: Bank Details ── */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Why we need this */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">💳</span>
                <div>
                  <p className="text-sm font-bold text-blue-900">Why do we need this?</p>
                  <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                    After your crops are weighed at the mandi, MSP payment is sent directly 
                    to this bank account. No middleman, no cash.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Bank Name
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={formData.bank_name}
                  onChange={(e) => set('bank_name', e.target.value)}
                  placeholder="e.g. State Bank of India"
                  className="w-full min-h-[52px] pl-11 pr-4 rounded-2xl border-2 border-slate-200 text-sm font-semibold text-slate-900 placeholder:text-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Account Number
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formData.bank_account}
                onChange={(e) => set('bank_account', e.target.value.replace(/\D/g, ''))}
                placeholder="Enter account number"
                className="w-full min-h-[52px] px-4 rounded-2xl border-2 border-slate-200 font-mono text-base font-bold text-slate-900 placeholder:text-slate-300 placeholder:font-sans focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all tracking-widest"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                IFSC Code
              </label>
              <input
                type="text"
                value={formData.ifsc}
                onChange={(e) => set('ifsc', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="e.g. SBIN0001234"
                maxLength={11}
                className="w-full min-h-[52px] px-4 rounded-2xl border-2 border-slate-200 font-mono text-base font-bold text-slate-900 placeholder:text-slate-300 placeholder:font-sans focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all tracking-widest"
              />
              <p className="text-xs text-slate-400 mt-1.5 pl-1">First 4 letters: bank code · Next digit: 0 · Last 6: branch code</p>
            </div>

            {/* Skip note */}
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-200">
              <span>💡</span>
              <span>Bank details can also be added later from your profile page.</span>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 px-5 min-h-[52px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-sm transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 min-h-[52px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
              >
                {loading
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : (<><CheckCircle2 className="w-5 h-5" /><span>Complete Registration</span></>)
                }
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
