import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from './supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'data.json');

// Table name mappings between JS camelCase and Postgres snake_case
const TABLE_MAP = {
  voiceSessions: 'voice_sessions',
  voiceChatSessions: 'voice_chat_sessions',
  adminUsers: 'admin_users',
  centerRequests: 'center_requests',
  pointsLedger: 'points_ledger',
  notificationsLog: 'notifications_log'
};

const toPgTable = (col) => TABLE_MAP[col] || col;

const TABLE_COLUMNS = {
  slots: ['id', 'centre_id', 'location_id', 'date', 'time', 'time_window', 'capacity', 'max_capacity', 'available', 'booked', 'booked_count', 'crop_type', 'msp_per_quintal', 'status', 'created_at'],
  locations: ['id', 'name', 'address', 'village', 'mandal', 'district', 'pincode', 'lat', 'lng', 'status', 'requested_by', 'reviewed_by', 'rejection_reason', 'photo_url', 'created_at'],
  centres: ['id', 'name', 'district', 'mandal', 'location_lat', 'location_lng', 'daily_capacity_quintals', 'contact_phone', 'status', 'created_at'],
  bookings: ['id', 'farmer_id', 'farmer_name', 'farmer_phone', 'slot_id', 'crop_id', 'expected_quantity', 'actual_quantity', 'status', 'payment_status', 'utr_number', 'crop_accepted_at', 'accepted_by', 'quality_grade', 'token_number', 'created_at', 'updated_at', 'queue_position', 'tracking_id', 'crop_type', 'location_id', 'date', 'time'],
  weighments: ['id', 'booking_id', 'farmer_id', 'gross_qty', 'gross_weight', 'bag_count', 'deductions_kg', 'deduction_reason', 'net_qty', 'net_weight', 'tare_weight', 'crop', 'quality_grade', 'moisture_content', 'weighed_by', 'status', 'timestamp', 'created_at'],
  payments: ['id', 'booking_id', 'amount', 'status', 'quantity', 'msp_rate', 'bank_txn_ref', 'utr_number', 'initiated_at', 'confirmed_at', 'paid_at', 'disbursed_at', 'disbursed_by', 'created_at', 'updated_at', 'farmer_id', 'bank_account', 'ifsc', 'bank_name'],
  tracking: ['id', 'booking_id', 'stage', 'notes', 'lorry_id', 'driver_phone', 'destination', 'ewhr_number', 'updated_at'],
  points_ledger: ['id', 'farmer_id', 'booking_id', 'delta', 'reason', 'created_at'],
  logistics: ['id', 'booking_id', 'weighment_id', 'lorry_id', 'driver_phone', 'mill_name', 'destination', 'dispatch_time', 'arrival_time', 'status', 'created_at'],
  notifications: ['id', 'user_id', 'farmer_id', 'title', 'message', 'type', 'channel', 'sent_by', 'booking_id', 'status', 'read', 'timestamp', 'created_at'],
  notifications_log: ['id', 'farmer_id', 'channel', 'template', 'sent_at', 'status'],
  voice_sessions: ['id', 'farmer_id', 'language', 'transcript', 'resolved_intent', 'action_taken', 'created_at'],
  voice_chat_sessions: ['id', 'farmer_id', 'farmer_name', 'status', 'booking_draft', 'messages', 'created_at', 'updated_at', 'closed_at'],
  admin_users: ['id', 'name', 'email', 'password', 'role', 'department', 'designation', 'district', 'created_at'],
  farmers: ['id', 'name', 'aadhaar', 'phone', 'bank_account', 'ifsc', 'district', 'mandal', 'village', 'land_hectares', 'language_preference', 'status', 'created_at', 'points', 'crop_type', 'bank_name'],
  crops: ['id', 'name', 'season', 'msp_per_quintal', 'unit', 'created_at']
};

const sanitizeForPg = (table, obj) => {
  const allowed = TABLE_COLUMNS[table];
  if (!allowed) return { ...obj };
  const sanitized = {};
  for (const col of allowed) {
    if (obj[col] !== undefined) {
      sanitized[col] = obj[col];
    }
  }
  return sanitized;
};

class SupabaseDB {
  constructor() {
    this.localCache = {};
    this.loadLocal();
    this.syncFromSupabase();
  }

