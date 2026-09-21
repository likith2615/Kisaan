import React, { useState, useEffect, useRef } from 'react';
import ProcurementMap from './ProcurementMap';
import GovFooter from './GovFooter';
import { translations } from '../translations';
import { Tractor, ArrowRight, Eye, ShieldCheck, Scale, Building2, Calendar, Mic } from 'lucide-react';

// Animated stat counter
function AnimatedStat({ target, suffix = '', prefix = '' }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const hasRun = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasRun.current) {
        hasRun.current = true;
        const numeric = typeof target === 'number' ? target : parseFloat(target);
        const duration = 1600;
        const start = performance.now();
        const step = (now) => {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          setVal(Math.round(eased * numeric));
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref}>
      {prefix}{val.toLocaleString('en-IN')}{suffix}
    </span>
  );
}

const CROP_IMAGES = {
  wheat:   'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400&q=75&auto=format&fit=crop',
  paddy:   'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=400&q=75&auto=format&fit=crop',
  mustard: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&q=75&auto=format&fit=crop',
  cotton:  'https://images.unsplash.com/photo-1612350000166-82e3d22d8c4e?w=400&q=75&auto=format&fit=crop',
  maize:   'https://images.unsplash.com/photo-1601472282292-57f3e0a879a2?w=400&q=75&auto=format&fit=crop',
};

function getCropImage(name = '') {
  const n = name.toLowerCase();
  if (n.includes('wheat') || n.includes('गेहूं') || n.includes('గోధుమ')) return CROP_IMAGES.wheat;
  if (n.includes('paddy') || n.includes('rice') || n.includes('धान') || n.includes('వరి')) return CROP_IMAGES.paddy;
  if (n.includes('mustard') || n.includes('सरसों') || n.includes('ఆవాలు')) return CROP_IMAGES.mustard;
  if (n.includes('cotton') || n.includes('कपास') || n.includes('పత్తి')) return CROP_IMAGES.cotton;
  if (n.includes('maize') || n.includes('corn') || n.includes('मक्का') || n.includes('మొక్కజొన్న')) return CROP_IMAGES.maize;
  return CROP_IMAGES.paddy;
}

