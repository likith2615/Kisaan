import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  QrCode, 
  XCircle, 
  ArrowLeft, 
  AlertTriangle, 
  CheckCircle2, 
  History 
} from 'lucide-react';
import { translations } from '../../translations';

export default function Screen7MyBookings({ 
  user, 
  lang, 
  bookings = [], 
  onCancelBooking, 
  onBack,
  onNavigate 
}) {
  const t = translations[lang] || translations.en;

  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'past'
  const [cancellingBooking, setCancellingBooking] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const upcomingBookings = bookings.filter(b => 
    ['booked', 'arrived_waiting_confirmation', 'arrived', 'checked_in', 'in_progress', 'weighed'].includes(b.status) &&
    b.payment_status !== 'paid' &&
    b.status !== 'completed'
  );
  const pastBookings = bookings.filter(b => 
    ['completed', 'cancelled', 'no_show'].includes(b.status) || 
    b.payment_status === 'paid' ||
    b.status === 'delivery_completed'
  );

  const handleConfirmCancel = async () => {
    if (!cancellingBooking) return;
    setCancelLoading(true);

    try {
      const res = await fetch(`/api/bookings/${cancellingBooking.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success && onCancelBooking) {
        onCancelBooking(cancellingBooking.id);
      }
    } catch (err) {
      if (onCancelBooking) onCancelBooking(cancellingBooking.id);
    } finally {
      setCancelLoading(false);
      setCancellingBooking(null);
    }
  };

  const displayedBookings = activeTab === 'upcoming' ? upcomingBookings : pastBookings;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-lg lg:max-w-5xl mx-auto w-full space-y-4 animate-fadeIn pb-28">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <h1 className="text-lg sm:text-xl font-black text-slate-900">
          {t.myBookingsTitle}
        </h1>
        <div className="w-10" />
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2 bg-slate-200/80 p-1 rounded-2xl">
        <button
          type="button"
          onClick={() => setActiveTab('upcoming')}
          className={`py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'upcoming'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t.upcomingTab} ({upcomingBookings.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('past')}
          className={`py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'past'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t.pastTab} ({pastBookings.length})
        </button>
      </div>

      {/* Bookings List */}
      {displayedBookings.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-3xl border border-slate-200">
          <History className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-800">{t.noBookingsFound}</h3>
          <p className="text-xs text-slate-500 mt-1">
            {activeTab === 'upcoming' ? 'You have no upcoming procurement slots.' : 'No past procurement history.'}
          </p>
          {activeTab === 'upcoming' && (
            <button
              type="button"
              onClick={() => onNavigate('book_slot')}
              className="mt-4 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm"
            >
              + Book a Slot Now
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedBookings.map((b) => {
            const isUpcoming = ['booked', 'checked_in', 'in_progress'].includes(b.status);
            return (
              <div
                key={b.id}
                className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm space-y-3 relative overflow-hidden"
              >
                <div className="flex items-start justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-slate-900">
                        {b.token_number || 'TK-482'}
                      </span>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        b.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : b.status === 'delivery_completed'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : b.status === 'arrived_waiting_confirmation'
                          ? 'bg-rose-100 text-rose-900 border border-rose-300 animate-pulse'
                          : b.status === 'checked_in'
                          ? 'bg-blue-100 text-blue-800'
                          : b.status === 'in_progress'
                          ? 'bg-purple-100 text-purple-800'
                          : b.status === 'cancelled'
                          ? 'bg-slate-100 text-slate-500 line-through'
                          : 'bg-amber-100 text-amber-900'
                      }`}>
                        {b.status === 'arrived_waiting_confirmation' ? 'Awaiting Verification' : b.status === 'delivery_completed' ? 'Delivery Accepted' : b.status}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-500 mt-0.5">
                      {b.crop_type || 'Paddy'} • {b.expected_quantity || 50} Q
                    </div>
                  </div>

                  <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                    <QrCode className="w-5 h-5 text-slate-700" />
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium truncate">{b.location?.name || 'Central Mandi Yard'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{b.slot?.date || 'Today'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="truncate">{b.slot?.time || b.slot?.time_window || '09:00 - 11:00 AM'}</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons for bookings */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isUpcoming && (
                      <button
                        type="button"
                        onClick={() => onNavigate('queue', b)}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Live Waiting List</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onNavigate('tracking', b)}
                      className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <span>Track Status & Payment</span>
                    </button>
                  </div>

                  {/* Cancel action for upcoming bookings */}
                  {isUpcoming && b.status === 'booked' && (
                    <button
                      type="button"
                      onClick={() => setCancellingBooking(b)}
                      className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>{t.cancelBooking}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancellation Warning Dialog Modal */}
      {cancellingBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4 animate-scaleUp">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-black text-slate-900">
                Cancel Slot Booking?
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                {t.cancelWarning}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={cancelLoading}
                onClick={handleConfirmCancel}
                className="w-full min-h-[48px] bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center"
              >
                {cancelLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  t.cancelConfirm
                )}
              </button>

              <button
                type="button"
                disabled={cancelLoading}
                onClick={() => setCancellingBooking(null)}
                className="w-full min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition-all"
              >
                {t.keepSlot}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
