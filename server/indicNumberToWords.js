/**
 * Indic Text Normalization for Text-to-Speech (TTS) - Server Side
 * 
 * Prevents Telugu/Kannada TTS engines from pronouncing raw numbers (e.g. 50, 1000, 1,09,150)
 * in Hindi ("pachaas", "ek hazaar") or English. Converts numerals, currencies, percentages,
 * dates, times, and account numbers into native phonetic script words.
 */

// ─── TELUGU NUMBER SYSTEM ───
const TE_UNITS = ['సున్నా', 'ఒకటి', 'రెండు', 'మూడు', 'నాలుగు', 'ఐదు', 'ఆరు', 'ఏడు', 'ఎనిమిది', 'తొమ్మిది'];
const TE_TEENS = ['పది', 'పదకొండు', 'పన్నెండు', 'పదమూడు', 'పద్నాలుగు', 'పదిహేను', 'పదహారు', 'పదిహేడు', 'పద్దెనిమిది', 'పందొమ్మిది'];
const TE_TENS = ['', '', 'ఇరవై', 'ముప్పై', 'నలభై', 'యాభై', 'అరవై', 'డెబ్బై', 'ఎనభై', 'తొంబై'];

export function teluguNumberBelowHundred(n) {
  if (n < 10) return TE_UNITS[n];
  if (n < 20) return TE_TEENS[n - 10];
  const t = Math.floor(n / 10);
  const rem = n % 10;
  if (rem === 0) return TE_TENS[t];
  return TE_TENS[t] + ' ' + TE_UNITS[rem];
}

export function numberToTeluguWords(num) {
  if (isNaN(num)) return '';
  num = Math.floor(Math.abs(num));
  if (num === 0) return 'సున్నా';

  const parts = [];

  // Crores (1,00,00,000)
  const crores = Math.floor(num / 10000000);
  num = num % 10000000;
  if (crores > 0) {
    if (crores === 1) parts.push('ఒక కోటి');
    else parts.push(numberToTeluguWords(crores) + ' కోట్ల');
  }

  // Lakhs (1,00,000)
  const lakhs = Math.floor(num / 100000);
  num = num % 100000;
  if (lakhs > 0) {
    if (lakhs === 1) parts.push(parts.length > 0 ? 'లక్షా' : 'ఒక లక్ష');
    else parts.push(teluguNumberBelowHundred(lakhs) + ' లక్షల');
  }

  // Thousands (1,000)
  const thousands = Math.floor(num / 1000);
  num = num % 1000;
  if (thousands > 0) {
    if (thousands === 1) {
      parts.push((parts.length > 0 || num > 0) ? 'వెయ్యి' : 'ఒక వెయ్యి');
    } else {
      parts.push(teluguNumberBelowHundred(thousands) + (num === 0 ? ' వేలు' : ' వేల'));
    }
  }

  // Hundreds (100)
  const hundreds = Math.floor(num / 100);
  num = num % 100;
  if (hundreds > 0) {
    if (num === 0) {
      if (hundreds === 1) parts.push('వంద');
      else parts.push(teluguNumberBelowHundred(hundreds) + ' వందలు');
    } else {
      if (hundreds === 1) parts.push('నూట');
      else parts.push(teluguNumberBelowHundred(hundreds) + ' వందల');
    }
  }

  // Remainder (0 - 99)
  if (num > 0) {
    parts.push(teluguNumberBelowHundred(num));
  }

  return parts.join(' ').trim();
}

/**
 * Normalizes full text for Telugu TTS so numbers, currencies, and dates
 * are read in authentic Telugu speech.
 */
