import React, { useState } from 'react';
import { 
  Search, 
  Download, 
  Filter, 
  Calendar, 
  QrCode, 
  CheckCircle2, 
  FileSpreadsheet 
} from 'lucide-react';
import { translations } from '../../translations';

export default function AdminScreen6Bookings({ 
  user, 
  lang, 
  bookings = [] 
}) {
  const t = translations[lang] || translations.en;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = bookings.filter(b => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.token_number?.toLowerCase().includes(q) ||
      b.farmer_name?.toLowerCase().includes(q) ||
      b.farmer_phone?.includes(q) ||
      b.farmer?.name?.toLowerCase().includes(q) ||
      b.farmer_id?.toLowerCase().includes(q) ||
      b.crop_type?.toLowerCase().includes(q) ||
      b.tracking_id?.toLowerCase().includes(q)
    );
  });

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Token', 'Farmer Name', 'Phone', 'Farmer ID', 'Slot Date', 'Slot Time', 'Crop', 'Expected Qty', 'Status', 'Tracking ID', 'Created At'];
    const rows = filtered.map(b => [
      b.token_number || '',
      b.farmer_name || b.farmer?.name || '',
      b.farmer_phone || b.farmer?.phone || '',
      b.farmer_id || '',
      b.date || b.slot?.date || '',
      b.time || b.slot?.time || b.slot?.time_window || '',
      b.crop_type || 'Paddy',
      b.expected_quantity || '',
      b.status || '',
      b.tracking_id || '',
      b.created_at || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `KissanSathi_Bookings_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            {t.bookingsTableTitle}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit register of all scheduled and completed procurement bookings across mandis
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs flex items-center gap-2 shadow-sm self-start sm:self-auto transition-colors active:scale-95"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>{t.exportCsv}</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full min-h-[42px] pl-10 pr-3.5 rounded-2xl border border-slate-300 text-xs font-semibold focus:border-slate-900 bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['all', 'booked', 'checked_in', 'in_progress', 'completed', 'cancelled'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-2 rounded-xl text-xs font-bold capitalize whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Dense Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-black">
              <tr>
                <th className="py-3 px-4">Token</th>
                <th className="py-3 px-4">Farmer</th>
                <th className="py-3 px-4">Slot Date & Time</th>
                <th className="py-3 px-4">Crop / Qty</th>
                <th className="py-3 px-4">Tracking ID</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No bookings found matching filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2 py-1 rounded-lg">
                        {b.token_number || 'TK-482'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{b.farmer_name || b.farmer?.name || b.farmer_id || 'Farmer'}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{b.farmer_phone ? `📞 ${b.farmer_phone}` : `Ref: ${b.id?.slice(-8)}`}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800">{b.date || b.slot?.date || 'Today'}</div>
                      <div className="text-[10px] text-slate-500">{b.time || b.slot?.time || b.slot?.time_window || '09:00 - 11:00 AM'}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{b.crop_type || 'Paddy'}</div>
                      <div className="text-[11px] text-slate-500">{b.expected_quantity || 50} Quintals</div>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-[11px] text-emerald-700">
                      {b.tracking_id || '—'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                        b.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : b.status === 'checked_in'
                          ? 'bg-blue-100 text-blue-800'
                          : b.status === 'in_progress'
                          ? 'bg-purple-100 text-purple-800'
                          : b.status === 'cancelled'
                          ? 'bg-slate-100 text-slate-400 line-through'
                          : 'bg-amber-100 text-amber-900'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
