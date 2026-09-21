import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from './supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'data.json');

const OFFICIAL_CROPS = [
  {
    id: 'CROP-01',
    name: 'Paddy (Common)',
    season: 'Kharif 2026',
    msp_per_quintal: 2183,
    unit: 'Quintal',
    created_at: new Date().toISOString()
  },
  {
    id: 'CROP-02',
    name: 'Wheat (Grade A)',
    season: 'Rabi 2026',
    msp_per_quintal: 2275,
    unit: 'Quintal',
    created_at: new Date().toISOString()
  },
  {
    id: 'CROP-03',
    name: 'Maize (Yellow)',
    season: 'Kharif 2026',
    msp_per_quintal: 2090,
    unit: 'Quintal',
    created_at: new Date().toISOString()
  },
  {
    id: 'CROP-04',
    name: 'Cotton (Medium Staple)',
    season: 'Kharif 2026',
    msp_per_quintal: 6620,
    unit: 'Quintal',
    created_at: new Date().toISOString()
  },
  {
    id: 'CROP-05',
    name: 'Pulses / Red Gram (Tur)',
    season: 'Kharif 2026',
    msp_per_quintal: 7000,
    unit: 'Quintal',
    created_at: new Date().toISOString()
  },
  {
    id: 'CROP-06',
    name: 'Chilli (Teja Guntur)',
    season: 'Rabi 2026',
    msp_per_quintal: 5000,
    unit: 'Quintal',
    created_at: new Date().toISOString()
  },
  {
    id: 'CROP-07',
    name: 'Groundnut (Pods)',
    season: 'Kharif 2026',
    msp_per_quintal: 6377,
    unit: 'Quintal',
    created_at: new Date().toISOString()
  },
  {
    id: 'CROP-08',
    name: 'Soybean (Yellow)',
    season: 'Kharif 2026',
    msp_per_quintal: 4600,
    unit: 'Quintal',
    created_at: new Date().toISOString()
  }
];

const OFFICIAL_LOCATIONS = [
  {
    id: 'LOC-AP-01',
    name: 'Kurnool Agricultural Market Committee Yard',
    address: 'Bellary Road, Near APSEB Substation, Kurnool',
    village: 'Kurnool',
    mandal: 'Kallur',
    district: 'Kurnool',
    pincode: '518003',
    lat: 15.8281,
    lng: 78.0373,
    status: 'active',
    daily_capacity_quintals: 3500,
    contact_phone: '08518-220145',
    photo_url: 'https://images.unsplash.com/photo-1595246140625-573b715d11dc?w=500&auto=format&fit=crop&q=60',
    created_at: '2026-09-08T07:13:21.978Z'
  },
  {
    id: 'LOC-AP-02',
    name: 'Adoni Commercial Cotton & Grain Mandi',
    address: 'Industrial Area, Siruguppa Road, Adoni',
    village: 'Adoni',
    mandal: 'Adoni',
    district: 'Kurnool',
    pincode: '518301',
    lat: 15.6322,
    lng: 77.2728,
    status: 'active',
    daily_capacity_quintals: 3000,
    contact_phone: '08512-252110',
    photo_url: 'https://images.unsplash.com/photo-1586771107445-d3ca888129ff?w=500&auto=format&fit=crop&q=60',
    created_at: '2026-09-08T07:13:21.978Z'
  },
  {
    id: 'LOC-AP-03',
    name: 'Nandyal APMC Rythu Mandi Hub',
    address: 'Sanjiv Nagar, Near Railway Goods Shed, Nandyal',
    village: 'Nandyal',
    mandal: 'Nandyal',
    district: 'Nandyal',
    pincode: '518501',
    lat: 15.4786,
    lng: 78.4836,
    status: 'active',
    daily_capacity_quintals: 2800,
    contact_phone: '08514-245332',
    photo_url: 'https://images.unsplash.com/photo-1595246140625-573b715d11dc?w=500&auto=format&fit=crop&q=60',
    created_at: '2026-09-08T07:13:21.978Z'
  },
  {
    id: 'LOC-AP-04',
    name: 'Guntur Mirchi & Grain Market Yard',
    address: 'Chuttugunta, GT Road, Guntur',
    village: 'Guntur',
    mandal: 'Guntur East',
    district: 'Guntur',
    pincode: '522004',
    lat: 16.3067,
    lng: 80.4365,
    status: 'active',
    daily_capacity_quintals: 5000,
    contact_phone: '0863-2223400',
    photo_url: 'https://images.unsplash.com/photo-1586771107445-d3ca888129ff?w=500&auto=format&fit=crop&q=60',
    created_at: '2026-09-08T07:13:21.978Z'
  },
  {
    id: 'LOC-AP-05',
    name: 'Tenali Paddy Procurement Center',
    address: 'Kothapet Rythu Bazaar, Tenali',
    village: 'Tenali',
    mandal: 'Tenali',
    district: 'Guntur',
    pincode: '522201',
    lat: 16.2435,
    lng: 80.6405,
    status: 'active',
    daily_capacity_quintals: 2200,
    contact_phone: '08644-226789',
    photo_url: 'https://images.unsplash.com/photo-1595246140625-573b715d11dc?w=500&auto=format&fit=crop&q=60',
    created_at: '2026-09-08T07:13:21.978Z'
  },
  {
    id: 'LOC-AP-06',
    name: 'Vijayawada Gollapudi APMC Mega Yard',
    address: 'NH-65 Bypass Road, Gollapudi, Vijayawada',
    village: 'Gollapudi',
    mandal: 'Vijayawada Rural',
    district: 'NTR',
    pincode: '521225',
    lat: 16.5417,
    lng: 80.5906,
    status: 'active',
    daily_capacity_quintals: 6000,
    contact_phone: '0866-2412890',
    photo_url: 'https://images.unsplash.com/photo-1586771107445-d3ca888129ff?w=500&auto=format&fit=crop&q=60',
    created_at: '2026-09-08T07:13:21.978Z'
  },
  {
    id: 'LOC-AP-07',
    name: 'Anantapur Groundnut & Millet Yard',
    address: 'Gooty Road, Near AP Seed Corp, Anantapur',
    village: 'Anantapur',
    mandal: 'Anantapur',
    district: 'Anantapur',
    pincode: '515001',
    lat: 14.6819,
    lng: 77.6006,
    status: 'active',
    daily_capacity_quintals: 2500,
    contact_phone: '08554-278120',
    photo_url: 'https://images.unsplash.com/photo-1595246140625-573b715d11dc?w=500&auto=format&fit=crop&q=60',
    created_at: '2026-09-08T07:13:21.978Z'
  },
  {
    id: 'LOC-AP-08',
    name: 'Nellore Rice & Grain Procurement Yard',
    address: 'Podalakur Road, Nellore',
    village: 'Nellore',
    mandal: 'Nellore Urban',
    district: 'SPSR Nellore',
    pincode: '524004',
    lat: 14.4426,
    lng: 79.9865,
    status: 'active',
    daily_capacity_quintals: 3000,
    contact_phone: '0861-2334510',
    photo_url: 'https://images.unsplash.com/photo-1586771107445-d3ca888129ff?w=500&auto=format&fit=crop&q=60',
    created_at: '2026-09-08T07:13:21.978Z'
  }
];