export function normalizeTeluguForSpeech(text) {
  if (!text || typeof text !== 'string') return '';
  let res = text;

  // 1. Government PFMS UTR Codes (read last 4 digits in Telugu)
  res = res.replace(/PFMS-DBT-([A-Za-z0-9\-]+)/g, (match, fullCode) => {
    const lastDigits = fullCode.replace(/\D/g, '').slice(-4);
    const digitWords = lastDigits.split('').map(d => teluguNumberBelowHundred(parseInt(d, 10))).join(' ');
    return 'పి.ఎఫ్.ఎం.ఎస్ యు.టి.ఆర్ చివరి అంకెలు ' + digitWords;
  });

  // 2. Bank account masked numbers: ••••2511 or ****2511
  res = res.replace(/(?:•{2,}|\*{2,}|x{2,})(\d{2,6})/gi, (match, d4) => {
    const digitWords = d4.split('').map(d => teluguNumberBelowHundred(parseInt(d, 10))).join(' ');
    return 'ఖాతా చివరి అంకెలు ' + digitWords;
  });

  // 3. Currency with Rupee sign or రూ.: ₹1,09,150 or రూ. 1,09,150 or ₹2183/Qtl
  res = res.replace(/(?:₹|రూ\.?|Rs\.?)\s*([\d,]+(?:\.\d+)?)(?:\/Qtl|\/క్వింటా)?/gi, (match, val) => {
    const cleanNum = parseFloat(val.replace(/,/g, ''));
    if (!isNaN(cleanNum)) {
      const isPerQtl = match.toLowerCase().includes('qtl') || match.includes('క్వింటా');
      return numberToTeluguWords(cleanNum) + ' రూపాయలు' + (isPerQtl ? ' ప్రతి క్వింటాలుకు' : '');
    }
    return match;
  });

  // 4. Percentages: 11.5% -> పదకొండు పాయింట్ ఐదు శాతం
  res = res.replace(/(\d+(?:\.\d+)?)\s*%/g, (match, val) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      if (val.includes('.')) {
        const [whole, dec] = val.split('.');
        const wholeWords = numberToTeluguWords(parseInt(whole, 10));
        const decWords = dec.split('').map(d => teluguNumberBelowHundred(parseInt(d, 10))).join(' ');
        return wholeWords + ' పాయింట్ ' + decWords + ' శాతం';
      }
      return numberToTeluguWords(num) + ' శాతం';
    }
    return match;
  });

  // 5. ISO Dates: 2026-09-21 or 21-09-2026
  res = res.replace(/(\d{4})-(\d{2})-(\d{2})/g, (match, y, m, d) => {
    const monthNames = ['', 'జనవరి', 'ఫిబ్రవరి', 'మార్చి', 'ఏప్రిల్', 'మే', 'జూన్', 'జూలై', 'ఆగస్టు', 'సెప్టెంబర్', 'అక్టోబర్', 'నవంబర్', 'డిసెంబర్'];
    const dayWords = numberToTeluguWords(parseInt(d, 10));
    const monthWord = monthNames[parseInt(m, 10)] || m;
    const yearWords = numberToTeluguWords(parseInt(y, 10));
    return dayWords + ' ' + monthWord + ' ' + yearWords;
  });

  // 6. Time: 10:00 AM, 11:30 AM, 02:00 PM
  res = res.replace(/(\d{1,2}):(\d{2})\s*(AM|PM)?/gi, (match, h, m, meridiem) => {
    const hour = parseInt(h, 10);
    const min = parseInt(m, 10);
    let timeStr = '';
    const isPM = (meridiem && meridiem.toUpperCase() === 'PM') || (!meridiem && hour >= 12 && hour < 18);
    const isEve = (meridiem && meridiem.toUpperCase() === 'PM' && hour >= 18) || (!meridiem && hour >= 18);
    
    if (isEve) timeStr += 'సాయంత్రం ';
    else if (isPM) timeStr += 'మధ్యాహ్నం ';
    else timeStr += 'ఉదయం ';

    const displayHour = (hour > 12) ? hour - 12 : (hour === 0 ? 12 : hour);
    const hourWords = numberToTeluguWords(displayHour);

    if (min === 0) {
      timeStr += hourWords + ' గంటలకు';
    } else if (min === 30) {
      timeStr += hourWords + 'న్నర గంటలకు';
    } else {
      timeStr += hourWords + ' గంటల ' + numberToTeluguWords(min) + ' నిమిషాలకు';
    }
    return timeStr;
  });

  // 7. Decimals (e.g. 11.5)
  res = res.replace(/(\d+)\.(\d+)/g, (match, whole, dec) => {
    const wholeWords = numberToTeluguWords(parseInt(whole, 10));
    const decWords = dec.split('').map(d => teluguNumberBelowHundred(parseInt(d, 10))).join(' ');
    return wholeWords + ' పాయింట్ ' + decWords;
  });

  // 8. Isolated numbers (e.g. 50 క్వింటాళ్లు, 1000, 4, 7, 58)
  res = res.replace(/\b([\d,]+)\b/g, (match, val) => {
    const cleanNum = parseInt(val.replace(/,/g, ''), 10);
    if (!isNaN(cleanNum)) {
      return numberToTeluguWords(cleanNum);
    }
    return match;
  });

  return res;
}

