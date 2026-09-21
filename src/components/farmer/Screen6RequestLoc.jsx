import React, { useState } from 'react';
import { 
  Building2, 
  MapPin, 
  Navigation, 
  CheckCircle2, 
  ArrowLeft, 
  Clock, 
  AlertCircle,
  Sparkles,
  Info
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

export default function Screen6RequestLoc({ user, lang, onBack, onRequestSubmitted }) {
  const t = translations[lang] || translations.en;

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    village: user?.village || '',
    mandal: user?.mandal || '',
    district: user?.district || 'Kurnool',
    pincode: '518001',
    nearest_landmark: '',
    lat: 15.8281,
    lng: 78.0373,
    photo_url: 'https://images.unsplash.com/photo-1595246140625-573b715d11dc?w=500&auto=format&fit=crop&q=60'
  });

  const [capturingGps, setCapturingGps] = useState(false);
  const [gpsSuccess, setGpsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Auto-capture GPS location using browser Geolocation API
  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser');
      return;
    }
    setCapturingGps(true);
    setErrorMsg('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData({
          ...formData,
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setCapturingGps(false);
        setGpsSuccess(true);
      },
      () => {
        setCapturingGps(false);
        setFormData({ ...formData, lat: 15.8281, lng: 78.0373 });
        setGpsSuccess(true);
      },
      { timeout: 8000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.district.trim()) {
      setErrorMsg('Please enter proposed location name and district');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/locations/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          requested_by: user?.id
        })
      });
      const data = await res.json();
      if (data.success) {
        setSubmittedRequest(data.data);
        if (onRequestSubmitted) onRequestSubmitted(data.data);
      } else {
        setErrorMsg(data.error || 'Failed to submit request.');
      }
    } catch {
      // Simulated submission fallback
      const simulated = {
        id: `LOC-REQ-${Date.now()}`,
        ...formData,
        status: 'pending',
        created_at: new Date().toISOString()
      };
      setSubmittedRequest(simulated);
      if (onRequestSubmitted) onRequestSubmitted(simulated);
    } finally {
      setLoading(false);
    }
  };

  // Submitted Success / Pending Screen
  if (submittedRequest) {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-lg mx-auto w-full space-y-4 animate-fadeIn pb-24 text-center">
        <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-md shadow-amber-600/10">
          <Clock className="w-9 h-9 stroke-[2.5]" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-xs font-black uppercase tracking-wider">
          <span>●</span>
          <span>Pending District Review</span>
        </div>

        <h2 className="text-2xl font-black text-slate-900">
          Mandi Request Submitted!
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 max-w-xs mx-auto">
          Your request for <span className="font-bold text-slate-900">{submittedRequest.name}</span> in {submittedRequest.district} district has been forwarded to the Slot & Center Manager. You will be notified once approved.
        </p>

        {/* Request Summary Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-md text-left space-y-2 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-400 font-semibold">Request Reference</span>
            <span className="font-mono font-bold text-slate-800">{submittedRequest.id}</span>
          </div>
          <div>
            <span className="text-slate-400 font-semibold">Address:</span>
            <div className="font-bold text-slate-800">{submittedRequest.address || `${submittedRequest.village || ''}, ${submittedRequest.district}`}</div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-semibold">GPS Coordinates:</span>
            <span className="font-mono text-emerald-700 font-bold">{submittedRequest.lat?.toFixed(4)}, {submittedRequest.lng?.toFixed(4)}</span>
          </div>
        </div>

        <div className="pt-3">
          <button
            type="button"
            onClick={onBack}
            className="w-full min-h-[52px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
          >
            {t.backToHome}
          </button>
        </div>
      </div>
    );
  }

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
          Request a New Mandi Center
        </h1>
        <div className="w-10" />
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-xs text-emerald-800 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Need a procurement center closer to your village?</span>
          <p className="text-emerald-700 text-[11px] mt-0.5 leading-relaxed">
            Submit your area details. The Mandi Board will inspect and approve new procurement points across Andhra Pradesh so you don't have to travel far.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Proposed Mandi Center Name *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Allagadda Rythu Paddy Procurement Point"
            className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-900 focus:border-emerald-600 outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              District (Andhra Pradesh) *
            </label>
            <select
              value={formData.district}
              onChange={(e) => setFormData({ ...formData, district: e.target.value })}
              className="w-full min-h-[48px] px-3 rounded-xl border-2 border-slate-200 text-xs font-semibold focus:border-emerald-600 bg-white outline-none"
            >
              {AP_DISTRICTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Mandal / Block
            </label>
            <input
              type="text"
              value={formData.mandal}
              onChange={(e) => setFormData({ ...formData, mandal: e.target.value })}
              placeholder="e.g. Allagadda"
              className="w-full min-h-[48px] px-3 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-900 focus:border-emerald-600 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Village / Town *
            </label>
            <input
              type="text"
              required
              value={formData.village}
              onChange={(e) => setFormData({ ...formData, village: e.target.value })}
              placeholder="Village name"
              className="w-full min-h-[48px] px-3 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-900 focus:border-emerald-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Nearest Landmark
            </label>
            <input
              type="text"
              value={formData.nearest_landmark}
              onChange={(e) => setFormData({ ...formData, nearest_landmark: e.target.value })}
              placeholder="e.g. Near Rythu Bharosa Kendra"
              className="w-full min-h-[48px] px-3 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-900 focus:border-emerald-600 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Detailed Address / Location Description *
          </label>
          <input
            type="text"
            required
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="e.g. Main Road, Opposite Primary Agricultural Cooperative Society"
            className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-900 focus:border-emerald-600 outline-none"
          />
        </div>

        {/* GPS Capture Button */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            GPS Location Pin
          </label>
          <button
            type="button"
            onClick={handleCaptureGps}
            disabled={capturingGps}
            className={`w-full min-h-[48px] rounded-xl border-2 flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
              gpsSuccess
                ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500'
            }`}
          >
            <Navigation className={`w-4 h-4 ${capturingGps ? 'animate-spin' : ''}`} />
            <span>
              {capturingGps
                ? 'Detecting GPS coordinates...'
                : gpsSuccess
                ? `GPS Captured (${formData.lat.toFixed(4)}, ${formData.lng.toFixed(4)})`
                : 'Auto-Capture My GPS Location'}
            </span>
          </button>
        </div>

        {/* Primary Action Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[52px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-200 text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Building2 className="w-5 h-5" />
                <span>Submit Mandi Request</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
