import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Auto-register Kisan Saathi PWA Service Worker
registerSW({
  immediate: true,
  onRegistered(r) {
    console.log('🌾 Kisan Saathi PWA Service Worker Registered:', r?.scope);
  },
  onRegisterError(error) {
    console.error('🌾 Kisan Saathi PWA Service Worker Registration Error:', error);
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
