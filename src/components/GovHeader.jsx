import React, { useState, useEffect } from 'react';
import { translations } from '../translations';
import { LogOut, LogIn, PhoneCall, Languages, Tractor, ArrowRight, ShieldCheck } from 'lucide-react';

export default function GovHeader({
  lang = 'te',
  onLanguageChange,
  currentUser,
  currentRole,
  onLogout,
  onOpenAuth,
  onGuestEntry
}) {
  const [currentTime, setCurrentTime] = useState('');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [highContrast, setHighContrast] = useState(false);

  const t = translations[lang] || translations.en;

  // Live IST Clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const options = {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      };
      setCurrentTime(now.toLocaleString('en-IN', options) + ' IST');
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Text Zoom Control
  const handleZoom = (delta) => {
    let nextZoom = delta === 0 ? 100 : Math.min(Math.max(zoomLevel + delta, 90), 125);
    setZoomLevel(nextZoom);
    document.documentElement.style.setProperty('--gov-zoom', `${nextZoom}%`);
  };

  const toggleHighContrast = () => {
    setHighContrast(!highContrast);
    document.documentElement.classList.toggle('gov-high-contrast');
  };

  const tickerNotices = {
    en: [
      '🌾 Kharif & Rabi 2026: Live MSP rates gazetted by CACP • Paddy: ₹2,300/Q, Cotton: ₹7,121/Q, Wheat: ₹2,275/Q',
      '⚡ 100% Automated Digital Weighment active across all mandis — Direct PFMS bank transfer within 48 hours',
      '📞 Kisan Call Centre 24x7 Toll-Free: 1800-180-1551 • PM-KISAN e-KYC & Land Record Seeding enabled',
      '🏛️ Digital India & AgriStack Compliance: Instant slot booking & certified electronic deductions'
    ],
    te: [
      '🌾 ఖరీఫ్ & రబీ 2026: కేంద్ర ప్రభుత్వ అధికారిక కనీస మద్దతు ధరలు (MSP) అమల్లోకి వచ్చాయి • వరి: ₹2,300/క్విం., పత్తి: ₹7,121/క్విం.',
      '⚡ అన్ని కొనుగోలు కేంద్రాలలో 100% ఆటోమేటెడ్ డిజిటల్ తూకం • 48 గంటల్లో నేరుగా బ్యాంకు ఖాతాలోకి నగదు జమ (PFMS)',
      '📞 కిసాన్ కాల్ సెంటర్ టోల్ ఫ్రీ నంబర్: 1800-180-1551 • ఆధార్ e-KYC మరియు బ్యాంక్ ఖాతా అనుసంధానం తప్పనిసరి',
      '🏛️ డిజిటల్ ఇండియా ఆధ్వర్యంలో పారదర్శక స్లాట్ బుకింగ్ మరియు లైవ్ టోకెన్ వ్యవస్థ'
    ],
    hi: [
      '🌾 खरीफ एवं रबी 2026: सीएसीपी द्वारा न्यूनतम समर्थन मूल्य (MSP) अधिसूचित • धान: ₹2,300/क्विं., कपास: ₹7,121/क्विं.',
      '⚡ सभी मंडियों में 100% इलेक्ट्रॉनिक धर्मकांटा तौल चालू • 48 घंटों में आधार-सीडेड बैंक खाते में डीबीटी भुगतान',
      '📞 किसान कॉल सेंटर 24x7 टोल-फ्री: 1800-180-1551 • पीएम-किसान ई-केवाईसी एवं भू-अभिलेख सत्यापन जारी',
      '🏛️ डिजिटल इंडिया एवं एग्रीस्टैक अनुपालन: पारदर्शी स्लॉट बुकिंग एवं लाइव टोकन कतार प्रबंधन'
    ],
    kn: [
      '🌾 ಮುಂಗಾರು ಮತ್ತು ಹಿಂಗಾರು 2026: ಕನಿಷ್ಠ ಬೆಂಬಲ ಬೆಲೆ (MSP) ಜಾರಿ • ಭತ್ತ: ₹2,300/ಕ್ವಿಂ., ಹತ್ತಿ: ₹7,121/ಕ್ವಿಂ.',
      '⚡ ಎಲ್ಲಾ ಮಂಡಿಗಳಲ್ಲಿ 100% ಡಿಜಿಟಲ್ ತೂಕ ಸಕ್ರಿಯ • 48 ಗಂಟೆಗಳಲ್ಲಿ ನೇರವಾಗಿ ಬ್ಯಾಂಕ್ ಖಾತೆಗೆ ಜಮೆ (PFMS)',
      '📞 ಕಿಸಾನ್ ಕಾಲ್ ಸೆಂಟರ್ ಟೋಲ್ ಫ್ರೀ: 1800-180-1551 • ಆಧಾರ್ ಇ-ಕೆವೈಸಿ ಲಿಂಕ್ ಮಾಡುವುದು ಕಡ್ಡಾಯ',
      '🏛️ ಡಿಜಿಟಲ್ ಇಂಡಿಯಾ ಅಡಿಯಲ್ಲಿ ಪಾರದರ್ಶಕ ಸ್ಲಾಟ್ ಬುಕಿಂಗ್ ಮತ್ತು ಲೈವ್ ಟೋಕನ್ ಸೌಲಭ್ಯ'
    ]
  };

  const notices = tickerNotices[lang] || tickerNotices.en;

  return (
    <header className="bg-white border-b border-gov-slate-200 shadow-gov shrink-0 w-full sticky top-0 z-50">
      {/* 1. National Tricolor Hairline Ribbon */}
      <div className="tiranga-ribbon w-full"></div>

      {/* 2. Top Accessibility & National Bar */}
      <div className="bg-[#0B2545] text-white text-[11px] py-1 px-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          {/* Government of India Crest Text */}
          <div className="flex items-center gap-3">
            <span className="font-semibold text-amber-300 flex items-center gap-1">
              <span className="text-xs">🇮🇳</span>
              <span>भारत सरकार | Government of India</span>
            </span>
            <span className="hidden md:inline text-slate-300">•</span>
            <span className="hidden md:inline text-slate-200">
              कृषि एवं किसान कल्याण मंत्रालय | Ministry of Agriculture & Farmers Welfare
            </span>
          </div>

          {/* Right Controls: IST Clock, Helpline, Font Sizing, Screen Reader */}
          <div className="flex items-center gap-3 sm:gap-4 ml-auto">
            {/* Toll Free Helpline */}
            <a
              href="tel:18001801551"
              className="hidden lg:flex items-center gap-1 text-amber-300 hover:text-amber-200 font-bold"
              title="Kisan Call Centre Toll Free"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>1800-180-1551 (Toll Free)</span>
            </a>

            {/* Live IST Time */}
            <span className="hidden sm:inline-block text-slate-300 font-mono text-[10px] bg-gov-navy-800 px-2 py-0.5 rounded border border-gov-navy-500">
              {currentTime || 'IST Live'}
            </span>

            {/* Font Sizer (A- / A / A+) */}
            <div className="flex items-center bg-gov-navy-800 rounded border border-gov-navy-500 px-1">
              <button
                onClick={() => handleZoom(-5)}
                className="px-1.5 py-0.5 hover:text-amber-300 font-bold text-[10px] transition-colors"
                title="Decrease Font Size"
              >
                A-
              </button>
              <span className="text-slate-500 text-[10px]">|</span>
              <button
                onClick={() => handleZoom(0)}
                className="px-1.5 py-0.5 hover:text-amber-300 font-bold text-[11px] text-amber-300 transition-colors"
                title="Reset Font Size"
              >
                A
              </button>
              <span className="text-slate-500 text-[10px]">|</span>
              <button
                onClick={() => handleZoom(5)}
                className="px-1.5 py-0.5 hover:text-amber-300 font-bold text-[12px] transition-colors"
                title="Increase Font Size"
              >
                A+
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Official Ministry Emblem & Portal Banner */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
        {/* Left: Emblem + Titles */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Official Website Logo */}
          <div className="flex-shrink-0 flex items-center justify-center">
            <div className="relative group cursor-pointer">
              <img
                src="/favicon.svg"
                alt="Kisan Saathi Logo"
                className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl shadow-md border-2 border-amber-400 bg-white object-contain p-0.5 hover:scale-105 transition-transform"
              />
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-[7px] text-white font-black" title="Govt Verified">
                ✓
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base sm:text-xl font-black text-gov-navy tracking-tight flex items-center gap-1.5">
                <span>{t.appName}</span>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                  e-NAM 2.0
                </span>
              </span>
              <span className="hidden sm:inline-block text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                ✓ Govt Verified Portal
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-600 font-medium line-clamp-1 max-w-xl">
              {t.appSubtitle}
            </p>
          </div>
        </div>

        {/* Right: Language Dropdown, User Info, Action CTAs */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Language Selector */}
          <div className="relative flex items-center bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 px-2 py-1 transition-colors">
            <Languages className="w-4 h-4 text-slate-600 mr-1.5 pointer-events-none" />
            <select
              value={lang}
              onChange={(e) => onLanguageChange && onLanguageChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer pr-1"
              title="Select Language / भाषा चुनें"
            >
              <option value="en">English (EN)</option>
              <option value="te">తెలుగు (TE)</option>
              <option value="hi">हिन्दी (HI)</option>
              <option value="kn">ಕನ್ನಡ (KN)</option>
            </select>
          </div>

          {/* If Logged In */}
          {currentUser ? (
            <div className="flex items-center gap-2">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-bold text-slate-800 leading-tight">
                  {currentUser.name || currentUser.id}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                  {currentRole === 'farmer' ? '👨‍🌾 ' + t.portalFarmer : '🏛️ ' + t.portalAdmin}
                </span>
              </div>

              {currentUser.isGuest && (
                <button
                  type="button"
                  onClick={() => onOpenAuth && onOpenAuth('farmer')}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign In / OTP</span>
                </button>
              )}

              <button
                type="button"
                onClick={onLogout}
                className="bg-red-50 hover:bg-red-100 active:bg-red-200 border border-red-200 text-red-700 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-xs"
                title="Logout / Exit Portal"
              >
                <LogOut className="w-4 h-4 text-red-700" />
                <span className="hidden sm:inline">{currentUser.isGuest ? 'Exit Guest' : t.logout}</span>
              </button>
            </div>
          ) : (
            /* Logged Out CTAs */
            <div className="flex items-center gap-2">
              {onGuestEntry && (
                <button
                  type="button"
                  onClick={onGuestEntry}
                  className="hidden md:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                >
                  <span>👁️</span>
                  <span>{t.exploreGuest}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onOpenAuth && onOpenAuth('farmer')}
                className="bg-gov-navy hover:bg-gov-navy-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 active:scale-95 border border-gov-navy-800 cursor-pointer"
              >
                <Tractor className="w-4 h-4 text-amber-300" />
                <span>{t.tabFarmerLogin}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4. Live Official Gazette / News Flash Ticker */}
      <div className="bg-gradient-to-r from-amber-50 via-white to-emerald-50 border-t border-amber-200/80 px-3 sm:px-6 py-1.5 flex items-center gap-2 overflow-hidden text-xs">
        <div className="flex-shrink-0 flex items-center gap-1.5 bg-amber-600 text-white font-black text-[10px] uppercase px-2 py-0.5 rounded shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
          <span>राजपत्र / Gazette</span>
        </div>
        <div className="overflow-hidden whitespace-nowrap flex-1 relative">
          {/* Duplicate content for seamless marquee loop */}
          <div className="inline-flex animate-marquee text-slate-700 font-semibold text-[11px] sm:text-xs">
            {[...notices, ...notices].map((notice, idx) => (
              <span key={idx} className="mr-8 inline-flex items-center gap-1 shrink-0">
                <span>{notice}</span>
                <span className="text-amber-500 font-bold ml-4">✦</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