  loadLocal() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        this.localCache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      }
    } catch (e) {
      console.warn('Could not read local data.json:', e.message);
    }
  }

  saveLocal() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.localCache, null, 2), 'utf8');
    } catch (e) {
      console.warn('Could not write local data.json:', e.message);
    }
  }

  async syncFromSupabase() {
    const tables = [
      'farmers', 
      'crops', 
      'centres', 
      'locations', 
      'slots', 
      'bookings', 
      'points_ledger', 
      'tracking', 
      'payments', 
      'weighments', 
      'logistics', 
      'notifications', 
      'notifications_log', 
      'admin_users', 
      'center_requests'
    ];
    for (const tbl of tables) {
      try {
        const { data, error } = await supabase.from(tbl).select('*');
        if (!error && data) {
          const key = tbl === 'voice_sessions' ? 'voiceSessions' 
            : (tbl === 'admin_users' ? 'adminUsers' 
            : (tbl === 'center_requests' ? 'centerRequests' 
            : (tbl === 'points_ledger' ? 'pointsLedger'
            : (tbl === 'notifications_log' ? 'notificationsLog' : tbl))));
          this.localCache[key] = data;
        }
      } catch (err) {
        console.warn(`Initial sync error for ${tbl}:`, err.message);
      }
    }
    this.saveLocal();
  }

  // --- Async Supabase Methods ---
  async getAll(collection, filters = {}) {
    const table = toPgTable(collection);
    try {
      let query = supabase.from(table).select('*');
      for (const [key, val] of Object.entries(filters)) {
        if (val !== undefined && val !== null && val !== '') {
          query = query.eq(key, val);
        }
      }
      const { data, error } = await query;
      if (error) {
        console.warn(`Supabase getAll(${table}) error:`, error.message);
        return this.getAllLocal(collection, filters);
      }
      this.localCache[collection] = data;
      return data || [];
    } catch (e) {
      return this.getAllLocal(collection, filters);
    }
  }

  async getById(collection, id) {
    const table = toPgTable(collection);
    try {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
      if (error || !data) {
        return this.getByIdLocal(collection, id);
      }
      return data;
    } catch (e) {
      return this.getByIdLocal(collection, id);
    }
  }

  async create(collection, item) {
    const table = toPgTable(collection);
    if (!item.id) {
      const prefix = collection.substring(0, 4).toUpperCase();
      item.id = `${prefix}-${Date.now()}`;
    }

    // Normalize slot specific fields
    if (collection === 'slots' || table === 'slots') {
      if (!item.location_id && item.centre_id) item.location_id = item.centre_id;
      if (!item.centre_id && item.location_id) item.centre_id = item.location_id;
      if (!item.time_window && item.time) item.time_window = item.time;
      if (!item.time && item.time_window) item.time = item.time_window;
      if (item.capacity !== undefined && item.available === undefined) item.available = item.capacity;
      if (item.capacity !== undefined && item.max_capacity === undefined) item.max_capacity = item.capacity;
      if (item.booked === undefined) item.booked = 0;
      if (item.booked_count === undefined) item.booked_count = 0;
      if (!item.status) item.status = 'active';
      if (!item.crop_type) item.crop_type = 'Paddy';
    }

    // Normalize booking specific fields
    if (collection === 'bookings' || table === 'bookings') {
      if (!item.status) item.status = 'booked';
      if (!item.created_at) item.created_at = new Date().toISOString();
      if (!item.token_number) item.token_number = `TK-${Math.floor(100 + Math.random() * 900)}`;
    }

    const payload = sanitizeForPg(table, item);

    try {
      const { data, error } = await supabase.from(table).insert([payload]).select().single();
      if (error) {
        console.warn(`Supabase insert (${table}) error:`, error.message);
        return this.createLocal(collection, item);
      }
      const merged = { ...item, ...data };
      this.createLocal(collection, merged);
      return merged;
    } catch (e) {
      return this.createLocal(collection, item);
    }
  }

  async update(collection, id, updates) {
    const table = toPgTable(collection);

    if (collection === 'slots' || table === 'slots') {
      if (updates.time && !updates.time_window) updates.time_window = updates.time;
      if (updates.time_window && !updates.time) updates.time = updates.time_window;
    }

    const payload = sanitizeForPg(table, updates);

    try {
      const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single();
      if (error) {
        console.warn(`Supabase update (${table}) error:`, error.message);
        return this.updateLocal(collection, id, updates);
      }
      const merged = { ...updates, ...data };
      this.updateLocal(collection, id, merged);
      return merged;
    } catch (e) {
      return this.updateLocal(collection, id, updates);
    }
  }

  async delete(collection, id) {
    const table = toPgTable(collection);
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) {
        console.warn(`Supabase delete (${table}) error:`, error.message);
        return this.deleteLocal(collection, id);
      }
      this.deleteLocal(collection, id);
      return true;
    } catch (e) {
      return this.deleteLocal(collection, id);
    }
  }

  // --- Synchronous Fallbacks ---
  getAllLocal(collection, filters = {}) {
    let items = this.localCache[collection] || [];
    if (filters.farmer_id) items = items.filter(i => i.farmer_id === filters.farmer_id);
    if (filters.user_id) items = items.filter(i => i.user_id === filters.user_id);
    if (filters.centre_id) items = items.filter(i => i.centre_id === filters.centre_id);
    if (filters.location_id) items = items.filter(i => i.location_id === filters.location_id);
    if (filters.status) items = items.filter(i => i.status === filters.status);
    return items;
  }

  getByIdLocal(collection, id) {
    const list = this.getAllLocal(collection);
    return list.find(item => item.id === id) || null;
  }

  createLocal(collection, item) {
    if (!this.localCache[collection]) this.localCache[collection] = [];
    const idx = this.localCache[collection].findIndex(i => i.id === item.id);
    if (idx >= 0) {
      this.localCache[collection][idx] = item;
    } else {
      this.localCache[collection].push(item);
    }
    this.saveLocal();
    return item;
  }

  updateLocal(collection, id, updates) {
    const list = this.localCache[collection] || [];
    const index = list.findIndex(item => item.id === id);
    if (index === -1) return null;
    this.localCache[collection][index] = { ...list[index], ...updates };
    this.saveLocal();
    return this.localCache[collection][index];
  }

  deleteLocal(collection, id) {
    const list = this.localCache[collection] || [];
    const index = list.findIndex(item => item.id === id);
    if (index === -1) return false;
    this.localCache[collection].splice(index, 1);
    this.saveLocal();
    return true;
  }

  async resetFarmerData() {
    // 1. Purge all farmer-related tables in Supabase Postgres
    const tablesToPurge = [
      'notifications',
      'notifications_log',
      'tracking',
      'weighments',
      'payments',
      'bookings',
      'points_ledger',
      'voice_sessions',
      'voice_chat_sessions',
      'farmers'
    ];

    for (const tbl of tablesToPurge) {
      try {
        await supabase.from(tbl).delete().neq('id', '___NEVER_MATCH___');
      } catch (err) {
        // Table might not exist in Supabase schema cache or is already empty
      }
    }

    // 2. Wipe in-memory local cache
    this.localCache.farmers = [];
    this.localCache.bookings = [];
    this.localCache.payments = [];
    this.localCache.tracking = [];
    this.localCache.weighments = [];
    this.localCache.points_ledger = [];
    this.localCache.pointsLedger = [];
    this.localCache.voice_sessions = [];
    this.localCache.voiceSessions = [];
    this.localCache.voiceChatSessions = [];
    this.localCache.voice_chat_sessions = [];
    this.localCache.notifications = [];
    this.localCache.notifications_log = [];
    this.localCache.notificationsLog = [];

    // Reset booked count on slots so fresh slots are available
    if (Array.isArray(this.localCache.slots)) {
      this.localCache.slots = this.localCache.slots.map(s => ({
        ...s,
        booked: 0,
        booked_count: 0,
        status: 'Available'
      }));
    }

    // Confirm fixed crop MSP rates
    this.localCache.crops = [
      { id: 'CROP-1', name: 'Paddy (Common) - వరి (సాధారణ)', msp_per_quintal: 2300, msp_price: 2300, season: 'Kharif 2026-27', unit: 'Quintal' },
      { id: 'CROP-2', name: 'Paddy (Grade A) - వరి (గ్రేడ్-ఎ)', msp_per_quintal: 2320, msp_price: 2320, season: 'Kharif 2026-27', unit: 'Quintal' },
      { id: 'CROP-3', name: 'Cotton (Medium Staple) - పత్తి', msp_per_quintal: 7121, msp_price: 7121, season: 'Kharif 2026-27', unit: 'Quintal' },
      { id: 'CROP-4', name: 'Wheat - గోధుమ', msp_per_quintal: 2275, msp_price: 2275, season: 'Rabi 2026-27', unit: 'Quintal' },
      { id: 'CROP-5', name: 'Maize - మొక్కజొన్న', msp_per_quintal: 2090, msp_price: 2090, season: 'Kharif 2026-27', unit: 'Quintal' },
      { id: 'CROP-6', name: 'Mustard - ఆవాలు', msp_per_quintal: 5650, msp_price: 5650, season: 'Rabi 2026-27', unit: 'Quintal' },
      { id: 'CROP-7', name: 'Groundnut - వేరుశనగ', msp_per_quintal: 6783, msp_price: 6783, season: 'Kharif 2026-27', unit: 'Quintal' },
      { id: 'CROP-8', name: 'Pulses (Red Gram / కందులు)', msp_per_quintal: 7000, msp_price: 7000, season: 'Kharif 2026-27', unit: 'Quintal' },
      { id: 'CROP-9', name: 'Chilli - మిరప', msp_per_quintal: 5000, msp_price: 5000, season: 'Kharif 2026-27', unit: 'Quintal' }
    ];

    this.saveLocal();
    return true;
  }
}

export const db = new SupabaseDB();
