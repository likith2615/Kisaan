import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zzjvoxaawrekaucpmtrd.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6anZveGFhd3Jla2F1Y3BtdHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MTA4MzQsImV4cCI6MjEwNDI4NjgzNH0.Bj35wtJ-sMdLhzFxStliAufMx8UiDqU9cWLwxldD0gk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
