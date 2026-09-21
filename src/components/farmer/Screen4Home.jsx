import React from 'react';
import {
  Calendar,
  MapPin,
  Clock,
  Truck,
  IndianRupee,
  Star,
  ArrowRight,
  PlusCircle,
  ListOrdered,
  Building2,
  History,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { translations } from '../../translations';

// Contextual crop image based on booking data
const SEASON_IMAGE = 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=900&q=70&auto=format&fit=crop';
const DEFAULT_BANNER = 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=900&q=70&auto=format&fit=crop';

export default function Screen4Home({
  user,
  lang,
  overview,
  onNavigate
}) {
  const t = translations[lang] || translations.en;

  const points = Number(overview?.farmer?.points ?? user?.points ?? 100);
  const isHighPriority = points >= 100;
  const activeBooking = overview?.activeBooking;
  const today = new Date().toISOString().split('T')[0];
  const isSlotToday = activeBooking?.slot?.date === today;

  // Completed procurements handled by Admin 2
  const completedBookings = overview?.completedBookings || (overview?.bookings || []).filter(b => 
    b.status === 'completed' || b.payment_status === 'paid' || b.status === 'delivery_completed'
  );
  const latestCompleted = overview?.latestCompleted || completedBookings[0] || null;

  const latestBooking  = activeBooking || latestCompleted || overview?.bookings?.[0];
  const latestTracking = latestBooking?.tracking;
  const latestPayment  = latestBooking?.payment;
  const hasBooking     = !!latestBooking;

  const isPaid = latestPayment?.status === 'paid' || latestBooking?.payment_status === 'paid' || latestBooking?.status === 'completed';
  const isReady = latestPayment?.status === 'ready_for_dbt' || latestBooking?.status === 'delivery_completed' || latestBooking?.actual_quantity;

  const paymentStatus = hasBooking
    ? (isPaid
      ? 'Paid ✓'
      : isReady
      ? 'Processing…'
      : 'Scheduled')
    : 'No Payout';

  const cropStage = hasBooking
    ? (latestTracking?.stage || (activeBooking?.status === 'completed' ? 'Procured' : (latestCompleted ? 'Procured' : 'Scheduled')))
    : 'Not Booked';

  return (
    <div className="flex-1 overflow-y-auto pb-28 bg-slate-50">

      {/* ── HERO BANNER IMAGE ── */}
      <div className="relative h-44 sm:h-52 overflow-hidden">
        <img
          src={activeBooking ? SEASON_IMAGE : DEFAULT_BANNER}
          alt="Paddy field harvest"
          loading="lazy"
          className="w-full h-full object-cover object-center"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-gov-navy/70 via-gov-navy/30 to-slate-50" />

        {/* Floating user info on top of image */}
        <div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 py-3 flex items-end justify-between max-w-lg lg:max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 border-2 border-white text-white font-black text-xl flex items-center justify-center shadow-lg shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() || 'K'}
            </div>
            <div>
              <div className="text-[10px] font-bold text-white/80 uppercase tracking-wider">
                {t.homeGreeting || 'Welcome back,'}
              </div>
              <h2 className="text-lg font-black text-white leading-tight drop-shadow">
                {user?.name || 'Farmer'}
              </h2>
              <div className="flex items-center text-xs text-white/80 gap-1">
                <MapPin className="w-3 h-3" />
                <span>{user?.village || 'Village'}, {user?.district || 'Kurnool'}</span>
              </div>
            </div>
          </div>

          {/* Reliability Points Badge */}
          <button
            type="button"
            onClick={() => onNavigate('profile')}
            className={`px-3 py-2 rounded-2xl border-2 flex flex-col items-center transition-all active:scale-95 cursor-pointer shadow-lg ${
              isHighPriority
                ? 'bg-amber-500/90 border-amber-300 text-slate-950 backdrop-blur-sm'
                : 'bg-white/90 border-white/50 text-slate-800 backdrop-blur-sm'
            }`}
          >
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
              <span className="text-base font-black">{points}</span>
            </div>
            <span className="text-[9px] font-bold uppercase">
              {isHighPriority ? '⚡ Priority' : 'Standard'}
            </span>
          </button>
        </div>
      </div>

      {/* ── CONTENT AREA ── */}
      <div className="px-4 sm:px-6 pt-4 max-w-lg lg:max-w-6xl mx-auto w-full space-y-4 sm:space-y-5">

        {/* ── GRID: Left (status + action) | Right (quick actions) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

          {/* LEFT COLUMN */}
          <div className="lg:col-span-7 space-y-4">

            {/* MSP Procurement Live Status Card */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-5 shadow-gov-xl relative overflow-hidden animate-fadeIn">
              {/* Glow accent */}
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-40 h-40 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

              <div className="relative z-10">
                <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>MSP Procurement · Live Status</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping ml-1" />
                </div>

                {activeBooking ? (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold text-slate-400">
                          {isSlotToday ? '🟢 Active Today' : '📅 Upcoming Slot'}
                        </span>
                        <h3 className="text-xl font-black text-white mt-0.5 leading-tight">
                          {activeBooking.location?.name || 'Kurnool Central Mandi'}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">{activeBooking.location?.address || 'Andhra Pradesh'}</p>
                      </div>
                      <div className="px-3 py-1.5 bg-amber-400 text-slate-950 text-xs font-black rounded-xl uppercase tracking-wider shadow-sm shrink-0 animate-borderGlow">
                        {activeBooking.token_number || 'TK-482'}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-700/40 text-xs">
                      <div className="flex items-center gap-2 text-slate-200">
                        <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{activeBooking.slot?.date || 'Today'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-200">
                        <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="truncate">{activeBooking.slot?.time || activeBooking.slot?.time_window || '09:00 – 11:00 AM'}</span>
                      </div>
                    </div>
                  </div>
                ) : latestCompleted ? (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-emerald-400">
                            ✅ గత పంట సేకరణ పూర్తయింది
                          </span>
                          <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-black rounded-lg">
                            PAID ✓
                          </span>
                        </div>
                        <h3 className="text-xl font-black text-white mt-1 leading-tight">
                          {latestCompleted.crop_type || 'వరి'} · {latestCompleted.actual_quantity || latestCompleted.quantity || 50} క్వింటాళ్లు
                        </h3>
                        <p className="text-xs text-slate-300 mt-0.5">
                          {latestCompleted.location?.name || 'Kurnool Agricultural Market Yard'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-black text-emerald-400">
                          ₹{Number(latestCompleted.payment?.amount || (latestCompleted.actual_quantity || latestCompleted.quantity || 50) * 2183).toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          PFMS DBT జమ అయింది
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-700/50 text-[11px]">
                      <div className="text-slate-300">
                        <span className="text-slate-400 block text-[10px]">ప్రభుత్వ PFMS UTR:</span>
                        <span className="font-mono text-emerald-300 font-bold truncate block text-[10px]">
                          {latestCompleted.utr_number || latestCompleted.payment?.utr_number || 'PFMS-DBT-SUCCESS'}
                        </span>
                      </div>
                      <div className="text-slate-300">
                        <span className="text-slate-400 block text-[10px]">నిల్వ ప్రదేశం:</span>
                        <span className="text-slate-200 font-semibold truncate block text-[10px]">
                          FCI సైలో (e-WHR: WHR-9842)
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-2">
                    <h3 className="text-lg font-black text-white leading-tight">{t.noActiveSlot || 'No active slot booking'}</h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      {t.noActiveSlotDesc || 'Book a slot to get your digital token and sell your crop at the guaranteed MSP rate.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 3 Core Answers */}
            <div className="grid grid-cols-3 gap-2.5 animate-slideUp" style={{ animationDelay: '80ms' }}>
              <div 
                onClick={() => onNavigate(activeBooking ? 'queue' : 'book_slot')}
                className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-card flex flex-col gap-1.5 cursor-pointer hover:border-blue-300 hover:bg-blue-50/20 transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase leading-none">When Slot?</div>
                <div className="text-xs font-black text-slate-900 truncate">
                  {activeBooking
                    ? (activeBooking.slot?.date === today ? '🟢 Today' : activeBooking.slot?.date)
                    : 'Not Booked'}
                </div>
              </div>

              <div
                onClick={() => onNavigate(hasBooking ? 'tracking' : 'book_slot')}
                className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-card flex flex-col gap-1.5 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase leading-none">Where Crop?</div>
                <div className={`text-xs font-black truncate capitalize ${hasBooking ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {cropStage}
                </div>
              </div>

              <div
                onClick={() => onNavigate(hasBooking ? 'tracking' : 'book_slot')}
                className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-card flex flex-col gap-1.5 cursor-pointer hover:border-amber-300 hover:bg-amber-50/30 transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <IndianRupee className="w-4 h-4" />
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase leading-none">When Paid?</div>
                <div className={`text-xs font-black truncate ${hasBooking ? 'text-amber-700' : 'text-slate-500'}`}>
                  {paymentStatus}
                </div>
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="space-y-2.5 animate-slideUp" style={{ animationDelay: '140ms' }}>
              {activeBooking ? (
                <>
                  <button
                    type="button"
                    onClick={() => onNavigate('queue')}
                    className="w-full min-h-[62px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-2xl px-5 py-4 shadow-gov-green hover:shadow-xl transition-all flex items-center justify-between font-black text-base group cursor-pointer"
                  >
                    <div className="flex items-center gap-3 text-left">
                      <span className="relative flex h-3 w-3 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400" />
                      </span>
                      <div>
                        <div>View Live Queue & Yard Status · Token {activeBooking.token_number || 'ACTIVE'}</div>
                        <div className="text-xs text-emerald-100 font-medium mt-0.5">
                          {activeBooking.status === 'checked_in'
                            ? 'Gate Check-In Verified • Next at Weighbridge'
                            : 'Tap to view real-time mandi waiting list'}
                        </div>
                      </div>
                    </div>
                    <Zap className="w-5 h-5 group-hover:scale-110 transition-transform shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate('tracking')}
                    className="w-full min-h-[48px] bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 hover:border-emerald-200 rounded-xl px-5 text-xs font-bold transition-all flex items-center justify-between cursor-pointer shadow-card"
                  >
                    <div className="flex items-center gap-2.5">
                      <Truck className="w-4 h-4 text-emerald-600" />
                      <span>Track Crop Procurement, Assay & Payment</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-emerald-600" />
                  </button>
                </>
              ) : latestCompleted ? (
                /* Primary Action when previous procurement was completed by Admin 2: allow booking another crop */
                <button
                  type="button"
                  onClick={() => onNavigate('book_slot')}
                  className="w-full min-h-[64px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:bg-emerald-800 text-white rounded-2xl px-5 py-4 shadow-gov-green hover:shadow-xl transition-all flex items-center justify-between font-black text-base group cursor-pointer"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <PlusCircle className="w-6 h-6 text-amber-300" />
                    </div>
                    <div>
                      <div className="text-base font-black">🌾 మరొక పంట స్లాట్ బుక్ చేసుకోండి (Book Another Crop)</div>
                      <div className="text-xs text-emerald-100 font-medium mt-0.5">
                        మునుపటి సేకరణ పూర్తయింది • కొత్త పంట స్లాట్ అందుబాటులో ఉంది
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform shrink-0" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate('book_slot')}
                  className="w-full min-h-[62px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-2xl px-5 py-4 shadow-gov-green hover:shadow-xl transition-all flex items-center justify-between font-black text-base group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <PlusCircle className="w-6 h-6 text-amber-300" />
                    <div className="text-left">
                      <div>{t.primaryActionBook || 'Book a Mandi Slot'}</div>
                      <div className="text-xs text-emerald-100 font-medium mt-0.5">Select mandi, date & arrival window</div>
                    </div>
                  </div>
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform shrink-0" />
                </button>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Quick Actions */}
          <div className="lg:col-span-5 space-y-2.5 animate-slideUp" style={{ animationDelay: '180ms' }}>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1 mb-1">
              Quick Actions
            </div>

            {[
              {
                id: 'map',
                icon: MapPin,
                iconBg: 'bg-emerald-50 text-emerald-600',
                title: 'Live AP Mandi Map',
                desc: 'Explore nearby procurement centers & capacity',
              },
              {
                id: 'request_loc',
                icon: Building2,
                iconBg: 'bg-amber-50 text-amber-600',
                title: t.quickActionRequest || 'Request New Centre',
                desc: 'Request nearby mandi with GPS pin & photo',
              },
              {
                id: 'my_bookings',
                icon: History,
                iconBg: 'bg-blue-50 text-blue-600',
                title: t.quickActionMyBookings || 'My Bookings',
                desc: 'View gate passes, token codes, or cancel slot',
              },
              {
                id: 'profile',
                icon: Star,
                iconBg: 'bg-purple-50 text-purple-600',
                title: t.quickActionProfile || 'Reliability Score',
                desc: `+20 on completion · -15 on cancellation`,
              },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => onNavigate(action.id)}
                  className="w-full p-4 rounded-2xl border border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/30 transition-all flex items-center justify-between text-left active:scale-[0.99] shadow-card hover:shadow-card-hover cursor-pointer min-h-[60px]"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${action.iconBg} flex items-center justify-center shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{action.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{action.desc}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                </button>
              );
            })}

            {/* Government Guarantee Card (desktop only) */}
            <div className="hidden lg:block bg-gradient-to-br from-gov-navy/5 to-emerald-50 rounded-2xl p-4 border border-emerald-200/50 text-xs space-y-2">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Official Government Procurement Guarantee</span>
              </div>
              <p className="text-slate-500 leading-relaxed text-[11px]">
                Tokens are digitally synchronized with Mandi Weighbridges. No waiting overnight.
                PFMS Direct Benefit Transfer credited within 48 hours of quality acceptance.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">ISO 9001</span>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">PFMS Validated</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
