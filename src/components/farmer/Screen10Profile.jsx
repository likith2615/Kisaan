import React, { useState } from 'react';
import { 
  User, 
  Star, 
  MapPin, 
  Phone, 
  LogOut, 
  ArrowLeft, 
  History, 
  PlusCircle, 
  MinusCircle, 
  Edit3, 
  Check, 
  Save,
  Building2,
  CheckCircle2
} from 'lucide-react';
import { translations } from '../../translations';

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

const CROPS = ['Paddy', 'Cotton', 'Wheat', 'Maize', 'Pulses', 'Chilli'];

export default function Screen10Profile({ 
  user, 
  lang, 
  pointsLedger = [], 
  onUpdateProfile, 
  onLogout, 
  onBack 
}) {
  const t = translations[lang] || translations.en;

  const points = Number(user?.points || 100);
  const isHighPriority = points >= 100;

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const [formData, setFormData] = useState({
    name: user?.name || '',
    village: user?.village || '',
    mandal: user?.mandal || '',
    district: user?.district || 'Kurnool',
    crop_type: user?.crop_type || 'Paddy',
    bank_name: user?.bank_name || '',
    bank_account: user?.bank_account || '',
    ifsc: user?.ifsc || ''
  });

  const handleSave = async () => {
    setLoading(true);
    setSuccessMsg('');
    try {
      if (user?.id) {
        await fetch(`/api/farmers/${user.id}/update-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        if (formData.bank_account) {
          await fetch(`/api/farmers/${user.id}/update-bank`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bank_name: formData.bank_name,
              bank_account: formData.bank_account,
              ifsc: formData.ifsc
            })
          });
        }
      }
      if (onUpdateProfile) onUpdateProfile({ ...user, ...formData });
      setIsEditing(false);
      setSuccessMsg('Profile & bank details successfully updated!');
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch {
      if (onUpdateProfile) onUpdateProfile({ ...user, ...formData });
      setIsEditing(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-lg lg:max-w-2xl mx-auto w-full space-y-4 animate-fadeIn pb-28">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <h1 className="text-lg sm:text-xl font-black text-slate-900">
          Farmer Profile & Bank
        </h1>

        <button
          type="button"
          onClick={onLogout}
          className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 active:scale-95 cursor-pointer"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 1. Farmer Profile Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-white font-black text-xl flex items-center justify-center">
              {user?.name?.charAt(0) || 'K'}
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">{user?.name || 'Farmer'}</h2>
              <div className="text-xs text-slate-500 font-medium">+91 {user?.phone}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Cancel' : 'Edit Profile'}</span>
          </button>
        </div>

        {isEditing ? (
          <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-sm font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Village</label>
                <input
                  type="text"
                  value={formData.village}
                  onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-sm font-semibold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Mandal</label>
                <input
                  type="text"
                  value={formData.mandal}
                  onChange={(e) => setFormData({ ...formData, mandal: e.target.value })}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-sm font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">District (AP)</label>
                <select
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                >
                  {AP_DISTRICTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Primary Crop</label>
                <select
                  value={formData.crop_type}
                  onChange={(e) => setFormData({ ...formData, crop_type: e.target.value })}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                >
                  {CROPS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bank details edit section */}
            <div className="pt-2 border-t border-slate-100 space-y-2.5">
              <span className="font-black text-slate-800 uppercase tracking-wider text-[11px] block">
                Bank Details (For MSP Payments)
              </span>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Bank Name</label>
                <input
                  type="text"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  placeholder="e.g. State Bank of India"
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Account Number</label>
                  <input
                    type="text"
                    value={formData.bank_account}
                    onChange={(e) => setFormData({ ...formData, bank_account: e.target.value.replace(/\D/g, '') })}
                    placeholder="Account Number"
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 font-mono text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={formData.ifsc}
                    onChange={(e) => setFormData({ ...formData, ifsc: e.target.value.toUpperCase() })}
                    placeholder="e.g. SBIN0001234"
                    maxLength={11}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 font-mono text-xs font-semibold"
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="w-full min-h-[48px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 shadow-sm cursor-pointer mt-3"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Profile & Bank Details</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
            <div>
              <span className="text-slate-400">Village:</span>
              <div className="font-bold text-slate-800">{user?.village || 'Not set'}</div>
            </div>
            <div>
              <span className="text-slate-400">District:</span>
              <div className="font-bold text-slate-800">{user?.district || 'Kurnool'}</div>
            </div>
            <div>
              <span className="text-slate-400">Primary Crop:</span>
              <div className="font-bold text-slate-800">{user?.crop_type || 'Paddy'}</div>
            </div>
            <div>
              <span className="text-slate-400">Mandal:</span>
              <div className="font-bold text-slate-800">{user?.mandal || 'Not set'}</div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Registered Bank Account Card */}
      {!isEditing && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>Direct Benefit Transfer (DBT) Bank Account</span>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
            >
              Edit
            </button>
          </div>

          {user?.bank_account ? (
            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-3.5 space-y-1 text-xs">
              <div className="font-black text-slate-900 text-sm">{user.bank_name || 'Registered Bank'}</div>
              <div className="font-mono text-slate-700">Account: ••••••••{user.bank_account.slice(-4)}</div>
              <div className="font-mono text-slate-500 text-[11px]">IFSC: {user.ifsc || 'SBIN0001234'}</div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-800 flex items-center justify-between">
              <span>No bank account registered yet.</span>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="font-bold underline text-amber-900 ml-2 cursor-pointer"
              >
                Add Bank Account ➔
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. Reliability Score Hero */}
      <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-white rounded-3xl p-5 shadow-lg space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-6 h-6 fill-white text-white" />
            <span className="text-xs font-bold uppercase tracking-wider">{t.reliabilityTitle}</span>
          </div>
          <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-black">
            {isHighPriority ? t.highPriorityBadge : t.standardPriorityBadge}
          </span>
        </div>

        <div className="text-4xl sm:text-5xl font-black tracking-tight">
          {points} <span className="text-lg font-bold">Points</span>
        </div>

        <p className="text-xs text-amber-100 leading-relaxed pt-1">
          {t.priorityDesc}
        </p>
      </div>

      {/* 4. Points Ledger History */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <History className="w-4 h-4 text-emerald-600" />
          <span>{t.pointsLedgerTitle}</span>
        </div>

        {pointsLedger.length === 0 ? (
          <div className="text-xs text-slate-400 py-3 text-center">
            No score ledger history recorded yet.
          </div>
        ) : (
          <div className="space-y-2.5">
            {pointsLedger.map((pl, idx) => {
              const isPositive = Number(pl.delta) >= 0;
              return (
                <div
                  key={pl.id || idx}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    {isPositive ? (
                      <PlusCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <MinusCircle className="w-4 h-4 text-red-600 shrink-0" />
                    )}
                    <div>
                      <div className="text-xs font-bold text-slate-900">{pl.reason}</div>
                      <div className="text-[10px] text-slate-400">
                        {pl.created_at ? new Date(pl.created_at).toLocaleDateString('en-IN') : 'Recent'}
                      </div>
                    </div>
                  </div>

                  <span className={`text-xs font-black ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}>
                    {isPositive ? `+${pl.delta}` : pl.delta}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
