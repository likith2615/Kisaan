import React, { useState, useEffect } from 'react';
import { 
  Wheat, 
  TrendingUp, 
  ShieldCheck, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  IndianRupee, 
  Lock, 
  Info,
  Calendar,
  Sparkles,
  Layers
} from 'lucide-react';

export default function AdminMspManager({ crops = [], onRefresh, user }) {
  const [localCrops, setLocalCrops] = useState([]);
  const [loadingCropId, setLoadingCropId] = useState('');
  const [editingRates, setEditingRates] = useState({});
  const [msg, setMsg] = useState({ text: '', type: 'success' });
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (crops && crops.length > 0) {
      setLocalCrops(crops);
      const rates = {};
      crops.forEach(c => {
        rates[c.id] = c.msp_per_quintal;
      });
      setEditingRates(rates);
    }
  }, [crops]);

  const flashMsg = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: 'success' }), 4000);
  };

  const handleRateChange = (cropId, val) => {
    setEditingRates(prev => ({
      ...prev,
      cropId: prev,
      [cropId]: val
    }));
  };

  const handleSaveCropMsp = async (crop) => {
    const newRate = Number(editingRates[crop.id]);
    if (!newRate || newRate <= 0) {
      flashMsg('Please enter a valid positive MSP rate per quintal', 'error');
      return;
    }

    setLoadingCropId(crop.id);
    try {
      const res = await fetch('/api/crops/update-msp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop_id: crop.id,
          msp_per_quintal: newRate,
          updated_by: user?.name ? `${user.name} (${user.id})` : 'ADMIN-OFFICER'
        })
      });

      const data = await res.json();
      if (data.success) {
        flashMsg(`✓ ${data.message || `MSP for ${crop.name} updated to ₹${newRate.toLocaleString('en-IN')}/Qtl`}`);
        if (onRefresh) onRefresh();
      } else {
        flashMsg(data.error || 'Failed to update MSP rate', 'error');
      }
    } catch {
      flashMsg('Server error while updating MSP price', 'error');
    } finally {
      setLoadingCropId('');
    }
  };

  const handleRefreshCrops = async () => {
    setIsRefreshing(true);
    if (onRefresh) await onRefresh();
    setIsRefreshing(false);
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* ── 1. HEADER & POLICY BANNER ── */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Admin Authority Only
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs font-bold text-slate-500">
              Cabinet Committee on Economic Affairs (CCEA) Rates
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1 flex items-center gap-2">
            <Wheat className="w-5 h-5 text-emerald-600" />
            <span>Government Minimum Support Price (MSP) Registry</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Administer state procurement pricing for Andhra Pradesh agricultural commodities. Changes immediately reflect across farmer booking estimations, weighbridge receipts, and direct DBT bank transfers.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefreshCrops}
          disabled={isRefreshing}
          className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer self-start md:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Sync Rates</span>
        </button>
      </div>

      {/* Security notice alert */}
      <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2.5 text-xs text-amber-900 font-semibold">
        <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
        <span>
          <strong>Single Source of Truth:</strong> MSP cannot be modified by farmers or unregistered buyers. Only authorized APMC slot & payment administrators have write access to this registry.
        </span>
      </div>

      {/* Notification Toast */}
      {msg.text && (
        <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn ${
          msg.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
        }`}>
          {msg.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* ── 2. CROP MSP CARDS GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {localCrops.map((crop) => {
          const currentRate = Number(editingRates[crop.id] !== undefined ? editingRates[crop.id] : crop.msp_per_quintal);
          const originalRate = Number(crop.msp_per_quintal);
          const hasChanged = currentRate !== originalRate;
          const isSaving = loadingCropId === crop.id;
          const tractorLoadVal = currentRate * 50; // 50 Quintals standard load

          return (
            <div 
              key={crop.id} 
              className={`bg-white rounded-3xl border p-4 sm:p-5 shadow-sm transition-all flex flex-col justify-between ${
                hasChanged ? 'border-2 border-amber-400 ring-2 ring-amber-400/10' : 'border-slate-200 hover:border-emerald-300'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center font-black text-lg">
                      {crop.name.includes('Paddy') ? '🌾' :
                       crop.name.includes('Wheat') ? '🍞' :
                       crop.name.includes('Maize') ? '🌽' :
                       crop.name.includes('Cotton') ? '☁️' :
                       crop.name.includes('Pulses') ? '🫘' :
                       crop.name.includes('Chilli') ? '🌶️' :
                       crop.name.includes('Groundnut') ? '🥜' : '🌱'}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-sm">{crop.name}</h3>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {crop.season || 'Kharif / Rabi 2026'}
                      </span>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                    Per {crop.unit || 'Quintal'}
                  </span>
                </div>

                {/* MSP Price Input Field */}
                <div className="mt-4 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Official Support Price (₹ / Quintal)
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-slate-400 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      min="100"
                      max="50000"
                      step="1"
                      value={editingRates[crop.id] !== undefined ? editingRates[crop.id] : crop.msp_per_quintal}
                      onChange={(e) => handleRateChange(crop.id, e.target.value)}
                      className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-300 bg-white font-black text-slate-900 text-base outline-none focus:border-emerald-600"
                      placeholder="e.g. 2183"
                    />
                  </div>
                </div>

                {/* Benchmark Value Insight */}
                <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 px-1">
                  <span>Standard 50 Qtl Load:</span>
                  <strong className="text-emerald-700 font-black">
                    ₹{tractorLoadVal.toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleSaveCropMsp(crop)}
                  disabled={isSaving || !hasChanged}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    hasChanged
                      ? 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-md animate-pulse'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isSaving ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{hasChanged ? 'Save & Update MSP' : 'Current Active Rate'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
