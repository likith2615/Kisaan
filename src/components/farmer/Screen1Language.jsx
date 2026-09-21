import React from 'react';
import { Check, Globe } from 'lucide-react';
import { translations } from '../../translations';

export default function Screen1Language({ currentLang, onSelectLang, onContinue }) {
  const t = translations[currentLang] || translations.en;

  const languages = [
    { code: 'te', native: 'తెలుగు', name: 'Telugu', subtitle: 'ఆంధ్రప్రదేశ్ & తెలంగాణ రైతుల కోసం', flag: '🌾' },
    { code: 'en', native: 'English', name: 'English', subtitle: 'Official Procurement Portal', flag: '🇮🇳' },
    { code: 'hi', native: 'हिन्दी', name: 'Hindi', subtitle: 'उत्तर एवं मध्य भारत के किसानों के लिए', flag: '🚜' },
    { code: 'kn', native: 'ಕನ್ನಡ', name: 'Kannada', subtitle: 'ಕರ್ನಾಟಕ ರೈತ ಬಾಂಧವರಿಗಾಗಿ', flag: '🌱' }
  ];

  return (
    <div className="flex-1 flex flex-col justify-between p-4 sm:p-6 max-w-lg mx-auto w-full animate-fadeIn">
      {/* Top Header / Branding */}
      <div className="text-center pt-4 pb-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 mb-3 shadow-sm">
          <Globe className="w-9 h-9" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          {t.chooseLanguage}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 mt-1 max-w-sm mx-auto">
          {t.chooseLanguageSub}
        </p>
      </div>

      {/* Language Selection Cards (Minimum 48px target, high contrast) */}
      <div className="grid grid-cols-1 gap-3.5 my-auto py-4">
        {languages.map((langItem) => {
          const isSelected = currentLang === langItem.code;
          return (
            <button
              key={langItem.code}
              type="button"
              onClick={() => onSelectLang(langItem.code)}
              className={`w-full min-h-[64px] flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-200 active:scale-[0.98] ${
                isSelected
                  ? 'border-emerald-600 bg-emerald-50/80 shadow-md shadow-emerald-600/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 shadow-sm'
              }`}
            >
              <div className="flex items-center space-x-3.5 text-left">
                <span className="text-3xl select-none" role="img" aria-label={langItem.name}>
                  {langItem.flag}
                </span>
                <div>
                  <div className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                    {langItem.native}
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      {langItem.name}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    {langItem.subtitle}
                  </div>
                </div>
              </div>

              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-300 bg-white'
                }`}
              >
                {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* One Primary Action Button */}
      <div className="pt-4 pb-2">
        <button
          type="button"
          onClick={onContinue}
          className="w-full min-h-[54px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-lg font-bold rounded-2xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 focus:ring-4 focus:ring-emerald-500/30"
        >
          <span>{t.continueBtn}</span>
          <span className="text-xl">➔</span>
        </button>
      </div>
    </div>
  );
}
