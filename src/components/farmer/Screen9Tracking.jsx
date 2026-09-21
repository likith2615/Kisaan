import React from 'react';
import { 
  Truck, 
  IndianRupee, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Building2, 
  ExternalLink,
  FileText,
  Activity,
  Check
} from 'lucide-react';
import { translations } from '../../translations';

export default function Screen9Tracking({ 
  user, 
  lang, 
  booking, 
  onBack,
  onNavigate 
}) {
  const t = translations[lang] || translations.en;

  // Empty state guard: If no booking exists for this farmer
  if (!booking || !booking?.id) {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-lg lg:max-w-4xl mx-auto w-full space-y-4 animate-fadeIn pb-28">
        {/* Header */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="text-center">
            <h1 className="text-lg sm:text-xl font-black text-slate-900">
              {t.trackPayTitle || 'Procurement & Payment Tracking'}
            </h1>
            <p className="text-[11px] text-slate-500">
              End-to-end grain dispatch, electronic weighment, and Aadhaar DBT transfer
            </p>
          </div>

          <div className="w-10" />
        </div>

        {/* Empty State Banner */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
            <Truck className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-slate-900">
              {lang === 'te' ? 'ఎలాంటి క్రియాశీల సేకరణ లేదా చెల్లింపు లేదు' : (lang === 'hi' ? 'कोई सक्रिय खरीद या भुगतान नहीं' : 'No Active Consignment or Payment')}
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              {lang === 'te' 
                ? 'మీరు ఇంకా ఎలాంటి మండి స్లాట్ బుక్ చేయలేదు. స్లాట్ బుక్ చేసి పంటను కొనుగోలు కేంద్రానికి తెచ్చిన తర్వాత, మీ ట్రక్ లైవ్ లొకేషన్, ఎలక్ట్రానిక్ J-ఫారం స్లిప్ మరియు నేరుగా DBT బ్యాంక్ చెల్లింపు వివరాలు ఇక్కడ కనిపిస్తాయి.'
                : (lang === 'hi'
                ? 'आपने अभी तक कोई मंडी स्लॉट बुक नहीं किया है। स्लॉट बुक करने और उपज लाने के बाद, आपकी लाइव जीपीएस ट्रैकिंग, इलेक्ट्रॉनिक जे-फॉर्म और डीबीटी बैंक भुगतान यहां दिखाई देगा।'
                : "You haven't booked any mandi slot yet. Once you book a slot and bring your produce to the procurement yard, your live GPS consignment journey, electronic weighbridge slip (J-Form), and direct Aadhaar DBT bank transfer will be tracked here.")}
            </p>
          </div>

          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('book_slot')}
              className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-sm rounded-2xl shadow-gov-green hover:shadow-xl transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <span>+ {t.primaryActionBook || 'Book a Mandi Slot'}</span>
            </button>
          )}

          {/* Value props */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-slate-100 text-left">
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center mb-2 font-bold text-xs">
                🌾
              </div>
              <div className="text-xs font-black text-slate-800">100% MSP Guarantee</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Direct deposit to Aadhaar-seeded bank account via PFMS.</div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center mb-2 font-bold text-xs">
                ⚖️
              </div>
              <div className="text-xs font-black text-slate-800">Certified Weighment</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Tamper-proof electronic weight slips and instant digital J-Form.</div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center mb-2 font-bold text-xs">
                🚚
              </div>
              <div className="text-xs font-black text-slate-800">GPS Buffer Transit</div>
              <div className="text-[11px] text-slate-500 mt-0.5">End-to-end GPS tracking from mandi yard to FCI silos.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const trackingId = booking?.tracking_id || booking?.tracking?.id || `TRK-2026-${booking.id?.replace(/\D/g, '').slice(-4) || 'LIVE'}`;
  const isProcuredDone = booking?.status === 'in_progress' || booking?.status === 'completed';
  const stage = booking?.tracking?.stage || (booking?.status === 'completed' ? 'delivered' : booking?.status === 'in_progress' ? 'procured' : 'booked');
  const isInTransitDone = stage === 'in_transit' || stage === 'delivered';
  const isDeliveredDone = stage === 'delivered';

  // Official 2026-27 Kharif MSP Rates
  const getMspRate = (crop) => {
    const c = (crop || '').toLowerCase();
    if (c.includes('grade a')) return 2369;
    if (c.includes('wheat')) return 2425;
    if (c.includes('maize')) return 2225;
    if (c.includes('cotton')) return 7121;
    return 2320; // Common Paddy default
  };

  const cropName = booking?.crop_type || booking?.crop?.name || user?.crop_type || 'Paddy (Common Standard)';
  const mspRate = getMspRate(cropName);
  const qty = Number(booking?.actual_quantity || booking?.expected_quantity) || 0;
  const calculatedAmount = qty * mspRate;

  const payment = booking?.payment || {
    amount: calculatedAmount,
    status: (booking?.payment_status === 'paid' || booking?.status === 'completed') ? 'paid' : (booking?.status === 'delivery_completed' ? 'processing' : 'pending'),
    bank_txn_ref: booking?.payment?.bank_txn_ref || booking?.utr_number || (booking?.payment_status === 'paid' ? `PFMS-DBT-${booking.id?.replace(/\D/g, '').slice(-6)}` : 'PFMS-PENDING'),
    paid_at: booking?.payment?.paid_at || null
  };

  const isPaid = payment.status === 'paid' || booking?.payment_status === 'paid' || booking?.status === 'completed';
  const isProcessing = !isPaid && (payment.status === 'processing' || booking?.status === 'delivery_completed');

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-lg lg:max-w-4xl mx-auto w-full space-y-4 animate-fadeIn pb-28">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <h1 className="text-lg sm:text-xl font-black text-slate-900">
            {t.trackPayTitle || 'Procurement & Payment Tracking'}
          </h1>
          <p className="text-[11px] text-slate-500">
            End-to-end grain dispatch, electronic weighment, and Aadhaar DBT transfer
          </p>
        </div>

        {onNavigate ? (
          <button
            type="button"
            onClick={() => onNavigate('queue')}
            className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 hover:bg-emerald-100 active:scale-95 transition-all cursor-pointer"
            title="View Live Queue"
          >
            <Activity className="w-5 h-5" />
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {/* Tracking ID Header Banner */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {t.trackingId || 'National Logistics Consignment ID'}
          </span>
          <div className="text-lg font-black text-emerald-800 tracking-wide font-mono">
            {trackingId}
          </div>
        </div>
        <div className="px-3 py-1 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200">
          Token: {booking?.token_number || 'TK-482'}
        </div>
      </div>

      {/* 1. Crop Logistics Tracker (3-Stage) */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <Truck className="w-4 h-4 text-emerald-600" />
            <span>Crop Logistics Journey</span>
          </div>
          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
            GPS Monitored
          </span>
        </div>

        <div className="space-y-4 relative pl-2">
          {/* Vertical Connecting Line */}
          <div className="absolute left-[23px] top-4 bottom-4 w-0.5 bg-slate-200 pointer-events-none" />

          {/* Stage 1: Procured */}
          <div className="flex items-start gap-3 relative z-10">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 ${
              isProcuredDone ? 'bg-emerald-600 shadow-sm' : 'bg-slate-200 text-slate-400'
            }`}>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black text-slate-900">{t.logisticsStage1 || 'Mandi Yard Weighment & Quality Passed'}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Weighed & Certified at {booking?.location?.name || booking?.location_name || 'Central Mandi Yard'} ({qty} Q @ ₹{mspRate}/Q)
              </div>
            </div>
          </div>

          {/* Stage 2: In Transit */}
          <div className="flex items-start gap-3 relative z-10">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 ${
              isInTransitDone ? 'bg-emerald-600 shadow-sm' : 'bg-slate-200 text-slate-500'
            }`}>
              {isInTransitDone ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4 text-slate-400" />}
            </div>
            <div>
              <div className={`text-xs font-black ${isInTransitDone ? 'text-slate-900' : 'text-slate-500'}`}>
                {t.logisticsStage2 || 'Dispatched to Buffer Silo / FCI Godown'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {isInTransitDone 
                  ? `GPS Monitored Lorry #${booking?.tracking?.lorry_id || 'AP-21-TX-9904'} → ${booking?.tracking?.destination || 'FCI Regional Buffer Silo, Kurnool'}`
                  : 'Awaiting truck allocation & dispatch by Logistics Officer'}
              </div>
              {isInTransitDone && booking?.tracking?.driver_phone && (
                <div className="text-[10px] font-bold text-blue-700 mt-0.5 flex items-center gap-1">
                  <span>📞 Driver Contact: {booking.tracking.driver_phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Stage 3: Delivered */}
          <div className="flex items-start gap-3 relative z-10">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 ${
              isDeliveredDone ? 'bg-emerald-600 shadow-sm' : 'bg-slate-200 text-slate-500'
            }`}>
              {isDeliveredDone ? <CheckCircle2 className="w-4 h-4" /> : <Building2 className="w-4 h-4 text-slate-400" />}
            </div>
            <div>
              <div className={`text-xs font-black ${isDeliveredDone ? 'text-slate-900' : 'text-slate-500'}`}>
                {t.logisticsStage3 || 'Central Warehouse Receipt Complete'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {isDeliveredDone
                  ? `Safely Deposited at Silo. Electronic WHR Certificate: ${booking?.tracking?.ewhr_number || 'eWHR-2026-AP8841'}`
                  : 'Pending final arrival confirmation at Central Silo'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Official Digital J-Form Summary Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black text-slate-900">Digital J-Form Certificate</div>
              <div className="text-[10px] text-slate-500">Form J-Procurement No. JF-2026-{booking?.token_number || '849'}</div>
            </div>
          </div>

          <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
            DoCA Certified
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Certified Commodity</span>
            <span className="font-bold text-slate-800">{cropName}</span>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Net Certified Weight</span>
            <span className="font-bold text-slate-800">{qty} Quintals</span>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Govt. MSP Benchmark</span>
            <span className="font-bold text-slate-800">₹{mspRate} / Quintal</span>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Gross Payout</span>
            <span className="font-mono font-black text-emerald-800">₹{calculatedAmount.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* 3. Direct Benefit Transfer (DBT) Payment Card */}
      <div className="bg-white rounded-3xl p-5 border-2 border-emerald-600/30 shadow-md space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black text-slate-900">{t.paymentCardTitle || 'Direct Benefit Transfer (DBT)'}</div>
              <div className="text-[10px] text-slate-500">Direct Deposit via Public Financial Management System</div>
            </div>
          </div>

          <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
            isPaid
              ? 'bg-emerald-100 text-emerald-800'
              : isProcessing
              ? 'bg-blue-100 text-blue-800'
              : 'bg-amber-100 text-amber-800'
          }`}>
            {isPaid ? (t.paymentPaid || 'Payment Transferred') : (isProcessing ? (t.paymentProcessing || 'In Bank Clearing') : (t.paymentPending || 'MSP Payment Scheduled'))}
          </span>
        </div>

        <div>
          <span className="text-xs text-slate-500 font-semibold">{t.amountLabel || 'Total MSP Payout'}</span>
          <div className="text-3xl font-black text-slate-900 tracking-tight mt-0.5">
            ₹{Number(payment.amount || calculatedAmount).toLocaleString('en-IN')}
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">{t.bankRef || 'PFMS Transaction Ref'}:</span>
            <span className="font-mono font-bold text-slate-800">{payment.bank_txn_ref || 'PFMS-PENDING'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">{t.accountNumber || 'Beneficiary Account'}:</span>
            <span className="font-mono font-bold text-slate-800">
              {user?.bank_account ? `A/C ••••${user.bank_account.slice(-4)} (${user.ifsc || 'Aadhaar DBT'})` : 'Primary Bank A/C (Aadhaar Seeded DBT)'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
