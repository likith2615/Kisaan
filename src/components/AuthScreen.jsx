import React, { useState, useEffect } from 'react';
import {
  Phone, ShieldCheck, ArrowRight, Lock, User,
  Building2, Wheat, CheckCircle2, Download, Smartphone, X
} from 'lucide-react';

// PWA Install hook
function usePWAInstall() {
  const [prompt, setPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    if (isStandalone) { setIsInstalled(true); return; }
    const handler = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setIsInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!prompt) return false;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') { setPrompt(null); return true; }
    return false;
  };

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  return { prompt, isInstalled, isIOS, install };
}

export default function AuthScreen({ onLoginSuccess, defaultMode = 'farmer' }) {
  const [mode, setMode] = useState(defaultMode);

  // Farmer state
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [demoOtp, setDemoOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Admin state
  const [adminId, setAdminId] = useState('');
  const [adminPass, setAdminPass] = useState('');

  // PWA
  const { prompt, isInstalled, isIOS, install } = usePWAInstall();
  const [iosBanner, setIosBanner] = useState(false);
  const [installDone, setInstallDone] = useState(false);

  useEffect(() => {
    if (isIOS && !isInstalled && !localStorage.getItem('ios_banner_dismissed')) {
      setTimeout(() => setIosBanner(true), 1500);
    }
  }, [isIOS, isInstalled]);

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  const handleInstall = async () => {
    const ok = await install();
    if (ok) setInstallDone(true);
  };

  const handleSendOtp = async (e) => {
    e?.preventDefault();
    if (!phone || phone.length < 10) { setError('Enter a valid 10-digit mobile number'); return; }
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: phone.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        setDemoOtp(data.demo_otp || '4829');
        setOtp(data.demo_otp || '4829');
      } else {
        setError(data.error || 'Could not send OTP. Try again.');
      }
    } catch {
      setOtpSent(true); setDemoOtp('4829'); setOtp('4829');
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    if (!otp || otp.length < 4) { setError('Enter the 4-digit OTP'); return; }
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: phone.trim(), otp: otp.trim(), language_preference: 'en' })
      });
      const data = await res.json();
      if (data.success) {
        onLoginSuccess(data.user, 'farmer');
      } else {
        setError(data.error || 'Invalid OTP. Please try again.');
      }
    } catch {
      onLoginSuccess({
        id: `FARM-${phone.slice(-4)}`,
        name: `Farmer (${phone.slice(-4)})`,
        phone, district: 'Kurnool', village: '', mandal: '', crop_type: 'Paddy', points: 100
      }, 'farmer');
    } finally { setLoading(false); }
  };

  const handleAdminLogin = async (e) => {
    e?.preventDefault();
    if (!adminId || !adminPass) { setError('Enter your Employee ID and Password'); return; }
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: adminId.trim(), password: adminPass })
      });
      const data = await res.json();
      if (data.success) {
        onLoginSuccess(data.user, 'admin');
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch {
      setError('Cannot reach server. Check your connection.');
    } finally { setLoading(false); }
  };

  const switchMode = (m) => {
    setMode(m); setError('');
    setPhone(''); setOtp(''); setOtpSent(false); setDemoOtp('');
    setAdminId(''); setAdminPass('');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* iOS Install Banner */}
      {iosBanner && (
        <div className="bg-slate-900 text-white px-4 py-3 flex items-start gap-3 shrink-0">
          <Smartphone className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-bold">Install as App on iPhone / iPad</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tap the <strong className="text-white">Share</strong> button at the bottom of Safari, then tap <strong className="text-white">"Add to Home Screen"</strong>
            </p>
          </div>
          <button onClick={() => { setIosBanner(false); localStorage.setItem('ios_banner_dismissed', 'true'); }} className="text-slate-400 hover:text-white mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row flex-1 min-h-0">

        {/* ── LEFT HERO PANEL — Beautiful Agriculture Imagery ── */}
        <div className="auth-hero-bg text-white lg:w-[48%] flex flex-col justify-between p-8 sm:p-12 lg:p-16 relative overflow-hidden min-h-[300px] lg:min-h-0">
          {/* Gradient overlay — nav to deep green */}
          <div className="absolute inset-0 overlay-emerald" />

          {/* Subtle dot pattern */}
          <div className="absolute inset-0 gov-dot-bg opacity-20" />

          {/* Top: Logo + badge */}
          <div className="relative z-10">
            {/* Tiranga accent */}
            <div className="flex items-center gap-1 mb-8">
              <div className="h-1 w-10 rounded-full bg-[#FF9933]" />
              <div className="h-1 w-10 rounded-full bg-white" />
              <div className="h-1 w-10 rounded-full bg-[#138808]" />
            </div>

            <div className="flex items-center gap-3.5 mb-7">
              <div className="w-14 h-14 rounded-2xl glass-card flex items-center justify-center text-3xl shrink-0 shadow-lg">
                🌾
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight leading-none drop-shadow">Kisan Saathi</h1>
                <p className="text-emerald-200 text-xs mt-1 font-semibold">Government Farmer Procurement Portal</p>
              </div>
            </div>

            <h2 className="text-3xl sm:text-4xl font-black leading-tight mb-4 drop-shadow-lg">
              Book your slot.<br />
              <span className="text-amber-300">Get paid directly.</span>
            </h2>
            <p className="text-emerald-100 text-sm leading-relaxed max-w-sm">
              Register once with your mobile number. Book a procurement slot at your nearest mandi.
              Receive MSP payment directly — no middlemen, no delays.
            </p>
          </div>

          {/* Middle: Feature pills */}
          <div className="relative z-10 my-8 space-y-2.5">
            {[
              { icon: '📅', text: 'Book slots at any mandi center' },
              { icon: '🎫', text: 'Get digital token & arrival time' },
              { icon: '⚖️', text: 'Certified weighment at mandi' },
              { icon: '💳', text: 'MSP payment directly to your bank' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 glass-card rounded-2xl px-4 py-3">
                <span className="text-xl">{f.icon}</span>
                <span className="text-sm font-semibold text-white">{f.text}</span>
                <span className="ml-auto text-emerald-300 text-xs font-bold">✓</span>
              </div>
            ))}
          </div>

          {/* Bottom: Install CTA + Ministry credit */}
          <div className="relative z-10">
            {installDone ? (
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
                <CheckCircle2 className="w-5 h-5" /> App installed successfully!
              </div>
            ) : prompt && !isInstalled ? (
              <button
                onClick={handleInstall}
                className="flex items-center gap-2.5 bg-white text-emerald-800 font-black text-sm px-5 py-3 rounded-2xl shadow-xl hover:bg-emerald-50 transition-all active:scale-95"
              >
                <Download className="w-5 h-5 text-emerald-600" />
                Install as Mobile App
              </button>
            ) : isInstalled ? (
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
                <CheckCircle2 className="w-5 h-5" /> App installed ✓
              </div>
            ) : null}

            <p className="text-emerald-400 text-[11px] mt-4 font-medium">
              Ministry of Agriculture, Farmers Welfare & Food Corporation of India · Govt. of India
            </p>
          </div>
        </div>

        {/* ── RIGHT FORM PANEL ── */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 bg-white relative overflow-y-auto">

          {/* Subtle background pattern */}
          <div className="absolute inset-0 gov-watermark-bg opacity-50 pointer-events-none" />

          <div className="relative w-full max-w-sm z-10">

            {/* Mode toggle */}
            <div className="flex rounded-2xl border-2 border-slate-100 bg-slate-50 p-1 mb-8 shadow-inner-sm">
              <button
                type="button"
                onClick={() => switchMode('farmer')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  mode === 'farmer'
                    ? 'bg-white text-emerald-700 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Wheat className="w-4 h-4" />
                Farmer Login
              </button>
              <button
                type="button"
                onClick={() => switchMode('admin')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  mode === 'admin'
                    ? 'bg-white text-gov-navy shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Building2 className="w-4 h-4" />
                Admin Login
              </button>
            </div>

            {/* ── FARMER SECTION ── */}
            {mode === 'farmer' && (
              <div className="animate-fadeIn">
                <div className="mb-7">
                  <h2 className="text-2xl font-black text-slate-900">
                    {otpSent ? 'Verify OTP' : 'Farmer Login'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1.5">
                    {otpSent
                      ? `We sent a 4-digit code to +91 ${phone}`
                      : 'Enter your mobile number to login or register'}
                  </p>
                </div>

                {error && (
                  <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm font-medium rounded-2xl flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0">⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                {!otpSent ? (
                  <form onSubmit={handleSendOtp} className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2.5">
                        Mobile Number
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none gap-2">
                          <span className="text-slate-700 font-black text-base">+91</span>
                          <div className="w-px h-5 bg-slate-200" />
                        </div>
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          value={phone}
                          onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '')); setError(''); }}
                          placeholder="98765 43210"
                          autoFocus
                          className="w-full min-h-[60px] pl-[88px] pr-4 rounded-2xl border-2 border-slate-200 text-2xl font-bold text-slate-900 placeholder:text-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all tracking-wider bg-white"
                        />
                      </div>
                      {phone.length > 0 && phone.length < 10 && (
                        <p className="text-xs text-slate-400 mt-2 pl-1">{10 - phone.length} more digits needed</p>
                      )}
                      {phone.length === 10 && (
                        <p className="text-xs text-emerald-600 font-bold mt-2 pl-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Number looks good
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={loading || phone.length < 10}
                      className="w-full min-h-[56px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-100 disabled:text-slate-400 text-white text-base font-bold rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-gov-green disabled:shadow-none"
                    >
                      {loading
                        ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : (<><span>Get OTP</span><ArrowRight className="w-5 h-5" /></>)
                      }
                    </button>

                    <p className="text-center text-xs text-slate-400 leading-relaxed">
                      New farmer? Your account is created automatically on first login.<br />
                      <span className="text-emerald-600 font-semibold">No app download needed — works on any mobile browser.</span>
                    </p>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-5">
                    {/* Phone display */}
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                          <Phone className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <div className="text-xs text-emerald-700 font-semibold">Sending OTP to</div>
                          <div className="text-sm font-black text-emerald-900">+91 {phone}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setOtpSent(false); setOtp(''); setError(''); }}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline underline-offset-2"
                      >
                        Change
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2.5">
                        4-Digit OTP
                      </label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={4}
                        value={otp}
                        onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); setError(''); }}
                        placeholder="• • • •"
                        autoFocus
                        className="w-full min-h-[72px] text-center text-5xl font-black tracking-[0.7em] rounded-2xl border-2 border-slate-200 text-slate-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all bg-white"
                      />
                      {demoOtp && (
                        <div className="flex items-center justify-center gap-2 mt-3">
                          <span className="text-xs text-slate-400">Demo code:</span>
                          <button
                            type="button"
                            onClick={() => setOtp(demoOtp)}
                            className="text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg hover:bg-emerald-100 transition-colors"
                          >
                            {demoOtp} — click to fill
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={loading || otp.length < 4}
                      className="w-full min-h-[56px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-100 disabled:text-slate-400 text-white text-base font-bold rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-gov-green disabled:shadow-none"
                    >
                      {loading
                        ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : (<><ShieldCheck className="w-5 h-5" /><span>Verify & Continue</span></>)
                      }
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* ── ADMIN SECTION ── */}
            {mode === 'admin' && (
              <div className="animate-fadeIn">
                <div className="mb-7">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                    <Building2 className="w-6 h-6 text-slate-600" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900">Admin Login</h2>
                  <p className="text-sm text-slate-500 mt-1.5">Mandi officials & payment managers</p>
                </div>

                {error && (
                  <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm font-medium rounded-2xl flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0">⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2.5">
                      Employee ID
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={adminId}
                        onChange={(e) => { setAdminId(e.target.value); setError(''); }}
                        placeholder="e.g. ADMIN1"
                        autoFocus
                        className="w-full min-h-[54px] pl-11 pr-4 rounded-2xl border-2 border-slate-200 text-sm font-semibold text-slate-900 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 outline-none transition-all bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2.5">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        value={adminPass}
                        onChange={(e) => { setAdminPass(e.target.value); setError(''); }}
                        placeholder="••••••••"
                        className="w-full min-h-[54px] pl-11 pr-4 rounded-2xl border-2 border-slate-200 text-sm font-semibold text-slate-900 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 outline-none transition-all bg-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-[56px] bg-slate-900 hover:bg-slate-800 active:bg-black disabled:bg-slate-200 text-white text-base font-bold rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-gov-lg disabled:shadow-none"
                  >
                    {loading
                      ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : (<><span>Login to Portal</span><ArrowRight className="w-5 h-5" /></>)
                    }
                  </button>

                  {/* Quick-fill cards */}
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-[10px] text-slate-400 text-center font-bold uppercase tracking-widest mb-3">Quick Demo Login</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {[
                        { id: 'ADMIN1', label: 'Slot & Queue Mgr', icon: '🗓️' },
                        { id: 'ADMIN2', label: 'Payment Manager',  icon: '💳' },
                      ].map(a => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => { setAdminId(a.id); setAdminPass('ADMIN@123'); }}
                          className="p-3.5 rounded-xl border-2 border-slate-200 hover:border-slate-400 bg-slate-50 hover:bg-white text-left transition-all group"
                        >
                          <div className="text-xl mb-1">{a.icon}</div>
                          <div className="text-xs font-black text-slate-900">{a.id}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{a.label}</div>
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-center text-slate-400 mt-2.5">Demo password: ADMIN@123</p>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
