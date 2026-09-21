import React, { useState, useEffect } from 'react';
import {
  Home,
  PlusCircle,
  Clock,
  History,
  User,
  WifiOff,
  MapPin,
  Zap,
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { translations } from '../../translations';

// Import all Farmer screens
import Screen1Language from './Screen1Language';
import Screen2Login from './Screen2Login';
import Screen3Onboarding from './Screen3Onboarding';
import Screen4Home from './Screen4Home';
import Screen5BookSlot from './Screen5BookSlot';
import Screen6RequestLoc from './Screen6RequestLoc';
import Screen7MyBookings from './Screen7MyBookings';
import Screen8LiveQueue from './Screen8LiveQueue';
import Screen9Tracking from './Screen9Tracking';
import Screen10Profile from './Screen10Profile';
import ProcurementMap from '../ProcurementMap';
import ErrorBoundary from '../ErrorBoundary';
import VoiceAgent from '../VoiceAgent';
import { usePushNotifications } from '../../hooks/usePushNotifications';


export default function FarmerApp({
  user,
  lang = 'en',
  onLanguageChange,
  onLoginSuccess,
  onLogout
}) {
  // FIX: Properly import translations
  const t = translations[lang] || translations.en;

  // Determine active screen
  const [activeScreen, setActiveScreen] = useState(() => {
    if (!user) return 'home';
    const isIncomplete = !user.village || !user.name || user.name.startsWith('Farmer (');
    if (isIncomplete) return 'onboarding';
    return 'home';
  });

  useEffect(() => {
    if (user) {
      const isIncomplete = !user.village || !user.name || user.name.startsWith('Farmer (');
      if (isIncomplete && activeScreen !== 'onboarding') {
        setActiveScreen('onboarding');
      }
    }
  }, [user]);

  const [overview, setOverview] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [locations, setLocations] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Auto-register push notification permissions for PWA
  const { isSupported: isPushSupported, isSubscribed: isPushSubscribed, subscribe: subscribePush } = usePushNotifications(user);

  useEffect(() => {
    if (user && isPushSupported && !isPushSubscribed) {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        subscribePush();
      } else if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        // Proactively request permission on farmer home screen
        const timer = setTimeout(() => {
          subscribePush().catch(() => {});
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [user, isPushSupported, isPushSubscribed]);

  // Monitor online / offline state

  useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch full farmer overview and active procurement centers
  const fetchFarmerData = async () => {
    if (!user?.id) return;
    try {
      const [ovRes, locRes, slotRes] = await Promise.all([
        fetch(`/api/farmer-overview/${user.id}`),
        fetch('/api/locations'),
        fetch('/api/slots')
      ]);

      const ov   = await ovRes.json();
      const loc  = await locRes.json();
      const slt  = await slotRes.json();

      if (ov.success)  {
        setOverview(ov.data);
        localStorage.setItem(`kissan_overview_${user.id}`, JSON.stringify(ov.data));
      }
      if (loc.success) {
        setLocations(loc.data);
        localStorage.setItem('kissan_locations', JSON.stringify(loc.data));
      }
      if (slt.success) {
        setSlots(slt.data);
        localStorage.setItem('kissan_slots', JSON.stringify(slt.data));
      }
    } catch (err) {
      // Offline fallback: load cached state from localStorage
      try {
        const cachedOv  = localStorage.getItem(`kissan_overview_${user.id}`);
        const cachedLoc = localStorage.getItem('kissan_locations');
        const cachedSlt = localStorage.getItem('kissan_slots');
        if (cachedOv)  setOverview(JSON.parse(cachedOv));
        if (cachedLoc) setLocations(JSON.parse(cachedLoc));
        if (cachedSlt) setSlots(JSON.parse(cachedSlt));
      } catch (e) {
        console.warn('Could not read cached data:', e);
      }
    }
  };

  useEffect(() => {
    fetchFarmerData();
  }, [user?.id]);

  const [selectedBookingId, setSelectedBookingId] = useState(null);

  // Set up Supabase Realtime subscriptions + background polling fallback
  useEffect(() => {
    if (!user?.id) return;

    let channel = null;
    if (supabase) {
      channel = supabase
        .channel(`farmer-realtime-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'slots' },         () => fetchFarmerData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' },      () => fetchFarmerData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' },     () => fetchFarmerData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' },      () => fetchFarmerData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'points_ledger' }, () => fetchFarmerData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tracking' },      () => fetchFarmerData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'weighments' },    () => fetchFarmerData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => fetchFarmerData())
        .subscribe();
    }

    // Auto-polling fallback every 12 seconds
    const pollTimer = setInterval(() => fetchFarmerData(), 12000);

    return () => {
      if (channel && supabase) supabase.removeChannel(channel);
      clearInterval(pollTimer);
    };
  }, [user?.id]);

  // Derived reactive booking
  const currentBooking =
    (selectedBookingId && overview?.bookings?.find(b => b.id === selectedBookingId)) ||
    (selectedBooking  && overview?.bookings?.find(b => b.id === selectedBooking.id))  ||
    overview?.activeBooking ||
    overview?.bookings?.[0] ||
    selectedBooking;

  const handleLanguageContinue = () => {
    localStorage.setItem('kissan_has_chosen_lang', 'true');
    if (!user) {
      setActiveScreen('login');
    } else {
      setActiveScreen('home');
    }
  };

  const handleLogin = (newUser, role, isNewUser) => {
    onLoginSuccess(newUser, role);
    if (isNewUser) {
      setActiveScreen('onboarding');
    } else {
      setActiveScreen('home');
    }
  };

  // Bottom navigation items
  const navItems = [
    { id: 'home',        label: t.navHome      || 'Home',     icon: Home },
    { id: 'book_slot',   label: t.navBook      || 'Book',     icon: PlusCircle },
    { id: 'queue',       label: t.navQueue     || 'Queue',    icon: Zap },
    { id: 'my_bookings', label: t.navBookings  || 'Bookings', icon: History },
    { id: 'profile',     label: t.navProfile   || 'Profile',  icon: User },
  ];

  const hasActiveBooking = !!overview?.activeBooking;

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative bg-slate-50">

      {/* Offline Alert Ribbon */}
      {!isOnline && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shrink-0 animate-slideUp">
          <WifiOff className="w-3.5 h-3.5" />
          <span>{t.offlineMode || 'Offline mode — showing cached data. Connect to sync.'}</span>
        </div>
      )}

      {/* Push Notification Request Banner */}
      {isPushSupported && !isPushSubscribed && typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
        <div className="bg-emerald-800 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between gap-3 shadow-md shrink-0 animate-slideUp border-b border-emerald-900">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base shrink-0">🔔</span>
            <span className="truncate">
              {lang === 'te' ? 'లైవ్ క్యూ టోకెన్ మరియు బ్యాంక్ DBT పేమెంట్ అలర్ట్‌ల కోసం నోటిఫికేషన్లను అనుమతించండి' : 'Enable live queue token alerts & instant PFMS DBT payment notifications'}
            </span>
          </div>
          <button
            type="button"
            onClick={subscribePush}
            className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-900 rounded-lg text-xs font-black shadow-xs whitespace-nowrap cursor-pointer transition-all active:scale-95 shrink-0"
          >
            {lang === 'te' ? 'అనుమతించు (Allow)' : 'Allow Alerts'}
          </button>
        </div>
      )}

      {/* Screen Router */}
      <ErrorBoundary fallbackAction={() => setActiveScreen('home')}>
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeScreen === 'language' && (
            <Screen1Language
              currentLang={lang}
              onSelectLang={(selected) => onLanguageChange && onLanguageChange(selected)}
              onContinue={handleLanguageContinue}
            />
          )}

          {activeScreen === 'login' && (
            <Screen2Login lang={lang} onLoginSuccess={handleLogin} />
          )}

          {activeScreen === 'onboarding' && (
            <Screen3Onboarding
              user={user}
              lang={lang}
              onSaveProfile={(updatedUser) => {
                onLoginSuccess(updatedUser, 'farmer');
                setActiveScreen('home');
              }}
            />
          )}

          {activeScreen === 'home' && (
            <Screen4Home
              user={user}
              lang={lang}
              overview={overview}
              onNavigate={(screen) => setActiveScreen(screen)}
            />
          )}

          {activeScreen === 'book_slot' && (
            <Screen5BookSlot
              user={user}
              lang={lang}
              locations={locations}
              slots={slots}
              activeBooking={overview?.activeBooking}
              onBookingSuccess={(booking) => {
                setSelectedBooking(booking);
                fetchFarmerData();
              }}
              onGoToQueue={(booking) => {
                setSelectedBooking(booking);
                fetchFarmerData();
                setActiveScreen('queue');
              }}
              onRequestLocation={() => setActiveScreen('request_loc')}
              onBack={() => setActiveScreen('home')}
            />
          )}

          {activeScreen === 'request_loc' && (
            <Screen6RequestLoc
              user={user}
              lang={lang}
              onBack={() => setActiveScreen('home')}
              onRequestSubmitted={() => fetchFarmerData()}
            />
          )}

          {activeScreen === 'my_bookings' && (
            <Screen7MyBookings
              user={user}
              lang={lang}
              bookings={overview?.bookings || []}
              onCancelBooking={() => fetchFarmerData()}
              onBack={() => setActiveScreen('home')}
              onNavigate={(screen, b) => {
                if (b) {
                  setSelectedBooking(b);
                  setSelectedBookingId(b.id || b.booking_id);
                }
                setActiveScreen(screen);
              }}
            />
          )}

          {activeScreen === 'queue' && (
            <Screen8LiveQueue
              user={user}
              lang={lang}
              booking={currentBooking}
              onBack={() => setActiveScreen('home')}
              onNavigate={(screen) => setActiveScreen(screen)}
              onCheckInSuccess={() => fetchFarmerData()}
            />
          )}

          {activeScreen === 'tracking' && (
            <Screen9Tracking
              user={user}
              lang={lang}
              booking={currentBooking}
              onBack={() => setActiveScreen('home')}
              onNavigate={(screen) => setActiveScreen(screen)}
            />
          )}

          {activeScreen === 'map' && (
            <div className="flex-1 overflow-y-auto p-4 max-w-lg lg:max-w-4xl mx-auto w-full space-y-4 pb-28 animate-fadeIn">
              <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-card flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-5 h-5 text-emerald-600" />
                    <span>Live Andhra Pradesh Mandi Map</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Explore procurement yards, operating hours & real-time capacity</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveScreen('home')}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                >
                  ← Back
                </button>
              </div>

              <div className="bg-white p-2 rounded-3xl border border-slate-200 shadow-card overflow-hidden">
                <ProcurementMap
                  centres={locations.filter(l => l.status === 'active' || !l.status)}
                  requests={locations.filter(l => l.status === 'pending')}
                  height="460px"
                  onSelectCentre={() => setActiveScreen('book_slot')}
                />
              </div>

              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center justify-between">
                <span>🌾 Tap any green mandi pin to view daily quota & contact info</span>
                <button
                  type="button"
                  onClick={() => setActiveScreen('book_slot')}
                  className="px-3.5 py-2 bg-emerald-700 text-white rounded-xl font-bold cursor-pointer hover:bg-emerald-800 transition-colors shrink-0 ml-3"
                >
                  Book Slot ➔
                </button>
              </div>
            </div>
          )}

          {activeScreen === 'profile' && (
            <Screen10Profile
              user={user}
              lang={lang}
              pointsLedger={overview?.pointsLedger || []}
              onUpdateProfile={(updatedUser) => {
                onLoginSuccess(updatedUser, 'farmer');
                fetchFarmerData();
              }}
              onLogout={onLogout}
              onLanguageChange={onLanguageChange}
              onBack={() => setActiveScreen('home')}
            />
          )}
        </div>
      </ErrorBoundary>

      {/* ── BOTTOM NAVIGATION BAR ── */}
      {user && !['language', 'login', 'onboarding'].includes(activeScreen) && (
        <div className="fixed bottom-0 inset-x-0 z-40">
          {/* Safe area for phones */}
          <div className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto">
            <div className="bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-gov-xl md:rounded-t-3xl px-2 py-1.5">
              <div className="flex items-center justify-around">
                {navItems.map((item) => {
                  const Icon   = item.icon;
                  const isActive = activeScreen === item.id;
                  const showDot  = item.id === 'queue' && hasActiveBooking && !isActive;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveScreen(item.id);
                        fetchFarmerData();
                      }}
                      className={`relative flex flex-col items-center justify-center min-w-[60px] py-2 px-1.5 rounded-2xl transition-all duration-200 ${
                        isActive
                          ? 'text-emerald-700 bg-emerald-50'
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {/* Active pill indicator */}
                      {isActive && (
                        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-emerald-600" />
                      )}

                      {/* Live queue indicator dot */}
                      {showDot && (
                        <span className="absolute top-1.5 right-3 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white animate-pulse" />
                      )}

                      <Icon className={`w-5 h-5 transition-all ${isActive ? 'stroke-[2.5] scale-110' : 'stroke-2'}`} />
                      <span className={`text-[10px] mt-0.5 font-semibold ${isActive ? 'font-bold' : ''}`}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sarvam AI Voice Automation Assistant ── */}
      {user && (
        <VoiceAgent
          currentFarmerId={user.id}
          lang={lang}
          onBookingCreated={() => fetchFarmerData()}
          onNavigate={(screen) => setActiveScreen(screen)}
        />
      )}
    </div>
  );
}

