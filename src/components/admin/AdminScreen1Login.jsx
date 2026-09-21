import React, { useState } from 'react';
import { Lock, User, ArrowRight, Building2 } from 'lucide-react';

export default function AdminScreen1Login({ onLoginSuccess }) {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId, password })
      });
      const data = await res.json();
      if (data.success) {
        onLoginSuccess(data.user);
      } else {
        setErrorMsg(data.error || 'Invalid credentials');
      }
    } catch {
      setErrorMsg('Server error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center p-4 bg-slate-50">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 border border-slate-200 shadow-md space-y-4">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Admin Login</h2>
          <p className="text-xs text-slate-500 mt-1">Enter your Employee ID and Password</p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Employee ID</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="text"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="e.g. ADMIN1"
                className="w-full min-h-[48px] pl-9 pr-3 rounded-xl border-2 border-slate-300 text-sm font-semibold focus:border-slate-900"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full min-h-[48px] pl-9 pr-3 rounded-xl border-2 border-slate-300 text-sm font-semibold focus:border-slate-900"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition-all"
          >
            {loading
              ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : (<><span>Login</span><ArrowRight className="w-4 h-4" /></>)
            }
          </button>
        </form>
      </div>
    </div>
  );
}
