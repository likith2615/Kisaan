import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import AuthScreen from './components/AuthScreen';
import FarmerApp from './components/farmer/FarmerApp';
import AdminPanel from './components/admin/AdminPanel';
import ErrorBoundary from './components/ErrorBoundary';
import GovHeader from './components/GovHeader';
import { X } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('kissan_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [currentRole, setCurrentRole] = useState(() => {
    return localStorage.getItem('kissan_role') || 'farmer';
  });

  const [lang, setLang] = useState(() => {
    return localStorage.getItem('kissan_lang') || 'en';
  });

  // Auth modal state — 'farmer' | 'admin' | null
  const [authMode, setAuthMode] = useState(null);
  const [isGuestMode, setIsGuestMode] = useState(false);

  // Always force white theme
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('kissan_theme', 'light');
  }, []);

  // Trap ESC key to close auth modal
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && authMode) setAuthMode(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [authMode]);

  const handleLoginSuccess = (user, role) => {
    setCurrentUser(user);
    setCurrentRole(role);
    setAuthMode(null);
    setIsGuestMode(false);
    localStorage.setItem('kissan_user', JSON.stringify(user));
    localStorage.setItem('kissan_role', role);
    if (role === 'farmer') {
      localStorage.setItem('kissan_has_registered', 'true');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentRole('farmer');
    setIsGuestMode(false);
    localStorage.removeItem('kissan_user');
    localStorage.removeItem('kissan_role');
  };

  const handleGuestEntry = () => {
    setIsGuestMode(true);
    setCurrentUser({ id: 'GUEST', name: 'Guest', isGuest: true });
    setCurrentRole('farmer');
    localStorage.setItem('kissan_user', JSON.stringify({ id: 'GUEST', name: 'Guest', isGuest: true }));
    localStorage.setItem('kissan_role', 'farmer');
  };

  const handleLanguageChange = (newLang) => {
    setLang(newLang);
    localStorage.setItem('kissan_lang', newLang);
  };

  // ─── STATES ─────────────────────────────────────────────────
  // 1. Not logged in → show LandingPage with GovHeader
  // 2. Auth modal open → LandingPage dimmed + AuthScreen modal
  // 3. Logged in as farmer → FarmerApp with GovHeader
  // 4. Logged in as admin → AdminPanel with GovHeader

  const isLoggedIn = !!currentUser && !currentUser.isGuest;
  const showLanding = !currentUser;

  return (
    <div className="min-h-screen flex flex-col bg-white font-sans antialiased text-slate-900 overflow-hidden">

      {/* ── GOV HEADER (always visible) ── */}
      <GovHeader
        lang={lang}
        onLanguageChange={handleLanguageChange}
        currentUser={currentUser}
        currentRole={currentRole}
        onLogout={handleLogout}
        onOpenAuth={setAuthMode}
        onGuestEntry={handleGuestEntry}
      />

      {/* ── MAIN CONTENT AREA ── */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <ErrorBoundary>

          {/* Landing page — shown when no user */}
          {showLanding && (
            <div className={`flex-1 flex flex-col overflow-y-auto transition-all duration-300 ${authMode ? 'blur-sm brightness-75 pointer-events-none select-none' : ''}`}>
              <LandingPage
                lang={lang}
                onLanguageChange={handleLanguageChange}
                onOpenAuth={setAuthMode}
                onGuestEntry={handleGuestEntry}
              />
            </div>
          )}

          {/* Farmer app */}
          {currentUser && currentRole === 'farmer' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <FarmerApp
                user={currentUser}
                lang={lang}
                onLanguageChange={handleLanguageChange}
                onLoginSuccess={handleLoginSuccess}
                onLogout={handleLogout}
              />
            </div>
          )}

          {/* Admin panel */}
          {currentUser && currentRole === 'admin' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <AdminPanel
                user={currentUser}
                lang={lang}
                onLoginSuccess={handleLoginSuccess}
                onLogout={handleLogout}
              />
            </div>
          )}

        </ErrorBoundary>
      </main>

      {/* ── AUTH MODAL OVERLAY ── */}
      {authMode && !currentUser && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Login"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setAuthMode(null)}
          />

          {/* Modal card */}
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden animate-scaleIn flex flex-col">
            {/* Close button */}
            <button
              onClick={() => setAuthMode(null)}
              className="absolute top-4 right-4 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/40 text-white transition-all active:scale-90"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex-1 overflow-y-auto">
              <AuthScreen
                onLoginSuccess={handleLoginSuccess}
                defaultMode={authMode}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
