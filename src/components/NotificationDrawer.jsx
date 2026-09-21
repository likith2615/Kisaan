import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  X, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  ShieldCheck, 
  RefreshCw, 
  Scale, 
  IndianRupee, 
  Truck,
  Trash2
} from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function NotificationDrawer({ 
  isOpen, 
  onClose, 
  user, 
  role = 'farmer' 
}) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const url = role === 'farmer' && user?.id 
        ? `/api/notifications?user_id=${encodeURIComponent(user.id)}` 
        : '/api/notifications';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        let list = data.data;
        if (role === 'farmer' && user?.id) {
          list = list.filter(n => !n.user_id || n.user_id === user.id || n.user_id === user.phone);
        }
        setNotifications(list.sort((a, b) => new Date(b.timestamp || b.created_at || 0) - new Date(a.timestamp || a.created_at || 0)));
      }
    } catch (err) {
      console.warn('Could not load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchNotifications();

    let channel = null;
    if (supabase) {
      channel = supabase
        .channel('drawer-notifications-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
          fetchNotifications();
        })
        .subscribe();
    }

    return () => {
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, [isOpen, user?.id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end animate-fadeIn">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slideLeft">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Official SMS & App Alerts
              </h3>
              <p className="text-[11px] text-slate-500">
                Government MSP Dispatch & Gate Sequence Updates
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={fetchNotifications}
              disabled={loading}
              className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              title="Refresh alerts"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Alerts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">No new alerts yet</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Official SMS alerts for slot confirmation, yard entry, weighment, and bank DBT payments will appear here in real time.
              </p>
            </div>
          ) : (
            notifications.map((notif, idx) => {
              const msg = notif.message || '';
              const isPayment = msg.includes('PFMS') || msg.includes('రూ.') || msg.includes('Rs.') || msg.includes('చెల్లింపు');
              const isWeigh = msg.includes('వేబ్రిడ్జి') || msg.includes('Weighbridge') || msg.includes('కొనుగోలు పూర్తయింది');
              const isQueue = msg.includes('క్యూలో') || msg.includes('queue') || msg.includes('స్థానంలో');
              const isBooking = msg.includes('స్లాట్') || msg.includes('Slot') || msg.includes('బుకింగ్');

              return (
                <div 
                  key={notif.id || idx}
                  className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-xs hover:border-slate-300 transition-all text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-white text-[11px] ${
                        isPayment 
                          ? 'bg-emerald-600' 
                          : isWeigh 
                          ? 'bg-purple-600' 
                          : isQueue 
                          ? 'bg-blue-600' 
                          : 'bg-amber-600'
                      }`}>
                        {isPayment ? '₹' : isWeigh ? '⚖' : isQueue ? '🚚' : '📩'}
                      </span>
                      <span className="font-bold text-slate-800">
                        {isPayment 
                          ? 'DBT Payment Dispatched' 
                          : isWeigh 
                          ? 'Weighbridge Call' 
                          : isQueue 
                          ? 'Yard Gate Position' 
                          : isBooking 
                          ? 'Procurement Slot Confirmed' 
                          : 'Official Alert'}
                      </span>
                    </div>

                    <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded-md">
                      {notif.channel || 'SMS/App'}
                    </span>
                  </div>

                  <p className="text-slate-700 leading-relaxed font-medium">
                    {msg}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                    <span>
                      {notif.timestamp ? new Date(notif.timestamp).toLocaleString() : 'Just now'}
                    </span>
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{notif.status || 'Delivered'}</span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 text-center">
          <p className="text-[11px] text-slate-500">
            Automated notifications powered by DoCA National SMS Gateway
          </p>
        </div>
      </div>
    </div>
  );
}