// ─── KANNADA NUMBER SYSTEM ───
const KN_UNITS = ['ಸೊನ್ನೆ', 'ಒಂದು', 'ಎರಡು', 'ಮೂರು', 'ನಾಲ್ಕು', 'ಐದು', 'ಆರು', 'ಏಳು', 'ಎಂಟು', 'ಒಂಬತ್ತು'];
const KN_TEENS = ['ಹತ್ತು', 'ಹನ್ನೊಂದು', 'ಹನ್ನೆರಡು', 'ಹದಿಮೂರು', 'ಹದಿನಾಲ್ಕು', 'ಹದಿನೈದು', 'ಹದಿನಾರು', 'ಹದಿನೇಳು', 'ಹದಿನೆಂಟು', 'ಹತ್ತೊಂಬತ್ತು'];
const KN_TENS = ['', '', 'ಇಪ್ಪತ್ತು', 'ಮೂವತ್ತು', 'ನಲವತ್ತು', 'ಐವತ್ತು', 'ಅರವತ್ತು', 'ಎಪ್ಪತ್ತು', 'ಎಂಬತ್ತು', 'ತೊಂಬತ್ತು'];

export function kannadaNumberBelowHundred(n) {
  if (n < 10) return KN_UNITS[n];
  if (n < 20) return KN_TEENS[n - 10];
  const t = Math.floor(n / 10);
  const rem = n % 10;
  if (rem === 0) return KN_TENS[t];
  return KN_TENS[t] + ' ' + KN_UNITS[rem];
}

export function numberToKannadaWords(num) {
  if (isNaN(num)) return '';
  num = Math.floor(Math.abs(num));
  if (num === 0) return 'ಸೊನ್ನೆ';

  const parts = [];
  const crores = Math.floor(num / 10000000);
  num = num % 10000000;
  if (crores > 0) parts.push(numberToKannadaWords(crores) + ' ಕೋಟಿ');

  const lakhs = Math.floor(num / 100000);
  num = num % 100000;
  if (lakhs > 0) parts.push(kannadaNumberBelowHundred(lakhs) + ' ಲಕ್ಷ');

  const thousands = Math.floor(num / 1000);
  num = num % 1000;
  if (thousands > 0) parts.push(kannadaNumberBelowHundred(thousands) + ' ಸಾವಿರ');

  const hundreds = Math.floor(num / 100);
  num = num % 100;
  if (hundreds > 0) parts.push(kannadaNumberBelowHundred(hundreds) + ' ನೂರು');

  if (num > 0) parts.push(kannadaNumberBelowHundred(num));

  return parts.join(' ').trim();
}

export function normalizeKannadaForSpeech(text) {
  if (!text || typeof text !== 'string') return '';
  let res = text;

  // Currency
  res = res.replace(/(?:₹|రూ\.?|Rs\.?)\s*([\d,]+(?:\.\d+)?)/gi, (match, val) => {
    const cleanNum = parseFloat(val.replace(/,/g, ''));
    if (!isNaN(cleanNum)) {
      return numberToKannadaWords(cleanNum) + ' ರೂಪಾಯಿಗಳು';
    }
    return match;
  });

  // Isolated numbers
  res = res.replace(/\b([\d,]+)\b/g, (match, val) => {
    const cleanNum = parseInt(val.replace(/,/g, ''), 10);
    if (!isNaN(cleanNum)) {
      return numberToKannadaWords(cleanNum);
    }
    return match;
  });

  return res;
}

/**
 * Universal speech normalizer dispatch by language code
 */
export function normalizeTextForSpeech(text, lang = 'te') {
  if (!text) return '';
  if (lang === 'te') return normalizeTeluguForSpeech(text);
  if (lang === 'kn') return normalizeKannadaForSpeech(text);
  return text;
}
