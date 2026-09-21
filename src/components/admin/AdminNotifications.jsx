import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, Send, Users, MapPin, Zap, AlertCircle,
  CheckCircle2, IndianRupee, Calendar, RefreshCw,
  ChevronDown, Search, BellRing, Megaphone, MessageSquare, X
} from 'lucide-react';
import { supabase } from '../../supabaseClient';

const NOTIFICATION_TYPES = [
  { id: 'general',        label: 'General Alert',       icon: '📣', color: 'bg-slate-100 text-slate-800 border-slate-300' },
  { id: 'slot_update',    label: 'Slot Update',          icon: '📅', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { id: 'queue_call',     label: 'Queue / Gate Call',    icon: '🚦', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { id: 'payment_update', label: 'Payment / DBT Update', icon: '💳', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { id: 'weighment',      label: 'Weighbridge Notice',   icon: '⚖️', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { id: 'urgent',         label: 'Urgent / Emergency',   icon: '🚨', color: 'bg-red-100 text-red-800 border-red-300' },
];

const TARGET_OPTIONS = [
  { id: 'ALL',          label: 'All Registered Farmers',    icon: Users,     desc: 'Every farmer in the system' },
  { id: 'queue_today',  label: 'Farmers in Queue Today',    icon: Zap,       desc: 'Only farmers with active slots today' },
  { id: 'location',     label: 'Farmers at Specific Mandi', icon: MapPin,    desc: 'Select mandi below' },
  { id: 'single',       label: 'One Specific Farmer',       icon: MessageSquare, desc: 'Search by name or phone' },
];

export default function AdminNotifications({ user }) {
  // Compose form
  const [title, setTitle] = useState('🌾 Kisan Saathi — Official Alert');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('general');
  const [target, setTarget] = useState('ALL');
  const [locationId, setLocationId] = useState('');
  const [singleFarmer, setSingleFarmer] = useState(null);
  const [farmerSearch, setFarmerSearch] = useState('');
  const [farmerResults, setFarmerResults] = useState([]);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  // Data
  const [locations, setLocations] = useState([]);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fetch data
  useEffect(() => {
    fetch('/api/locations').then(r => r.json()).then(d => { if (d.success) setLocations(d.data || []); }).catch(() => {});
    loadHistory();
  }, []);

  // Supabase realtime for history updates
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('admin-notif-history')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => loadHistory())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/notifications/admin-history');
      const data = await res.json();
      if (data.success) setHistory(data.data || []);
    } catch {}
    finally { setLoadingHistory(false); }
  };

  const searchFarmers = useCallback(async (q) => {
    if (!q || q.length < 2) { setFarmerResults([]); return; }
    try {
      const res = await fetch('/api/farmers');
      const data = await res.json();
      if (data.success) {
        const lower = q.toLowerCase();
        setFarmerResults(
          (data.data || []).filter(f =>
            f.name?.toLowerCase().includes(lower) ||
            f.phone?.includes(q) ||
            f.village?.toLowerCase().includes(lower) ||
            f.id?.toLowerCase().includes(lower)
          ).slice(0, 8)
        );
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (target === 'single') searchFarmers(farmerSearch);
  }, [farmerSearch, target, searchFarmers]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim()) { setSendResult({ success: false, error: 'Please enter a message.' }); return; }
    if (target === 'single' && !singleFarmer) { setSendResult({ success: false, error: 'Please select a farmer.' }); return; }
    if (target === 'location' && !locationId) { setSendResult({ success: false, error: 'Please select a mandi location.' }); return; }

    setSending(true);
    setSendResult(null);
    try {
      let url, body;

      if (target === 'single') {
        // Send to single farmer
        url = '/api/notifications/send';
        body = {
          farmer_id: singleFarmer.id,
          title,
          message,
          type,
          channel: 'App',
          sent_by: user?.id || 'ADMIN',
        };
      } else {
        // Broadcast
        url = '/api/notifications/broadcast';
        body = {
          title,
          message,
          type,
          channel: 'App',
          target: target === 'location' ? 'location' : target,
          location_id: target === 'location' ? locationId : undefined,
          sent_by: user?.id || 'ADMIN',
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        setSendResult({
          success: true,
          sent_count: data.sent_count || 1,
          push_count: data.push_delivered_count ?? (data.push_delivered ? 1 : 0),
          msg: data.message
        });
        // Clear form
        setMessage('');
        setSingleFarmer(null);
        setFarmerSearch('');
        loadHistory();
      } else {
        setSendResult({ success: false, error: data.error || 'Failed to send notification.' });
      }
    } catch (err) {
      setSendResult({ success: false, error: 'Network error. Check server connection.' });
    } finally {
      setSending(false);
    }
  };

  const selectedType = NOTIFICATION_TYPES.find(t => t.id === type) || NOTIFICATION_TYPES[0];

  // Quick message templates
  const TEMPLATES = {
    queue_call:     (loc) => `🚦 Gate Call: Your token is next at the weighbridge bay. Please bring your vehicle to the weighment platform immediately. Token holders at ${loc || 'Kurnool Mandi'} — report now.`,
    payment_update: () => `💳 Good news! Your MSP crop payment has been processed under PFMS DBT. Please check your bank account within 24 hours. UTR will be sent via SMS.`,
    slot_update:    (date) => `📅 Slot Update: Your procurement slot for ${date || 'today'} is confirmed. Please arrive 15 minutes before your slot time with original land records and Aadhaar.`,
    general:        () => `🌾 Official Notice from Kisan Saathi — ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}: Please ensure all crop samples are free of excess moisture (>17%). CACP quality norms apply.`,
    weighment:      () => `⚖️ Weighbridge Notice: All farmers must present original Pattadar Passbook / Aadhaar at the gate before weighment. Digital copies accepted via DigiLocker.`,
    urgent:         () => `🚨 URGENT: Due to heavy rainfall, mandi operations at the centre are temporarily suspended until further notice. New slot dates will be communicated shortly. Inconvenience regretted.`,
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full overflow-y-auto p-4 sm:p-6 pb-24">

      {/* ── LEFT: Compose Panel ── */}
      <div className="flex-1 max-w-xl space-y-5">

        <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-black text-slate-900 text-lg">Send Notification</h2>
            <p className="text-xs text-slate-500 mt-0.5">Admin → Farmer(s) — In-app + Web Push</p>
          </div>
        </div>

        <form onSubmit={handleSend} className="space-y-5">

          {/* Notification Type */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2.5">
              Notification Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {NOTIFICATION_TYPES.map(nt => (
                <button
                  key={nt.id}
                  type="button"
                  onClick={() => {
                    setType(nt.id);
                    if (!message) setMessage(TEMPLATES[nt.id]?.(locations[0]?.name, new Date().toLocaleDateString('en-IN')) || '');
                  }}
                  className={`p-3 rounded-2xl border-2 text-left transition-all ${
                    type === nt.id
                      ? `${nt.color} border-current shadow-sm`
                      : 'bg-white border-slate-200 hover:border-slate-400 text-slate-600'
                  }`}
                >
                  <div className="text-xl mb-1">{nt.icon}</div>
                  <div className={`text-[11px] font-bold leading-tight ${type === nt.id ? '' : 'text-slate-700'}`}>{nt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Target Recipients */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2.5">
              Send To
            </label>
            <div className="space-y-2">
              {TARGET_OPTIONS.map(opt => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { setTarget(opt.id); setSingleFarmer(null); setFarmerSearch(''); }}
                    className={`w-full p-3.5 rounded-2xl border-2 flex items-center gap-3 text-left transition-all ${
                      target === opt.id
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-slate-200 hover:border-slate-400 text-slate-700'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${target === opt.id ? 'text-amber-400' : 'text-slate-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-bold ${target === opt.id ? 'text-white' : ''}`}>{opt.label}</div>
                      <div className={`text-[11px] ${target === opt.id ? 'text-slate-400' : 'text-slate-400'}`}>{opt.desc}</div>
                    </div>
                    {target === opt.id && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Location selector */}
            {target === 'location' && (
              <div className="mt-3">
                <select
                  value={locationId}
                  onChange={e => setLocationId(e.target.value)}
                  className="w-full min-h-[44px] px-4 rounded-2xl border-2 border-slate-200 text-sm font-semibold text-slate-900 focus:border-slate-900 outline-none bg-white"
                >
                  <option value="">— Select Mandi —</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l.district})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Single farmer search */}
            {target === 'single' && (
              <div className="mt-3 space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={farmerSearch}
                    onChange={e => { setFarmerSearch(e.target.value); setSingleFarmer(null); }}
                    placeholder="Search by name, phone or village..."
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border-2 border-slate-200 text-sm focus:border-slate-900 outline-none bg-white"
                  />
                </div>
                {farmerResults.length > 0 && !singleFarmer && (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                    {farmerResults.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => { setSingleFarmer(f); setFarmerSearch(f.name); setFarmerResults([]); }}
                        className="w-full p-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center gap-2.5"
                      >
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-black text-sm flex items-center justify-center shrink-0">
                          {f.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-sm truncate">{f.name}</div>
                          <div className="text-xs text-slate-400 truncate">{f.phone} • {f.village}, {f.district}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {singleFarmer && (
                  <div className="flex items-center gap-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center shrink-0">
                      {singleFarmer.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-emerald-900 text-sm">{singleFarmer.name}</div>
                      <div className="text-xs text-emerald-700">{singleFarmer.phone} • {singleFarmer.village}</div>
                    </div>
                    <button type="button" onClick={() => { setSingleFarmer(null); setFarmerSearch(''); }} className="text-emerald-600 hover:text-emerald-800">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
              Notification Title
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. 🌾 Kisan Saathi — Queue Update"
              className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-sm font-semibold text-slate-900 focus:border-slate-900 outline-none"
            />
          </div>

          {/* Message */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                Message
              </label>
              <button
                type="button"
                onClick={() => setMessage(TEMPLATES[type]?.(locations[0]?.name) || '')}
                className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg hover:bg-amber-100"
              >
                ✨ Use Template
              </button>
            </div>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              required
              placeholder="Type your message here... (supports Telugu, Hindi, Kannada, English)"
              className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-sm text-slate-900 focus:border-slate-900 outline-none resize-none leading-relaxed"
            />
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[10px] text-slate-400">Delivered in-app immediately + browser push (if subscribed)</p>
              <span className="text-[10px] text-slate-400">{message.length}/500</span>
            </div>
          </div>

          {/* Send Result */}
          {sendResult && (
            <div className={`p-4 rounded-2xl border-2 text-sm font-semibold flex items-start gap-2.5 ${
              sendResult.success
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-red-50 border-red-300 text-red-900'
            }`}>
              {sendResult.success
                ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                : <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              }
              <div>
                {sendResult.success ? (
                  <>
                    <div className="font-black">Notification Sent ✓</div>
                    <div className="text-xs font-medium mt-1 text-emerald-700">
                      {sendResult.sent_count} farmer(s) notified in-app via Supabase realtime.
                      {sendResult.push_count > 0 && ` ${sendResult.push_count} browser push notification(s) delivered.`}
                    </div>
                  </>
                ) : (
                  <div>{sendResult.error}</div>
                )}
              </div>
            </div>
          )}

          {/* Send Button */}
          <button
            type="submit"
            disabled={sending || !message.trim()}
            className="w-full min-h-[56px] bg-slate-900 hover:bg-slate-800 active:bg-black disabled:bg-slate-200 disabled:text-slate-400 text-white text-base font-black rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-gov-lg disabled:shadow-none"
          >
            {sending
              ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : (
                <>
                  <Send className="w-5 h-5 text-amber-400" />
                  <span>
                    Send to {target === 'ALL' ? 'All Farmers' : target === 'queue_today' ? "Today's Queue" : target === 'location' ? 'Mandi Farmers' : singleFarmer?.name || 'Farmer'}
                  </span>
                </>
              )
            }
          </button>
        </form>
      </div>

      {/* ── RIGHT: Notification History ── */}
      <div className="lg:w-[420px] shrink-0 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-700">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900">Sent History</h3>
              <p className="text-xs text-slate-500">{history.length} notifications sent</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadHistory}
            disabled={loadingHistory}
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>

        <div className="space-y-2.5 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
          {history.length === 0 ? (
            <div className="py-12 text-center">
              <BellRing className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">No notifications sent yet</p>
              <p className="text-xs text-slate-400 mt-1">Use the compose panel to send your first notification.</p>
            </div>
          ) : (
            history.map((n, i) => {
              const notifType = NOTIFICATION_TYPES.find(t => t.id === n.type) || NOTIFICATION_TYPES[0];
              return (
                <div key={n.id || i} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-card text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{notifType.icon}</span>
                      <span className="font-bold text-slate-900 text-sm truncate">{n.title || 'Kisan Saathi Alert'}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${notifType.color} shrink-0`}>
                      {notifType.label}
                    </span>
                  </div>
                  <p className="text-slate-600 leading-relaxed line-clamp-2">{n.message}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-100">
                    <span>To: {n.farmer_id ? n.farmer_id.slice(0, 12) + '…' : 'Broadcast'}</span>
                    <span>{n.timestamp ? new Date(n.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'Just now'}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
