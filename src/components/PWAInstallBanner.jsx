import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    if (isStandalone) return;

    // Check if previously dismissed
    if (localStorage.getItem('pwa_banner_dismissed') === 'true') return;

    // iOS detection
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    if (ios) {
      // On iOS, show manual instructions after short delay
      setTimeout(() => setShowBanner(true), 2000);
      return;
    }

    // Android/Chrome: capture beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    localStorage.setItem('pwa_banner_dismissed', 'true');
  };

  if (!showBanner || dismissed) return null;

  if (isIOS) {
    return (
      <div className="bg-slate-900 text-white px-4 py-3 flex items-center gap-3">
        <Smartphone className="w-5 h-5 text-emerald-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold">Install as App on iPhone</p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Tap <strong>Share</strong> → <strong>"Add to Home Screen"</strong> to install
          </p>
        </div>
        <button type="button" onClick={handleDismiss} className="text-slate-400 hover:text-white p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-emerald-600 text-white px-4 py-3 flex items-center gap-3">
      <Download className="w-5 h-5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold">Install Kisan Saathi App</p>
        <p className="text-[10px] text-emerald-200 mt-0.5">Works offline · Faster · No browser needed</p>
      </div>
      <button
        type="button"
        onClick={handleInstall}
        className="px-3 py-1.5 bg-white text-emerald-700 text-xs font-black rounded-xl shrink-0 hover:bg-emerald-50 transition-colors"
      >
        Install
      </button>
      <button type="button" onClick={handleDismiss} className="text-emerald-200 hover:text-white p-1 shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
