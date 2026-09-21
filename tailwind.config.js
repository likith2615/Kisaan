/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Indian Government Official Theme Tokens
        "gov-navy": {
          DEFAULT: "#0B2545",
          50:  "#F0F5FA",
          100: "#DCE6F2",
          200: "#B8CCE4",
          300: "#8FAFD2",
          400: "#5D8EBF",
          500: "#134074",
          600: "#0B2545",
          700: "#081B33",
          800: "#061222",
          900: "#030A13",
        },
        "gov-saffron": {
          DEFAULT: "#FF9933",
          50:  "#FFF6ED",
          100: "#FFE8D2",
          200: "#FFCFA6",
          300: "#FFB073",
          400: "#FF9933",
          500: "#F26522",
          600: "#D34908",
          700: "#A93406",
          800: "#7F2606",
          900: "#4D1503",
        },
        "gov-green": {
          DEFAULT: "#046A38",
          50:  "#ECFDF5",
          100: "#D1FAE5",
          200: "#A7F3D0",
          300: "#6EE7B7",
          400: "#34D399",
          500: "#138808",
          600: "#046A38",
          700: "#03502A",
          800: "#02371D",
          900: "#011F10",
        },
        "gov-gold": {
          DEFAULT: "#D4AF37",
          50:  "#FEFCE8",
          100: "#FEF9C3",
          200: "#FEF08A",
          300: "#FDE047",
          400: "#FACC15",
          500: "#EAB308",
          600: "#CA8A04",
          700: "#A16207",
          800: "#854D0E",
          900: "#713F12",
        },
        // Material-style surface tokens
        "primary":                 "#0B2545",
        "primary-container":       "#FF9933",
        "on-primary":              "#ffffff",
        "on-primary-container":    "#4D1503",
        "primary-fixed":           "#FFE8D2",
        "on-primary-fixed":        "#2e1500",
        "secondary":               "#134074",
        "secondary-container":     "#DCE6F2",
        "on-secondary-container":  "#081B33",
        "tertiary":                "#046A38",
        "tertiary-container":      "#D1FAE5",
        "on-tertiary-container":   "#03502A",
        "surface":                 "#F8FAFC",
        "surface-container-low":   "#F1F5F9",
        "surface-container":       "#E2E8F0",
        "surface-container-high":  "#CBD5E1",
        "surface-container-highest":"#94A3B8",
        "surface-container-lowest":"#FFFFFF",
        "on-surface":              "#0F172A",
        "on-surface-variant":      "#334155",
        "outline":                 "#64748B",
        "outline-variant":         "#CBD5E1",
        "error":                   "#B91C1C",
        "error-container":         "#FEE2E2",
      },

      fontFamily: {
        sans:  ['"Inter"', '"Noto Sans"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['"Noto Serif"', 'Georgia', 'serif'],
        mono:  ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },

      // ─── BOX SHADOWS ────────────────────────────────────────
      boxShadow: {
        'gov':      '0 1px 3px rgba(11,37,69,0.08), 0 1px 2px rgba(11,37,69,0.04)',
        'gov-md':   '0 4px 6px -1px rgba(11,37,69,0.10), 0 2px 4px -1px rgba(11,37,69,0.06)',
        'gov-lg':   '0 10px 15px -3px rgba(11,37,69,0.12), 0 4px 6px -2px rgba(11,37,69,0.05)',
        'gov-xl':   '0 20px 40px -8px rgba(11,37,69,0.20), 0 8px 16px -4px rgba(11,37,69,0.08)',
        'gov-gold':  '0 0 20px rgba(212,175,55,0.30)',
        'gov-green': '0 8px 24px -4px rgba(4,106,56,0.25)',
        'inner-sm':  'inset 0 1px 3px rgba(0,0,0,0.06)',
        'card':      '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(11,37,69,0.06)',
        'card-hover':'0 4px 6px rgba(0,0,0,0.04), 0 12px 32px rgba(11,37,69,0.12)',
      },

      // ─── ANIMATIONS ─────────────────────────────────────────
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          from: { opacity: '0', transform: 'translateX(-20px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.92)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        marquee: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        borderGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255,153,51,0.4)' },
          '50%':       { boxShadow: '0 0 0 6px rgba(255,153,51,0)' },
        },
        countUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fadeIn':      'fadeIn 0.45s ease-out both',
        'slideUp':     'slideUp 0.5s ease-out both',
        'slideUp-sm':  'slideUp 0.35s ease-out both',
        'slideInLeft': 'slideInLeft 0.45s ease-out both',
        'scaleIn':     'scaleIn 0.35s ease-out both',
        'shimmer':     'shimmer 1.6s linear infinite',
        'marquee':     'marquee 35s linear infinite',
        'borderGlow':  'borderGlow 2.5s ease-in-out infinite',
        'countUp':     'countUp 0.5s ease-out both',
        'spin-slow':   'spin 4s linear infinite',
        'spin-xslow':  'spin 120s linear infinite',
      },

      // ─── SPACING ─────────────────────────────────────────
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },

      // ─── BORDER RADIUS ───────────────────────────────────
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },

      // ─── BACKDROP BLUR ───────────────────────────────────
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