const OFFICIAL_CENTRES = OFFICIAL_LOCATIONS.map(loc => ({
  id: loc.id,
  name: loc.name,
  district: loc.district,
  mandal: loc.mandal,
  location_lat: loc.lat,
  location_lng: loc.lng,
  daily_capacity_quintals: loc.daily_capacity_quintals,
  contact_phone: loc.contact_phone,
  status: 'Active',
  created_at: loc.created_at
}));

const OFFICIAL_FARMERS = [
  {
    id: 'FARM-1001',
    name: 'Ramesh Babu Naidu',
    aadhaar: 'XXXX-XXXX-4921',
    phone: '9876543210',
    bank_account: '918276543210',
    ifsc: 'SBIN0001234',
    bank_name: 'State Bank of India',
    district: 'Kurnool',
    mandal: 'Kallur',
    village: 'Nandikotkur Road',
    land_hectares: 3.5,
    language_preference: 'te',
    status: 'Verified',
    created_at: new Date().toISOString(),
    points: 120,
    crop_type: 'Paddy'
  },
  {
    id: 'FARM-1002',
    name: 'Venkata Siva Reddy',
    aadhaar: 'XXXX-XXXX-8812',
    phone: '9440123456',
    bank_account: '918244012345',
    ifsc: 'APGB0002145',
    bank_name: 'Andhra Pragathi Grameena Bank',
    district: 'Nandyal',
    mandal: 'Nandyal',
    village: 'Rythu Nagar',
    land_hectares: 4.2,
    language_preference: 'te',
    status: 'Verified',
    created_at: new Date().toISOString(),
    points: 100,
    crop_type: 'Pulses'
  },
  {
    id: 'FARM-1003',
    name: 'Subba Rao Goud',
    aadhaar: 'XXXX-XXXX-3341',
    phone: '9121854243',
    bank_account: '918221854243',
    ifsc: 'UBIN0531234',
    bank_name: 'Union Bank of India',
    district: 'Kurnool',
    mandal: 'Adoni',
    village: 'Siruguppa Cross',
    land_hectares: 5.0,
    language_preference: 'te',
    status: 'Verified',
    created_at: new Date().toISOString(),
    points: 110,
    crop_type: 'Cotton'
  },
  {
    id: 'FARM-1004',
    name: 'Mallaiah Swamy',
    aadhaar: 'XXXX-XXXX-7654',
    phone: '8500558579',
    bank_account: '918200558579',
    ifsc: 'CNRB0001890',
    bank_name: 'Canara Bank',
    district: 'Guntur',
    mandal: 'Guntur East',
    village: 'Mirchi Yard Colony',
    land_hectares: 2.8,
    language_preference: 'te',
    status: 'Verified',
    created_at: new Date().toISOString(),
    points: 100,
    crop_type: 'Chilli'
  },
  {
    id: 'FARM-1005',
    name: 'Chandra Mohan',
    aadhaar: 'XXXX-XXXX-2511',
    phone: '8179072511',
    bank_account: '918279072511',
    ifsc: 'SBIN0001234',
    bank_name: 'State Bank of India',
    district: 'Kurnool',
    mandal: 'Kallur',
    village: 'Kurnool City',
    land_hectares: 3.0,
    language_preference: 'en',
    status: 'Verified',
    created_at: new Date().toISOString(),
    points: 100,
    crop_type: 'Paddy'
  }
];

