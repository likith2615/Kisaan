import React, { useState } from 'react';
import { 
  Building2, 
  MapPin, 
  Check, 
  X, 
  AlertCircle, 
  ExternalLink, 
  Clock, 
  User, 
  Phone, 
  CheckCircle2, 
  XCircle 
} from 'lucide-react';
import { translations } from '../../translations';

export default function AdminScreen3Requests({ 
  user, 
  lang, 
  locations = [], 
  onRefresh 
}) {
  const t = translations[lang] || translations.en;

  const [filter, setFilter] = useState('pending'); // 'pending' | 'active' | 'rejected' | 'all'
  const [rejectModalLoc, setRejectModalLoc] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const filteredLocations = locations.filter(l => {
    if (filter === 'all') return true;
    return l.status === filter;
  });

  // Handle Approve
  const handleApprove = async (locId) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/locations/${locId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed_by: user?.id || 'ADMIN-OFFICER' })
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ type: 'success', text: 'Location approved! Center is now active and bookable by farmers.' });
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Failed to approve location.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reject
  const handleConfirmReject = async () => {
    if (!rejectModalLoc) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/locations/${rejectModalLoc.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rejectReason || 'Location does not meet road clearance standards.',
          reviewed_by: user?.id || 'ADMIN-OFFICER'
        })
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ type: 'success', text: 'Location request rejected with stated reason.' });
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Failed to reject location.' });
    } finally {
      setActionLoading(false);
      setRejectModalLoc(null);
      setRejectReason('');
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            {t.locRequestsTitle}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review farmer proposals for new village procurement centers, inspect GPS pins, and approve active centers
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl self-start sm:self-auto">
          {['pending', 'active', 'rejected', 'all'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors ${
                filter === f
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f} ({locations.filter(l => f === 'all' ? true : l.status === f).length})
            </button>
          ))}
        </div>
      </div>

      {actionMessage && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm ${
          actionMessage.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-300' : 'bg-red-50 text-red-900 border border-red-300'
        }`}>
          <span>{actionMessage.text}</span>
          <button type="button" onClick={() => setActionMessage(null)} className="font-black ml-2">✕</button>
        </div>
      )}

      {/* Requests Table / Card View */}
      {filteredLocations.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-3xl border border-slate-200">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-700">No {filter} location requests found</h3>
          <p className="text-xs text-slate-400 mt-0.5">Farmer location submissions will appear here for review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLocations.map((loc) => {
            const isPending = loc.status === 'pending';
            const isActive = loc.status === 'active';
            const isRejected = loc.status === 'rejected';

            return (
              <div
                key={loc.id}
                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div>
                      <h3 className="text-base font-black text-slate-900">{loc.name}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{loc.address || `${loc.village}, ${loc.district}`}</span>
                      </div>
                    </div>

                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full shrink-0 ${
                      isActive
                        ? 'bg-emerald-100 text-emerald-800'
                        : isPending
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {loc.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs py-2 text-slate-600">
                    <div>
                      <span className="text-slate-400 font-medium">District / Mandal:</span>
                      <div className="font-bold text-slate-800">{loc.district} • {loc.mandal || 'Rural'}</div>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Pincode:</span>
                      <div className="font-bold text-slate-800">{loc.pincode || '518001'}</div>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">GPS Coordinates:</span>
                      <div className="font-mono text-emerald-700 font-bold">
                        {Number(loc.lat || 15.8281).toFixed(4)}, {Number(loc.lng || 78.0373).toFixed(4)}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Requested By:</span>
                      <div className="font-bold text-slate-800">{loc.requested_by || 'Farmer (Self)'}</div>
                    </div>
                  </div>

                  {loc.rejection_reason && (
                    <div className="p-2.5 bg-red-50 rounded-xl border border-red-200 text-xs text-red-800 font-medium">
                      <span className="font-bold">Rejection Reason:</span> {loc.rejection_reason}
                    </div>
                  )}
                </div>

                {/* Actions for Pending Requests */}
                {isPending && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleApprove(loc.id)}
                      className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors active:scale-95"
                    >
                      <Check className="w-4 h-4" />
                      <span>{t.approveLocation}</span>
                    </button>

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => setRejectModalLoc(loc)}
                      className="min-h-[44px] bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors active:scale-95"
                    >
                      <X className="w-4 h-4" />
                      <span>{t.rejectLocation}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject with Reason Modal */}
      {rejectModalLoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 animate-scaleUp">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center mx-auto">
              <XCircle className="w-7 h-7" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-black text-slate-900">
                Reject Location Proposal
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Provide a clear operational reason. The farmer will see this reason on their app to make adjustments and resubmit.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                {t.rejectionReasonPrompt}
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Distance is within 3 km of active APMC Mandi, or insufficient heavy lorry turning radius."
                className="w-full p-3 rounded-xl border-2 border-slate-300 text-xs font-medium text-slate-800 focus:border-red-600"
              />
            </div>

            <div className="space-y-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmReject}
                className="w-full min-h-[46px] bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center"
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>

              <button
                type="button"
                onClick={() => setRejectModalLoc(null)}
                className="w-full min-h-[42px] bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
