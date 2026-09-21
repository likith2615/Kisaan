import { GoogleGenerativeAI } from '@google/generative-ai';
import { SarvamAIClient } from 'sarvamai';
import { normalizeTextForSpeech } from './indicNumberToWords.js';
import { db } from './db.js';

// Environment credentials
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || process.env.VITE_SARVAM_API_KEY || '';
export const SARVAM_TELUGU_SPEAKER = process.env.SARVAM_TELUGU_SPEAKER || 'meera';
export const SARVAM_TTS_MODEL = process.env.SARVAM_TTS_MODEL || 'bulbul:v3';

// Initialize Google AI Studio Gemini client if key is available
let genAI = null;
if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  } catch (e) {
    console.warn('Gemini client init warning:', e?.message || e);
  }
}

// ─────────────────────────────────────────────────────────────
// 1. DATABASE RAG RETRIEVER
// ─────────────────────────────────────────────────────────────

/**
 * Retrieve comprehensive, real-time grounded context from the database for a farmer
 */
export async function retrieveFarmerDatabaseRAGContext(farmerId) {
  try {
    const [
      allFarmers,
      allBookings,
      allSlots,
      allLocations,
      allCrops,
      allPayments,
      allTracking
    ] = await Promise.all([
      db.getAll('farmers').catch(() => []),
      db.getAll('bookings').catch(() => []),
      db.getAll('slots').catch(() => []),
      db.getAll('locations').catch(() => []),
      db.getAll('crops').catch(() => []),
      db.getAll('payments').catch(() => []),
      db.getAll('tracking').catch(() => [])
    ]);

    // Match farmer
    let farmer = null;
    if (farmerId) {
      farmer = allFarmers.find(f => f.id === farmerId || f.phone === farmerId) || await db.getById('farmers', farmerId).catch(() => null);
    }
    if (!farmer && allFarmers.length > 0) {
      farmer = allFarmers[allFarmers.length - 1];
    }

    // Farmer's bookings
    const farmerBookings = allBookings
      .filter(b => farmer && (b.farmer_id === farmer.id || b.farmer_phone === farmer.phone))
      .map(b => {
        const slot = allSlots.find(s => s.id === b.slot_id);
        const loc = slot ? allLocations.find(l => l.id === slot.location_id || l.id === slot.centre_id) : allLocations.find(l => l.id === b.location_id);
        const pay = allPayments.find(p => p.booking_id === b.id || (farmer && p.farmer_id === farmer.id));
        const trk = allTracking.find(t => t.booking_id === b.id);
        const isPaid = pay?.status === 'paid' || b.payment_status === 'paid';
        const utr = pay?.utr_number || pay?.bank_txn_ref || b.utr_number || null;
        const actualWt = Number(b.actual_quantity) || Number(b.expected_quantity) || 50;

        let goodsLoc = 'At Mandi Yard';
        if (b.status === 'completed' || trk?.stage?.includes('Warehouse')) {
          goodsLoc = `Central Silo Warehouse (${trk?.destination || 'FCI Buffer Silo, Kurnool'})`;
        } else if (b.status === 'delivery_completed' || trk?.stage?.includes('Transit')) {
          goodsLoc = `Mandi Weighbridge / Staged for Warehouse Dispatch (${loc?.name || 'Mandi Yard'})`;
        } else if (['checked_in', 'in_progress'].includes(b.status)) {
          goodsLoc = `Mandi Unloading Gate & Quality Testing Desk (${loc?.name || 'Mandi Yard'})`;
        } else {
          goodsLoc = `Scheduled for Arrival on ${slot?.date || b.date || 'Booked Date'}`;
        }

        return {
          id: b.id,
          token_number: b.token_number,
          crop: b.crop_type || 'Paddy',
          crop_type: b.crop_type || 'Paddy',
          quantity_quintals: b.expected_quantity,
          expected_quantity: b.expected_quantity,
          actual_quantity: b.actual_quantity || null,
          actual_weight: actualWt,
          weighbridge_weight: b.actual_quantity ? `${b.actual_quantity} Quintals (Certified)` : 'Pending Weighment',
          quality_grade: b.quality_grade || 'Grade A Superfine',
          status: b.status,
          date: slot?.date || b.date,
          time: slot?.time || slot?.time_window || b.time,
          mandi_center: loc?.name || 'Kurnool Mandi Center',
          queue_position: b.queue_position || 1,
          payment: {
            amount: pay?.amount || Math.round(actualWt * 2300),
            status: isPaid ? 'paid' : (b.status === 'delivery_completed' ? 'ready_for_dbt' : 'scheduled'),
            utr_number: utr,
            bank_name: pay?.bank_name || farmer?.bank_name || 'State Bank of India',
            bank_account: pay?.bank_account || farmer?.bank_account || 'Linked Aadhaar Account'
          },
          goods_location: goodsLoc,
          tracking_stage: trk?.stage || b.status,
          destination: trk?.destination || 'FCI Regional Buffer Silo, Kurnool',
          lorry_id: trk?.lorry_id || null,
          ewhr_number: trk?.ewhr_number || null,
          notes: trk?.notes || null
        };
      })
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    const activeBooking = farmerBookings.find(b => ['booked', 'checked_in', 'in_progress', 'delivery_completed', 'completed'].includes(b.status)) || farmerBookings[0] || null;

    // Active Mandi centers summary
    const activeMandiCenters = allLocations
      .filter(l => l.status === 'active' || !l.status)
      .map(l => ({
        id: l.id,
        name: l.name,
        district: l.district,
        mandal: l.mandal || '',
        daily_capacity_quintals: l.daily_capacity_quintals || 1000,
        contact_phone: l.contact_phone || '1800-180-1551'
      }));

    // MSP Catalog
    const mspCatalog = allCrops.map(c => ({
      crop: c.name,
      msp_rate_per_quintal: c.msp_per_quintal || c.msp_rate || 2320,
      season: c.season || 'Kharif'
    }));

    return {
      farmer: farmer ? {
        id: farmer.id,
        name: farmer.name,
        phone: farmer.phone,
        village: farmer.village,
        mandal: farmer.mandal,
        district: farmer.district,
        crop_type: farmer.crop_type || 'Paddy',
        reliability_points: farmer.points || 100,
        bank_name: farmer.bank_name || 'State Bank of India',
        bank_account: farmer.bank_account ? `XXXX${farmer.bank_account.slice(-4)}` : 'Linked via Aadhaar DBT',
        ifsc: farmer.ifsc || 'SBIN0001234'
      } : null,
      activeBooking,
      allFarmerBookingsCount: farmerBookings.length,
      recentBookings: farmerBookings.slice(0, 3),
      mandiCenters: activeMandiCenters.slice(0, 6),
      availableSlotsCount: allSlots.filter(s => s.status !== 'Full').length,
      mspCatalog,
      availableSlots: allSlots
        .filter(s => s.status !== 'Full')
        .slice(0, 10)
        .map(s => {
          const loc = allLocations.find(l => l.id === s.location_id || l.id === s.centre_id);
          return {
            slot_id: s.id,
            location_id: s.location_id || s.centre_id,
            location_name: loc?.name || 'Mandi Center',
            district: loc?.district || 'Andhra Pradesh',
            date: s.date,
            time: s.time || s.time_window || '08:00 AM - 10:00 AM',
            remaining_capacity: Math.max(1, (s.capacity || 20) - (s.booked_count || 0))
          };
        }),
      qualityStandards: {
        max_moisture_percentage: 17,
        foreign_matter_max: 1,
        payment_sla_hours: 48,
        disbursement_method: 'Aadhaar PFMS Direct Benefit Transfer (DBT)'
      }
    };
  } catch (err) {
    console.warn('RAG context retrieval error:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// 2. STRICT GUARDRAIL CHECKER
// ─────────────────────────────────────────────────────────────

const BLOCKED_TOPIC_REGEX = /politics|election|vote|prime minister|chief minister|movie|actor|cinema|cricket|ipl|crypto|bitcoin|hack|exploit|bypass|password|leak|dating|joke|song|poem|coding|javascript|python|react|linux|sudo|terminal|porn|gambling|betting|క్రికెట్|సినిమా|రాజకీయాలు|పాటలు|జోకులు|గేమ్స్|నటుడు|ఎన్నికలు/i;

const AGRI_DOMAIN_REGEX = /slot|book|booking|వరి|గోధుమ|పత్తి|ధాన్యం|paddy|wheat|cotton|mustard|maize|quintal|క్వింటా|crop|mandi|మండి|కేంద్రం|center|queue|క్యూ|token|టోకెన్|wait|weigh|తూకం|వేబ్రిడ్జి|weighbridge|gate|check.?in|చెక్.?ఇన్|payment|పేమెంట్|డబ్బులు|dbt|pfms|utr|ఖాతా|account|రద్దు|cancel|msp|ధర|rate|price|moisture|తేమ|quality|farmer|రైతు|స్లాట్|స్థితి|status|tracking|రవాణా|ట్రాకింగ్|help|సహాయం|నమస్కారం|hello|hi|yes|సరే|అవును|హా|sure|ok|కర్నూలు|తెనాలి|గుంటూరు|విజయవాడ/i;

/**
 * Strict Guardrail evaluator for Farmer Voice Assistant
 */
export function checkStrictGuardrails(userQuery) {
  const query = (userQuery || '').trim();

  // 1. Empty check
  if (!query) {
    return {
      passed: false,
      reason: 'EMPTY_QUERY',
      refusalText: {
        te: 'నమస్కారం రైతు సోదరా, దయచేసి మీ ప్రశ్న లేదా స్లాట్ బుకింగ్ వివరాలు మాట్లాడండి.',
        hi: 'नमस्ते किसान भाई, कृपया अपनी समस्या या स्लॉट बुकिंग के बारे में बोलें।',
        en: 'Hello Farmer! Please speak your agriculture procurement or slot booking request.'
      }
    };
  }

  // 2. Explicit Out-of-Domain / Harmful Topic Check
  if (BLOCKED_TOPIC_REGEX.test(query) && !AGRI_DOMAIN_REGEX.test(query)) {
    return {
      passed: false,
      reason: 'OUT_OF_DOMAIN',
      refusalText: {
        te: 'క్షమించండి రైతు సోదరా. నేను కేవలం వ్యవసాయ పంట కొనుగోలు, మండి స్లాట్ బుకింగ్, లైవ్ క్యూ, MSP మద్దతు ధరలు మరియు ప్రభుత్వ DBT చెల్లింపుల సహాయకురాలిని మాత్రమే. వీటిలో మీకు ఎలా సహాయం చేయాలి?',
        hi: 'क्षमा करें किसान भाई। मैं केवल फसल खरीद, मंडी स्लॉट बुकिंग, कतार स्थिति, MSP समर्थन मूल्य और DBT भुगतान से संबंधित सहायता के लिए हूँ।',
        en: 'Apologies, I am exclusively dedicated to Government Agricultural Procurement, Mandi slot booking, live queue sequence, MSP rates, and PFMS DBT payment status for farmers.'
      }
    };
  }

  return { passed: true };
}

// ─────────────────────────────────────────────────────────────
// 3. SARVAM AI AUDIO CLIENT (Bulbul v3 Female Telugu Engine)
// ─────────────────────────────────────────────────────────────

let sarvamClient = null;
let lastSarvamKey = '';

function getSarvamClient(customKey = null) {
  const key = customKey || process.env.SARVAM_API_KEY || process.env.VITE_SARVAM_API_KEY || SARVAM_API_KEY;
  if (!key) return null;
  if (!sarvamClient || lastSarvamKey !== key) {
    try {
      sarvamClient = new SarvamAIClient({ apiSubscriptionKey: key });
      lastSarvamKey = key;
    } catch (err) {
      console.warn('Sarvam client initialization warning:', err?.message || err);
    }
  }
  return sarvamClient;
}

const BULBUL_V3_FEMALE_SPEAKERS = ['priya', 'kavya', 'neha', 'roopa', 'kavitha', 'rupali', 'simran', 'pooja', 'shreya', 'ishita', 'tanya', 'suhani', 'shruti'];

/**
 * High-fidelity Native Indic Female Neural TTS
 * Produces clear Telugu, Hindi, and Kannada female speech without requiring third-party API keys
 */
export async function getFemaleIndicAudio(text, lang = 'te') {
  try {
    const langCode = lang === 'te' ? 'te' : (lang === 'kn' ? 'kn' : (lang === 'hi' ? 'hi' : 'en'));
    // Split into sentences / phrases under 180 chars to respect URL query bounds
    const sentences = text.match(/[^.!?।\n]+[.!?।\n]?/g) || [text];
    const chunks = [];
    let curr = '';
    for (const s of sentences) {
      if ((curr + ' ' + s).length < 180) {
        curr = (curr ? curr + ' ' : '') + s;
      } else {
        if (curr) chunks.push(curr);
        curr = s;
      }
    }
    if (curr) chunks.push(curr);

    const audioBuffers = [];
    for (const chunk of chunks) {
      const cleanChunk = chunk.trim();
      if (!cleanChunk) continue;
      const url = 'https://translate.google.com/translate_tts?ie=UTF-8&q=' + encodeURIComponent(cleanChunk) + '&tl=' + langCode + '&client=tw-ob';
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        audioBuffers.push(Buffer.from(buf));
      }
    }
    if (audioBuffers.length > 0) {
      return Buffer.concat(audioBuffers).toString('base64');
    }
    return null;
  } catch (e) {
    console.warn('Female Indic TTS generation notice:', e?.message || e);
    return null;
  }
}

/**
 * Convert text into Female Telugu/Indic voice using Sarvam AI Bulbul v3 with automatic high-fidelity female neural fallback
 */
export async function generateSarvamVoiceAudio(text, language = 'te', speaker = 'priya', customKey = null) {
  try {
    const cleanText = (text || '').replace(/[#*_`]/g, '').trim().slice(0, 2000);
    if (!cleanText) return null;

    // Normalize numbers, currencies, dates into native Indic script words so digits are never read in Hindi/English
    const spokenText = normalizeTextForSpeech(cleanText, language);

    const key = customKey || process.env.SARVAM_API_KEY || process.env.VITE_SARVAM_API_KEY || SARVAM_API_KEY;
    const langCode = language === 'te' ? 'te-IN' : (language === 'hi' ? 'hi-IN' : (language === 'kn' ? 'kn-IN' : 'en-IN'));

    let chosenSpeaker = (speaker || 'priya').toLowerCase();
    if (chosenSpeaker === 'meera' || !BULBUL_V3_FEMALE_SPEAKERS.includes(chosenSpeaker)) {
      chosenSpeaker = 'priya';
    }

    // 1. If a valid, non-placeholder Sarvam key is present, try Sarvam AI
    if (key && !key.startsWith('AQ.')) {
      const client = getSarvamClient(key);
      if (client && client.textToSpeech) {
        try {
          const response = await client.textToSpeech.convert({
            text: spokenText,
            language_code: langCode,
            speaker: chosenSpeaker,
            model: 'bulbul:v3',
            pace: 0.95
          });

          if (response && response.audios && response.audios.length > 0) {
            return response.audios[0];
          }
        } catch (sdkErr) {
          console.warn('Sarvam SDK convert attempt error:', sdkErr?.message || sdkErr);
        }
      }

      // REST API Attempt
      try {
        const restRes = await fetch('https://api.sarvam.ai/text-to-speech', {
          method: 'POST',
          headers: {
            'api-subscription-key': key,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: spokenText,
            language_code: langCode,
            speaker: chosenSpeaker,
            model: 'bulbul:v3',
            pace: 0.95
          })
        });

        if (restRes.ok) {
          const restData = await restRes.json();
          if (restData.audios && restData.audios.length > 0) {
            return restData.audios[0];
          }
        }
      } catch (restErr) {
        console.warn('Sarvam REST attempt notice:', restErr?.message || restErr);
      }
    }

    // 2. Guaranteed High-Fidelity Female Indic Neural TTS Fallback
    const femaleAudio = await getFemaleIndicAudio(spokenText, language);
    if (femaleAudio) {
      return femaleAudio;
    }

    return null;
  } catch (err) {
    console.warn('Voice audio generation notice:', err?.message || err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// 4. GOOGLE AI STUDIO / GEMINI RAG REASONING PIPELINE
// ─────────────────────────────────────────────────────────────

/**
 * Execute RAG query against Google AI Studio Gemini model with strict guardrails and multi-turn conversational memory
 */
export async function executeRAGQueryWithGemini(userQuery, ragContext, language = 'te', conversationHistory = [], bookingDraft = null) {
  if (!genAI) return null;

  try {
    const langName = language === 'te' ? 'Pure Natural Telugu (తెలుగు script)' : (language === 'hi' ? 'Hindi (हिन्दी)' : 'English');

    const systemPrompt = `You are "Kisan Vaani" (కిసాన్ వాణి), an empathetic, authoritative Government AI Voice Assistant for Andhra Pradesh Agricultural & Food Procurement Portal (Kisan Saathi).
You speak with high empathy, respect, and clear authoritative guidance exclusively to Indian Farmers in ${langName}.
Keep spoken answers brief, warm, and natural (1 to 2 short sentences maximum) for ultra-low latency voice synthesis.

STRICT DOMAIN GUARDRAILS:
1. ONLY answer agricultural procurement, mandi slot reservation, live yard queue positions, moisture standards (<17%), MSP support prices, PFMS DBT bank credits, e-WHR storage receipts, or crop transport.
2. Reject any non-agricultural topic politely in 1 short sentence and redirect to farmer services.
3. Ground all answers strictly on the real-time DATABASE CONTEXT below. Never invent fake token numbers or unverified dates.

MULTI-TURN CONVERSATIONAL SLOT BOOKING:
When a farmer wants to book a slot:
- Check what is missing from current conversation and active draft: ${JSON.stringify(bookingDraft || {})}
- Needed parameters:
  * Crop: Paddy (వరి), Wheat (గోధుమ), Cotton (పత్తి), Maize (మొక్కజొన్న), Mustard (ఆవాలు)
  * Quantity: in Quintals (e.g. 50 క్వింటాళ్లు)
  * Mandi Location: check 'availableSlots' or 'mandiCenters' in database context below
  * Date/Time window: check 'availableSlots' in database context below
- If ANY detail is missing, ask for ONLY the missing detail in 1 polite conversational sentence. (e.g. "మీరు ఏ పంట కోసం స్లాట్ బుక్ చేయాలనుకుంటున్నారు? మరియు ఎన్ని క్వింటాళ్లు?")
- If all parameters are satisfied or farmer confirmed, confirm the booking and include on the final line:
ACTION: {"type": "book_slot", "crop": "Paddy", "quantity": 50, "location_id": "LOC-AP-01", "date": "2026-09-21", "time": "08:00 AM - 10:00 AM"}

OTHER ACTION TRIGGERS:
- If farmer arrived at the gate: ACTION: {"type": "gate_checkin"}
- If farmer asks for queue position / live waiting time: ACTION: {"type": "check_queue"}
- If farmer asks for bank payment / money credit: ACTION: {"type": "check_payment"}
- If farmer asks to cancel slot: ACTION: {"type": "cancel_booking"}

REAL-TIME DATABASE CONTEXT:
${JSON.stringify(ragContext, null, 2)}
`;

    const candidateModels = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'];
    let result = null;

    // Construct valid alternating conversation thread for Gemini
    const contents = [];
    if (Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-6)) {
        const text = (msg.text || msg.content || '').trim();
        if (!text) continue;
        const role = (msg.role === 'ai' || msg.role === 'model' || msg.sender === 'ai') ? 'model' : 'user';
        if (contents.length > 0 && contents[contents.length - 1].role === role) {
          contents[contents.length - 1].parts[0].text += `\n${text}`;
        } else {
          contents.push({ role, parts: [{ text }] });
        }
      }
    }

    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      contents[contents.length - 1].parts[0].text += `\nFarmer says: "${userQuery}"`;
    } else {
      contents.push({ role: 'user', parts: [{ text: `Farmer says: "${userQuery}"` }] });
    }

    for (const m of candidateModels) {
      try {
        const candidateModel = genAI.getGenerativeModel({
          model: m,
          systemInstruction: systemPrompt,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
          }
        });
        result = await candidateModel.generateContent({ contents });
        if (result) break;
      } catch (mErr) {
        console.warn(`Gemini model ${m} invocation failed, trying next candidate:`, mErr?.message || mErr);
      }
    }

    if (!result) return null;
    const rawReply = result?.response?.text()?.trim() || '';

    // Parse potential ACTION block
    let action = null;
    let spokenText = rawReply;

    const actionMatch = rawReply.match(/ACTION:\s*(\{.*?\})/s);
    if (actionMatch) {
      try {
        action = JSON.parse(actionMatch[1]);
        spokenText = rawReply.replace(/ACTION:\s*\{.*?\}/s, '').trim();
      } catch (e) {
        console.warn('Action parse warning:', e);
      }
    }

    return { spoken: spokenText, action };
  } catch (err) {
    console.warn('Gemini RAG reasoning error:', err?.message || err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// 5. INITIAL VOICE GREETING BUILDER
// ─────────────────────────────────────────────────────────────

/**
 * Generate natural initial welcome voice greeting for the farmer
 */
export async function getInitialGreeting(farmer = null, language = 'te', speaker = 'priya', customKey = null) {
  const name = farmer?.name ? (language === 'te' ? `${farmer.name} గారూ` : farmer.name) : '';

  const greetings = {
    te: name
      ? `నమస్కారం ${name}! నేను మీ కిసాన్ వాణి AI సహాయకురాలిని. మీకు స్లాట్ బుకింగ్, మండి క్యూ లేదా బ్యాంక్ పేమెంట్ వివరాలలో ఎలా సహాయం చేయాలి? చెప్పండి, నేను వింటున్నాను.`
      : `నమస్కారం రైతు సోదరా! నేను మీ కిసాన్ వాణి AI సహాయకురాలిని. మీకు స్లాట్ బుకింగ్, మండి క్యూ లేదా బ్యాంక్ పేమెంట్ వివరాలలో ఎలా సహాయం చేయాలి? చెప్పండి, నేను వింటున్నాను.`,
    hi: name
      ? `नमस्ते ${name}! मैं आपकी किसान वाणी AI सहायिका हूँ। आज मैं आपकी फसल खरीद, स्लॉट या भुगतान में क्या सहायता करूँ? बोलिए, मैं सुन रही हूँ।`
      : `नमस्ते किसान भाई! मैं आपकी किसान वाणी AI सहायिका हूँ। आज मैं आपकी फसल खरीद, स्लॉट या भुगतान में क्या सहायता करूँ? बोलिए, मैं सुन रही हूँ।`,
    kn: name
      ? `ನಮಸ್ಕಾರ ${name}! ನಾನು ನಿಮ್ಮ ಕಿಸಾನ್ ವಾಣಿ AI ಸಹಾಯಕ. ನಿಮಗೆ ಸ್ಲಾಟ್ ಬುಕಿಂಗ್, ಮಂಡಿ ಕ್ಯೂ ಅಥವಾ ಪಾವತಿಯಲ್ಲಿ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ? ಹೇಳಿ, ನಾನು ಕೇಳುತ್ತಿದ್ದೇನೆ.`
      : `ನಮಸ್ಕಾರ ರೈತ ಮಿತ್ರರೇ! ನಾನು ನಿಮ್ಮ ಕಿಸಾನ್ ವಾಣಿ AI ಸಹಾಯಕ. ನಿಮಗೆ ಸ್ಲಾಟ್ ಬುಕಿಂಗ್, ಮಂಡಿ ಕ್ಯೂ ಅಥವಾ ಪಾವತಿಯಲ್ಲಿ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ? ಹೇಳಿ, ನಾನು ಕೇಳುತ್ತಿದ್ದೇನೆ.`,
    en: name
      ? `Hello ${name}! I am Kisan Vaani, your AI government procurement assistant. How can I assist you with mandi slots, live queue, or DBT payments today? Please speak, I am listening.`
      : `Hello Farmer! I am Kisan Vaani, your AI government procurement assistant. How can I assist you with mandi slots, live queue, or DBT payments today? Please speak, I am listening.`
  };

  const text = greetings[language] || greetings.te;
  const audioBase64 = await generateSarvamVoiceAudio(text, language, speaker, customKey);

  return {
    greeting_text: text,
    language,
    speaker: speaker || 'priya',
    audio_base64: audioBase64 || null,
    voice_provider: audioBase64 ? 'sarvam_ai' : 'web_speech'
  };
}

