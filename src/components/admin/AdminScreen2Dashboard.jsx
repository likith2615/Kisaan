import React from 'react';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  Building2, 
  IndianRupee, 
  Calendar, 
  AlertCircle, 
  ArrowRight, 
  TrendingUp, 
  Activity 
} from 'lucide-react';
import { translations } from '../../translations';

export default function AdminScreen2Dashboard({ 
  user, 
  lang, 
  bookings = [], 
  locations = [], 
  payments = [], 
  onNavigate 
}) {
  const t = translations[lang] || translations.en;

  const totalToday = bookings.length;
  const checkedInCount = bookings.filter(b => b.status === 'checked_in').length;
  const inProgressCount = bookings.filter(b => b.status === 'in_progress').length;
  const completedCount = bookings.filter(b => b.status === 'completed').length;
  const pendingRequestsCount = locations.filter(l => l.status === 'pending').length;

  let totalDisbursed = 0;
  payments.forEach(p => {
    totalDisbursed += Number(p.amount) || 0;
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Center Command • {user?.district || 'Kurnool Operations'}
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-0.5">
            {user?.name || 'Center Procurement Officer'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Designated Hub: <span className="font-bold text-slate-800">{user?.center_id || 'CENTRE-101 (Main Mandi)'}</span>
          </p>
        </div>

        {pendingRequestsCount > 0 && (
          <button
            type="button"
            onClick={() => onNavigate('requests')}
            className="px-4 py-2.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 transition-colors flex items-center gap-2 text-xs font-bold shadow-sm self-start sm:self-auto active:scale-95"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            <span>{pendingRequestsCount} {t.pendingRequestsBadge}</span>
            <ArrowRight className="w-4 h-4 text-amber-700" />
          </button>
        )}
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Today's Bookings */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">{t.todayBookings}</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{totalToday}</div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">Scheduled for today</div>
        </div>

        {/* Card 2: Checked-In / Live Queue */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">{t.checkedInCount}</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600">{checkedInCount}</div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">Avg wait time ~14.8 min</div>
        </div>

        {/* Card 3: In Progress Weighing */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">{t.inProgressCount}</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-700">{inProgressCount}</div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">Electronic weighbridge active</div>
        </div>

        {/* Card 4: Completed Procurements */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">{t.completedCount}</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700">{completedCount}</div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">Certified gate passes issued</div>
        </div>
      </div>

      {/* Quick Access Control Banners */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <button
          type="button"
          onClick={() => onNavigate('queue')}
          className="p-5 rounded-3xl bg-slate-900 text-white hover:bg-slate-800 transition-all flex items-center justify-between text-left shadow-lg shadow-slate-900/10 group"
        >
          <div>
            <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Live Day-Of Command</div>
            <div className="text-lg font-black mt-0.5">{t.adminNavQueue}</div>
            <div className="text-xs text-slate-300 mt-1">Check-in farmers, weigh grain, finalize gate pass</div>
          </div>
          <ArrowRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-transform" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('requests')}
          className="p-5 rounded-3xl bg-white border border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 transition-all flex items-center justify-between text-left shadow-sm group"
        >
          <div>
            <div className="text-xs text-amber-700 font-bold uppercase tracking-wider">Farmer Submissions</div>
            <div className="text-lg font-black text-slate-900 mt-0.5">{t.adminNavRequests}</div>
            <div className="text-xs text-slate-500 mt-1">Review GPS pins, approve centers, or reject with reason</div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('analytics')}
          className="p-5 rounded-3xl bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all flex items-center justify-between text-left shadow-sm group"
        >
          <div>
            <div className="text-xs text-emerald-700 font-bold uppercase tracking-wider">Judging Criteria Metric</div>
            <div className="text-lg font-black text-slate-900 mt-0.5">{t.adminNavAnalytics}</div>
            <div className="text-xs text-slate-500 mt-1">Wait time reduction, congestion curve & utilization %</div>
          </div>
          <TrendingUp className="w-5 h-5 text-emerald-600 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
