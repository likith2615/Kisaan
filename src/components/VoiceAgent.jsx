import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Volume2, Sparkles, X, CheckCircle2, ChevronRight, 
  Zap, RefreshCw, Radio, StopCircle, Calendar, MapPin, Package, Clock, ShieldCheck 
} from 'lucide-react';
import { normalizeTextForSpeech } from '../utils/indicNumberToWords';

export default function VoiceAgent({ currentFarmerId, lang = 'te', onBookingCreated, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [assistantState, setAssistantState] = useState('idle'); // 'idle' | 'greeting' | 'listening' | 'processing' | 'speaking'
  const [transcript, setTranscript] = useState('');
  const [language, setLanguage] = useState(lang || 'te');
  const [speaker, setSpeaker] = useState('priya'); // Sarvam Bulbul v3 female Telugu voices: priya, kavya, neha, roopa, kavitha, rupali
  const [sarvamKey, setSarvamKey] = useState(() => {
    try {
      return localStorage.getItem('kissan_sarvam_key') || '';
    } catch {
      return '';
    }
  });
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyTestStatus, setKeyTestStatus] = useState(null); // 'testing' | 'valid' | 'invalid'
  const [response, setResponse] = useState(null);
  const [greetingInfo, setGreetingInfo] = useState(null);
  const [lastAction, setLastAction] = useState(null);

  // Multi-Turn Conversational State & Barge-In
  const [sessionId, setSessionId] = useState(null);
  const [customQuintalInput, setCustomQuintalInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [bookingDraft, setBookingDraft] = useState({});
  const [availableOptions, setAvailableOptions] = useState({ locations: [], dates: [], times: [], unavailableDate: null });
  const [isInterrupted, setIsInterrupted] = useState(false);

  const audioRef = useRef(null);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const transcriptRef = useRef('');
  const messagesEndRef = useRef(null);

  const handleOpenModal = () => {
    unlockAudio();
    setIsOpen(true);
    triggerInitialGreeting(language, speaker);
  };

  const handleCloseModal = async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setAssistantState('idle');
    setIsOpen(false);

    // Call persistent DB session close endpoint
    if (sessionId || currentFarmerId) {
      fetch('/api/voice/session/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, farmer_id: currentFarmerId })
      }).catch(() => {});
    }
  };

  useEffect(() => {
    if (lang) setLanguage(lang);
  }, [lang]);

  useEffect(() => {
    // When farmer logs in or changes account, reset voice session to load fresh farmer state
    setSessionId(null);
    setBookingDraft({});
    setConversationHistory([]);
    setLastAction(null);
  }, [currentFarmerId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversationHistory, transcript]);

  // Mandi location name mapping
  const locationNames = {
    'LOC-AP-01': 'Kurnool Agricultural Market Yard (కర్నూలు)',
    'LOC-AP-02': 'Adoni Cotton & Grain Mandi (ఆదోని)',
    'LOC-AP-03': 'Nandyal Rythu Agricultural Market (నంద్యాల)',
    'LOC-AP-04': 'Guntur Mirchi & Grain Market Yard (గుంటూరు)',
    'LOC-AP-05': 'Tenali Paddy Procurement Centre (తెనాలి)',
    'LOC-AP-06': 'Vijayawada Gollapudi Wholesale Mandi (విజయవాడ)',
  };

  // Sample automated voice task prompts in all 4 languages
  const samplePrompts = {
    te: [
      { text: 'నాకు 50 క్వింటాళ్ల వరి కోసం స్లాట్ బుక్ చేయండి', label: '🌾 వరి స్లాట్ బుకింగ్ (Auto-Book 50Q Paddy)', icon: '🌾' },
      { text: 'నా టోకెన్ క్యూ నెంబర్ మరియు వేచి ఉండే సమయం ఎంత?', label: '🚦 లైవ్ క్యూ & వెయిటింగ్ సమయం', icon: '🚦' },
      { text: 'నా పంట చెల్లింపు డబ్బులు బ్యాంక్ ఖాతాలో జమ అయ్యాయా?', label: '💰 DBT బ్యాంక్ పేమెంట్ స్థితి', icon: '💳' },
      { text: 'నేను మండికి వచ్చాను, గేట్ చెక్-ఇన్ చేయండి', label: '✅ యార్డ్ గేట్ చెక్-ఇన్', icon: '✅' },
      { text: 'ప్రస్తుత వరి మరియు గోధుమల MSP మద్దతు ధరలు ఎంత?', label: '⚖️ ప్రభుత్వ MSP ధరల వివరాలు', icon: '⚖️' },
      { text: 'మా గ్రామానికి కొత్త కొనుగోలు కేంద్రం కావాలి', label: '🏢 కొత్త కేంద్రం అభ్యర్థన', icon: '🏢' },
      { text: 'నా ప్రస్తుత స్లాట్ బుకింగ్ రద్దు చేయండి', label: '❌ బుకింగ్ రద్దు', icon: '❌' },
    ],
    hi: [
      { text: 'मेरे लिए 50 क्विंटल धान का खरीद स्लॉट बुक करें', label: '🌾 धान स्लॉट बुक करें', icon: '🌾' },
      { text: 'मेरी कतार स्थिति और अनुमानित समय क्या है?', label: '🚦 लाइव कतार स्थिति', icon: '🚦' },
      { text: 'क्या मेरी फसल का DBT भुगतान खाते में आया?', label: '💰 भुगतान स्थिति', icon: '💳' },
      { text: 'मैं मंडी पहुंच गया हूं, गेट चेक-इन करें', label: '✅ गेट चेक-इन', icon: '✅' },
      { text: 'वर्तमान MSP सरकारी खरीद दरें क्या हैं?', label: '⚖️ MSP दरें', icon: '⚖️' },
      { text: 'मेरी बुकिंग रद्द करें', label: '❌ बुकिंग रद्द करें', icon: '❌' },
    ],
    en: [
      { text: 'Book a procurement slot for 50 quintals of paddy', label: '🌾 Auto-Book Paddy Slot (50 Q)', icon: '🌾' },
      { text: 'What is my live queue position and wait time?', label: '🚦 Live Queue Position & Wait Time', icon: '🚦' },
      { text: 'What is my DBT bank payment status?', label: '💰 Bank DBT Payment Status', icon: '💳' },
      { text: 'I have arrived at the mandi, do gate check-in', label: '✅ Mandi Gate Check-In', icon: '✅' },
      { text: 'What are the current Government MSP rates?', label: '⚖️ Current MSP Rates', icon: '⚖️' },
      { text: 'Cancel my active slot booking', label: '❌ Cancel Booking', icon: '❌' },
    ],
    kn: [
      { text: 'ನನಗೆ 50 ಕ್ವಿಂಟಾಲ್ ಭತ್ತಕ್ಕಾಗಿ ಸ್ಲಾಟ್ ಬುಕ್ ಮಾಡಿ', label: '🌾 ಭತ್ತದ ಸ್ಲಾಟ್ ಬುಕ್ ಮಾಡಿ', icon: '🌾' },
      { text: 'ನನ್ನ ಲೈವ್ ಕ್ಯೂ ಮತ್ತು ಕಾಯುವ ಸಮಯ ಎಷ್ಟು?', label: '🚦 ಕ್ಯೂ ಸ್ಥಿತಿ', icon: '🚦' },
      { text: 'ನನ್ನ ಬೆಳೆಯ ಹಣ ಬ್ಯಾಂಕ್ ಖಾತೆಗೆ ಜಮೆಯಾಗಿದೆಯೇ?', label: '💰 ಪಾವತಿ ಸ್ಥಿತಿ', icon: '💳' },
      { text: 'ನಾನು ಮಂಡಿಗೆ ಬಂದಿದ್ದೇನೆ, ಗೇಟ್ ಚೆಕ್-ಇನ್ ಮಾಡಿ', label: '✅ ಗೇಟ್ ಚೆಕ್-ಇನ್', icon: '✅' },
      { text: 'ಪ್ರಸ್ತುತ ಸರ್ಕಾರದ MSP ದರಗಳು ಎಷ್ಟು?', label: '⚖️ MSP ದರಗಳು', icon: '⚖️' },
    ]
  };

  const getLangCode = (l) => {
    switch (l) {
      case 'te': return 'te-IN';
      case 'hi': return 'hi-IN';
      case 'kn': return 'kn-IN';
      default: return 'en-IN';
    }
  };

  // Audio and SpeechSynthesis priming on user interaction
  const unlockAudio = () => {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.resume();
        // Warm up speech synthesis engine synchronously on user click
        const silent = new SpeechSynthesisUtterance(' ');
        silent.volume = 0.01;
        silent.rate = 10;
        window.speechSynthesis.speak(silent);
      }
    } catch {}
  };

  // Pre-load available browser voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Standard initial greeting messages per language
  const GREETING_MESSAGES = {
    te: 'నమస్కారం రైతు సోదరా! నేను మీ కిసాన్ వాణి AI సహాయకురాలిని. మీకు స్లాట్ బుకింగ్, మండి క్యూ లేదా బ్యాంక్ పేమెంట్ వివరాలలో ఎలా సహాయం చేయాలి? చెప్పండి, నేను వింటున్నాను.',
    hi: 'नमस्ते किसान भाई! मैं आपकी किसान वाणी AI सहायिका हूँ। आपको मंडी स्लॉट बुकिंग, कतार स्थिति या बैंक भुगतान में क्या सहायता चाहिए? बोलिए, मैं सुन रही हूँ।',
    en: 'Hello Farmer! I am your Kisan Vaani AI assistant. How can I help you with slot booking, live queue, or bank payment today? Please speak, I am listening.',
    kn: 'ನಮಸ್ಕಾರ ರೈತ ಬಾಂಧವರೇ! ನಾನು ನಿಮ್ಮ ಕಿಸಾನ್ ವಾಣಿ AI ಸಹಾಯಕ. ನಿಮಗೆ ಸ್ಲಾಟ್ ಬುಕಿಂಗ್, ಮಂಡಿ ಕ್ಯೂ ಅಥವಾ ಬ್ಯಾಂಕ್ ಪಾವತಿ ವಿವರಗಳಲ್ಲಿ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ? ಹೇಳಿ, ನಾನು ಕೇಳುತ್ತಿದ್ದೇನೆ.'
  };

  // ── BARGE-IN INTERRUPTION HANDLER ──
  const interruptAssistant = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsInterrupted(true);
    setTimeout(() => setIsInterrupted(false), 2500);
    startListening();
  };

  // Play audio (Sarvam AI base64 or Web Speech synthesis fallback) with callback on completion
  const playAudioOrSpeech = (text, l, audioBase64 = null, onFinished = null) => {
    setAssistantState('speaking');

    let finishedCalled = false;
    const safeFinish = () => {
      if (finishedCalled) return;
      finishedCalled = true;
      if (onFinished) onFinished();
    };

    // 1. If Sarvam AI returned synthesized base64 audio
    if (audioBase64) {
      try {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        const isMp3 = audioBase64.startsWith('//OE') || audioBase64.startsWith('SUQz') || audioBase64.slice(0, 100).includes('audio/mp3') || audioBase64.slice(0, 100).includes('audio/mpeg');
        const mimeType = isMp3 ? 'audio/mp3' : 'audio/wav';
        const audioUrl = audioBase64.startsWith('data:') ? audioBase64 : `data:${mimeType};base64,${audioBase64}`;
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          safeFinish();
        };

        audio.onerror = (e) => {
          console.warn('Audio playback error, falling back to Web Speech:', e);
          fallbackWebSpeech(text, l, safeFinish);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('Audio play promise rejected, falling back to Web Speech:', err);
            fallbackWebSpeech(text, l, safeFinish);
          });
        }
        return;
      } catch (e) {
        console.warn('Voice audio creation exception:', e);
      }
    }

    // 2. Fallback Web Speech Synthesis
    fallbackWebSpeech(text, l, safeFinish);
  };

  const fallbackWebSpeech = (text, l, onFinished = null) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();

        // Convert raw digits (50, 1000, 1,09,150, 11.5%) into pure native Indic words (e.g. "యాభై", "వెయ్యి")
        // This prevents Chrome & Windows TTS engines from pronouncing numbers in Hindi or English!
        const spokenText = normalizeTextForSpeech(text, l);

        const utterance = new SpeechSynthesisUtterance(spokenText);
        const targetLang = getLangCode(l);
        utterance.lang = targetLang;
        utterance.rate = 0.92;
        utterance.pitch = 1.15; // Natural pleasant female pitch
        utterance.volume = 1.0;

        const voices = window.speechSynthesis.getVoices() || [];
        const langPrefix = (l || 'te').toLowerCase();

        // Filter out male voices so the assistant never sounds male
        const isMale = (v) => {
          const n = ((v?.name || '') + ' ' + (v?.lang || '')).toLowerCase();
          return n.includes('male') || n.includes('david') || n.includes('ravi') || n.includes('mark') || n.includes('george') || n.includes('guy') || n.includes('stefan') || n.includes('richard');
        };
        const pool = voices.filter(v => !isMale(v)).length > 0 ? voices.filter(v => !isMale(v)) : voices;

        // 1. Language-specific matching:
        let matchingVoice = null;
        if (langPrefix === 'te') {
          // Dedicated Telugu voices (Google తెలుగు, Microsoft Mohan, etc.)
          matchingVoice = pool.find(v =>
            v.lang && (v.lang.toLowerCase().startsWith('te') || v.lang.toLowerCase().includes('te-in'))
          ) || pool.find(v => v.name && v.name.toLowerCase().includes('telugu'));
        } else if (langPrefix === 'kn') {
          // Dedicated Kannada voices
          matchingVoice = pool.find(v =>
            v.lang && (v.lang.toLowerCase().startsWith('kn') || v.lang.toLowerCase().includes('kn-in'))
          ) || pool.find(v => v.name && v.name.toLowerCase().includes('kannada'));
        } else if (langPrefix === 'hi') {
          // Dedicated Hindi voices
          matchingVoice = pool.find(v =>
            v.lang && (v.lang.toLowerCase().startsWith('hi') || v.lang.toLowerCase().includes('hi-in'))
          ) || pool.find(v => v.name && v.name.toLowerCase().includes('hindi'));
        }

        // 2. Dedicated Female Voice Fallback (Priya, Zira, Heera, Neerja, Swara, etc.)
        if (!matchingVoice) {
          matchingVoice = pool.find(v => {
            const n = (v?.name || '').toLowerCase();
            return n.includes('female') || n.includes('zira') || n.includes('heera') || n.includes('neerja') || n.includes('priya') || n.includes('swara') || n.includes('veena') || n.includes('kavya');
          }) || pool.find(v =>
            v.name && (v.name.toLowerCase().includes('india') || v.name.toLowerCase().includes('indic'))
          ) || pool.find(v => v.lang && v.lang.toLowerCase().startsWith('en-in'))
            || pool[0];
        }

        if (matchingVoice) {
          utterance.voice = matchingVoice;
        }

        let hasEnded = false;
        utterance.onend = () => {
          if (!hasEnded) {
            hasEnded = true;
            if (onFinished) onFinished();
          }
        };
        utterance.onerror = (err) => {
          console.warn('Speech synthesis utterance error:', err);
          if (!hasEnded) {
            hasEnded = true;
            if (onFinished) onFinished();
          }
        };

        // Safety timeout in case browser speech engine stalls
        const estimatedDurationMs = Math.max(3000, Math.min(12000, (text || '').length * 85));
        setTimeout(() => {
          if (!hasEnded) {
            hasEnded = true;
            if (onFinished) onFinished();
          }
        }, estimatedDurationMs);

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('Web Speech error:', err);
        if (onFinished) onFinished();
      }
    } else {
      if (onFinished) onFinished();
    }
  };

  // ── 1. TRIGGER INITIAL GREETING & START PERSISTENT DB SESSION ──
  const triggerInitialGreeting = async (forcedLang = language, forcedSpeaker = speaker) => {
    setAssistantState('greeting');
    setTranscript('');
    setResponse(null);

    const defaultGreeting = GREETING_MESSAGES[forcedLang] || GREETING_MESSAGES.te;
    setGreetingInfo({ greeting_text: defaultGreeting, language: forcedLang, speaker: forcedSpeaker });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch('/api/voice/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          farmer_id: currentFarmerId,
          language: forcedLang,
          speaker: forcedSpeaker || 'priya'
        })
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (data.success && data.data) {
        const sess = data.data.session;
        if (sess) {
          setSessionId(sess.id);
          if (sess.booking_draft && Object.keys(sess.booking_draft).length > 0) {
            setBookingDraft(sess.booking_draft);
          }
          if (Array.isArray(sess.messages) && sess.messages.length > 0) {
            setConversationHistory(sess.messages.map((m, idx) => ({
              id: `hist-${idx}-${Date.now()}`,
              role: m.role,
              text: m.text,
              time: m.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            })));
          } else {
            setConversationHistory([
              {
                id: 'greet-' + Date.now(),
                role: 'ai',
                text: data.data.initial_greeting || defaultGreeting,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ]);
          }
        }
        setGreetingInfo({
          greeting_text: data.data.initial_greeting || defaultGreeting,
          language: forcedLang,
          speaker: forcedSpeaker
        });

        playAudioOrSpeech(
          data.data.initial_greeting || defaultGreeting,
          forcedLang,
          data.data.audio_base64,
          () => {
            startListening();
          }
        );
      } else {
        setConversationHistory([
          {
            id: 'greet-' + Date.now(),
            role: 'ai',
            text: defaultGreeting,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        playAudioOrSpeech(defaultGreeting, forcedLang, null, () => {
          startListening();
        });
      }
    } catch (e) {
      console.warn('Initial greeting fetch notice, using immediate speech:', e?.message || e);
      setConversationHistory([
        {
          id: 'greet-' + Date.now(),
          role: 'ai',
          text: defaultGreeting,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      playAudioOrSpeech(defaultGreeting, forcedLang, null, () => {
        startListening();
      });
    }
  };

  // Test Sarvam API Key
  const handleTestSarvamKey = async () => {
    if (!sarvamKey || !sarvamKey.trim()) return;
    setKeyTestStatus('testing');
    try {
      const res = await fetch('/api/voice/test-sarvam-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: sarvamKey.trim(),
          speaker,
          language
        })
      });
      const data = await res.json();
      if (data.success && data.audio_base64) {
        setKeyTestStatus('valid');
        playAudioOrSpeech('నమస్కారం! సర్వం ఏఐ తెలుగు వాయిస్ విజయవంతంగా అనుసంధానించబడింది.', language, data.audio_base64);
      } else {
        setKeyTestStatus('invalid');
      }
    } catch {
      setKeyTestStatus('invalid');
    }
  };

  // Save Sarvam API Key
  const handleSaveSarvamKey = async () => {
    const trimmed = (sarvamKey || '').trim();
    try {
      localStorage.setItem('kissan_sarvam_key', trimmed);
      await fetch('/api/voice/save-sarvam-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: trimmed })
      });
    } catch {}
    setShowKeyModal(false);
    triggerInitialGreeting(language, speaker);
  };

  // ── 2. LISTEN FOR FARMER'S VOICE RESPONSE WITH BARGE-IN ──
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setAssistantState('idle');
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = getLangCode(language);
      recognition.interimResults = true;
      recognition.continuous = true;
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        isListeningRef.current = true;
        transcriptRef.current = '';
        setAssistantState('listening');
        setTranscript('');
      };

      recognition.onspeechstart = () => {
        // BARGE-IN: User began talking while assistant was speaking -> cut off playback immediately!
        if (assistantState === 'speaking' || assistantState === 'greeting') {
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
          }
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
          }
          setIsInterrupted(true);
          setAssistantState('listening');
          setTimeout(() => setIsInterrupted(false), 2000);
        }
      };

      recognition.onresult = (event) => {
        // BARGE-IN: User speech detected -> halt audio immediately
        if (audioRef.current || ('speechSynthesis' in window && window.speechSynthesis.speaking)) {
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
          }
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
          }
          setIsInterrupted(true);
          setAssistantState('listening');
          setTimeout(() => setIsInterrupted(false), 2000);
        }

        let fullTranscript = '';
        let hasFinalResult = false;
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript + ' ';
          if (event.results[i].isFinal) hasFinalResult = true;
        }
        const cleanText = fullTranscript.trim();
        if (cleanText) {
          transcriptRef.current = cleanText;
          setTranscript(cleanText);
        }

        // Debounced silence detection: user pauses speaking -> automatically submit query
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        if (cleanText.length > 1) {
          const timeoutMs = hasFinalResult ? 900 : 1300;
          silenceTimerRef.current = setTimeout(() => {
            const textToProcess = (transcriptRef.current || cleanText).trim();
            if (textToProcess) {
              transcriptRef.current = '';
              handleProcessVoice(textToProcess);
            }
          }, timeoutMs);
        }
      };

      recognition.onerror = (e) => {
        console.warn('Speech recognition notice:', e?.error || e);
        if (e?.error === 'language-not-supported' && recognition.lang !== 'en-IN') {
          try {
            recognition.lang = 'en-IN';
            recognition.start();
            return;
          } catch {}
        }
      };

      recognition.onend = () => {
        isListeningRef.current = false;
        // If recognition closed and there is pending spoken text, process it immediately!
        const pending = (transcriptRef.current || '').trim();
        if (pending.length > 1) {
          transcriptRef.current = '';
          handleProcessVoice(pending);
        } else if (assistantState === 'listening') {
          setAssistantState('idle');
        }
      };

      recognition.start();
    } catch (e) {
      console.warn('Speech recognition start failed:', e);
      isListeningRef.current = false;
      setAssistantState('idle');
    }
  };

  // ── 3. PROCESS FARMER QUERY (RAG + GEMINI + SARVAM) & SPEAK RESPONSE ──
  const handleProcessVoice = async (textToProcess) => {
    const queryText = (textToProcess || transcript || '').trim();
    if (!queryText) return;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    if (audioRef.current) audioRef.current.pause();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    setAssistantState('processing');
    setLastAction(null);

    // Record farmer's speech in conversation feed
    const farmerMsg = {
      id: 'farmer-' + Date.now(),
      role: 'farmer',
      text: queryText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    const updatedHistory = [...conversationHistory, farmerMsg];
    setConversationHistory(updatedHistory);
    setTranscript('');

    try {
      const res = await fetch('/api/voice/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmer_id: currentFarmerId,
          session_id: sessionId,
          text: queryText,
          language,
          speaker,
          sarvam_api_key: sarvamKey || undefined,
          conversation_history: updatedHistory.map(m => ({ role: m.role, text: m.text })),
          booking_draft: bookingDraft
        })
      });

      const json = await res.json();
      if (json.success && json.data) {
        setResponse(json.data);

        // Update booking draft from multi-turn dialogue
        if (json.data.updated_booking_draft) {
          setBookingDraft(prev => ({ ...prev, ...json.data.updated_booking_draft }));
        }

        // Add AI response to conversation feed
        const aiMsg = {
          id: 'ai-' + Date.now(),
          role: 'ai',
          text: json.data.spoken_response,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setConversationHistory(prev => [...prev, aiMsg]);

        // Speak AI answer with Sarvam AI or Web Speech
        playAudioOrSpeech(
          json.data.spoken_response,
          language,
          json.data.audio_base64,
          () => {
            // Once spoken, seamlessly listen again for continuous conversation
            startListening();
          }
        );

        // Update booking draft if returned
        if (json.data.updated_booking_draft !== undefined) {
          setBookingDraft(json.data.updated_booking_draft || {});
        }

        // Handle available location/date/time options
        if (json.data.action_taken === 'prompt_location_selection') {
          setAvailableOptions({
            locations: json.data.action_payload?.available_locations || [],
            dates: [],
            times: [],
            unavailableDate: null
          });
        } else if (json.data.action_taken === 'prompt_date_selection' || json.data.action_taken === 'suggest_available_dates') {
          setAvailableOptions({
            locations: [],
            dates: json.data.action_payload?.available_dates || [],
            times: [],
            unavailableDate: json.data.action_payload?.unavailable_date || null
          });
        } else if (json.data.action_taken === 'prompt_time_selection') {
          setAvailableOptions({
            locations: [],
            dates: [],
            times: json.data.action_payload?.available_times || [],
            unavailableDate: null
          });
        }

        // ── Automated Action Execution ──
        if (json.data.action_taken === 'booking_created') {
          setBookingDraft({}); // Reset draft upon completed booking
          setAvailableOptions({ dates: [], times: [], unavailableDate: null });
          setLastAction({
            type: 'booking',
            token: json.data.action_payload?.token_number || 'TK-NEW',
            msg: language === 'te' ? 'స్లాట్ విజయవంతంగా బుక్ చేయబడింది!' : 'Slot Booked Successfully!'
          });
          if (onBookingCreated) onBookingCreated();
        } else if (json.data.action_taken && json.data.action_taken.startsWith('navigate:')) {
          const targetScreen = json.data.action_taken.split(':')[1];
          setLastAction({
            type: 'navigation',
            screen: targetScreen,
            msg: language === 'te' ? `${targetScreen} పేజీకి వెళ్తున్నారు...` : `Navigating to ${targetScreen}...`
          });
          setTimeout(() => {
            if (onNavigate) onNavigate(targetScreen);
          }, 2000);
        }
      } else {
        setAssistantState('idle');
      }
    } catch (err) {
      console.warn('Process voice error:', err);
      setAssistantState('idle');
    }
  };

  return (
    <>
      {/* ── Floating Voice Assistant Trigger ── */}
      <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40">
        <button
          type="button"
          onClick={handleOpenModal}
          className="relative bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-900 text-white p-3.5 sm:p-4 rounded-full shadow-gov-xl flex items-center gap-2.5 transition-transform hover:scale-105 active:scale-95 border-2 border-amber-400 cursor-pointer"
          title="Sarvam AI Voice Assistant"
        >
          {/* Pulsing ring indicator */}
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 text-[8px] font-black text-slate-950 items-center justify-center">AI</span>
          </span>

          <Mic className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300 animate-pulse" />
          <div className="text-left hidden sm:block pr-1">
            <div className="font-black text-xs text-white leading-tight">
              {language === 'te' ? 'కిసాన్ వాణి AI' : (language === 'hi' ? 'किसान वाणी AI' : 'Kisan Vaani AI')}
            </div>
            <div className="text-[9px] text-amber-300 font-bold flex items-center gap-1">
              <span>Sarvam Voice Assistant</span>
            </div>
          </div>
        </button>
      </div>

      {/* ── Voice Assistant Modal Overlay ── */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white border-t sm:border border-slate-200 rounded-t-3xl sm:rounded-3xl max-w-lg w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]">
            {/* National Tricolor Ribbon */}
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-white to-emerald-600 shrink-0" />

            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-400 to-emerald-600 flex items-center justify-center text-slate-950 font-black text-base shadow-md">
                  🎙️
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-white text-sm sm:text-base">
                      {language === 'te' ? 'కిసాన్ వాణి • Sarvam AI' : 'Kisan Vaani • Sarvam AI'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                      Bulbul v3 ({speaker})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-amber-300 font-medium">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>Live DB RAG</span>
                    </span>
                    <span>•</span>
                    <span className="text-emerald-300">Barge-in Enabled</span>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <button
                  type="button"
                  onClick={() => setShowKeyModal(true)}
                  className={`px-2 py-1 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-1 ${
                    sarvamKey ? 'bg-emerald-900/60 border-emerald-500 text-emerald-300' : 'bg-amber-900/60 border-amber-500 text-amber-300 animate-pulse'
                  }`}
                  title="Configure Sarvam AI Subscription Key"
                >
                  <span>🔑</span>
                  <span>{sarvamKey ? 'Key Active' : 'Set Key'}</span>
                </button>

                <select
                  value={speaker}
                  onChange={(e) => {
                    setSpeaker(e.target.value);
                    triggerInitialGreeting(language, e.target.value);
                  }}
                  className="bg-slate-800 text-emerald-300 text-[11px] font-bold px-2 py-1 rounded-xl border border-slate-700 outline-none cursor-pointer"
                  title="Sarvam AI Female Speaker"
                >
                  <option value="priya">👩 ప్రియ (Priya)</option>
                  <option value="kavya">👩 కావ్య (Kavya)</option>
                  <option value="neha">👩 నేహ (Neha)</option>
                  <option value="roopa">👩 రూపా (Roopa)</option>
                  <option value="kavitha">👩 కవిత (Kavitha)</option>
                  <option value="rupali">👩 రూపాలి (Rupali)</option>
                </select>

                <select
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value);
                    triggerInitialGreeting(e.target.value, speaker);
                  }}
                  className="bg-slate-800 text-amber-300 text-[11px] font-bold px-2 py-1 rounded-xl border border-slate-700 outline-none cursor-pointer"
                >
                  <option value="te">తెలుగు (TE)</option>
                  <option value="en">English (EN)</option>
                  <option value="hi">हिन्दी (HI)</option>
                  <option value="kn">ಕನ್ನಡ (KN)</option>
                </select>

                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer hover:bg-slate-700 transition-all ml-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">

              {/* ── Voice Agent Goals & Capabilities Header ── */}
              <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-teal-950 text-white p-3 sm:p-3.5 rounded-2xl shadow-sm border border-emerald-800/60">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>{language === 'te' ? 'కిసాన్ వాణి లక్ష్యాలు & విధులు' : (language === 'hi' ? 'किसान वाणी लक्ष्य एवं कार्य' : 'Kisan Vaani Goals & Tasks')}</span>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    AI Automated
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[10px]">
                  <div 
                    onClick={() => handleProcessVoice(language === 'te' ? 'వరి 50 క్వింటాళ్లు స్లాట్ బుక్ చేయండి' : 'Book slot for 50 quintals paddy')}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all cursor-pointer border border-white/10"
                  >
                    <div className="font-black text-white flex items-center gap-1">
                      <span>🌾</span>
                      <span>{language === 'te' ? '1. స్లాట్ బుకింగ్' : '1. Slot Booking'}</span>
                    </div>
                    <div className="text-slate-300 text-[9px] truncate">పంట & క్వింటాళ్లు చెప్పండి</div>
                  </div>

                  <div 
                    onClick={() => handleProcessVoice(language === 'te' ? 'క్యూ నెంబర్ ఎంత' : 'What is my queue position')}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all cursor-pointer border border-white/10"
                  >
                    <div className="font-black text-white flex items-center gap-1">
                      <span>🚦</span>
                      <span>{language === 'te' ? '2. లైవ్ క్యూ నెంబర్' : '2. Live Queue'}</span>
                    </div>
                    <div className="text-slate-300 text-[9px] truncate">టోకెన్ & వేచి ఉండే సమయం</div>
                  </div>

                  <div 
                    onClick={() => handleProcessVoice(language === 'te' ? 'నేను మండికి వచ్చాను గేట్ చెక్ ఇన్ చేయండి' : 'I have arrived gate check in')}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all cursor-pointer border border-white/10"
                  >
                    <div className="font-black text-white flex items-center gap-1">
                      <span>🚪</span>
                      <span>{language === 'te' ? '3. గేట్ అరైవల్' : '3. Gate Check-In'}</span>
                    </div>
                    <div className="text-slate-300 text-[9px] truncate">భౌతిక రాక రిపోర్టింగ్</div>
                  </div>

                  <div 
                    onClick={() => handleProcessVoice(language === 'te' ? 'నా పంట పేమెంట్ డబ్బులు జమ అయ్యాయా' : 'What is my payment status')}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all cursor-pointer border border-white/10"
                  >
                    <div className="font-black text-white flex items-center gap-1">
                      <span>💰</span>
                      <span>{language === 'te' ? '4. DBT పేమెంట్' : '4. DBT Payment'}</span>
                    </div>
                    <div className="text-slate-300 text-[9px] truncate">PFMS జమ & UTR వివరాలు</div>
                  </div>

                  <div 
                    onClick={() => handleProcessVoice(language === 'te' ? 'ప్రభుత్వ MSP మద్దతు ధరలు ఎంత' : 'What are the MSP rates')}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all cursor-pointer border border-white/10"
                  >
                    <div className="font-black text-white flex items-center gap-1">
                      <span>⚖️</span>
                      <span>{language === 'te' ? '5. ప్రభుత్వ ధరలు' : '5. MSP Rates'}</span>
                    </div>
                    <div className="text-slate-300 text-[9px] truncate">అధికారిక MSP రేట్లు</div>
                  </div>

                  <div 
                    onClick={() => handleProcessVoice(language === 'te' ? 'మా గ్రామానికి కొత్త కొనుగోలు కేంద్రం కావాలి' : 'Request new procurement center')}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all cursor-pointer border border-white/10"
                  >
                    <div className="font-black text-white flex items-center gap-1">
                      <span>🏢</span>
                      <span>{language === 'te' ? '6. కొత్త కేంద్రం' : '6. Center Request'}</span>
                    </div>
                    <div className="text-slate-300 text-[9px] truncate">గ్రామ మండి అభ్యర్థన</div>
                  </div>
                </div>
              </div>

              {/* ── State & Mic Center ── */}
              <div className="text-center py-3 bg-gradient-to-b from-slate-50 to-emerald-50/40 rounded-3xl p-4 border border-slate-100 relative">
                {/* Barge-in Interrupted Flash Alert */}
                {isInterrupted && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 font-black text-[10px] px-3 py-1 rounded-full shadow-md animate-bounce flex items-center gap-1 z-10">
                    <Zap className="w-3 h-3 text-slate-950" />
                    <span>{language === 'te' ? 'వాయిస్ ఆపబడింది! మీరు మాట్లాడండి...' : 'Interrupted! Listening to you...'}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (assistantState === 'speaking' || assistantState === 'greeting') {
                      interruptAssistant();
                    } else if (assistantState === 'listening') {
                      isListeningRef.current = false;
                      if (recognitionRef.current) try { recognitionRef.current.stop(); } catch {}
                      const pending = (transcriptRef.current || transcript || '').trim();
                      if (pending.length > 1) {
                        transcriptRef.current = '';
                        handleProcessVoice(pending);
                      } else {
                        setAssistantState('idle');
                      }
                    } else {
                      startListening();
                    }
                  }}
                  className={`w-20 h-20 sm:w-22 sm:h-22 rounded-full flex items-center justify-center mx-auto transition-all shadow-xl active:scale-95 cursor-pointer relative ${
                    assistantState === 'listening'
                      ? 'bg-red-600 text-white animate-pulse ring-8 ring-red-200'
                      : (assistantState === 'greeting' || assistantState === 'speaking'
                        ? 'bg-amber-500 text-slate-950 animate-bounce ring-8 ring-amber-100 hover:bg-amber-600'
                        : 'bg-gradient-to-tr from-emerald-700 to-teal-600 text-white ring-8 ring-emerald-100 hover:scale-105')
                  }`}
                  title={assistantState === 'speaking' ? 'Click to Interrupt and Speak' : (assistantState === 'listening' ? 'Click to Send Spoken Words' : 'Microphone')}
                >
                  {assistantState === 'listening' ? (
                    <Mic className="w-8 h-8 sm:w-9 sm:h-9 text-white animate-pulse" />
                  ) : (assistantState === 'greeting' || assistantState === 'speaking' ? (
                    <div className="flex flex-col items-center">
                      <Volume2 className="w-7 h-7 text-slate-950" />
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-900 mt-0.5">Interrupt</span>
                    </div>
                  ) : (
                    <Mic className="w-8 h-8 sm:w-9 sm:h-9 text-amber-300" />
                  ))}
                </button>

                {/* Real-time State Banner */}
                <div className="mt-2.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black mb-1 bg-white shadow-xs border border-slate-200">
                    {assistantState === 'greeting' && (
                      <span className="text-amber-700 flex items-center gap-1">
                        <Radio className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                        <span>{language === 'te' ? 'కిసాన్ వాణి మాట్లాడుతోంది...' : 'Speaking initial greeting...'}</span>
                      </span>
                    )}
                    {assistantState === 'listening' && (
                      <span className="text-red-600 flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                        <span>{language === 'te' ? 'మీరు మాట్లాడండి... నేను వింటున్నాను' : 'Listening... Speak now'}</span>
                      </span>
                    )}
                    {assistantState === 'processing' && (
                      <span className="text-blue-700 flex items-center gap-1">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                        <span>{language === 'te' ? 'Gemini 3.6 Flash & DB విశ్లేషిస్తోంది...' : 'Querying Database & Gemini AI...'}</span>
                      </span>
                    )}
                    {assistantState === 'speaking' && (
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-700 flex items-center gap-1">
                          <Volume2 className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                          <span>{language === 'te' ? 'సమాధానం మాట్లాడుతోంది' : 'Speaking answer'}</span>
                        </span>
                        <button
                          type="button"
                          onClick={interruptAssistant}
                          className="px-2 py-0.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-bold border border-amber-300 flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <StopCircle className="w-3 h-3 text-amber-700" />
                          <span>{language === 'te' ? 'ఆపండి (Interrupt)' : 'Interrupt'}</span>
                        </button>
                      </div>
                    )}
                    {assistantState === 'idle' && (
                      <span className="text-slate-700">
                        {language === 'te' ? 'మాట్లాడటానికి మైక్ బటన్ నొక్కండి' : 'Tap microphone to speak'}
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-500">
                    Barge-in Support: You can interrupt at any time by speaking or tapping the button
                  </p>
                </div>

                {/* Spoken Transcript Preview & Instant Process Button */}
                {transcript && (
                  <div className="mt-2 text-xs text-slate-900 font-bold bg-white border-2 border-amber-400 p-2.5 rounded-2xl shadow-sm text-left flex items-center justify-between gap-2 animate-slideUp">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-amber-600 text-base shrink-0">🎙️</span>
                      <span className="truncate font-black text-slate-900">"{transcript}"</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const txt = transcript.trim();
                        transcriptRef.current = '';
                        handleProcessVoice(txt);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer shrink-0 flex items-center gap-1 transition-all"
                    >
                      <span>పంపండి</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* ── Interactive Multi-Turn Booking Progress Widget ── */}
              {(bookingDraft.crop || bookingDraft.quantity || bookingDraft.location_id || bookingDraft.date) && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 rounded-2xl p-3 text-xs shadow-xs animate-fadeIn">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black text-emerald-950 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                      <Package className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{language === 'te' ? 'స్లాట్ బుకింగ్ వివరాలు (Live Booking Draft)' : 'Active Booking Parameters'}</span>
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                      Multi-Turn Active
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-white/80 border border-emerald-100">
                      <span className="text-sm">🌾</span>
                      <div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">{language === 'te' ? 'పంట' : 'Crop'}</div>
                        <div className="font-black text-slate-900">
                          {bookingDraft.crop || <span className="text-amber-600 font-bold italic">అడగండి...</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-white/80 border border-emerald-100">
                      <span className="text-sm">⚖️</span>
                      <div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">{language === 'te' ? 'పరిమాణం' : 'Quantity'}</div>
                        <div className="font-black text-slate-900">
                          {bookingDraft.quantity ? `${bookingDraft.quantity} Quintals` : <span className="text-amber-600 font-bold italic">ఎన్ని క్వింటాళ్లు?</span>}
                        </div>
                      </div>
                    </div>

                    <div 
                      onClick={() => handleProcessVoice(language === 'te' ? 'కొనుగోలు కేంద్రం మార్చాలి' : 'Change mandi centre')}
                      className="flex items-center gap-1.5 p-1.5 rounded-xl bg-white/80 border border-emerald-100 hover:border-amber-400 hover:bg-amber-50/40 transition-all cursor-pointer"
                      title="Tap to change mandi center"
                    >
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-slate-400 font-bold uppercase">{language === 'te' ? 'కేంద్రం' : 'Mandi Center'}</span>
                          <span className="text-[8px] text-amber-700 font-bold underline">మార్చు</span>
                        </div>
                        <div className="font-black text-slate-900 truncate">
                          {bookingDraft.location_id ? (locationNames[bookingDraft.location_id] || bookingDraft.location_id) : <span className="text-amber-600 font-bold italic">ఎంపిక చేయండి...</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-white/80 border border-emerald-100">
                      <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">{language === 'te' ? 'తేదీ / సమయం' : 'Date / Slot'}</div>
                        <div className="font-black text-slate-900">
                          {bookingDraft.date ? `${bookingDraft.date}${bookingDraft.time ? ' · ' + bookingDraft.time : ''}` : <span className="text-amber-600 font-bold italic">తేదీ నిర్ణయించండి...</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Interactive Mandi Location, Date & Time Slots from Admin ── */}
              {(availableOptions.locations?.length > 0 || availableOptions.dates.length > 0 || availableOptions.times.length > 0 || availableOptions.unavailableDate) && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-3 space-y-2.5 shadow-sm animate-fadeIn">
                  {availableOptions.unavailableDate && (
                    <div className="flex items-center gap-1.5 text-xs text-red-700 bg-red-100 p-2 rounded-xl font-bold border border-red-200">
                      <span>⚠️</span>
                      <span>{availableOptions.unavailableDate} తేదీన అడ్మిన్ స్లాట్ కేటాయించలేదు. క్రింది తేదీలలో ఒకదాన్ని ఎంచుకోండి:</span>
                    </div>
                  )}

                  {availableOptions.locations?.length > 0 && (
                    <div>
                      <div className="text-[11px] font-black uppercase text-amber-900 flex items-center justify-between mb-1.5">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-amber-700" />
                          <span>{language === 'te' ? 'కొనుగోలు కేంద్రాలు (Tap to Select Center):' : 'Available Mandi Centres:'}</span>
                        </span>
                        <span className="text-[9px] text-amber-700 bg-amber-200/80 px-2 py-0.5 rounded-full font-bold">AP Mandis</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {availableOptions.locations.map(loc => (
                          <button
                            key={loc.id}
                            type="button"
                            onClick={() => handleProcessVoice(`${loc.name} కేంద్రం`)}
                            className="px-3 py-2 bg-white hover:bg-emerald-50 active:scale-95 border-2 border-emerald-400 text-slate-900 font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-between text-left"
                          >
                            <span className="font-black truncate">{loc.name}</span>
                            <span className="text-[10px] text-slate-500 shrink-0 ml-1">{loc.district}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {availableOptions.dates.length > 0 && (
                    <div>
                      <div className="text-[11px] font-black uppercase text-amber-900 flex items-center justify-between mb-1.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-amber-700" />
                          <span>{language === 'te' ? 'అడ్మిన్ కేటాయించిన తేదీలు (Tap to Select Date):' : 'Available Admin Dates:'}</span>
                        </span>
                        <span className="text-[9px] text-amber-700 bg-amber-200/80 px-2 py-0.5 rounded-full font-bold">Admin Allocated</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {availableOptions.dates.map(d => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => handleProcessVoice(`${d} తేదీన స్లాట్ కావాలి`)}
                            className="px-3 py-1.5 bg-white hover:bg-amber-100 active:scale-95 border-2 border-amber-400 text-amber-950 font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1"
                          >
                            <span>📅</span>
                            <span>{d}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {availableOptions.times.length > 0 && (
                    <div>
                      <div className="text-[11px] font-black uppercase text-amber-900 flex items-center justify-between mb-1.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-700" />
                          <span>{language === 'te' ? 'అడ్మిన్ కేటాయించిన సమయాలు (Tap to Select Time Window):' : 'Available Time Windows:'}</span>
                        </span>
                        <span className="text-[9px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">Open Slots</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {availableOptions.times.map(tw => (
                          <button
                            key={tw}
                            type="button"
                            onClick={() => handleProcessVoice(`${tw} సమయానికి స్లాట్ కన్ఫర్మ్ చేయండి`)}
                            className="px-3 py-2 bg-white hover:bg-emerald-50 active:scale-95 border-2 border-emerald-400 text-emerald-950 font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1 text-center"
                          >
                            <span>⏰</span>
                            <span>{tw}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Quick Crop & Quintal Selectors (One-Tap or Number Input) ── */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-slate-600 flex items-center gap-1">
                    <span>🌾</span>
                    <span>{language === 'te' ? 'పంట & క్వింటాళ్ల ఎంపిక (Tap or Type)' : 'Crop & Quintals Selector:'}</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">{language === 'te' ? 'నేరుగా నొక్కండి' : 'One-tap'}</span>
                </div>

                {/* Quick Crop Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {[
                    { id: 'Paddy', labelTe: '🌾 వరి (Paddy)', labelEn: '🌾 Paddy' },
                    { id: 'Cotton', labelTe: '🌿 పత్తి (Cotton)', labelEn: '🌿 Cotton' },
                    { id: 'Maize', labelTe: '🌽 మొక్కజొన్న (Maize)', labelEn: '🌽 Maize' },
                    { id: 'Wheat', labelTe: '🌾 గోధుమ (Wheat)', labelEn: '🌾 Wheat' },
                    { id: 'Chilli', labelTe: '🌶️ మిర్చి (Chilli)', labelEn: '🌶️ Chilli' },
                  ].map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        const txt = language === 'te' ? `${c.labelTe} పంట` : `${c.id} crop`;
                        handleProcessVoice(txt);
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        bookingDraft.crop === c.id
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400'
                      }`}
                    >
                      {language === 'te' ? c.labelTe : c.labelEn}
                    </button>
                  ))}
                </div>

                {/* Quick Quintal Chips & Number Input */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[10, 25, 50, 75, 100, 200].map(q => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        const txt = language === 'te' ? `${q} క్వింటాళ్లు` : `${q} quintals`;
                        handleProcessVoice(txt);
                      }}
                      className={`px-2.5 py-1 rounded-xl text-xs font-black border transition-all cursor-pointer shrink-0 ${
                        Number(bookingDraft.quantity) === q
                          ? 'bg-slate-900 text-amber-300 border-slate-900'
                          : 'bg-white text-slate-800 border-slate-200 hover:border-amber-400'
                      }`}
                    >
                      {q} Qtl
                    </button>
                  ))}

                  {/* Direct Number Input */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (customQuintalInput && Number(customQuintalInput) > 0) {
                        const txt = language === 'te' ? `${customQuintalInput} క్వింటాళ్లు` : `${customQuintalInput} quintals`;
                        handleProcessVoice(txt);
                        setCustomQuintalInput('');
                      }
                    }}
                    className="flex items-center gap-1 ml-auto"
                  >
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      placeholder="Qtl #"
                      value={customQuintalInput}
                      onChange={(e) => setCustomQuintalInput(e.target.value)}
                      className="w-16 px-2 py-1 text-xs font-black rounded-lg border border-slate-300 bg-white text-slate-900 outline-none focus:border-emerald-600 text-center"
                    />
                    <button
                      type="submit"
                      disabled={!customQuintalInput}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-lg cursor-pointer"
                    >
                      OK
                    </button>
                  </form>
                </div>
              </div>

              {/* ── Multi-Turn Conversation Thread Feed ── */}
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {conversationHistory.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'farmer' ? 'items-end' : 'items-start'} text-left animate-fadeIn`}
                  >
                    <div
                      className={`p-3 rounded-2xl max-w-[85%] text-xs shadow-xs ${
                        msg.role === 'farmer'
                          ? 'bg-slate-900 text-white rounded-br-none'
                          : 'bg-emerald-50 border border-emerald-200 text-slate-900 rounded-bl-none'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1 text-[10px] font-bold opacity-75">
                        <span>{msg.role === 'farmer' ? '🌾 మీరు (Farmer)' : `🎙️ కిసాన్ వాణి (${speaker})`}</span>
                        <span>{msg.time}</span>
                      </div>
                      <p className="font-semibold leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Action Banner (Booking confirmed, check-in, etc.) */}
              {lastAction && (
                <div className="bg-emerald-600 text-white p-3 rounded-2xl shadow-md flex items-center justify-between text-xs font-bold animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-amber-300 shrink-0" />
                    <div>
                      <div>{lastAction.msg}</div>
                      {lastAction.token && (
                        <div className="text-amber-200 text-[11px] font-mono">
                          Token Number: {lastAction.token}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── One-Tap Quick Voice Task Automations ── */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>{language === 'te' ? 'త్వరిత పనులు (Quick Automations):' : 'Quick Voice Task Automations:'}</span>
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                  {(samplePrompts[language] || samplePrompts.te).map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setTranscript(prompt.text);
                        handleProcessVoice(prompt.text);
                      }}
                      className="w-full text-left bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-400 rounded-2xl p-2.5 text-xs text-slate-800 font-bold transition-all active:scale-98 flex items-center justify-between cursor-pointer group shadow-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base">{prompt.icon}</span>
                        <div className="truncate">
                          <div className="font-black text-slate-900">{prompt.label}</div>
                          <div className="text-[10px] text-slate-400 font-medium truncate">"{prompt.text}"</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Type & Ask Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (textInput && textInput.trim()) {
                  const query = textInput.trim();
                  setTextInput('');
                  handleProcessVoice(query);
                }
              }}
              className="px-4 py-2.5 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={language === 'te' ? 'ఇక్కడ టైప్ చేసి అడగండి (Type question here)...' : 'Type your question here...'}
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-emerald-600 outline-none text-slate-900 font-medium"
              />
              <button
                type="submit"
                disabled={!textInput.trim() || assistantState === 'processing'}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-40 text-white rounded-xl text-xs font-black shrink-0 cursor-pointer shadow-xs active:scale-95 transition-all flex items-center gap-1"
              >
                <span>{language === 'te' ? 'పంపండి' : 'Send'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </form>

            {/* Footer info */}
            <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center text-[10px] text-slate-500 flex items-center justify-between px-4 shrink-0">
              <span className="flex items-center gap-1">
                <span>🔊</span> Sarvam AI Bulbul v3 Female ({speaker})
              </span>
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Google AI Studio Gemini 3.6 Flash</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Sarvam API Key Configuration Modal ── */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 border border-slate-200 relative animate-scaleIn">
            <button
              type="button"
              onClick={() => setShowKeyModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center text-2xl font-black">
                🔑
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Sarvam AI Subscription Key</h3>
                <p className="text-xs text-slate-500 font-medium">Connect Bulbul v3 Female Telugu Voice</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Get your free or standard subscription key from <a href="https://dashboard.sarvam.ai" target="_blank" rel="noreferrer" className="text-emerald-700 font-bold underline">dashboard.sarvam.ai</a> and paste it below:
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Sarvam AI Subscription Key
                </label>
                <input
                  type="password"
                  value={sarvamKey}
                  onChange={(e) => {
                    setSarvamKey(e.target.value);
                    setKeyTestStatus(null);
                  }}
                  placeholder="Paste your Sarvam API Key here..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>

              {keyTestStatus === 'valid' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Key is valid! Sarvam Bulbul v3 voice synthesized successfully.</span>
                </div>
              )}

              {keyTestStatus === 'invalid' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center gap-2">
                  <span>⚠️ Authentication failed. Please verify your Sarvam API key from dashboard.sarvam.ai</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={handleTestSarvamKey}
                disabled={!sarvamKey || keyTestStatus === 'testing'}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{keyTestStatus === 'testing' ? 'Testing...' : 'Test Voice'}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveSarvamKey}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                Save & Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