// Generate comprehensive multi-time slots for 5 dates across all Mandi centers
const TIME_SLOTS = [
  '08:00 AM - 10:00 AM',
  '10:00 AM - 12:00 PM',
  '01:00 PM - 03:00 PM',
  '03:00 PM - 05:00 PM'
];

const getDates = () => {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 5; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
};

const OFFICIAL_SLOTS = [];
const datesList = getDates();

for (const loc of OFFICIAL_LOCATIONS) {
  for (const date of datesList) {
    for (const time of TIME_SLOTS) {
      const crop = loc.id === 'LOC-AP-02' ? 'Cotton' 
        : loc.id === 'LOC-AP-04' ? 'Chilli' 
        : loc.id === 'LOC-AP-07' ? 'Groundnut' 
        : 'Paddy';
      const msp = OFFICIAL_CROPS.find(c => c.name.startsWith(crop))?.msp_per_quintal || 2183;
      
      const slotId = `SLOT-${loc.id}-${date.replace(/-/g, '')}-${time.slice(0, 2)}${time.slice(9, 11)}`;
      OFFICIAL_SLOTS.push({
        id: slotId,
        centre_id: loc.id,
        location_id: loc.id,
        date,
        time,
        time_window: time,
        capacity: 50,
        max_capacity: 50,
        available: 50,
        booked: 0,
        booked_count: 0,
        crop_type: crop,
        msp_per_quintal: msp,
        status: 'active',
        created_at: new Date().toISOString()
      });
    }
  }
}

async function runSeed() {
  console.log('--- Cleaning Slate & Seeding Official Government Mandi Network ---');
  
  const cleanData = {
    farmers: OFFICIAL_FARMERS,
    crops: OFFICIAL_CROPS,
    centres: OFFICIAL_CENTRES,
    locations: OFFICIAL_LOCATIONS,
    slots: OFFICIAL_SLOTS,
    bookings: [],
    weighments: [],
    payments: [],
    tracking: [],
    pointsLedger: OFFICIAL_FARMERS.map(f => ({
      id: `PL-${f.id}`,
      farmer_id: f.id,
      booking_id: null,
      delta: f.points,
      reason: 'Aadhaar e-KYC Verification bonus',
      created_at: new Date().toISOString()
    })),
    logistics: [],
    notifications: [],
    notificationsLog: [],
    voiceSessions: [],
    adminUsers: [],
    centerRequests: []
  };

  // Write to local data.json
  fs.writeFileSync(DATA_FILE, JSON.stringify(cleanData, null, 2), 'utf8');
  console.log(`✓ Cleaned local data.json successfully! (${OFFICIAL_LOCATIONS.length} Mandis, ${OFFICIAL_SLOTS.length} Slots, ${OFFICIAL_FARMERS.length} Farmers)`);

  // Sync to Supabase if connected
  if (supabase) {
    try {
      console.log('Syncing to Supabase...');
      // Clear bookings, weighments, payments
      await supabase.from('weighments').delete().neq('id', 'NONE');
      await supabase.from('payments').delete().neq('id', 'NONE');
      await supabase.from('tracking').delete().neq('id', 'NONE');
      await supabase.from('bookings').delete().neq('id', 'NONE');
      await supabase.from('slots').delete().neq('id', 'NONE');
      await supabase.from('locations').delete().neq('id', 'NONE');
      await supabase.from('centres').delete().neq('id', 'NONE');
      await supabase.from('farmers').delete().neq('id', 'NONE');
      await supabase.from('crops').delete().neq('id', 'NONE');

      // Upsert crops
      await supabase.from('crops').upsert(OFFICIAL_CROPS);
      // Upsert locations & centres
      await supabase.from('locations').upsert(OFFICIAL_LOCATIONS);
      await supabase.from('centres').upsert(OFFICIAL_CENTRES);
      // Upsert farmers
      await supabase.from('farmers').upsert(OFFICIAL_FARMERS);
      // Upsert slots
      await supabase.from('slots').upsert(OFFICIAL_SLOTS);
      console.log('✓ Supabase tables successfully populated!');
    } catch (e) {
      console.warn('Supabase sync notice:', e.message);
    }
  }
}

runSeed();
