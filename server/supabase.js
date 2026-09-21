import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://zzjvoxaawrekaucpmtrd.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6anZveGFhd3Jla2F1Y3BtdHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MTA4MzQsImV4cCI6MjEwNDI4NjgzNH0.Bj35wtJ-sMdLhzFxStliAufMx8UiDqU9cWLwxldD0gk';

export const supabase = createClient(supabaseUrl, supabaseKey);
