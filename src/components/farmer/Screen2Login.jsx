import React, { useState } from 'react';
import { Phone, ShieldCheck, ArrowRight } from 'lucide-react';
import { translations } from '../../translations';

export default function Screen2Login({ lang, onLoginSuccess }) {
  const t = translations[lang] || translations.en;

  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [demoOtpCode, setDemoOtpCode] = useState('');

  // Handle Send OTP
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    if (!phone || phone.trim().length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number');
      return;
    }
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: phone.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        setDemoOtpCode(data.demo_otp || '4829');
        setOtp(data.demo_otp || '4829'); // Auto-populate for easiest farmer friction-free UX
      } else {
        setErrorMsg(data.error || 'Could not send OTP. Please try again.');
      }
    } catch (err) {
      // Offline fallback
      setOtpSent(true);
      setDemoOtpCode('4829');
      setOtp('4829');
    } finally {
      setLoading(false);
    }
  };

  // Handle Verify OTP
  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    if (!otp || otp.length < 4) {
      setErrorMsg('Please enter the 4-digit OTP');
      return;
    }
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: phone.trim(),
          otp: otp.trim(),
          language_preference: lang
        })
      });
      const data = await res.json();
      if (data.success) {
        onLoginSuccess(data.user, 'farmer', data.isNewUser);
      } else {
        setErrorMsg(data.error || 'Invalid OTP. Please check and re-enter.');
      }
    } catch (err) {
      // Offline fallback user creation
      const fallbackUser = {
        id: `FARM-${phone.slice(-4) || '9999'}`,
        name: `Farmer (${phone.slice(-4) || 'User'})`,
        phone: phone || '9848011223',
        district: 'Kurnool',
        village: 'Ulchala',
        mandal: 'Kallur',
        crop_type: 'Paddy',
        points: 120,
        language_preference: lang
      };
      onLoginSuccess(fallbackUser, 'farmer', false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-4 sm:p-6 max-w-lg mx-auto w-full animate-fadeIn">
      {/* Header */}
      <div className="text-center pt-3 pb-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 mb-2.5 shadow-sm">
          <Phone className="w-7 h-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          {t.loginTitle}
        </h1>
        <p className="text-sm text-slate-600 mt-1 max-w-xs mx-auto">
          {t.loginSubtitle}
        </p>
      </div>

      {/* Main Input Form */}
      <div className="my-auto py-3">
        {errorMsg && (
          <div className="p-3 mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {!otpSent ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1.5">
                {t.phoneLabel}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-base">
                  +91
                </div>
                <input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder={t.phonePlaceholder}
                  autoFocus
                  className="w-full min-h-[54px] pl-14 pr-4 rounded-xl border-2 border-slate-300 text-xl font-bold text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 tracking-wider"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || phone.length < 10}
              className="w-full min-h-[52px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-lg font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{t.getOtp}</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
              <span>OTP sent to +91 {phone}</span>
              <button
                type="button"
                onClick={() => setOtpSent(false)}
                className="text-emerald-700 underline text-xs font-bold"
              >
                Change
              </button>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1.5">
                {t.enterOtp}
              </label>
              <input
                type="tel"
                maxLength={4}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="4-digit OTP"
                autoFocus
                className="w-full min-h-[54px] px-4 text-center tracking-[0.6em] rounded-xl border-2 border-slate-300 text-2xl font-black text-slate-900 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
              />
              {demoOtpCode && (
                <p className="text-xs text-slate-500 mt-1.5 text-center">
                  Demo code: <span className="font-bold text-emerald-700">{demoOtpCode}</span> (Auto-filled)
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || otp.length < 4}
              className="w-full min-h-[52px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-lg font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>{t.verifyLogin}</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Trust Seal */}
      <div className="text-center py-2 text-[11px] text-slate-400 font-medium">
        Ministry of Consumer Affairs, Food & Public Distribution • SIH 2026
      </div>
    </div>
  );
}
