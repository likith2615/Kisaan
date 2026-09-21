import React from 'react';
import { translations } from '../translations';

export default function GovFooter({ lang = 'te' }) {
  const t = translations[lang] || translations.en;

  return (
    <footer className="bg-[#0B2545] text-slate-300 font-sans border-t-4 border-amber-500">

      {/* ── Beautiful Agricultural Banner before footer ── */}
      <div className="relative h-48 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=1400&q=70&auto=format&fit=crop"
          alt="Golden wheat fields"
          loading="lazy"
          className="w-full h-full object-cover object-center"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B2545] via-[#0B2545]/60 to-transparent" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <div className="text-3xl mb-2">🌾</div>
          <h3 className="text-white font-black text-xl sm:text-2xl drop-shadow-lg">
            Empowering Every Farmer, Every Season
          </h3>
          <p className="text-emerald-200 text-sm mt-1.5 max-w-xl font-medium">
            Transparent procurement · Direct bank credit · Zero middlemen
          </p>
        </div>
      </div>

      {/* ── Quick Links Banner ── */}
      <div className="bg-[#081B33] border-b border-gov-navy-700 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
          {[
            { href: 'https://india.gov.in',       icon: '🏛️', label: 'National Portal',   sub: 'india.gov.in' },
            { href: 'https://digitalindia.gov.in', icon: '🇮🇳', label: 'Digital India',     sub: 'digitalindia.gov.in' },
            { href: 'https://enam.gov.in',         icon: '🌾', label: 'e-NAM Portal',      sub: 'enam.gov.in' },
            { href: 'https://pmkisan.gov.in',      icon: '💰', label: 'PM-KISAN DBT',     sub: 'pmkisan.gov.in' },
            { href: 'https://agmarknet.gov.in',    icon: '📊', label: 'AGMARKNET',         sub: 'agmarknet.gov.in' },
            { href: 'https://pgportal.gov.in',     icon: '⚖️', label: 'CPGRAMS',           sub: 'Grievance Redressal' },
          ].map((link, i) => (
            <a
              key={i}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="p-2.5 rounded-xl bg-gov-navy-800 hover:bg-gov-navy-700 border border-gov-navy-600 flex flex-col items-center text-center transition-all group"
            >
              <span className="text-xl mb-1">{link.icon}</span>
              <span className="font-bold text-white group-hover:text-amber-300 text-[11px]">{link.label}</span>
              <span className="text-[10px] text-slate-400 mt-0.5">{link.sub}</span>
            </a>
          ))}
        </div>
      </div>

      {/* ── Main Footer Body ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

          {/* Col 1: Ministry Info */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-black text-xl shadow-md shadow-amber-500/20">
                🌾
              </div>
              <div>
                <h3 className="text-white font-black text-lg tracking-tight">{t.appName || 'Kisan Saathi'}</h3>
                <p className="text-amber-300 text-xs font-semibold mt-0.5">National Farmer Procurement & Slot Booking Platform</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-lg">
              An AI-enabled unified procurement framework developed for the Ministry of Agriculture & Farmers Welfare 
              and Food Corporation of India. Designed to eliminate mandi congestion, ensure zero-malpractice weighment, 
              and guarantee direct DBT credit under CACP MSP benchmarks.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {[
                { label: '✓ ISO 9001:2015 Certified', color: 'text-emerald-300 border-emerald-500/30' },
                { label: '🛡️ PFMS & NPCI Validated',  color: 'text-amber-300 border-amber-500/30' },
                { label: '⚡ SIH 2026 Innovation',      color: 'text-blue-300 border-blue-500/30' },
              ].map((badge, i) => (
                <span key={i} className={`text-[11px] bg-gov-navy-800 ${badge.color} border px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1`}>
                  {badge.label}
                </span>
              ))}
            </div>
          </div>

          {/* Col 2: Farmer Helpdesks */}
          <div>
            <h4 className="text-amber-300 font-bold text-sm mb-4 uppercase tracking-wider border-b border-gov-navy-600 pb-2">
              Farmer Helpdesks
            </h4>
            <ul className="space-y-3 text-xs">
              <li className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-amber-400 text-sm mt-0.5 shrink-0">call</span>
                <div>
                  <p className="font-bold text-white">Kisan Call Centre (KCC)</p>
                  <a href="tel:18001801551" className="text-amber-300 hover:underline text-[11px]">1800-180-1551 (Toll Free)</a>
                  <p className="text-[10px] text-slate-500 mt-0.5">6:00 AM – 10:00 PM, All 7 Days</p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-amber-400 text-sm mt-0.5 shrink-0">mail</span>
                <div>
                  <p className="font-bold text-white">E-Procurement Support</p>
                  <p className="text-slate-400 text-[11px]">support.kisansaathi@gov.in</p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-amber-400 text-sm mt-0.5 shrink-0">domain</span>
                <div>
                  <p className="font-bold text-white">Krishi Bhavan</p>
                  <p className="text-[11px] text-slate-400">Dr. Rajendra Prasad Road, New Delhi 110001</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Col 3: Portal Standards */}
          <div>
            <h4 className="text-amber-300 font-bold text-sm mb-4 uppercase tracking-wider border-b border-gov-navy-600 pb-2">
              Gov Guidelines
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              {[
                { href: '#msp-table',        label: 'Official MSP Gazette 2026' },
                { href: '#weighment-norms',  label: 'CACP Moisture & Tare Norms' },
                { href: '#dbt-guidelines',   label: 'DBT Direct Transfer Timeline' },
                { href: '#privacy',          label: 'Privacy & Aadhaar Data Protection' },
                { href: '#terms',            label: 'Terms of Service & Mandi By-laws' },
                { href: '#accessibility',    label: 'Guidelines for Indian Govt Websites (GIGW)' },
              ].map((link, i) => (
                <li key={i}>
                  <a href={link.href} className="hover:text-amber-300 transition-colors flex items-center gap-1.5">
                    <span className="text-amber-500">→</span>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Bottom Legal Ribbon ── */}
      <div className="bg-[#061222] border-t border-gov-navy-700 py-5 px-4 sm:px-6 lg:px-8 text-[11px] text-slate-400">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left">
          <div>
            <p className="text-slate-300 font-medium">
              © 2026 Ministry of Agriculture & Farmers Welfare, Government of India. All Rights Reserved.
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              Portal Designed, Developed and Hosted by National Informatics Centre (NIC) / SIH 2026 Team.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              GIGW 3.0 Compliant
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">Last Reviewed: Sep 2026</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