export default function LandingPage({ lang = 'te', onLanguageChange, onOpenAuth, onGuestEntry }) {
  const [crops, setCrops] = useState([]);
  const [centres, setCentres] = useState([]);
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    fetch('/api/crops').then(r => r.json()).then(d => { if (d.success) setCrops(d.data); }).catch(() => {});
    fetch('/api/centres').then(r => r.json()).then(d => { if (d.success) setCentres(d.data); }).catch(() => {});
    fetch('/api/centerRequests').then(r => r.json()).then(d => { if (d.success) setRequests(d.data); }).catch(() => {});
  }, []);

  const t = translations[lang] || translations.en;

  const defaultCrops = [
    { id: 'C1', name: 'Wheat / गोधुमలు / गेहूं',          season: 'Rabi 2026',   msp_per_quintal: 2275,  unit: 'Quintal' },
    { id: 'C2', name: 'Paddy / వరి / धान (Grade A)',       season: 'Kharif 2026', msp_per_quintal: 2300,  unit: 'Quintal' },
    { id: 'C3', name: 'Mustard / ఆవాలు / सरसों',           season: 'Rabi 2026',   msp_per_quintal: 5650,  unit: 'Quintal' },
    { id: 'C4', name: 'Cotton / పత్తి / कपास (Long Staple)',season: 'Kharif 2026', msp_per_quintal: 7121,  unit: 'Quintal' },
    { id: 'C5', name: 'Maize / మొక్కజొన్న / मक्का',       season: 'Kharif 2026', msp_per_quintal: 2090,  unit: 'Quintal' },
  ];

  const features = [
    {
      step: '01', icon: 'calendar_month', badge: 'e-Token',
      title: { te: 'స్మార్ట్ స్లాట్ బుకింగ్ & లైవ్ టోకెన్', hi: 'स्मार्ट स्लॉट बुकिंग एवं ई-टोकन', kn: 'ಸ್ಮಾರ್ಟ್ ಸ್ಲಾಟ್ ಬುಕಿಂಗ್', en: 'Smart Slot Booking & Digital Token' },
      desc: { te: 'మీకు అనుకూలమైన సమయంలో స్లాట్ బుక్ చేసుకోండి. టోకెన్ ఆధారిత వేగవంతమైన ప్రవేశం.', en: 'Select your mandi and arrival window. Real-time token dispatch prevents mandi congestion.', hi: 'अपनी सुविधानुसार स्लॉट बुक करें। कतार और भीड़ से पूर्ण मुक्ति।', kn: 'ನಿಮಗೆ ಅನುಕೂಲಕರ ಸಮಯದಲ್ಲಿ ಸ್ಲಾಟ್ ಬುಕ್ ಮಾಡಿ.' },
      color: 'blue',
    },
    {
      step: '02', icon: 'scale', badge: 'CACP Norms',
      title: { te: 'డిజిటల్ తూకం & స్పష్టమైన తగ్గింపులు', hi: 'प्रमाणित इलेक्ट्रॉनिक धर्मकांटा तौल', kn: 'ಡಿಜಿಟಲ್ ತೂಕ ಮತ್ತು ನಿಖರ ಕಡಿತಗಳು', en: 'Certified Digital Weighment' },
      desc: { te: 'తేమ మరియు బస్తా బరువు వివరాలతో కూడిన పారదర్శక డిజిటల్ రశీదు.', en: 'Clear itemized deductions for moisture & tare bag weight with certified digital receipts.', hi: 'नमी और बोरी के वजन की स्पष्ट कटौती के साथ प्रमाणित डिजिटल रसीद।', kn: 'ತೇವಾಂಶ ಮತ್ತು ಚೀಲದ ತೂಕದ ಸ್ಪಷ್ಟ ವಿವರಗಳೊಂದಿಗೆ ಡಿಜಿಟಲ್ ರಸೀದಿ.' },
      color: 'amber',
    },
    {
      step: '03', icon: 'account_balance', badge: 'PFMS / DBT',
      title: { te: 'నేరుగా బ్యాంకు ఖాతాలోకి జమ (PFMS)', hi: 'सीधे बैंक खाते में डीबीटी भुगतान', kn: 'ನೇರವಾಗಿ ಬ್ಯಾಂಕ್ ಖಾತೆಗೆ ಜಮೆ (DBT)', en: 'Direct Benefit Transfer (PFMS)' },
      desc: { te: '48–72 గంటల్లో ఆధార్ ఆధారిత బ్యాంక్ ఖాతాకు నిధుల బదిలీ.', en: 'Guaranteed government MSP transferred directly into farmer bank accounts in 48 hours.', hi: '48 से 72 घंटों में सीधे बैंक खाते में भुगतान और यूटीआर नंबर।', kn: '48 ರಿಂದ 72 ಗಂಟೆಗಳಲ್ಲಿ ಆಧಾರ್ ಲಿಂಕ್ಡ್ ಬ್ಯಾಂಕ್ ಖಾತೆಗೆ ಹಣ ಜಮೆ.' },
      color: 'emerald',
    },
    {
      step: '04', icon: 'record_voice_over', badge: 'AI Vaani',
      title: { te: 'బహుభాషా కిసాన్ వాయిస్ అసిస్టెంట్', hi: 'बहुभाषी किसान वाणी वॉयस AI', kn: 'ಬಹುಭಾಷಾ ಕಿಸಾನ್ ವಾಯ್ಸ್ ಸಹಾಯಕ', en: 'Multilingual Kisan AI Voice Agent' },
      desc: { te: 'మీ స్వంత భాషలో మాట్లాడి స్లాట్ బుక్ చేయండి మరియు పేమెంట్ స్టేటస్ తెలుసుకోండి.', en: 'Speak in Telugu, Hindi, Kannada, or English to check booking status, mandi rates, and slot openings.', hi: 'अपनी मातृभाषा में बोलकर स्लॉट बुक करें और भुगतान स्थिति जानें।', kn: 'ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲೇ ಮಾತನಾಡಿ ಸ್ಲಾಟ್ ಬುಕ್ ಮಾಡಿ.' },
      color: 'purple',
    },
  ];

  const stepColor = { blue: 'bg-blue-100 text-blue-700 border-blue-200', amber: 'bg-amber-100 text-amber-700 border-amber-200', emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200', purple: 'bg-purple-100 text-purple-700 border-purple-200' };

  return (
    <div className="h-full overflow-y-auto bg-white text-slate-900 font-sans flex flex-col">

      {/* ── HERO SECTION ── */}
      <section className="relative overflow-hidden min-h-[88vh] flex flex-col justify-center hero-agri-bg">
        {/* Gradient overlay */}
        <div className="absolute inset-0 overlay-navy-lg" />

        {/* Ashoka Chakra watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04]">
          <svg viewBox="0 0 200 200" className="w-[600px] h-[600px] text-white fill-none stroke-current animate-spin-xslow">
            <circle cx="100" cy="100" r="90" strokeWidth="2" />
            <circle cx="100" cy="100" r="20" fill="white" />
            {[...Array(24)].map((_, i) => (
              <line key={i} x1="100" y1="20" x2="100" y2="180" strokeWidth="1.5"
                transform={`rotate(${i * 15} 100 100)`} />
            ))}
          </svg>
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-8 lg:px-12 py-16 text-white text-center z-10">
          {/* Gov badge */}
          <div className="animate-fadeIn inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/10 border border-amber-400/40 text-amber-300 text-xs font-bold mb-8 backdrop-blur-sm shadow-lg">
            <span className="text-lg">🏛️</span>
            <span>{t.heroBadge || 'Ministry of Agriculture & Farmers Welfare · Govt. of India'}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>

          <h1 className="animate-slideUp text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight max-w-5xl mx-auto leading-tight"
            style={{ animationDelay: '80ms' }}>
            {t.heroTitle || 'Kisan Saathi — Digital Procurement Portal'}
          </h1>

          <p className="animate-slideUp text-sm sm:text-lg text-slate-200 max-w-3xl mx-auto mt-5 leading-relaxed"
            style={{ animationDelay: '160ms' }}>
            {t.heroDesc || 'Book your mandi slot online. Receive 100% MSP — directly to your bank account within 48 hours. No middlemen. No waiting overnight.'}
          </p>

          {/* CTA Buttons */}
          <div className="animate-slideUp mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-xl mx-auto"
            style={{ animationDelay: '240ms' }}>
            <button
              type="button"
              onClick={() => onOpenAuth('farmer')}
              className="w-full sm:w-auto flex-1 sm:flex-none bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black px-8 py-4 rounded-2xl text-sm sm:text-base shadow-2xl shadow-amber-500/30 hover:shadow-amber-500/50 transition-all flex items-center justify-center gap-2.5 group active:scale-[0.97] border border-amber-300 cursor-pointer"
            >
              <Tractor className="w-5 h-5 text-slate-950" />
              <span>{t.ctaFarmer || 'Farmer Login / Register'}</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 text-slate-950" />
            </button>

            <button
              type="button"
              onClick={onGuestEntry}
              className="w-full sm:w-auto glass-card text-white px-6 py-4 rounded-2xl font-bold text-sm hover:bg-white/20 transition-all flex items-center justify-center gap-2 active:scale-[0.97] cursor-pointer"
            >
              <Eye className="w-4 h-4 text-amber-300" />
              <span>{t.exploreGuest || 'Explore as Guest'}</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenAuth('admin')}
              className="w-full sm:w-auto glass-card text-slate-200 px-6 py-4 rounded-2xl font-bold text-sm hover:bg-white/20 transition-all flex items-center justify-center gap-2 active:scale-[0.97] cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>{t.ctaAdmin || 'Mandi Admin Login'}</span>
            </button>
          </div>

          {/* Trust guarantees ribbon */}
          <div className="animate-slideUp mt-12 pt-8 border-t border-white/10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-slate-300 font-semibold"
            style={{ animationDelay: '320ms' }}>
            {[
              { icon: '✓', color: 'text-emerald-400', text: '100% CACP MSP Guaranteed' },
              { icon: '⚡', color: 'text-amber-400',   text: 'Direct PFMS Bank Credit (48 Hrs)' },
              { icon: '⚖️', color: 'text-blue-400',    text: 'Calibrated Electronic Weighbridge' },
              { icon: '🔒', color: 'text-emerald-400', text: 'Aadhaar-Seeded e-KYC' },
            ].map((g, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className={g.color}>{g.icon}</span>
                {g.text}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom curve */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" className="w-full" preserveAspectRatio="none">
            <path d="M0 60 Q720 0 1440 60 L1440 60 L0 60Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ── LIVE STATS BAR ── */}
      <section className="bg-white border-b border-slate-100 py-8 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 grid grid-cols-2 md:grid-cols-4 gap-0 divide-y-2 md:divide-y-0 md:divide-x divide-slate-100">
          {[
            { val: 18500, suffix: '+', unit: 'Quintals', label: t.statsProcured || 'Produce Procured', color: 'text-gov-navy', icon: '🌾' },
            { val: 45,    prefix: '< ', unit: 'Minutes', label: t.statsWaitTime || 'Average Wait Time', color: 'text-emerald-700', icon: '⏱️' },
            { val: 99,    suffix: '.2%', unit: '',        label: t.statsDbt || 'DBT Success Rate',     color: 'text-blue-800', icon: '🏦' },
            { val: centres.length || 3, unit: 'Mandis',  label: t.statsCentres || 'Active Mandis',    color: 'text-amber-700', icon: '🏛️' },
          ].map((stat, i) => (
            <div key={i} className="py-6 px-4 sm:px-6 text-center stat-card animate-countUp" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className={`${stat.color} font-black text-3xl sm:text-4xl tracking-tight leading-none`}>
                {stat.prefix || ''}
                <AnimatedStat target={stat.val} suffix={stat.suffix || ''} />
                {stat.unit && <span className="text-sm font-bold ml-1">{stat.unit}</span>}
              </div>
              <div className="text-xs font-bold text-slate-500 mt-2 uppercase tracking-wider">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── MSP RATES SECTION ── */}
      <section id="msp-table" className="py-16 px-4 sm:px-8 lg:px-12 max-w-6xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold mb-3">
              <span>📜</span>
              <span>Central Gazette CACP 2026 — Official MSP Rates</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-gov-navy tracking-tight leading-tight">
              {t.mspSectionTitle || 'Government Minimum Support Prices'}
            </h2>
            <p className="text-slate-500 text-sm mt-1.5 max-w-lg">
              {t.mspSectionDesc || 'CACP-notified rates for Kharif & Rabi 2026 crops. Guaranteed direct to your bank account.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenAuth('farmer')}
            className="self-start sm:self-end text-sm font-bold text-white bg-gov-navy hover:bg-gov-navy-700 px-5 py-2.5 rounded-xl border border-gov-navy flex items-center gap-2 shadow-gov-md transition-all active:scale-[0.97] cursor-pointer"
          >
            <span>{t.newBookingBtn || 'Book a Slot'}</span>
            <ArrowRight className="w-4 h-4 text-amber-300" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 stagger-children">
          {(crops.length > 0 ? crops : defaultCrops).map((c) => (
            <div
              key={c.id}
              className="crop-card bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover group animate-fadeIn"
              onClick={() => onOpenAuth('farmer')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onOpenAuth('farmer')}
            >
              {/* Crop image */}
              <div className="relative h-32 overflow-hidden">
                <img
                  src={getCropImage(c.name)}
                  alt={c.name}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <div className="absolute bottom-2 left-2.5 right-2.5">
                  <span className="text-[10px] font-bold text-white/90 bg-black/30 px-2 py-0.5 rounded-full backdrop-blur-sm">
                    {c.season}
                  </span>
                </div>
                <div className="absolute top-2 right-2">
                  <span className="text-[10px] font-bold text-emerald-300 bg-emerald-900/60 px-1.5 py-0.5 rounded backdrop-blur-sm">
                    FAQ Grade
                  </span>
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-bold text-gov-navy text-sm leading-tight mb-3 group-hover:text-amber-800 transition-colors line-clamp-2">
                  {c.name}
                </h3>
                <div className="text-2xl font-black text-emerald-700 leading-none">
                  ₹{Number(c.msp_per_quintal).toLocaleString('en-IN')}
                  <span className="text-xs text-slate-500 font-normal ml-1">/ {c.unit || 'Q'}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-gov-navy">Book Slot →</span>
                    <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">MSP ✓</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4-STEP HOW IT WORKS ── */}
      <section className="py-16 bg-slate-50 border-t border-b border-slate-200 px-4 sm:px-8 lg:px-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold mb-3 border border-emerald-200">
              <span>🌾</span>
              <span>4-Step Standard Operating Procedure · e-NAM Compliant</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-gov-navy tracking-tight">
              {t.featuresTitle || 'How Kisan Saathi Works'}
            </h2>
            <p className="text-slate-500 text-sm mt-3 leading-relaxed">
              Standardized under the National Agriculture Market (e-NAM) guidelines to ensure zero hassle for farmers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
            {features.map((f, i) => (
              <div
                key={i}
                className="bg-white border border-slate-200 hover:border-gov-navy/30 rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-all relative overflow-hidden group animate-slideUp"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {/* Step badge */}
                <div className="absolute top-0 right-0 bg-gov-navy text-amber-300 text-[10px] font-black px-3 py-1.5 rounded-bl-xl">
                  STEP {f.step}
                </div>

                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 border ${stepColor[f.color]}`}>
                  <span className="material-symbols-outlined">{f.icon}</span>
                </div>

                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-1.5">{f.badge}</div>
                <h3 className="font-bold text-gov-navy text-sm sm:text-base mb-2 group-hover:text-amber-800 transition-colors">{f.title[lang] || f.title.en}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{f.desc[lang] || f.desc.en}</p>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                  <span className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-[9px]">✓</span>
                  <span>Certified Process</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BEAUTIFUL FARMER TESTIMONIAL / TRUST BAND ── */}
      <section className="relative py-20 paddy-bg overflow-hidden">
        <div className="absolute inset-0 overlay-emerald" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-8 text-center text-white z-10">
          <div className="text-5xl mb-6">🌾</div>
          <blockquote className="text-xl sm:text-2xl md:text-3xl font-bold leading-relaxed mb-6 text-white">
            "Slots, weighment, payment — all done in one day. My money was in my account the next morning."
          </blockquote>
          <cite className="text-emerald-200 text-sm font-semibold not-italic">
            — Ramu Reddy, Paddy Farmer · Kurnool District, Andhra Pradesh
          </cite>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-emerald-100">
            <span className="glass-card px-4 py-2 rounded-full">₹2,300/Quintal — MSP Paddy</span>
            <span className="glass-card px-4 py-2 rounded-full">Token: TK-0847</span>
            <span className="glass-card px-4 py-2 rounded-full">Payment: Within 18 hrs</span>
          </div>
        </div>
      </section>

      {/* ── MANDI MAP ── */}
      <section className="py-16 px-4 sm:px-8 lg:px-12 max-w-6xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold mb-2 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Geolocation Infrastructure
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-gov-navy tracking-tight">
              {t.navMap || 'Mandi Network Map'} · {lang === 'te' ? 'సమీప కొనుగోలు కేంద్రాలు' : 'Nearby Procurement Hubs'}
            </h2>
            <p className="text-sm text-slate-500 mt-1 max-w-lg">
              Interactive spatial view of active grain procurement centres and farmer-requested sanction points.
            </p>
          </div>
          <button
            onClick={() => onOpenAuth('farmer')}
            className="self-start sm:self-end text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-4 py-2.5 rounded-xl border border-amber-300 transition-all flex items-center gap-1.5 active:scale-[0.97] shadow-sm"
          >
            <span>{t.navCenterRequest || 'Request New Centre'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-gov-lg bg-white">
          <ProcurementMap
            centres={centres}
            requests={requests}
            height="420px"
            lang={lang}
            onSelectCentre={() => onOpenAuth('farmer')}
          />
        </div>
      </section>

      {/* ── FOOTER ── */}
      <GovFooter lang={lang} />
    </div>
  );
}
