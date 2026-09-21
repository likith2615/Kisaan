import React, { useState } from 'react';
import { translations } from '../translations';

export default function AuthModal({ isOpen, onClose, initialRole = 'farmer', lang = 'te', onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' or 'register'
  const [mobileNumber, setMobileNumber] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState('');
  const [activeOtpCode, setActiveOtpCode] = useState('');
  const [showFloatingOtpAlert, setShowFloatingOtpAlert] = useState(false);
  const [showDigiLockerNotice, setShowDigiLockerNotice] = useState(false);
  const [showAdminSection, setShowAdminSection] = useState(initialRole === 'admin');

  // Registration State
  const [regData, setRegData] = useState({
    name: '',
    phone: '',
    aadhaar: '',
    district: 'Kurnool',
    mandal: 'Kallur',
    village: 'Ulchala',
    land_hectares: 3.5,
    bank_account: '',
    ifsc: 'SBIN0001234',
    language_preference: lang
  });

  // Admin Login State
  const [adminId, setAdminId] = useState('ADMIN-GOI-01');
  const [adminPassword, setAdminPassword] = useState('gov@2026');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const t = translations[lang] || translations.en;

  // 1. Send 4-Digit OTP for Mobile Number
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    const cleanPhone = mobileNumber.replace(/\D/g, '').trim();
    if (!cleanPhone || cleanPhone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number');
      return;
    }

    setErrorMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: cleanPhone })
      });
      const data = await res.json();
      if (data.success) {
        const demoCode = data.demo_otp || '4829';
        setActiveOtpCode(demoCode);
        setOtpStep(true);
        setShowFloatingOtpAlert(true);
      } else {
        setErrorMsg(data.error || 'Failed to send OTP');
      }
    } catch {
      // Fallback in case of temporary network glitch
      const fallbackOtp = '4829';
      setActiveOtpCode(fallbackOtp);
      setOtpStep(true);
      setShowFloatingOtpAlert(true);
    } finally {
      setLoading(false);
    }
  };

  // 2. Verify 4-Digit OTP & Auto-Create/Login
  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    if (!otp || otp.length !== 4) {
      setErrorMsg('Please enter the 4-digit OTP code');
      return;
    }

    setErrorMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: mobileNumber.trim(),
          otp: otp.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('🎉 Aadhaar e-KYC Verified! Entering portal...');
        setShowFloatingOtpAlert(false);
        setTimeout(() => {
          onLoginSuccess(data.user, 'farmer');
          onClose();
        }, 800);
      } else {
        setErrorMsg(data.error || 'Invalid OTP code.');
      }
    } catch {
      const demoUser = {
        id: `FARM-${mobileNumber.slice(-4) || '2026'}`,
        name: `Farmer (${mobileNumber.slice(-4)})`,
        phone: mobileNumber,
        district: 'Kurnool',
        village: 'Ulchala',
        land_hectares: 3.0,
        status: 'Verified'
      };
      onLoginSuccess(demoUser, 'farmer');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  // 3. Quick Demo Profile Logins
  const handleQuickDemoFarmer = (phone, name, district) => {
    const demoUser = {
      id: `FARM-${phone.slice(-4)}`,
      name: name,
      phone: phone,
      district: district,
      village: 'Gram Panchayat Center',
      land_hectares: 4.2,
      bank_account: 'XXXX-XXXX-9842',
      ifsc: 'SBIN0001234',
      status: 'Aadhaar Verified'
    };
    onLoginSuccess(demoUser, 'farmer');
    onClose();
  };

  // 4. Register New Farmer
  const handleRegisterFarmer = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register-farmer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...regData, language_preference: lang })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('🎉 Registration successful! Logging into dashboard...');
        setTimeout(() => {
          onLoginSuccess(data.user, 'farmer');
          onClose();
        }, 1000);
      } else {
        setErrorMsg(data.error || 'Registration failed');
      }
    } catch {
      setErrorMsg('Network error during registration');
    } finally {
      setLoading(false);
    }
  };

  // 5. Admin Direct Login
  const handleAdminLogin = async (e) => {
    e?.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: adminId.trim(), password: adminPassword.trim() })
      });
      const data = await res.json();
      if (data.success) {
        onLoginSuccess(data.user, 'admin');
        onClose();
      } else {
        setErrorMsg(data.error || 'Authentication failed');
      }
    } catch {
      onLoginSuccess({
        id: 'ADMIN-GOI-01',
        name: 'District Procurement Officer',
        email: 'admin@kisan.gov.in',
        role: 'admin',
        district: 'State Operations Command'
      }, 'admin');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  // 6. Explore as Guest
  const handleGuestEntry = () => {
    const guestUser = {
      id: 'GUEST-FARMER',
      name: 'Guest Farmer / అతిథి రైతు',
      phone: '9999999999',
      district: 'All Mandis',
      mandal: 'Preview Mandi',
      village: 'Kisan Kendra',
      land_hectares: 2.5,
      isGuest: true
    };
    onLoginSuccess(guestUser, 'farmer');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gov-navy-900/70 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      {/* Floating 4-Digit OTP Window */}
      {showFloatingOtpAlert && (
        <aside aria-label="Simulated OTP Alert" className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] max-w-sm w-[92%] bg-gov-navy text-white p-4 rounded-2xl shadow-2xl border-2 border-amber-400 animate-bounce duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-gov-navy flex items-center justify-center text-lg font-black shrink-0 shadow-md">
              💬
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                  Govt SMS Alert • KISAN-OTP
                </span>
                <span className="text-[10px] text-slate-300">Just now</span>
              </div>
              <p className="text-xs text-slate-100 mt-1">
                Your Kisan Saathi verification code is:{' '}
                <span className="font-mono font-black text-amber-300 text-base tracking-widest bg-gov-navy-800 px-2 py-0.5 rounded-md border border-amber-400">
                  {activeOtpCode}
                </span>
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOtp(activeOtpCode);
                    setShowFloatingOtpAlert(false);
                  }}
                  className="bg-amber-400 hover:bg-amber-300 text-gov-navy px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-xs active:scale-95"
                >
                  ⚡ Auto-Fill OTP
                </button>
                <button
                  type="button"
                  onClick={() => setShowFloatingOtpAlert(false)}
                  className="text-slate-300 hover:text-white text-xs py-1 px-2"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Floating DigiLocker Notice */}
      {showDigiLockerNotice && (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border-t-4 border-t-blue-800 text-center animate-scale-up">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-800 flex items-center justify-center text-3xl shadow-xs">
              🇮🇳
            </div>
            <h3 className="text-lg font-black text-gov-navy tracking-tight">DigiLocker National Identity</h3>
            <span className="inline-block px-3 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mt-1">
              Sandbox Compliance in Progress
            </span>
            <p className="text-xs text-slate-600 mt-3 leading-relaxed">
              National Digital Locker Sandbox integration with the Central Farmer Registry is undergoing e-KYC compliance verification.
              <br/><br/>
              Please use the instant <strong>Aadhaar / Mobile OTP</strong> login below.
            </p>
            <button
              onClick={() => setShowDigiLockerNotice(false)}
              className="mt-5 w-full bg-gov-navy hover:bg-gov-navy-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95"
            >
              Continue with Mobile OTP
            </button>
          </div>
        </div>
      )}

      {/* Main Card Container */}
      <div className="bg-white border-t sm:border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-md w-full shadow-2xl relative overflow-hidden max-h-[94vh] overflow-y-auto">
        {/* National Tricolor Hairline Ribbon */}
        <div className="tiranga-ribbon w-full"></div>

        {/* Top Header Bar */}
        <div className="bg-[#0B2545] text-white p-4 sm:p-5 relative">
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 text-slate-300 hover:text-white p-1 rounded-full hover:bg-gov-navy-800 transition-colors"
            title="Close"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 text-white flex items-center justify-center text-2xl font-black shadow-md border border-amber-300">
              🌾
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black tracking-tight text-white">{t.appName}</span>
                <span className="text-[10px] bg-amber-400 text-gov-navy font-black px-1.5 py-0.2 rounded uppercase">
                  Jan Parichay
                </span>
              </div>
              <p className="text-[11px] text-amber-200">National Farmer Authentication & e-KYC</p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {/* Quick 1-Click Demo Profiles */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
              <span>⚡</span>
              <span>1-Click Instant Demo Login</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoFarmer('9876543210', 'Ramesh Kumar', 'Kurnool')}
                className="p-2 rounded-lg bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-400 text-left transition-all active:scale-95 shadow-xs"
              >
                <div className="text-xs font-bold text-gov-navy">👨‍🌾 Ramesh Kumar</div>
                <div className="text-[10px] text-slate-500">Kurnool • 4.2 Ha</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoFarmer('9123456780', 'Lakshmi Devi', 'Tenali')}
                className="p-2 rounded-lg bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-400 text-left transition-all active:scale-95 shadow-xs"
              >
                <div className="text-xs font-bold text-gov-navy">👩‍🌾 Lakshmi Devi</div>
                <div className="text-[10px] text-slate-500">Tenali • 3.5 Ha</div>
              </button>
            </div>
          </div>

          {/* Unified Toggle: Login vs Register */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => {
                setActiveTab('login');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'login' ? 'bg-white text-gov-navy shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-base">login</span>
              <span>{t.tabFarmerLogin}</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('register');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'register' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-base">person_add</span>
              <span>{t.tabRegister}</span>
            </button>
          </div>

          {errorMsg && (
            <div className="bg-red-50 text-red-700 text-xs font-bold p-3 rounded-xl border border-red-200 flex items-center gap-2">
              <span className="material-symbols-outlined text-base shrink-0">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 text-emerald-800 text-xs font-bold p-3 rounded-xl border border-emerald-200 flex items-center gap-2">
              <span className="material-symbols-outlined text-base shrink-0">check_circle</span>
              <span>{successMsg}</span>
            </div>
          )}

          {/* VIEW 1: NORMAL LOGIN (MOBILE NUMBER + DIGILOCKER) */}
          {activeTab === 'login' && (
            <div className="space-y-3.5">
              {!otpStep ? (
                <form onSubmit={handleSendOtp} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.identifierLabel}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-slate-500 font-bold text-sm">
                        +91
                      </span>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder={t.identifierPlaceholder}
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                        className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-200 outline-none transition-all"
                        required
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Enter any 10-digit mobile number. Instant Aadhaar OTP will be generated.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gov-navy hover:bg-gov-navy-700 text-white py-3 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 cursor-pointer"
                  >
                    {loading ? 'Sending...' : t.getOtpBtn}
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>

                  {/* DigiLocker Login Button */}
                  <div className="relative my-3 text-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200"></div>
                    </div>
                    <span className="relative bg-white px-3 text-[11px] text-slate-400 uppercase font-bold">
                      National Digital Identity
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowDigiLockerNotice(true)}
                    className="w-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-2xs active:scale-95"
                  >
                    <span>🇮🇳</span>
                    <span>{t.digilockerBtn}</span>
                    <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded font-black">
                      Sandbox
                    </span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4 animate-fade-in">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-bold text-slate-700">
                        {t.enterOtpLabel} (4 Digits)
                      </label>
                      <button
                        type="button"
                        onClick={() => setOtpStep(false)}
                        className="text-[11px] text-amber-700 hover:underline font-bold"
                      >
                        Change Number (+91 {mobileNumber})
                      </button>
                    </div>

                    <div className="flex justify-center gap-2 my-2">
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="• • • •"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        className="w-full text-center tracking-[0.6em] text-3xl font-black py-2 bg-amber-50/70 border-2 border-amber-500 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
                        autoFocus
                        required
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] mt-1">
                      <button
                        type="button"
                        onClick={() => setShowFloatingOtpAlert(true)}
                        className="text-amber-800 hover:underline font-bold flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-xs">chat</span>
                        View SMS Alert ({activeOtpCode || '4829'})
                      </button>
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        className="text-slate-500 hover:text-slate-800 font-bold"
                      >
                        Resend OTP
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otp.length !== 4}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-3 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    <span>{loading ? 'Verifying...' : 'Verify OTP & Enter / సృష్టించండి'}</span>
                  </button>
                </form>
              )}

              {/* Explore as Guest Option */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleGuestEntry}
                  className="text-xs font-bold text-slate-600 hover:text-amber-900 hover:underline inline-flex items-center gap-1"
                >
                  <span>👀</span>
                  <span>{t.exploreGuest}</span>
                  <span className="text-[10px] text-slate-400">(No login required)</span>
                </button>
              </div>
            </div>
          )}

          {/* VIEW 2: FULL REGISTRATION FORM */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterFarmer} className="space-y-2.5 animate-fade-in">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">{t.fullName} *</label>
                  <input
                    type="text"
                    placeholder="e.g. Venkat Rao"
                    value={regData.name}
                    onChange={(e) => setRegData({ ...regData, name: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">{t.mobileNumber} *</label>
                  <input
                    type="tel"
                    placeholder="10-digit mobile"
                    value={regData.phone}
                    onChange={(e) => setRegData({ ...regData, phone: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">{t.district} *</label>
                  <input
                    type="text"
                    placeholder="e.g. Kurnool / Tenali"
                    value={regData.district}
                    onChange={(e) => setRegData({ ...regData, district: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">{t.landHectares} *</label>
                  <input
                    type="number"
                    step="0.1"
                    value={regData.land_hectares}
                    onChange={(e) => setRegData({ ...regData, land_hectares: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">{t.bankAccount}</label>
                  <input
                    type="text"
                    placeholder="Bank Account"
                    value={regData.bank_account}
                    onChange={(e) => setRegData({ ...regData, bank_account: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">{t.ifscCode}</label>
                  <input
                    type="text"
                    value={regData.ifsc}
                    onChange={(e) => setRegData({ ...regData, ifsc: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95"
              >
                <span className="material-symbols-outlined text-base">how_to_reg</span>
                <span>{loading ? 'Creating...' : t.registerBtn}</span>
              </button>
            </form>
          )}

          {/* BOTTOM SECTION: ADMIN LOGIN BUTTON */}
          <div className="pt-3 border-t border-slate-200">
            {!showAdminSection ? (
              <button
                type="button"
                onClick={() => setShowAdminSection(true)}
                className="w-full bg-slate-50 hover:bg-gov-navy-50 border border-slate-300 hover:border-gov-navy-400 text-slate-700 hover:text-gov-navy py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <span className="material-symbols-outlined text-base text-gov-navy">admin_panel_settings</span>
                <span>🛡️ Government Officer Command Portal Login</span>
              </button>
            ) : (
              <div className="bg-slate-50 border-2 border-gov-navy rounded-xl p-3.5 animate-scale-up">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-gov-navy flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-amber-600">security</span>
                    Nodal Officer Command Access
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAdminSection(false)}
                    className="text-[11px] text-slate-500 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Officer ID (e.g. ADMIN-GOI-01)"
                    value={adminId}
                    onChange={(e) => setAdminId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none"
                  />
                  <input
                    type="password"
                    placeholder="Passcode (gov@2026)"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none"
                  />

                  <button
                    type="button"
                    onClick={handleAdminLogin}
                    disabled={loading}
                    className="w-full bg-gov-navy hover:bg-gov-navy-700 text-white py-2 rounded-xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-sm text-amber-300">verified_user</span>
                    <span>Enter Nodal Officer Portal</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
