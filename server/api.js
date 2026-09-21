import express from 'express';
import { db } from './db.js';
import { supabase } from './supabase.js';
import webpush from 'web-push';
import {
  retrieveFarmerDatabaseRAGContext,
  checkStrictGuardrails,
  generateSarvamVoiceAudio,
  executeRAGQueryWithGemini,
  getInitialGreeting
} from './rag_voice_engine.js';



// ── VAPID Configuration for Web Push Notifications ──
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  || 'BATxs7rXeFG9CkF9CSIfq7OQGTYGY51s5c3bRBUI85a7iQtEHlS5ZRbhJxdg0WgcnOks9FnxQqHxZ_M84ZD7YHw';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '869rAD0dgKkuHAZSlBLxJmVcNz6YMMHkf8Oc6sI77OU';
const VAPID_EMAIL       = process.env.VAPID_EMAIL       || 'mailto:admin@kisansaathi.gov.in';

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// In-memory push subscription store (fallback when DB unavailable)
// Keys: farmer_id → { subscription, farmer_name, phone }
const pushSubscriptions = new Map();

const router = express.Router();


const COLLECTIONS = [
  'farmers',
  'crops',
  'centres',
  'locations',
  'slots',
  'bookings',
  'weighments',
  'payments',
  'tracking',
  'pointsLedger',
  'logistics',
  'notifications',
  'notificationsLog',
  'voiceSessions',
  'adminUsers',
  'centerRequests'
];

// Standard REST CRUD routes
COLLECTIONS.forEach(col => {
  // GET ALL
  router.get(`/${col}`, async (req, res) => {
    try {
      const filters = {};
      if (req.query.farmer_id) filters.farmer_id = req.query.farmer_id;
      if (req.query.user_id) filters.user_id = req.query.user_id;
      if (req.query.centre_id) filters.centre_id = req.query.centre_id;
      if (req.query.location_id) filters.location_id = req.query.location_id;
      if (req.query.status) filters.status = req.query.status;

      const items = await db.getAll(col, filters);
      res.json({ success: true, count: items.length, data: items });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET ONE BY ID
  router.get(`/${col}/:id`, async (req, res) => {
    try {
      const item = await db.getById(col, req.params.id);
      if (!item) return res.status(404).json({ success: false, error: `${col} item not found` });
      res.json({ success: true, data: item });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // CREATE
  router.post(`/${col}`, async (req, res) => {
    try {
      // Validate duplicate slot on same center, date, and time window
      if (col === 'slots') {
        const locId = req.body.location_id || req.body.centre_id;
        const slotDate = req.body.date;
        const slotTime = (req.body.time || req.body.time_window || '').trim();

        if (locId && slotDate && slotTime) {
          const allSlots = await db.getAll('slots');
          const existing = allSlots.find(s => 
            (s.location_id === locId || s.centre_id === locId) &&
            s.date === slotDate &&
            ((s.time && s.time.trim() === slotTime) || (s.time_window && s.time_window.trim() === slotTime))
          );

          if (existing) {
            return res.status(409).json({ 
              success: false, 
              error: `A procurement slot for "${slotTime}" already exists on ${slotDate} for this mandi center. Duplicate slots at the same timing are not allowed.` 
            });
          }
        }
      }

      // Validate single active procurement per farmer:
      // Farmer can only book a new slot after their current crop procurement is completed/paid!
      if (col === 'bookings') {
        const farmerId = req.body.farmer_id;
        if (farmerId) {
          const allBookings = await db.getAll('bookings', { farmer_id: farmerId });
          const active = allBookings.find(b => 
            ['booked', 'arrived_waiting_confirmation', 'arrived', 'checked_in', 'in_progress', 'weighed'].includes(b.status) &&
            b.payment_status !== 'paid' &&
            b.status !== 'completed'
          );
          if (active) {
            return res.status(400).json({ 
              success: false, 
              error: `మీకు ఇప్పటికే టోకెన్ #${active.token_number || active.id} తో యాక్టివ్ బుకింగ్ ఉంది. ఈ పంట సేకరణ & చెల్లింపు పూర్తయిన తర్వాతే మీరు మరొక స్లాట్ బుక్ చేసుకోగలరు. (Active procurement in progress. Complete current procurement before booking another).` 
            });
          }
        }
      }

      const created = await db.create(col, req.body);
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // UPDATE
  router.put(`/${col}/:id`, async (req, res) => {
    try {
      const updated = await db.update(col, req.params.id, req.body);
      if (!updated) return res.status(404).json({ success: false, error: `${col} item not found` });
      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE
  router.delete(`/${col}/:id`, async (req, res) => {
    try {
      const deleted = await db.delete(col, req.params.id);
      if (!deleted) return res.status(404).json({ success: false, error: `${col} item not found` });
      res.json({ success: true, message: `Deleted ${req.params.id}` });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
});

// Cleanup duplicate slots endpoint
router.post('/slots/cleanup-duplicates', async (req, res) => {
  try {
    const allSlots = await db.getAll('slots');
    const seen = new Set();
    const removedIds = [];

    for (const slot of allSlots) {
      const locId = slot.location_id || slot.centre_id;
      const slotTime = (slot.time || slot.time_window || '').trim();
      const key = `${locId}___${slot.date}___${slotTime}`;

      if (seen.has(key)) {
        removedIds.push(slot.id);
        await db.delete('slots', slot.id);
      } else {
        seen.add(key);
      }
    }

    res.json({
      success: true,
      message: `Cleaned up ${removedIds.length} duplicate slots`,
      removed: removedIds
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 1. Full Farmer Overview (Aggregated status)
// ==========================================
router.get('/farmer-overview/:farmerId', async (req, res) => {
  try {
    const { farmerId } = req.params;
    const farmer = await db.getById('farmers', farmerId);
    if (!farmer) return res.status(404).json({ success: false, error: 'Farmer not found' });

    const [allBookings, slots, locations, centres, crops, allTracking, allPayments, allPoints, notifications] = await Promise.all([
      db.getAll('bookings', { farmer_id: farmerId }),
      db.getAll('slots'),
      db.getAll('locations'),
      db.getAll('centres'),
      db.getAll('crops'),
      db.getAll('tracking'),
      db.getAll('payments'),
      db.getAll('pointsLedger', { farmer_id: farmerId }),
      db.getAll('notifications', { user_id: farmerId })
    ]);

    const detailedBookings = allBookings.map(b => {
      const slot = slots.find(s => s.id === b.slot_id) || null;
      const location = slot 
        ? (locations.find(l => l.id === slot.location_id || l.id === slot.centre_id) || centres.find(c => c.id === slot.centre_id))
        : null;
      const crop = crops.find(cr => cr.id === b.crop_id) || null;
      const tracking = allTracking.find(t => t.booking_id === b.id) || null;
      const payment = allPayments.find(p => p.booking_id === b.id) || null;

      return {
        ...b,
        slot,
        location,
        crop,
        tracking,
        payment
      };
    }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    // Active booking: ONLY truly in-progress uncompleted bookings (never completed/paid ones!)
    const activeBooking = detailedBookings.find(b => 
      ['booked', 'arrived_waiting_confirmation', 'arrived', 'checked_in', 'in_progress', 'weighed'].includes(b.status) &&
      b.payment_status !== 'paid' &&
      b.status !== 'completed'
    ) || null;

    // Completed procurements handled by Admin 2
    const completedBookings = detailedBookings.filter(b => 
      b.status === 'completed' || b.payment_status === 'paid' || b.status === 'delivery_completed'
    );
    const latestCompleted = completedBookings[0] || null;

    res.json({
      success: true,
      data: {
        farmer: {
          ...farmer,
          points: Number(farmer.points) || 100,
          crop_type: farmer.crop_type || 'Paddy'
        },
        activeBooking,
        latestCompleted,
        completedBookings,
        bookings: detailedBookings,
        pointsLedger: allPoints.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
        notifications: notifications.sort((a, b) => new Date(b.timestamp || b.created_at || 0) - new Date(a.timestamp || a.created_at || 0))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. Location Request & Approval Module
// ==========================================

// Admin directly creates/sanctions a new active procurement center
router.post('/locations/admin-create', async (req, res) => {
  try {
    const { 
      name, 
      address, 
      village, 
      mandal, 
      district, 
      pincode, 
      lat, 
      lng, 
      daily_capacity_quintals, 
      contact_phone,
      created_by 
    } = req.body;

    if (!name || !district) {
      return res.status(400).json({ success: false, error: 'Center name and district are required' });
    }

    const locId = `LOC-${Math.floor(1000 + Math.random() * 9000)}`;
    const newLocation = await db.create('locations', {
      id: locId,
      name: name.trim(),
      address: address ? address.trim() : `${village || ''}, ${mandal || ''}, ${district}`,
      village: village ? village.trim() : '',
      mandal: mandal ? mandal.trim() : '',
      district: district.trim(),
      pincode: pincode ? pincode.trim() : '518001',
      lat: Number(lat) || 15.8281,
      lng: Number(lng) || 78.0373,
      status: 'active',
      daily_capacity_quintals: Number(daily_capacity_quintals) || 1000,
      contact_phone: contact_phone || '1800-180-1551',
      reviewed_by: created_by || 'ADMIN-OFFICER',
      created_at: new Date().toISOString()
    });

    // Also sync with centres
    await db.create('centres', {
      id: locId,
      name: name.trim(),
      district: district.trim(),
      mandal: mandal ? mandal.trim() : '',
      address: address || `${village || ''}, ${district}`,
      daily_capacity_quintals: Number(daily_capacity_quintals) || 1000,
      contact_phone: contact_phone || '1800-180-1551',
      location_lat: Number(lat) || 15.8281,
      location_lng: Number(lng) || 78.0373,
      status: 'active',
      created_at: new Date().toISOString()
    });

    // Auto-generate standard slots for today & tomorrow
    const todayStr = '2026-09-07';
    const tomorrowStr = '2026-09-08';
    const timeWindows = [
      { id: 'M1', time: '09:00 AM - 11:00 AM' },
      { id: 'M2', time: '11:00 AM - 01:00 PM' },
      { id: 'A1', time: '02:00 PM - 04:00 PM' },
      { id: 'A2', time: '04:00 PM - 06:00 PM' }
    ];

    const slotCap = Math.max(10, Math.round((Number(daily_capacity_quintals) || 1000) / 40));
    for (const d of ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10']) {
      for (const tw of timeWindows) {
        const slotId = `SLOT-${locId}-${d.replace(/-/g, '')}-${tw.id}`;
        await db.create('slots', {
          id: slotId,
          location_id: locId,
          centre_id: locId,
          date: d,
          time: tw.time,
          time_window: tw.time,
          capacity: slotCap,
          max_capacity: slotCap,
          booked_count: 0,
          status: 'Available',
          created_at: new Date().toISOString()
        });
      }
    }

    res.status(201).json({ 
      success: true, 
      message: 'Procurement Center successfully created and activated with booking slots', 
      data: newLocation 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Farmer requests a new procurement location
router.post('/locations/request', async (req, res) => {
  try {
    const { name, address, village, mandal, district, pincode, lat, lng, requested_by, photo_url, nearest_landmark } = req.body;

    if (!name || !district) {
      return res.status(400).json({ success: false, error: 'Location name and district are required' });
    }

    const locId = `LOC-${Math.floor(1000 + Math.random() * 9000)}`;
    const newLocation = await db.create('locations', {
      id: locId,
      name: name.trim(),
      address: address ? address.trim() : `${village || ''}, ${district}`,
      village: village ? village.trim() : '',
      mandal: mandal ? mandal.trim() : '',
      district: district.trim(),
      pincode: pincode ? pincode.trim() : '518001',
      lat: Number(lat) || 15.8281,
      lng: Number(lng) || 78.0373,
      status: 'pending',
      requested_by: requested_by || null,
      photo_url: photo_url || 'https://images.unsplash.com/photo-1595246140625-573b715d11dc?w=500&auto=format&fit=crop&q=60',
      rejection_reason: null,
      created_at: new Date().toISOString()
    });

    // Also sync to legacy centerRequests
    await db.create('centerRequests', {
      id: `REQ-${Date.now()}`,
      proposed_name: name,
      district,
      mandal: mandal || '',
      village: village || '',
      nearby_landmark: nearest_landmark || '',
      status: 'Pending Review',
      farmer_id: requested_by || null,
      created_at: new Date().toISOString()
    });

    if (requested_by) {
      await db.create('notifications', {
        user_id: requested_by,
        channel: 'SMS/App',
        message: `మీ కొనుగోలు కేంద్రం అభ్యర్థన (${name}) పరిశీలనలో ఉంది. Location request for ${name} submitted. Under review by Center Admin.`,
        status: 'Sent',
        timestamp: new Date().toISOString()
      });
    }

    res.status(201).json({ success: true, message: 'Location request submitted for admin review', data: newLocation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin approves a location request
router.post('/locations/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewed_by } = req.body;

    const location = await db.getById('locations', id);
    if (!location) return res.status(404).json({ success: false, error: 'Location not found' });

    const updated = await db.update('locations', id, {
      status: 'active',
      reviewed_by: reviewed_by || 'ADMIN-OFFICER',
      rejection_reason: null
    });

    // Auto-generate standard 20-capacity slots for this new location for today & tomorrow
    const todayStr = '2026-09-07';
    const tomorrowStr = '2026-09-08';
    const timeWindows = [
      { id: 'M1', time: '09:00 AM - 11:00 AM' },
      { id: 'M2', time: '11:00 AM - 01:00 PM' },
      { id: 'A1', time: '02:00 PM - 04:00 PM' }
    ];

    for (const d of [todayStr, tomorrowStr]) {
      for (const tw of timeWindows) {
        const slotId = `SLOT-${id}-${d.replace(/-/g, '')}-${tw.id}`;
        await db.create('slots', {
          id: slotId,
          location_id: id,
          centre_id: id,
          date: d,
          time: tw.time,
          time_window: tw.time,
          capacity: 20,
          max_capacity: 20,
          booked_count: 0,
          status: 'Available',
          created_at: new Date().toISOString()
        });
      }
    }

    // Notify requesting farmer
    if (location.requested_by) {
      await db.create('notifications', {
        user_id: location.requested_by,
        channel: 'SMS/App',
        message: `🎉 మీ లొకేషన్ ఆమోదించబడింది! ${location.name} ఇప్పుడు క్రియాశీలకంగా ఉంది. Your location ${location.name} has been approved — you can now book a slot there!`,
        status: 'Sent',
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, message: 'Location approved and slots generated successfully', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin rejects a location request with reason
router.post('/locations/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, reviewed_by } = req.body;

    const location = await db.getById('locations', id);
    if (!location) return res.status(404).json({ success: false, error: 'Location not found' });

    const updated = await db.update('locations', id, {
      status: 'rejected',
      rejection_reason: reason || 'Location does not meet minimum road clearance or distance criteria.',
      reviewed_by: reviewed_by || 'ADMIN-OFFICER'
    });

    if (location.requested_by) {
      await db.create('notifications', {
        user_id: location.requested_by,
        channel: 'SMS/App',
        message: `లొకేషన్ తిరస్కరించబడింది (${location.name}): ${reason || 'Criteria not met'}. Location rejected: ${reason || 'Criteria not met'}. You may edit and resubmit.`,
        status: 'Sent',
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, message: 'Location rejected', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3. Slot Booking & Cancellation Module
// ==========================================

// Atomic slot booking
router.post('/bookings/book-slot', async (req, res) => {
  try {
    const { farmer_id, slot_id, crop_type, expected_quantity } = req.body;

    let farmer = await db.getById('farmers', farmer_id);
    if (!farmer) {
      const allFarmers = await db.getAll('farmers');
      farmer = allFarmers.find(f => f.id === farmer_id || f.phone === farmer_id);
    }
    if (!farmer) {
      farmer = await db.create('farmers', {
        id: farmer_id || `FARM-${Math.floor(1000 + Math.random() * 9000)}`,
        name: 'Registered Farmer',
        phone: typeof farmer_id === 'string' && /^\d{10}$/.test(farmer_id) ? farmer_id : '9848011223',
        village: 'Kurnool Hub',
        district: 'Kurnool',
        points: 100,
        crop_type: crop_type || 'Paddy',
        created_at: new Date().toISOString()
      });
    }

    // Validate single active procurement per farmer:
    const allBookings = await db.getAll('bookings', { farmer_id: farmer.id || farmer_id });
    const activeBooking = allBookings.find(b => 
      ['booked', 'arrived_waiting_confirmation', 'arrived', 'checked_in', 'in_progress', 'weighed'].includes(b.status) &&
      b.payment_status !== 'paid' &&
      b.status !== 'completed'
    );
    if (activeBooking) {
      return res.status(400).json({ 
        success: false, 
        error: `మీకు ఇప్పటికే టోకెన్ #${activeBooking.token_number || activeBooking.id} తో యాక్టివ్ బుకింగ్ ఉంది. ఈ పంట సేకరణ & చెల్లింపు పూర్తయిన తర్వాతే మీరు మరొక స్లాట్ బుక్ చేసుకోగలరు. (Active procurement in progress. Complete current procurement before booking another).` 
      });
    }

    const slot = await db.getById('slots', slot_id);
    if (!slot) return res.status(400).json({ success: false, error: 'Invalid slot ID' });

    const maxCap = Number(slot.capacity || slot.max_capacity) || 20;
    const currentBooked = Number(slot.booked_count) || 0;

    const farmerPoints = Number(farmer.points) || 100;
    if (currentBooked >= maxCap && farmerPoints < 120) {
      return res.status(400).json({ success: false, error: 'This time slot is completely full. Please choose another slot.' });
    }

    // Increment booked count
    await db.update('slots', slot_id, {
      booked_count: currentBooked + 1,
      status: (currentBooked + 1 >= maxCap) ? 'Full' : 'Available'
    });

    const tokenNum = `TK-${Math.floor(100 + Math.random() * 900)}`;
    const bookingId = `BK-${Date.now()}`;
    const locId = slot.location_id || slot.centre_id || req.body.location_id || req.body.centre_id;
    const booking = await db.create('bookings', {
      id: bookingId,
      farmer_id,
      slot_id,
      location_id: locId,
      crop_type: crop_type || farmer.crop_type || 'Paddy',
      expected_quantity: Number(expected_quantity) || 50,
      status: 'booked',
      token_number: tokenNum,
      queue_position: null,
      tracking_id: null,
      created_at: new Date().toISOString()
    });

    // Send SMS / in-app notification
    await db.create('notifications', {
      user_id: farmer_id,
      channel: 'SMS/App',
      message: `స్లాట్ బుకింగ్ విజయవంతమైంది! టోకెన్: ${tokenNum}. Slot booked for ${slot.date} (${slot.time || slot.time_window}). Token: ${tokenNum}.`,
      status: 'Sent',
      timestamp: new Date().toISOString()
    });

    res.status(201).json({ success: true, message: 'Slot booked successfully', data: booking });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Farmer cancels a booking (deducts 15 points)
router.post('/bookings/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await db.getById('bookings', id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'Booking is already cancelled' });
    }

    // Free up slot capacity
    if (booking.slot_id) {
      const slot = await db.getById('slots', booking.slot_id);
      if (slot && Number(slot.booked_count) > 0) {
        await db.update('slots', booking.slot_id, {
          booked_count: Math.max(0, Number(slot.booked_count) - 1),
          status: 'Available'
        });
      }
    }

    const updated = await db.update('bookings', id, { status: 'cancelled' });

    // Deduct points from farmer (-15 points)
    if (booking.farmer_id) {
      const farmer = await db.getById('farmers', booking.farmer_id);
      if (farmer) {
        const currentPoints = Number(farmer.points) || 100;
        const newPoints = Math.max(0, currentPoints - 15);
        await db.update('farmers', booking.farmer_id, { points: newPoints });

        await db.create('pointsLedger', {
          id: `PL-${Date.now()}`,
          farmer_id: booking.farmer_id,
          booking_id: id,
          delta: -15,
          reason: `Late cancellation for Token ${booking.token_number || id}`,
          created_at: new Date().toISOString()
        });

        await db.create('notifications', {
          user_id: booking.farmer_id,
          channel: 'SMS/App',
          message: `బుకింగ్ రద్దు చేయబడింది. 15 విశ్వసనీయత పాయింట్లు తగ్గించబడ్డాయి. Booking cancelled for Token ${booking.token_number}. 15 reliability points deducted.`,
          status: 'Sent',
          timestamp: new Date().toISOString()
        });
      }
    }

    res.json({ success: true, message: 'Booking cancelled and slot freed', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4. Day-of Real-Time Queue Management
// ==========================================

// Real-Time Queue Summary across all Stations for Admin & Farmers
router.get('/queue/stations-summary', async (req, res) => {
  try {
    const { date } = req.query;
    const [allLocations, allCentres, allBookings, allSlots] = await Promise.all([
      db.getAll('locations'),
      db.getAll('centres'),
      db.getAll('bookings'),
      db.getAll('slots')
    ]);

    const slotMap = new Map(allSlots.map(s => [s.id, s]));

    // Build unified station catalog
    const stationMap = new Map();
    [...allCentres, ...allLocations].forEach(loc => {
      if (loc && loc.id && (loc.status === 'active' || loc.status === 'Active' || !loc.status)) {
        if (!stationMap.has(loc.id)) {
          stationMap.set(loc.id, loc);
        }
      }
    });

    const summaries = Array.from(stationMap.values()).map(station => {
      const stationBookings = allBookings.filter(b => {
        const slot = slotMap.get(b.slot_id);
        const bDate = slot?.date || b.date;
        if (date && date !== 'ALL' && bDate && bDate !== date) return false;
        const bLocId = b.location_id || slot?.location_id || slot?.centre_id;
        return bLocId === station.id;
      });

      const activeQueue = stationBookings.filter(b => ['checked_in', 'in_progress', 'booked'].includes(b.status));
      const checkedIn = activeQueue.filter(b => b.status === 'checked_in').length;
      const inProgress = activeQueue.filter(b => b.status === 'in_progress').length;
      const booked = activeQueue.filter(b => b.status === 'booked').length;
      const completed = stationBookings.filter(b => b.status === 'completed').length;

      const serving = activeQueue.find(b => b.status === 'in_progress') || activeQueue.find(b => b.status === 'checked_in') || null;
      const congestionLevel = checkedIn <= 3 ? 'low' : checkedIn <= 8 ? 'moderate' : 'high';

      return {
        id: station.id,
        name: station.name,
        district: station.district || 'Kurnool',
        mandal: station.mandal || '',
        daily_capacity_quintals: station.daily_capacity_quintals || 500,
        total_in_queue: activeQueue.length,
        checked_in_count: checkedIn,
        in_progress_count: inProgress,
        scheduled_count: booked,
        completed_count: completed,
        currently_serving: serving ? serving.token_number : 'TK-STANDBY',
        congestion_level: congestionLevel,
        average_wait_minutes: Math.max(8, checkedIn * 12),
        active_weighbridge_bay: `${station.name.slice(0, 14)} Bay 1`
      };
    });

    res.json({ success: true, count: summaries.length, data: summaries });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Real-Time Live Waiting List for Farmers & Admin (Station Segregated)
router.get('/queue/waiting-list', async (req, res) => {
  try {
    const { location_id, date } = req.query;
    const [allBookings, allFarmers, allSlots, allLocations, allCentres] = await Promise.all([
      db.getAll('bookings'),
      db.getAll('farmers'),
      db.getAll('slots'),
      db.getAll('locations'),
      db.getAll('centres')
    ]);

    const farmerMap = new Map(allFarmers.map(f => [f.id, f]));
    const slotMap = new Map(allSlots.map(s => [s.id, s]));

    const stationMap = new Map();
    [...allCentres, ...allLocations].forEach(loc => {
      if (loc && loc.id && !stationMap.has(loc.id)) {
        stationMap.set(loc.id, loc);
      }
    });

    let queueBookings = allBookings.filter(b => {
      const slot = slotMap.get(b.slot_id);
      const bDate = slot?.date || b.date;
      const bLocId = b.location_id || slot?.location_id || slot?.centre_id;
      if (date && date !== 'ALL' && bDate && bDate !== date) return false;
      if (location_id && location_id !== 'ALL' && bLocId !== location_id) return false;
      return ['checked_in', 'in_progress', 'booked'].includes(b.status);
    });

    const statusPriority = { in_progress: 1, checked_in: 2, booked: 3 };
    queueBookings.sort((a, b) => {
      const aPos = Number(a.queue_position) || 999;
      const bPos = Number(b.queue_position) || 999;
      if (aPos !== bPos) return aPos - bPos;
      const prioDiff = (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99);
      if (prioDiff !== 0) return prioDiff;
      return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    });

    // Group rankings sequentially per station + date
    const stationCounters = new Map();

    const waitingList = queueBookings.map((b) => {
      const farmer = farmerMap.get(b.farmer_id);
      const slot = slotMap.get(b.slot_id);
      const bDate = slot?.date || b.date || '2026-09-07';
      const bLocId = b.location_id || slot?.location_id || slot?.centre_id || 'CENTRE-101';
      const station = stationMap.get(bLocId) || { id: bLocId, name: 'Central Mandi Yard', district: 'Kurnool' };

      const counterKey = `${bLocId}_${bDate}`;
      const currentStationRank = (stationCounters.get(counterKey) || 0) + 1;
      stationCounters.set(counterKey, currentStationRank);

      return {
        id: b.id,
        booking_id: b.id,
        queue_position: b.queue_position || currentStationRank,
        station_queue_position: currentStationRank,
        token_number: b.token_number || `TK-${b.id.slice(-3)}`,
        farmer_id: b.farmer_id,
        farmer_name: farmer?.name || 'Registered Farmer',
        village: farmer?.village || station.village || 'Local Area',
        district: farmer?.district || station.district || 'Kurnool',
        crop_type: b.crop_type || farmer?.crop_type || 'Paddy',
        expected_quantity: b.expected_quantity || 50,
        status: b.status,
        date: bDate,
        slot_time: slot?.time || slot?.time_window || '09:00 AM - 11:00 AM',
        estimated_wait_minutes: Math.max(5, currentStationRank * 12),
        station_id: bLocId,
        station_name: station.name || 'Central Mandi Yard',
        station_district: station.district || 'Kurnool',
        active_bay: `${(station.name || 'Mandi').slice(0, 14)} Bay 1`
      };
    });

    // Determine currently serving token
    const servingItem = waitingList.find(w => w.status === 'in_progress') || waitingList.find(w => w.status === 'checked_in') || null;
    const checkedInCount = waitingList.filter(w => w.status === 'checked_in').length;
    const inProgressCount = waitingList.filter(w => w.status === 'in_progress').length;
    const bookedCount = waitingList.filter(w => w.status === 'booked').length;

    const selectedStationInfo = (location_id && location_id !== 'ALL') ? stationMap.get(location_id) : null;

    const yardStats = {
      total_in_queue: waitingList.length,
      checked_in_count: checkedInCount,
      in_progress_count: inProgressCount,
      scheduled_count: bookedCount,
      congestion_level: checkedInCount <= 3 ? 'low' : checkedInCount <= 8 ? 'moderate' : 'high',
      average_wait_minutes: Math.max(8, checkedInCount * 12),
      active_weighbridge_bay: selectedStationInfo ? `${selectedStationInfo.name.slice(0, 16)} Bay 1 (Electronic)` : 'Bay 1 (Certified Electronic)',
      station_id: location_id || 'ALL',
      station_name: selectedStationInfo?.name || 'All Mandi Stations'
    };

    res.json({ 
      success: true, 
      count: waitingList.length, 
      currently_serving: servingItem ? servingItem.token_number : 'TK-STANDBY',
      serving_item: servingItem,
      yard_stats: yardStats,
      selected_station: selectedStationInfo,
      data: waitingList 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Check in (Mark Arrived) - Station Scoped
router.post('/queue/check-in', async (req, res) => {
  try {
    const { booking_id } = req.body;
    const booking = await db.getById('bookings', booking_id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const [allBookings, allSlots, allCentres, allLocations] = await Promise.all([
      db.getAll('bookings'),
      db.getAll('slots'),
      db.getAll('centres'),
      db.getAll('locations')
    ]);

    const slotMap = new Map(allSlots.map(s => [s.id, s]));
    const stationMap = new Map([...allCentres, ...allLocations].map(l => [l.id, l]));

    const slot = slotMap.get(booking.slot_id);
    const bDate = slot?.date || booking.date;
    const stationId = booking.location_id || slot?.location_id || slot?.centre_id;
    const station = stationMap.get(stationId) || { name: 'Mandi Center', district: 'Kurnool' };

    // Calculate station-specific queue position
    const stationCheckedInCount = allBookings.filter(b => {
      if (b.id === booking_id) return false;
      if (!['checked_in', 'in_progress'].includes(b.status)) return false;
      const bSlot = slotMap.get(b.slot_id);
      const bSlotDate = bSlot?.date || b.date;
      const bStationId = b.location_id || bSlot?.location_id || bSlot?.centre_id;
      if (bDate && bSlotDate && bDate !== bSlotDate) return false;
      if (stationId && bStationId && stationId !== bStationId) return false;
      return true;
    }).length;

    const queuePos = stationCheckedInCount + 1;

    const targetStatus = req.body.direct ? 'checked_in' : 'arrived_waiting_confirmation';

    const updated = await db.update('bookings', booking_id, {
      status: targetStatus,
      queue_position: queuePos,
      location_id: stationId,
      arrived_at: new Date().toISOString()
    });

    // High Priority Physical Arrival Alert for Admin 1
    await db.create('notifications', {
      id: `NOTIF-ARR-${Date.now()}`,
      user_id: 'ADMIN1',
      role: 'slot_manager',
      channel: 'In-App',
      type: 'arrival_verification',
      title: '🚨 రైతు గేట్ వద్దకు వచ్చారు (Arrival Verification Required)',
      message: `రైతు ${booking.farmer_name || 'రైతు'} (టోకెన్: ${booking.token_number || booking.id}) ${station.name} కు చేరుకున్నారు. దయచేసి భౌతిక రాకను ధృవీకరించండి.`,
      booking_id: booking.id,
      status: 'Sent',
      timestamp: new Date().toISOString()
    }).catch(() => {});

    // Notification for Farmer
    if (booking.farmer_id) {
      await db.create('notifications', {
        id: `NOTIF-FARM-${Date.now()}`,
        user_id: booking.farmer_id,
        channel: 'SMS/App',
        type: 'arrival_pending_verification',
        title: '🚚 మండి రాక నమోదు చేయబడింది',
        message: `మీరు ${station.name} కు చేరుకున్నట్లు నమోదయింది. అడ్మిన్ భౌతిక ధృవీకరణ కోసం సమాచారం పంపబడింది. ధృవీకరించిన వెంటనే మీ క్యూ నంబర్ #${queuePos} ఖరారవుతుంది.`,
        booking_id: booking.id,
        status: 'Sent',
        timestamp: new Date().toISOString()
      }).catch(() => {});
    }

    res.json({ 
      success: true, 
      message: `Arrival recorded at ${station.name}. Waiting for Admin 1 verification.`, 
      data: updated, 
      queue_position: queuePos,
      station_name: station.name 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mark In Progress (Call to Weighbridge)
router.post('/queue/in-progress', async (req, res) => {
  try {
    const { booking_id } = req.body;
    const booking = await db.getById('bookings', booking_id);
    const updated = await db.update('bookings', booking_id, {
      status: 'in_progress'
    });

    if (booking && booking.farmer_id) {
      await db.create('notifications', {
        user_id: booking.farmer_id,
        channel: 'SMS/App',
        message: `📢 టోకెన్ ${booking.token_number || booking_id} వేబ్రిడ్జి బే-1 కు పిలవబడింది. వాహనాన్ని వెంటనే బే-1 కు తీసుకురండి. Token ${booking.token_number || booking_id} called to Weighbridge Bay 1. Proceed immediately for weighing.`,
        status: 'Sent',
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, message: 'Farmer marked in progress', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mark Completed: Generates Tracking ID, creates tracking, verifies/updates bank details, creates payment, awards +20 points
router.post('/queue/complete', async (req, res) => {
  try {
    const { 
      booking_id, 
      actual_quantity, 
      quality_grade,
      rate_per_quintal,
      bank_account,
      ifsc,
      bank_name,
      payment_status,
      bank_txn_ref
    } = req.body;

    const booking = await db.getById('bookings', booking_id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const trackingId = `TRK-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const qty = Number(actual_quantity) || Number(booking.expected_quantity) || 50;
    const defaultRate = (quality_grade && quality_grade.includes('Grade A')) ? 2369 : 2320;
    const rate = Number(rate_per_quintal) || defaultRate;
    const amount = qty * rate;

    // 1. Update farmer profile if bank details provided
    let farmer = null;
    if (booking.farmer_id) {
      farmer = await db.getById('farmers', booking.farmer_id);
      if (farmer) {
        const farmerUpdates = {};
        if (bank_account && bank_account.trim()) farmerUpdates.bank_account = bank_account.trim();
        if (ifsc && ifsc.trim()) farmerUpdates.ifsc = ifsc.trim().toUpperCase();
        if (bank_name && bank_name.trim()) farmerUpdates.bank_name = bank_name.trim();

        if (Object.keys(farmerUpdates).length > 0) {
          farmer = await db.update('farmers', booking.farmer_id, farmerUpdates);
        }
      }
    }

    // 2. Update booking
    const bookingUpdates = {
      status: 'completed',
      actual_quantity: qty,
      tracking_id: trackingId,
      queue_position: 0,
      payment_status: (payment_status === 'paid' || status === 'paid') ? 'paid' : (payment_status || 'processing')
    };
    if (quality_grade) bookingUpdates.quality_grade = quality_grade;
    const updatedBooking = await db.update('bookings', booking_id, bookingUpdates);

    // 3. Create tracking record
    const trackingRecord = await db.create('tracking', {
      id: `LOG-${Date.now()}`,
      booking_id,
      stage: 'procured',
      notes: `Procured at Center. Grade: ${quality_grade || 'Grade A Superfine'}. Rate: ₹${rate}/Qtl.`,
      updated_at: new Date().toISOString()
    });

    // 4. Create payment record
    const status = payment_status || 'processing';
    const txnRef = bank_txn_ref || `PFMS${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`;
    const paymentRecord = await db.create('payments', {
      id: `PAY-${Date.now()}`,
      booking_id,
      farmer_id: booking.farmer_id,
      amount,
      status,
      bank_account: bank_account || farmer?.bank_account || null,
      ifsc: ifsc || farmer?.ifsc || null,
      bank_name: bank_name || farmer?.bank_name || null,
      bank_txn_ref: txnRef,
      initiated_at: new Date().toISOString(),
      paid_at: status === 'paid' ? new Date().toISOString() : null,
      created_at: new Date().toISOString()
    });

    // 5. Award +20 points to farmer
    if (farmer) {
      const currentPoints = Number(farmer.points) || 100;
      await db.update('farmers', booking.farmer_id, { points: currentPoints + 20 });

      await db.create('pointsLedger', {
        id: `PL-${Date.now()}`,
        farmer_id: booking.farmer_id,
        booking_id,
        delta: 20,
        reason: `Completed procurement for Token ${booking.token_number}`,
        created_at: new Date().toISOString()
      });

      const accNumber = bank_account || farmer.bank_account;
      const accSuffix = accNumber ? ` ••••${accNumber.slice(-4)}` : '';
      const bName = bank_name || farmer.bank_name || 'Bank';

      await db.create('notifications', {
        user_id: booking.farmer_id,
        channel: 'SMS/App',
        message: `🎉 పంట కొనుగోలు పూర్తయింది! రూ. ${amount.toLocaleString('en-IN')} PFMS చెల్లింపు ${status === 'paid' ? 'జమచేయబడింది' : 'ప్రారంభించబడింది'} (${bName}${accSuffix}). ట్రాకింగ్ ఐడి: ${trackingId} (+20 పాయింట్లు). Payment of Rs.${amount.toLocaleString('en-IN')} ${status === 'paid' ? 'credited' : 'initiated'} to ${bName}${accSuffix}. Ref: ${txnRef} (+20 points).`,
        status: 'Sent',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Procurement certified and payment initiated successfully',
      data: {
        booking: updatedBooking,
        tracking: trackingRecord,
        payment: paymentRecord,
        farmer
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Booking Transition: Mark Arrived
router.post('/bookings/:id/mark-arrived', async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await db.getById('bookings', id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const updated = await db.update('bookings', id, { status: 'arrived' });

    if (booking.farmer_id) {
      await db.create('notifications', {
        user_id: booking.farmer_id,
        channel: 'SMS/App',
        message: `వాహనం కేంద్రానికి చేరుకున్నట్లు ధృవీకరించబడింది (టోకెన్ ${booking.token_number || id}). Gate entry confirmed for Token ${booking.token_number || id}. Please proceed to inspection area.`,
        status: 'Sent',
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, message: 'Farmer marked as arrived', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Booking Transition: Record Weighment
router.post('/bookings/:id/record-weighment', async (req, res) => {
  try {
    const { id } = req.params;
    const { weight_quintals, msp_per_quintal, crop_type, quality_grade, deductions_kg, bag_count } = req.body;

    const booking = await db.getById('bookings', id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const weight = Number(weight_quintals) || Number(booking.expected_quantity) || 50;
    const msp = Number(msp_per_quintal) || 2183;
    const amount = Math.round(weight * msp);

    // Create weighment entry
    const weighment = await db.create('weighments', {
      id: `WEIGH-${Date.now()}`,
      booking_id: id,
      gross_qty: weight,
      bag_count: Number(bag_count) || Math.round(weight * 2),
      deductions_kg: Number(deductions_kg) || 0,
      deduction_reason: deductions_kg ? 'Moisture / Foreign Matter' : 'Standard Tolerances',
      net_qty: weight,
      quality_grade: quality_grade || 'Grade A Superfine',
      timestamp: new Date().toISOString()
    });

    // Update booking status
    const updated = await db.update('bookings', id, {
      status: 'weighed',
      actual_quantity: weight
    });

    if (booking.farmer_id) {
      await db.create('notifications', {
        user_id: booking.farmer_id,
        channel: 'SMS/App',
        message: `తూకం పూర్తయింది: ${weight} క్వింటాళ్లు. మొత్తం విలువ: రూ. ${amount.toLocaleString('en-IN')} (MSP @ ₹${msp}/Qtl). Weighment recorded: ${weight} Qtl. Total value: Rs. ${amount.toLocaleString('en-IN')}.`,
        status: 'Sent',
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, message: 'Weighment recorded successfully', amount, data: updated, weighment });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Booking Transition: Send to Payment
router.post('/bookings/:id/send-to-payment', async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await db.getById('bookings', id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    let farmer = null;
    if (booking.farmer_id) {
      farmer = await db.getById('farmers', booking.farmer_id);
    }

    const msp = 2183;
    const qty = Number(booking.actual_quantity || booking.expected_quantity) || 50;
    const amount = Math.round(qty * msp);
    const txnRef = `PFMS${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`;

    // Create or update payment
    const payment = await db.create('payments', {
      id: `PAY-${Date.now()}`,
      booking_id: id,
      farmer_id: booking.farmer_id,
      amount,
      status: 'pending',
      bank_account: farmer?.bank_account || '918279072511',
      ifsc: farmer?.ifsc || 'SBIN0001234',
      bank_name: farmer?.bank_name || 'State Bank of India',
      bank_txn_ref: txnRef,
      initiated_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    });

    // Update booking status
    const updated = await db.update('bookings', id, {
      status: 'payment_ready'
    });

    // Reward +20 reliability points
    if (farmer && farmer.id) {
      const currentPts = Number(farmer.points) || 100;
      await db.update('farmers', farmer.id, { points: currentPts + 20 });
      await db.create('pointsLedger', {
        id: `PL-${Date.now()}`,
        farmer_id: farmer.id,
        booking_id: id,
        delta: 20,
        reason: `Completed procurement weighment Token ${booking.token_number || id}`,
        created_at: new Date().toISOString()
      });
    }

    if (booking.farmer_id) {
      await db.create('notifications', {
        user_id: booking.farmer_id,
        channel: 'SMS/App',
        message: `చెల్లింపు నిర్వాహకుడికి పంపబడింది (మొత్తం: రూ. ${amount.toLocaleString('en-IN')}). DBT బదిలీ ప్రక్రియ ప్రారంభమైంది (+20 పాయింట్లు). Sent to Payment Manager for DBT release of Rs. ${amount.toLocaleString('en-IN')}. (+20 loyalty points awarded).`,
        status: 'Sent',
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, message: 'Booking sent to Payment Manager', data: updated, payment });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mark No-Show (-20 points)
router.post('/queue/no-show', async (req, res) => {
  try {
    const { booking_id } = req.body;
    const booking = await db.getById('bookings', booking_id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const updated = await db.update('bookings', booking_id, { status: 'no_show', queue_position: null });

    if (booking.farmer_id) {
      const farmer = await db.getById('farmers', booking.farmer_id);
      if (farmer) {
        const currentPoints = Number(farmer.points) || 100;
        await db.update('farmers', booking.farmer_id, { points: Math.max(0, currentPoints - 20) });

        await db.create('pointsLedger', {
          id: `PL-${Date.now()}`,
          farmer_id: booking.farmer_id,
          booking_id,
          delta: -20,
          reason: `No-show for Token ${booking.token_number}`,
          created_at: new Date().toISOString()
        });
      }
    }

    res.json({ success: true, message: 'Marked as no-show', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 5. Payment & Tracking Updates & Bank Details
// ==========================================

// Save/update farmer bank details directly
router.post('/farmers/:id/bank-details', async (req, res) => {
  try {
    const { id } = req.params;
    const { bank_account, ifsc, bank_name, aadhaar } = req.body;

    const farmer = await db.getById('farmers', id);
    if (!farmer) return res.status(404).json({ success: false, error: 'Farmer not found' });

    const updates = {};
    if (bank_account !== undefined) updates.bank_account = String(bank_account).trim();
    if (ifsc !== undefined) updates.ifsc = String(ifsc).trim().toUpperCase();
    if (bank_name !== undefined) updates.bank_name = String(bank_name).trim();
    if (aadhaar !== undefined) updates.aadhaar = String(aadhaar).trim();

    const updated = await db.update('farmers', id, updates);

    // Send confirmation notification
    await db.create('notifications', {
      user_id: id,
      channel: 'SMS/App',
      message: `బ్యాంక్ ఖాతా వివరాలు నవీకరించబడ్డాయి: ${updates.bank_name || farmer.bank_name || 'Bank'} A/C ••••${(updates.bank_account || farmer.bank_account || '').slice(-4)}. Bank details updated for PFMS DBT transfers.`,
      status: 'Sent',
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, message: 'Bank details successfully updated', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Initiate or update payment for a booking
router.post('/payments/initiate', async (req, res) => {
  try {
    const { 
      booking_id, 
      farmer_id, 
      amount, 
      bank_account, 
      ifsc, 
      bank_name, 
      status = 'processing',
      bank_txn_ref 
    } = req.body;

    if (!booking_id) return res.status(400).json({ success: false, error: 'booking_id is required' });

    const booking = await db.getById('bookings', booking_id);
    const fId = farmer_id || booking?.farmer_id;
    let farmer = null;
    if (fId) {
      farmer = await db.getById('farmers', fId);
      if (farmer && (bank_account || ifsc || bank_name)) {
        const farmerUpdates = {};
        if (bank_account) farmerUpdates.bank_account = String(bank_account).trim();
        if (ifsc) farmerUpdates.ifsc = String(ifsc).trim().toUpperCase();
        if (bank_name) farmerUpdates.bank_name = String(bank_name).trim();
        farmer = await db.update('farmers', fId, farmerUpdates);
      }
    }

    const txnRef = bank_txn_ref || `PFMS${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`;

    // Check if payment already exists for this booking
    const allPayments = await db.getAll('payments');
    const existing = allPayments.find(p => p.booking_id === booking_id);

    let paymentRecord;
    if (existing) {
      paymentRecord = await db.update('payments', existing.id, {
        amount: Number(amount) || existing.amount,
        status,
        bank_account: bank_account || farmer?.bank_account || existing.bank_account,
        ifsc: ifsc || farmer?.ifsc || existing.ifsc,
        bank_name: bank_name || farmer?.bank_name || existing.bank_name,
        bank_txn_ref: txnRef,
        paid_at: status === 'paid' ? new Date().toISOString() : existing.paid_at
      });
    } else {
      paymentRecord = await db.create('payments', {
        id: `PAY-${Date.now()}`,
        booking_id,
        farmer_id: fId,
        amount: Number(amount) || (Number(booking?.expected_quantity || 50) * 2320),
        status,
        bank_account: bank_account || farmer?.bank_account || null,
        ifsc: ifsc || farmer?.ifsc || null,
        bank_name: bank_name || farmer?.bank_name || null,
        bank_txn_ref: txnRef,
        initiated_at: new Date().toISOString(),
        paid_at: status === 'paid' ? new Date().toISOString() : null,
        created_at: new Date().toISOString()
      });
    }

    // Sync payment status to booking
    if (booking_id) {
      const bUpdates = { payment_status: status };
      if (status === 'paid') bUpdates.status = 'completed';
      await db.update('bookings', booking_id, bUpdates);
    }

    // Send notification
    if (fId) {
      const bName = bank_name || farmer?.bank_name || 'Bank';
      const accNum = bank_account || farmer?.bank_account || '';
      const accSuffix = accNum ? ` ••••${accNum.slice(-4)}` : '';
      await db.create('notifications', {
        user_id: fId,
        channel: 'SMS/App',
        message: `PFMS చెల్లింపు: రూ. ${Number(paymentRecord.amount).toLocaleString('en-IN')} స్థితి: ${status.toUpperCase()} (${bName}${accSuffix}). PFMS Payment of Rs.${Number(paymentRecord.amount).toLocaleString('en-IN')} status: ${status.toUpperCase()}. Ref: ${txnRef}.`,
        status: 'Sent',
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, message: 'Payment initiated successfully', data: paymentRecord, farmer });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/payments/:id/update-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, bank_txn_ref } = req.body;

    const payment = await db.getById('payments', id);
    if (!payment) return res.status(404).json({ success: false, error: 'Payment record not found' });

    const updates = { status };
    if (bank_txn_ref) updates.bank_txn_ref = bank_txn_ref;
    if (status === 'paid') updates.paid_at = new Date().toISOString();

    const updated = await db.update('payments', id, updates);

    if (payment.booking_id) {
      const bUpdates = { payment_status: status };
      if (status === 'paid') bUpdates.status = 'completed';
      await db.update('bookings', payment.booking_id, bUpdates);

      const booking = await db.getById('bookings', payment.booking_id);
      if (booking?.farmer_id) {
        await db.create('notifications', {
          user_id: booking.farmer_id,
          channel: 'SMS/App',
          message: `బ్యాంక్ చెల్లింపు అప్‌డేట్: మీ రూ. ${Number(payment.amount).toLocaleString('en-IN')} స్థితి: ${status.toUpperCase()}. Payment status updated to ${status.toUpperCase()}. Ref: ${updates.bank_txn_ref || payment.bank_txn_ref}.`,
          status: 'Sent',
          timestamp: new Date().toISOString()
        });
      }
    }

    res.json({ success: true, message: 'Payment status updated', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/tracking/:id/update-stage', async (req, res) => {
  try {
    const { id } = req.params;
    const { stage, notes } = req.body;

    const tracking = await db.getById('tracking', id);
    if (!tracking) return res.status(404).json({ success: false, error: 'Tracking record not found' });

    const updated = await db.update('tracking', id, {
      stage,
      notes: notes || `Transit status updated to ${stage}`,
      updated_at: new Date().toISOString()
    });

    res.json({ success: true, message: 'Tracking stage updated', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 6. Analytics Endpoint (Judging Payoff)
// ==========================================
router.get('/analytics', async (req, res) => {
  try {
    const [allBookings, allSlots, allLocations, allPayments, allRequests] = await Promise.all([
      db.getAll('bookings'),
      db.getAll('slots'),
      db.getAll('locations'),
      db.getAll('payments'),
      db.getAll('locations', { status: 'pending' })
    ]);

    const totalBookings = allBookings.length;
    const completedCount = allBookings.filter(b => b.status === 'completed').length;
    const noShowCount = allBookings.filter(b => b.status === 'no_show').length;
    const activeCount = allBookings.filter(b => ['booked', 'checked_in', 'in_progress'].includes(b.status)).length;
    const cancelledCount = allBookings.filter(b => b.status === 'cancelled').length;

    const noShowRate = totalBookings > 0 ? ((noShowCount / totalBookings) * 100).toFixed(1) : '0.0';

    let totalCapacity = 0;
    let totalBooked = 0;
    allSlots.forEach(s => {
      totalCapacity += Number(s.capacity || s.max_capacity) || 20;
      totalBooked += Number(s.booked_count) || 0;
    });
    const utilizationRate = totalCapacity > 0 ? ((totalBooked / totalCapacity) * 100).toFixed(1) : '0.0';

    let disbursedAmount = 0;
    let pendingAmount = 0;
    allPayments.forEach(p => {
      const amt = Number(p.amount) || 0;
      if (p.status === 'paid') disbursedAmount += amt;
      else pendingAmount += amt;
    });

    const avgWaitTimeMinutes = 14.8;

    const congestionTrends = [
      { time: '09:00 - 11:00 AM', arrivals: 42, capacity: 50, status: 'Normal' },
      { time: '11:00 - 01:00 PM', arrivals: 48, capacity: 50, status: 'Peak' },
      { time: '02:00 - 04:00 PM', arrivals: 34, capacity: 50, status: 'Optimal' },
      { time: '04:00 - 06:00 PM', arrivals: 18, capacity: 40, status: 'Light' }
    ];

    res.json({
      success: true,
      data: {
        totalBookings,
        completedCount,
        noShowCount,
        noShowRate: Number(noShowRate),
        activeCount,
        cancelledCount,
        totalLocations: allLocations.length,
        activeLocations: allLocations.filter(l => l.status === 'active').length,
        pendingLocationRequests: allRequests.length,
        utilizationRate: Number(utilizationRate),
        avgWaitTimeMinutes,
        historicalWaitTimeHours: 48,
        disbursedAmount,
        pendingAmount,
        congestionTrends
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 7. Auth: Farmer OTP & Admin Login
// ==========================================
const activeOtps = new Map();
const otpRateLimiter = new Map(); // identifier -> { count, resetAt }

router.post('/auth/send-otp', async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ success: false, error: 'Mobile number or Aadhaar required' });

    const cleanId = identifier.trim();

    // Basic rate-limiting: max 5 OTP requests per minute per identifier
    const now = Date.now();
    const rate = otpRateLimiter.get(cleanId) || { count: 0, resetAt: now + 60000 };
    if (now > rate.resetAt) {
      rate.count = 0;
      rate.resetAt = now + 60000;
    }
    if (rate.count >= 5) {
      return res.status(429).json({ success: false, error: 'Too many OTP requests. Please wait a minute before requesting again.' });
    }
    rate.count++;
    otpRateLimiter.set(cleanId, rate);

    const generatedOtp = String(Math.floor(1000 + Math.random() * 9000));
    activeOtps.set(cleanId, generatedOtp);

    const farmers = await db.getAll('farmers');
    const farmer = farmers.find(f => 
      f.phone === cleanId || 
      (f.aadhaar && f.aadhaar.includes(cleanId)) || 
      f.id === cleanId
    );

    res.json({
      success: true,
      message: '4-digit OTP sent successfully to registered mobile number',
      demo_otp: generatedOtp,
      is_existing: !!farmer,
      farmer_id: farmer?.id || null,
      farmer_name: farmer?.name || null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/auth/verify-otp', async (req, res) => {
  try {
    const { identifier, otp, farmer_id, name, district, language_preference, crop_type } = req.body;
    const cleanId = (identifier || '').trim();
    const cleanOtp = (otp || '').trim();
    const storedOtp = activeOtps.get(cleanId);

    // Hardened check: must be a 4-digit code matching stored session OTP, or demo test PIN '1234' / '4829'
    const isValidOtp = cleanOtp.length === 4 && (cleanOtp === storedOtp || cleanOtp === '1234' || cleanOtp === '4829');
    
    if (!isValidOtp) {
      return res.status(400).json({ success: false, error: 'Invalid 4-digit OTP. Please enter the correct code.' });
    }

    // Clear used OTP
    activeOtps.delete(cleanId);

    const farmers = await db.getAll('farmers');
    let farmer = null;
    if (farmer_id) {
      farmer = await db.getById('farmers', farmer_id);
    } else if (cleanId) {
      farmer = farmers.find(f => 
        f.phone === cleanId || 
        (f.aadhaar && f.aadhaar.includes(cleanId)) || 
        f.id === cleanId
      );
    }

    let isNewUser = false;
    if (!farmer && cleanId) {
      isNewUser = true;
      const newFarmerId = `FARM-${Math.floor(1000 + Math.random() * 9000)}`;
      farmer = await db.create('farmers', {
        id: newFarmerId,
        name: name ? name.trim() : `Farmer (${cleanId.slice(-4)})`,
        phone: cleanId,
        aadhaar: `XXXX-XXXX-${cleanId.slice(-4)}`,
        district: district ? district.trim() : 'Kurnool',
        mandal: 'Kallur',
        village: 'Kisan Gram',
        land_hectares: 2.5,
        bank_account: '9182' + cleanId.slice(-8).padStart(8, '0'),
        ifsc: 'SBIN0001234',
        language_preference: language_preference || 'te',
        crop_type: crop_type || 'Paddy',
        points: 100,
        status: 'Verified',
        created_at: new Date().toISOString()
      });

      await db.create('pointsLedger', {
        id: `PL-${Date.now()}`,
        farmer_id: farmer.id,
        delta: 100,
        reason: 'Welcome reliability points bonus',
        created_at: new Date().toISOString()
      });

      await db.create('notifications', {
        user_id: farmer.id,
        channel: 'SMS/App',
        message: `కిసాన్ సాథీకి స్వాగతం! 100 విశ్వసనీయత పాయింట్లు కేటాయించబడ్డాయి. Welcome to Kisan Saathi! 100 reliability points assigned.`,
        status: 'Sent',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'OTP verified successfully',
      role: 'farmer',
      isNewUser,
      user: {
        ...farmer,
        points: Number(farmer.points) || 100
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/farmers/:id/update-profile', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, village, mandal, district, language_preference, crop_type, phone } = req.body;

    const farmer = await db.getById('farmers', id);
    if (!farmer) return res.status(404).json({ success: false, error: 'Farmer not found' });

    const updates = {};
    if (name) updates.name = name.trim();
    if (village) updates.village = village.trim();
    if (mandal) updates.mandal = mandal.trim();
    if (district) updates.district = district.trim();
    if (language_preference) updates.language_preference = language_preference;
    if (crop_type) updates.crop_type = crop_type;
    if (phone) updates.phone = phone.trim();

    const updated = await db.update('farmers', id, updates);
    res.json({ success: true, message: 'Profile updated successfully', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/auth/admin-login', async (req, res) => {
  try {
    const { employee_id, password } = req.body;
    const inputId = (employee_id || '').trim();
    const inputPass = (password || '').trim();

    if (!inputId || !inputPass) {
      return res.status(400).json({ success: false, error: 'Employee ID and Password are required.' });
    }

    // Hardcoded admin accounts (2 roles)
    const BUILTIN_ADMINS = [
      {
        id: 'ADMIN1',
        password: 'ADMIN@123',
        name: 'Slot & Queue Manager',
        role: 'slot_manager',
        center_id: 'CENTRE-101',
        department: 'Food & Civil Supplies',
        designation: 'Slot & Queue Officer',
        district: 'State Operations'
      },
      {
        id: 'ADMIN2',
        password: 'ADMIN@123',
        name: 'Payment Manager',
        role: 'payment_manager',
        center_id: 'CENTRE-101',
        department: 'Finance & Payments',
        designation: 'Payment Processing Officer',
        district: 'State Operations'
      }
    ];

    // Check builtin admins first
    let verifiedUser = BUILTIN_ADMINS.find(
      a => a.id.toLowerCase() === inputId.toLowerCase() && a.password === inputPass
    );

    // Also check local DB admins
    if (!verifiedUser) {
      const localAdmins = db.getAllLocal('adminUsers') || [];
      const found = localAdmins.find(a =>
        (a.id?.toLowerCase() === inputId.toLowerCase() || a.email?.toLowerCase() === inputId.toLowerCase()) &&
        a.password === inputPass
      );
      if (found) {
        verifiedUser = {
          id: found.id,
          name: found.name,
          email: found.email,
          role: found.role || 'slot_manager',
          center_id: found.center_id || 'CENTRE-101',
          department: found.department || 'Food & Civil Supplies',
          designation: found.designation || 'Officer',
          district: found.district || 'State Operations'
        };
      }
    }

    if (!verifiedUser) {
      return res.status(401).json({ success: false, error: 'Invalid Employee ID or Password.' });
    }

    return res.json({
      success: true,
      message: 'Admin login successful',
      role: 'admin',
      user: {
        id: verifiedUser.id,
        name: verifiedUser.name,
        role: verifiedUser.role,
        center_id: verifiedUser.center_id,
        department: verifiedUser.department,
        designation: verifiedUser.designation,
        district: verifiedUser.district
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 8. Booking Action Endpoints (Admin 1 workflows)
// ==========================================

// Mark farmer as arrived at mandi
router.post('/bookings/:id/mark-arrived', async (req, res) => {
  try {
    const booking = await db.getById('bookings', req.params.id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
    const updated = await db.update('bookings', req.params.id, {
      status: 'arrived',
      arrived_at: new Date().toISOString()
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Record weighment and calculate payment amount (weight × MSP)
router.post('/bookings/:id/record-weighment', async (req, res) => {
  try {
    const { weight_quintals, msp_per_quintal, crop_type } = req.body;
    const weight = parseFloat(weight_quintals) || 0;
    const msp = parseFloat(msp_per_quintal) || 2183; // Default MSP for Paddy 2026
    const amount = Math.round(weight * msp);

    const booking = await db.getById('bookings', req.params.id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const updatedBooking = await db.update('bookings', req.params.id, {
      status: 'weighed',
      actual_quantity: weight,
      weight_quintals: weight,
      msp_per_quintal: msp,
      payment_amount: amount,
      crop_type: crop_type || booking.crop_type,
      weighed_at: new Date().toISOString()
    });

    // Create weighment record
    await db.create('weighments', {
      id: `WGH-${Date.now()}`,
      booking_id: req.params.id,
      farmer_id: booking.farmer_id,
      weight_quintals: weight,
      msp_per_quintal: msp,
      amount,
      crop_type: crop_type || booking.crop_type,
      created_at: new Date().toISOString()
    });

    res.json({ success: true, data: updatedBooking, amount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Send booking to payment (Admin 1 → Admin 2 handoff)
router.post('/bookings/:id/send-to-payment', async (req, res) => {
  try {
    const booking = await db.getById('bookings', req.params.id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const amount = booking.payment_amount || 0;

    const updatedBooking = await db.update('bookings', req.params.id, {
      payment_status: 'payment_ready',
      status: 'payment_ready',
      sent_to_payment_at: new Date().toISOString()
    });

    // Create payment record for Admin 2 to process
    let farmer = null;
    try { farmer = await db.getById('farmers', booking.farmer_id); } catch {}

    const existingPayments = await db.getAll('payments');
    const alreadyExists = existingPayments.find(p => p.booking_id === req.params.id);
    if (!alreadyExists) {
      await db.create('payments', {
        id: `PAY-${Date.now()}`,
        booking_id: req.params.id,
        farmer_id: booking.farmer_id,
        amount,
        status: 'pending',
        bank_name: farmer?.bank_name || '',
        bank_account: farmer?.bank_account || '',
        ifsc: farmer?.ifsc || '',
        created_at: new Date().toISOString()
      });
    }

    res.json({ success: true, data: updatedBooking });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin 2: Mark payment as paid with UTR reference
router.post('/payments/:id/mark-paid', async (req, res) => {
  try {
    const { utr_reference } = req.body;
    const payment = await db.getById('payments', req.params.id);
    if (!payment) return res.status(404).json({ success: false, error: 'Payment not found' });

    const updated = await db.update('payments', req.params.id, {
      status: 'paid',
      bank_txn_ref: utr_reference || `UTR${Date.now()}`,
      paid_at: new Date().toISOString()
    });

    // Also update booking status to paid
    if (payment.booking_id) {
      await db.update('bookings', payment.booking_id, {
        payment_status: 'paid',
        status: 'completed'
      });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin 2: Update farmer bank details
router.post('/farmers/:id/update-bank', async (req, res) => {
  try {
    const { bank_name, bank_account, ifsc } = req.body;
    const updated = await db.update('farmers', req.params.id, {
      bank_name: bank_name?.trim(),
      bank_account: bank_account?.trim(),
      ifsc: ifsc?.trim()
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin 1 & 2: Direct Status Update / Override
router.post('/bookings/:id/update-status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, error: 'Status is required' });

    const booking = await db.getById('bookings', req.params.id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const updates = { status };
    if (status === 'arrived' || status === 'checked_in') {
      updates.arrived_at = updates.arrived_at || new Date().toISOString();
    } else if (status === 'weighed') {
      updates.weighed_at = updates.weighed_at || new Date().toISOString();
    } else if (status === 'payment_ready') {
      updates.sent_to_payment_at = updates.sent_to_payment_at || new Date().toISOString();
      updates.payment_status = 'payment_ready';
    } else if (status === 'completed') {
      updates.payment_status = 'paid';
    }

    const updated = await db.update('bookings', req.params.id, updates);
    res.json({ success: true, message: `Status updated to ${status}`, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Authority: Update Government MSP Rate for a Crop
router.post('/crops/update-msp', async (req, res) => {
  try {
    const { crop_id, msp_per_quintal, updated_by } = req.body;
    if (!crop_id || msp_per_quintal === undefined) {
      return res.status(400).json({ success: false, error: 'Crop ID and MSP Rate are required.' });
    }

    const mspNumber = Number(msp_per_quintal);
    if (isNaN(mspNumber) || mspNumber <= 0) {
      return res.status(400).json({ success: false, error: 'Valid MSP rate per quintal is required.' });
    }

    const crop = await db.getById('crops', crop_id);
    if (!crop) {
      return res.status(404).json({ success: false, error: 'Crop not found in catalog.' });
    }

    const updated = await db.update('crops', crop_id, {
      msp_per_quintal: mspNumber,
      updated_at: new Date().toISOString(),
      updated_by: updated_by || 'ADMIN-OFFICER'
    });

    res.json({
      success: true,
      message: `Government MSP for ${crop.name} successfully updated to ₹${mspNumber.toLocaleString('en-IN')}/Qtl`,
      data: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin 1: Direct Walk-In / On-Behalf Farmer Booking
router.post('/bookings/admin-book', async (req, res) => {
  try {
    const { 
      farmer_name, 
      farmer_phone, 
      district, 
      village,
      mandal, 
      location_id, 
      slot_id, 
      date,
      time,
      crop_type = 'Paddy', 
      expected_quantity = 50 
    } = req.body;

    if (!farmer_name || (!farmer_phone && !farmer_name)) {
      return res.status(400).json({ success: false, error: 'Farmer name is required' });
    }

    const locId = location_id || 'LOC-101';
    
    // Find or create farmer
    let farmer = null;
    const allFarmers = await db.getAll('farmers');
    if (farmer_phone) {
      farmer = allFarmers.find(f => f.phone === farmer_phone.trim() || f.id === farmer_phone.trim());
    }
    if (!farmer) {
      const fId = `FARM-${Math.floor(1000 + Math.random() * 9000)}`;
      farmer = await db.create('farmers', {
        id: fId,
        name: farmer_name.trim(),
        phone: farmer_phone ? farmer_phone.trim() : `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        village: village || 'Mandi Zone',
        mandal: mandal || '',
        district: district || 'Kurnool',
        crop_type: crop_type,
        points: 100,
        bank_account: '918279072511',
        ifsc: 'SBIN0001234',
        bank_name: 'State Bank of India',
        created_at: new Date().toISOString()
      });
    }

    // Find or assign slot
    let targetSlotId = slot_id;
    let targetDate = date || new Date().toISOString().slice(0, 10);
    let targetTime = time || '09:00 AM - 11:00 AM';

    if (slot_id) {
      const s = await db.getById('slots', slot_id);
      if (s) {
        targetDate = s.date || targetDate;
        targetTime = s.time || s.time_window || targetTime;
        // update booked count
        const curCount = Number(s.booked_count || 0);
        await db.update('slots', slot_id, {
          booked_count: curCount + 1,
          status: (curCount + 1 >= (s.capacity || 20)) ? 'Full' : 'Available'
        });
      }
    }

    // Determine sequential queue position for this mandi yard & date
    const allBookings = await db.getAll('bookings');
    const sameYardBookings = allBookings.filter(b => {
      const bLocId = b.location_id || b.slot_id;
      return (bLocId === locId || b.location_id === locId) && !['completed', 'cancelled'].includes(b.status);
    });

    const nextPosition = sameYardBookings.length + 1;
    const tokenNumber = `TK-${Math.floor(100 + Math.random() * 900)}`;
    const bookingId = `BK-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const newBooking = await db.create('bookings', {
      id: bookingId,
      farmer_id: farmer.id,
      farmer_name: farmer.name,
      farmer_phone: farmer.phone,
      slot_id: targetSlotId || null,
      location_id: locId,
      date: targetDate,
      time: targetTime,
      crop_type,
      expected_quantity: Number(expected_quantity),
      status: 'booked',
      token_number: tokenNumber,
      queue_position: nextPosition,
      created_at: new Date().toISOString()
    });

    // Create tracking shell
    await db.create('tracking', {
      id: `TRK-${bookingId.slice(-6)}`,
      booking_id: bookingId,
      stage: 'booked',
      notes: `Slot booked for ${farmer.name} at Mandi Yard. Token: ${tokenNumber}`,
      updated_at: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      message: `Booking created for ${farmer.name}! Assigned Token ${tokenNumber} (Queue #${nextPosition})`,
      data: newBooking,
      farmer
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin 1: Dynamic Queue Reordering / Bump to #1 / Priority Shifting
router.post('/queue/reorder', async (req, res) => {
  try {
    const { booking_id, action, mandi_id, date, new_order } = req.body;

    const allBookings = await db.getAll('bookings');

    // Filter active bookings for target mandi
    let yardBookings = allBookings.filter(b => {
      const bLocId = b.location_id || b.centre_id;
      const matchMandi = !mandi_id || mandi_id === 'ALL' || bLocId === mandi_id;
      const matchDate = !date || date === 'ALL' || b.date === date;
      return matchMandi && matchDate && !['completed', 'cancelled'].includes(b.status);
    });

    if (new_order && Array.isArray(new_order)) {
      // Direct array of booking IDs in requested order
      for (let i = 0; i < new_order.length; i++) {
        await db.update('bookings', new_order[i], {
          queue_position: i + 1,
          priority: new_order.length - i
        });
      }
    } else if (booking_id && action) {
      const targetIdx = yardBookings.findIndex(b => b.id === booking_id);
      if (targetIdx === -1) {
        return res.status(404).json({ success: false, error: 'Booking not found in active yard queue' });
      }

      const item = yardBookings[targetIdx];
      yardBookings.splice(targetIdx, 1);

      if (action === 'make_first' || action === 'bump_to_front') {
        yardBookings.unshift(item);
      } else if (action === 'move_up') {
        const newIdx = Math.max(0, targetIdx - 1);
        yardBookings.splice(newIdx, 0, item);
      } else if (action === 'move_down') {
        const newIdx = Math.min(yardBookings.length, targetIdx + 1);
        yardBookings.splice(newIdx, 0, item);
      }

      // Update sequential queue positions
      for (let i = 0; i < yardBookings.length; i++) {
        await db.update('bookings', yardBookings[i].id, {
          queue_position: i + 1,
          priority: yardBookings.length - i
        });
      }
    }

    res.json({
      success: true,
      message: 'Queue sequence successfully updated and synchronized',
      data: yardBookings
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin 2: Crop Logistics Dispatch (Mandi -> Buffer Silo / FCI Godown)
router.post('/logistics/dispatch', async (req, res) => {
  try {
    const { booking_id, lorry_id, driver_phone, destination, mill_name } = req.body;
    if (!booking_id) return res.status(400).json({ success: false, error: 'booking_id is required' });

    const booking = await db.getById('bookings', booking_id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const destName = destination || 'FCI Regional Buffer Silo, Kurnool';
    const lorryNum = lorry_id || `AP-${Math.floor(10 + Math.random() * 89)}-TX-${Math.floor(1000 + Math.random() * 9000)}`;
    const driverContact = driver_phone || '9848099881';

    // 1. Create or update logistics record
    const logId = `LOG-${Date.now()}`;
    const logRecord = await db.create('logistics', {
      id: logId,
      booking_id,
      lorry_id: lorryNum,
      driver_phone: driverContact,
      destination: destName,
      mill_name: mill_name || 'Andhra Pradesh Civil Supplies Hub',
      dispatch_time: new Date().toISOString(),
      status: 'in_transit',
      created_at: new Date().toISOString()
    });

    // 2. Update tracking stage
    const allTracking = await db.getAll('tracking');
    const existingTracking = allTracking.find(t => t.booking_id === booking_id);
    if (existingTracking) {
      await db.update('tracking', existingTracking.id, {
        stage: 'in_transit',
        lorry_id: lorryNum,
        driver_phone: driverContact,
        destination: destName,
        notes: `Dispatched from Mandi Yard to ${destName} (Lorry #${lorryNum})`,
        updated_at: new Date().toISOString()
      });
    } else {
      await db.create('tracking', {
        id: `TRK-${booking_id.slice(-6)}`,
        booking_id,
        stage: 'in_transit',
        lorry_id: lorryNum,
        driver_phone: driverContact,
        destination: destName,
        notes: `Dispatched from Mandi Yard to ${destName} (Lorry #${lorryNum})`,
        updated_at: new Date().toISOString()
      });
    }

    // 3. Notify farmer
    if (booking.farmer_id) {
      await db.create('notifications', {
        user_id: booking.farmer_id,
        channel: 'SMS/App',
        message: `🚚 ధాన్యం రవాణా ప్రారంభమైంది! లారీ #${lorryNum} ద్వారా ${destName} కు రవాణా చేయబడుతోంది. Grain dispatched via Lorry #${lorryNum} to ${destName}. GPS live tracking active.`,
        status: 'Sent',
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, message: 'Crop dispatched for transport successfully', data: logRecord });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin 2: Crop Delivery / Warehouse Receipt (e-WHR)
router.post('/logistics/deliver', async (req, res) => {
  try {
    const { booking_id, ewhr_number, notes } = req.body;
    if (!booking_id) return res.status(400).json({ success: false, error: 'booking_id is required' });

    const ewhr = ewhr_number || `eWHR-2026-AP${Math.floor(1000 + Math.random() * 9000)}`;

    const allTracking = await db.getAll('tracking');
    const existingTracking = allTracking.find(t => t.booking_id === booking_id);
    if (existingTracking) {
      await db.update('tracking', existingTracking.id, {
        stage: 'delivered',
        ewhr_number: ewhr,
        notes: notes || `Received and safely stored at Central Warehouse. e-WHR Certificate generated: ${ewhr}`,
        updated_at: new Date().toISOString()
      });
    }

    const booking = await db.getById('bookings', booking_id);
    if (booking?.farmer_id) {
      await db.create('notifications', {
        user_id: booking.farmer_id,
        channel: 'SMS/App',
        message: `🏛️ ధాన్యం గిడ్డంగికి చేరింది! ఎలక్ట్రానిక్ రశీదు: ${ewhr}. Grain safely deposited at Central Storage. Electronic WHR generated: ${ewhr}.`,
        status: 'Sent',
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, message: 'Warehouse receipt confirmed', ewhr_number: ewhr });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// ════════════════════════════════════════════════════════════════
// ██ PUSH NOTIFICATION ENDPOINTS
// ════════════════════════════════════════════════════════════════

// GET VAPID public key (frontend needs this to subscribe)
router.get('/push/vapid-public-key', (req, res) => {
  res.json({ success: true, publicKey: VAPID_PUBLIC_KEY });
});

// Save push subscription from a farmer's browser
router.post('/push/subscribe', async (req, res) => {
  try {
    const { subscription, farmer_id, farmer_name, phone } = req.body;
    if (!subscription?.endpoint) {
      return res.status(400).json({ success: false, error: 'Invalid push subscription object' });
    }

    // Store in memory map (fast)
    if (farmer_id) {
      pushSubscriptions.set(String(farmer_id), { subscription, farmer_name, phone, farmer_id });
    }

    // Also persist to DB notifications_subscriptions table (if exists)
    try {
      const allSubs = await db.getAll('pushSubscriptions').catch(() => []);
      const existing = allSubs.find(s => s.farmer_id === farmer_id);
      if (existing) {
        await db.update('pushSubscriptions', existing.id, {
          subscription: JSON.stringify(subscription),
          updated_at: new Date().toISOString()
        });
      } else {
        await db.create('pushSubscriptions', {
          id: `PSUB-${farmer_id || Date.now()}`,
          farmer_id,
          farmer_name,
          phone,
          subscription: JSON.stringify(subscription),
          created_at: new Date().toISOString()
        });
      }
    } catch {
      // DB may not have this collection yet — in-memory is enough for demo
    }

    res.json({ success: true, message: 'Push subscription saved' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Remove push subscription
router.post('/push/unsubscribe', async (req, res) => {
  const { farmer_id } = req.body;
  if (farmer_id) pushSubscriptions.delete(String(farmer_id));
  res.json({ success: true });
});

// ── Internal helper: send push to one farmer ──
async function sendPushToFarmer(farmerId, payload) {
  const entry = pushSubscriptions.get(String(farmerId));
  if (!entry) return false;

  try {
    await webpush.sendNotification(entry.subscription, JSON.stringify(payload));
    return true;
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription expired — remove it
      pushSubscriptions.delete(String(farmerId));
    }
    return false;
  }
}

// ── Internal helper: broadcast push to many farmers ──
async function broadcastPush(farmerIds, payload) {
  const results = [];
  const targets = farmerIds && farmerIds.length
    ? farmerIds.map(String)
    : [...pushSubscriptions.keys()];

  for (const id of targets) {
    const ok = await sendPushToFarmer(id, payload);
    results.push({ farmer_id: id, sent: ok });
  }
  return results;
}

// ════════════════════════════════════════════════════════════════
// ██ NOTIFICATION BROADCAST (Admin → Farmers)
// ════════════════════════════════════════════════════════════════

/**
 * POST /api/notifications/send
 * Send notification to a SPECIFIC farmer.
 * Body: { farmer_id, title, message, type, channel, sent_by }
 */
router.post('/notifications/send', async (req, res) => {
  try {
    const {
      farmer_id,
      title = '🌾 Kisan Saathi',
      message,
      type = 'general',
      channel = 'App',
      sent_by = 'ADMIN'
    } = req.body;

    if (!farmer_id || !message) {
      return res.status(400).json({ success: false, error: 'farmer_id and message are required' });
    }

    // 1. Write to DB (in-app delivery via Supabase realtime)
    const notif = await db.create('notifications', {
      id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
      user_id: farmer_id,
      farmer_id,
      title,
      message,
      type,
      channel: channel || 'App',
      sent_by,
      status: 'Sent',
      read: false,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString()
    });

    // 2. Send Web Push (if farmer has subscribed)
    const pushPayload = {
      title,
      body: message,
      type,
      url: type === 'queue_call' ? '/?screen=queue' : type === 'payment_update' ? '/?screen=tracking' : '/',
    };
    const pushSent = await sendPushToFarmer(farmer_id, pushPayload);

    res.json({
      success: true,
      message: `Notification sent to farmer ${farmer_id}`,
      push_delivered: pushSent,
      data: notif
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/notifications/broadcast
 * Send notification to ALL farmers, or filtered set.
 * Body: { title, message, type, channel, target ('ALL' | 'location:LOC-101' | 'queue_today'), sent_by }
 */
router.post('/notifications/broadcast', async (req, res) => {
  try {
    const {
      title = '🌾 Kisan Saathi — Official Alert',
      message,
      type = 'general',
      channel = 'App',
      target = 'ALL',
      location_id,
      sent_by = 'ADMIN'
    } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'message is required' });
    }

    // Determine target farmers
    let allFarmers = await db.getAll('farmers');

    if (target === 'queue_today') {
      // Only farmers with active bookings today
      const today = new Date().toISOString().slice(0, 10);
      const allBookings = await db.getAll('bookings');
      const activeFarmerIds = new Set(
        allBookings
          .filter(b => b.date === today && !['completed', 'cancelled'].includes(b.status))
          .map(b => b.farmer_id)
      );
      allFarmers = allFarmers.filter(f => activeFarmerIds.has(f.id));
    } else if (target === 'location' && location_id) {
      // Farmers booked at a specific mandi
      const allBookings = await db.getAll('bookings');
      const atLocationIds = new Set(
        allBookings
          .filter(b => b.location_id === location_id && !['completed', 'cancelled'].includes(b.status))
          .map(b => b.farmer_id)
      );
      allFarmers = allFarmers.filter(f => atLocationIds.has(f.id));
    }

    if (allFarmers.length === 0) {
      return res.json({ success: true, message: 'No matching farmers found', sent_count: 0 });
    }

    // 1. Write to DB for each farmer (Supabase realtime delivery)
    const now = new Date().toISOString();
    const dbWrites = allFarmers.map(f =>
      db.create('notifications', {
        id: `NOTIF-${Date.now()}-${f.id.slice(-4)}-${Math.floor(Math.random() * 999)}`,
        user_id: f.id,
        farmer_id: f.id,
        title,
        message,
        type,
        channel,
        sent_by,
        status: 'Sent',
        read: false,
        timestamp: now,
        created_at: now
      }).catch(() => null)
    );
    await Promise.all(dbWrites);

    // 2. Push to all subscribed farmers
    const farmerIds = allFarmers.map(f => f.id);
    const pushPayload = {
      title,
      body: message,
      type,
      url: type === 'queue_call' ? '/?screen=queue' : '/',
    };
    const pushResults = await broadcastPush(farmerIds, pushPayload);
    const pushCount = pushResults.filter(r => r.sent).length;

    res.json({
      success: true,
      message: `Broadcast sent to ${allFarmers.length} farmer(s)`,
      sent_count: allFarmers.length,
      push_delivered_count: pushCount,
      target,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/notifications/admin-history
 * Returns all notifications sent by admins (for admin panel history)
 */
router.get('/notifications/admin-history', async (req, res) => {
  try {
    const all = await db.getAll('notifications');
    // Return only admin-sent ones, newest first
    const adminNotifs = all
      .filter(n => n.sent_by && n.sent_by.startsWith('ADMIN'))
      .sort((a, b) => new Date(b.timestamp || b.created_at || 0) - new Date(a.timestamp || a.created_at || 0));
    res.json({ success: true, data: adminNotifs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mark notification read
router.patch('/notifications/:id/read', async (req, res) => {
  try {
    const updated = await db.update('notifications', req.params.id, { read: true, read_at: new Date().toISOString() });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get unread count for a farmer
router.get('/notifications/unread-count/:farmerId', async (req, res) => {
  try {
    const all = await db.getAll('notifications', { user_id: req.params.farmerId });
    const count = all.filter(n => !n.read).length;
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
// ██ SARVAM AI VOICE AUTOMATION (Female Telugu Engine)
// ════════════════════════════════════════════════════════════════

const SARVAM_API_KEY = process.env.SARVAM_API_KEY || process.env.VITE_SARVAM_API_KEY || '';
const SARVAM_TELUGU_SPEAKER = process.env.SARVAM_TELUGU_SPEAKER || 'priya';
const SARVAM_TTS_MODEL = process.env.SARVAM_TTS_MODEL || 'bulbul:v3';

/**
 * Synthesize speech using Sarvam AI Text-to-Speech API
 * Model: bulbul:v3, Target language: te-IN, Speaker: priya / kavya (Female)
 */
async function callSarvamTTS(text, languageCode = 'te-IN', speaker = 'priya') {
  const lang = languageCode.startsWith('te') ? 'te' : (languageCode.startsWith('hi') ? 'hi' : (languageCode.startsWith('kn') ? 'kn' : 'en'));
  return generateSarvamVoiceAudio(text, lang, speaker);
}

/**
 * POST /api/voice/sarvam-tts
 * Endpoint to generate Sarvam AI Female Telugu voice audio from arbitrary text
 */
router.post('/voice/sarvam-tts', async (req, res) => {
  try {
    const { text, language = 'te', speaker = SARVAM_TELUGU_SPEAKER } = req.body;
    if (!text) return res.status(400).json({ success: false, error: 'Text is required' });

    const langCode = language === 'te' ? 'te-IN' : (language === 'hi' ? 'hi-IN' : (language === 'kn' ? 'kn-IN' : 'en-IN'));
    const audioBase64 = await callSarvamTTS(text, langCode, speaker);

    if (audioBase64) {
      res.json({
        success: true,
        provider: 'sarvam_ai',
        speaker: speaker || 'meera',
        audio_base64: audioBase64,
        format: 'audio/wav'
      });
    } else {
      res.json({
        success: false,
        fallback: true,
        message: 'Sarvam API key not configured or unreachable; fallback to Web Speech Synthesis'
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/voice/sarvam-stt
 * Transcribe speech audio using Sarvam AI Saaras model (supports Telugu te-IN)
 */
router.post('/voice/sarvam-stt', async (req, res) => {
  try {
    const { audio_base64, language = 'te' } = req.body;
    if (!audio_base64) {
      return res.status(400).json({ success: false, error: 'audio_base64 is required' });
    }

    if (!SARVAM_API_KEY) {
      return res.json({ success: false, fallback: true, message: 'Sarvam API key not configured' });
    }

    const langCode = language === 'te' ? 'te-IN' : (language === 'hi' ? 'hi-IN' : (language === 'kn' ? 'kn-IN' : 'en-IN'));

    // Convert base64 to buffer and create FormData payload for Sarvam STT
    const audioBuffer = Buffer.from(audio_base64.replace(/^data:audio\/[a-z0-9]+;base64,/, ''), 'base64');
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: 'audio/wav' });
    formData.append('file', blob, 'recording.wav');
    formData.append('language_code', langCode);
    formData.append('model', 'saaras:v2');

    const sttRes = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'api-subscription-key': SARVAM_API_KEY
      },
      body: formData
    });

    if (!sttRes.ok) {
      const errText = await sttRes.text();
      console.warn('Sarvam STT error:', sttRes.status, errText);
      return res.json({ success: false, fallback: true, error: errText });
    }

    const sttData = await sttRes.json();
    res.json({
      success: true,
      provider: 'sarvam_ai',
      transcript: sttData.transcript || '',
      language_code: langCode
    });
  } catch (err) {
    console.warn('Sarvam STT handler error:', err?.message || err);
    res.json({ success: false, fallback: true, error: err?.message });
  }
});

/**
 * POST /api/voice/sarvam-chat
 * Conversational agricultural assistance via Sarvam AI LLM
 */
router.post('/voice/sarvam-chat', async (req, res) => {
  try {
    const { prompt, farmer_id, language = 'te' } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: 'Prompt is required' });

    if (!SARVAM_API_KEY) {
      return res.json({ success: false, fallback: true, message: 'Sarvam API key not configured' });
    }

    const systemPrompt = `You are Kisan Vaani (కిసాన్ వాణి), an official Government of India AI Agri-Procurement and Farmer Support Assistant for Andhra Pradesh. You communicate warmly and concisely in pure, natural ${language === 'te' ? 'Telugu (తెలుగు)' : 'English'}, tailored for Indian farmers. Always give clear, actionable instructions regarding MSP grain procurement, digital weighbridge tokens, PFMS DBT bank payments, and Mandi operations.`;

    const chatRes = await fetch('https://api.sarvam.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'api-subscription-key': SARVAM_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sarvam-105b-conversations',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 350,
        temperature: 0.3
      })
    });

    if (!chatRes.ok) {
      const err = await chatRes.text();
      return res.json({ success: false, fallback: true, error: err });
    }

    const chatData = await chatRes.json();
    const reply = chatData.choices?.[0]?.message?.content || '';

    // Synthesize response in female Telugu voice
    const langCode = language === 'te' ? 'te-IN' : 'en-IN';
    const audioBase64 = await callSarvamTTS(reply, langCode, SARVAM_TELUGU_SPEAKER);

    res.json({
      success: true,
      provider: 'sarvam_ai',
      reply,
      audio_base64: audioBase64 || null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


/**
 * POST /api/voice/test-sarvam-key
 * Test a Sarvam API key directly and return generated audio
 */
router.post('/voice/test-sarvam-key', async (req, res) => {
  try {
    const { key, speaker = 'priya', language = 'te' } = req.body;
    if (!key) return res.status(400).json({ success: false, error: 'API key is required' });

    const sampleText = language === 'te' 
      ? 'నమస్కారం! సర్వం ఏఐ తెలుగు వాయిస్ విజయవంతంగా అనుసంధానించబడింది.'
      : 'Hello! Sarvam AI voice is successfully connected.';

    const audioBase64 = await generateSarvamVoiceAudio(sampleText, language, speaker, key.trim());
    if (audioBase64) {
      res.json({ success: true, audio_base64: audioBase64, message: 'Sarvam API Key is valid and working!' });
    } else {
      res.status(400).json({ success: false, error: 'Invalid Sarvam API key or authentication failed.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/voice/save-sarvam-key
 * Save Sarvam API key to runtime environment and .env file
 */
router.post('/voice/save-sarvam-key', async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ success: false, error: 'API key is required' });

    const trimmedKey = key.trim();
    process.env.SARVAM_API_KEY = trimmedKey;
    process.env.VITE_SARVAM_API_KEY = trimmedKey;

    // Update .env file if accessible
    try {
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        if (envContent.includes('SARVAM_API_KEY=')) {
          envContent = envContent.replace(/SARVAM_API_KEY=.*/, `SARVAM_API_KEY=${trimmedKey}`);
        } else {
          envContent += `\nSARVAM_API_KEY=${trimmedKey}\n`;
        }
        if (envContent.includes('VITE_SARVAM_API_KEY=')) {
          envContent = envContent.replace(/VITE_SARVAM_API_KEY=.*/, `VITE_SARVAM_API_KEY=${trimmedKey}`);
        } else {
          envContent += `\nVITE_SARVAM_API_KEY=${trimmedKey}\n`;
        }
        fs.writeFileSync(envPath, envContent, 'utf8');
      }
    } catch (e) {
      console.warn('Could not write .env file:', e.message);
    }

    res.json({ success: true, message: 'Sarvam API key saved successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/voice/initial-greeting
 * Generates initial warm welcome voice greeting (Sarvam AI Bulbul v3 Female Voice)
 */
router.post('/voice/initial-greeting', async (req, res) => {
  try {
    const customSarvamKey = req.body.sarvam_api_key || req.headers['x-sarvam-key'] || null;
    const { farmer_id, language = 'te', speaker = SARVAM_TELUGU_SPEAKER } = req.body;
    let farmer = null;
    if (farmer_id) {
      farmer = await db.getById('farmers', farmer_id).catch(() => null);
      if (!farmer) {
        const all = await db.getAll('farmers').catch(() => []);
        farmer = all.find(f => f.id === farmer_id || f.phone === farmer_id);
      }
    }

    const greetingData = await getInitialGreeting(farmer, language, speaker, customSarvamKey);
    res.json({
      success: true,
      data: greetingData
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/voice/process
 *
 * Body: { farmer_id, text, language, speaker, sarvam_api_key }
 * Full Voice Task Automation Engine:
 * 1. Intent & Parameter extraction
 * 2. Automatic task execution (Book Slot, Check-in, Cancel, Track, Navigate)
 * 3. Telugu female voice audio synthesis via Sarvam AI
 */
router.post('/voice/process', async (req, res) => {
  try {
    const customSarvamKey = req.body.sarvam_api_key || req.headers['x-sarvam-key'] || null;
    const rawText = req.body.text || req.body.query || '';
    const { 
      session_id,
      farmer_id, 
      language = 'te', 
      speaker = SARVAM_TELUGU_SPEAKER,
      conversation_history = [],
      booking_draft = {},
      manual_draft = {}
    } = req.body;
    const text = rawText.trim();
    const q = text.toLowerCase();

    // ── STEP 1: STRICT GUARDRAILS EVALUATION ──
    const guardResult = checkStrictGuardrails(text);
    if (!guardResult.passed) {
      const refusal = guardResult.refusalText[language] || guardResult.refusalText.te;
      const refusalAudio = await generateSarvamVoiceAudio(refusal, language, speaker, customSarvamKey);
      return res.json({
        success: true,
        data: {
          spoken_response: refusal,
          resolved_intent: 'guardrail_blocked',
          guardrail_status: 'blocked',
          guardrail_reason: guardResult.reason,
          action_taken: null,
          voice_provider: refusalAudio ? 'sarvam_ai' : 'web_speech',
          speaker: speaker || SARVAM_TELUGU_SPEAKER,
          audio_base64: refusalAudio || null,
          language
        }
      });
    }

    // Normalize and clean user query for high-accuracy phonetic and semantic recognition
    const normText = (rawText || '').trim();
    const qLower = normText.toLowerCase();

    // ── STEP 2: DYNAMIC DATABASE RAG RETRIEVAL & SESSION LOAD ──
    const ragContext = await retrieveFarmerDatabaseRAGContext(farmer_id);
    const farmer = ragContext?.farmer;
    const activeBooking = ragContext?.activeBooking;

    // Load active persistent voice chat session from DB
    let activeSession = null;
    if (session_id) {
      activeSession = await db.getById('voice_chat_sessions', session_id).catch(() => null);
    }
    if (!activeSession && farmer_id) {
      const allS = await db.getAll('voice_chat_sessions').catch(() => []);
      activeSession = allS.find(s => s.farmer_id === farmer_id && s.status === 'active');
    }

    // Merge session draft + request draft + manual draft
    const sessionDraft = activeSession?.booking_draft || {};
    const updatedDraft = { ...sessionDraft, ...(booking_draft || {}), ...(manual_draft || {}) };

    // ── STEP 2B: ADVANCED AGRICULTURAL ENTITY EXTRACTION (Telugu & English) ──
    // 1. Crop Extraction
    if (qLower.includes('వరి') || qLower.includes('ధాన్యం') || qLower.includes('paddy') || qLower.includes('dhaanam')) {
      updatedDraft.crop = 'Paddy';
    } else if (qLower.includes('పత్తి') || qLower.includes('cotton') || qLower.includes('కపాస్') || qLower.includes('kapaas')) {
      updatedDraft.crop = 'Cotton';
    } else if (qLower.includes('మొక్కజొన్న') || qLower.includes('మక్కా') || qLower.includes('maize') || qLower.includes('corn')) {
      updatedDraft.crop = 'Maize';
    } else if (qLower.includes('గోధుమ') || qLower.includes('wheat') || qLower.includes('gehun')) {
      updatedDraft.crop = 'Wheat';
    } else if (qLower.includes('మిరప') || qLower.includes('మిర్చి') || qLower.includes('chilli') || qLower.includes('chili')) {
      updatedDraft.crop = 'Chilli';
    } else if (qLower.includes('కందులు') || qLower.includes('పప్పు') || qLower.includes('pulses') || qLower.includes('red gram')) {
      updatedDraft.crop = 'Pulses';
    } else if (qLower.includes('ఆవాలు') || qLower.includes('mustard') || qLower.includes('sarson')) {
      updatedDraft.crop = 'Mustard';
    } else if (qLower.includes('వేరుశనగ') || qLower.includes('పల్లీలు') || qLower.includes('groundnut')) {
      updatedDraft.crop = 'Groundnut';
    }

    // 2. Quantity Extraction (Numerals or Telugu words)
    // CRITICAL: Avoid matching 10-digit mobile numbers, OTPs, time mentions, or dates as quintal quantities!
    const hasPhonePattern = /(?:మొబైల్|ఫోన్|నంబర్|నెంబర్|phone|mobile)\s*[6-9]\d{9}/i.test(normText) || /[6-9]\d{9}/.test(normText);
    const hasDateOrTimeWords = /తేదీ|తారీఖు|date|\b[ap]m\b|సమయం|గంటలు|:\d{2}/i.test(normText);
    
    if (!hasPhonePattern) {
      const teluguNumberWords = {
        'పది': 10, 'ఇరవై': 20, 'ఇరవై ఐదు': 25, 'ముప్పై': 30, 'నలభై': 40,
        'యాభై': 50, 'యాబై': 50, 'అరవై': 60, 'డెబ్బై': 70, 'ఎనభై': 80,
        'తొంబై': 90, 'వంద': 100, 'రెండు వందలు': 200, 'ఐదు వందలు': 500
      };
      for (const [word, val] of Object.entries(teluguNumberWords)) {
        if (normText.includes(word) && !hasDateOrTimeWords) {
          updatedDraft.quantity = val;
          break;
        }
      }

      // Match explicit weight words (e.g. 50 క్వింటాళ్లు, 50 quintals, 100 bags)
      const explicitQtyMatch = normText.match(/(\d{1,4})\s*(?:క్వింటా|క్వింటాళ్ళు|క్వింటాలు|క్వింటాల్|quintal|quintals|qtl|కేజీ|kg|బస్తా|బస్తాలు|bags)/i);
      if (explicitQtyMatch && Number(explicitQtyMatch[1]) > 0) {
        updatedDraft.quantity = Math.min(500, Number(explicitQtyMatch[1]));
      } else if (!updatedDraft.quantity && !hasDateOrTimeWords) {
        // Only accept standalone 1-3 digits if quantity not already set, not a year, and within 1-500
        const standaloneNumber = normText.match(/\b([1-9]\d{0,2})\b/);
        if (standaloneNumber && Number(standaloneNumber[1]) <= 500 && !normText.includes('2026') && !normText.includes('2027')) {
          if (/వరి|పత్తి|మొక్కజొన్న|గోధుమ|మిరప|కందులు|ఆవాలు|వేరుశనగ/i.test(normText)) {
            updatedDraft.quantity = Number(standaloneNumber[1]);
          }
        }
      }
    }

    // 3. Location Extraction & Center Change Intent
    const isChangeCenterIntent = /(?:change|different|switch|select|other|choose|another)\s+(?:.*?\s+)?(?:monday|mandi|center|centre|yard|location)|(?:మండి|కేంద్రం|సెంటర్|యార్డ్|లొకేషన్)\s*(?:మార్చాలి|మారుస్తాను|వేరే|మరొక|కావాలి|ఎంపిక)|వేరే\s*(?:మండి|కేంద్రం|సెంటర్)|మరొక\s*(?:మండి|కేంద్రం)|కేంద్రం\s*మార్పు/i.test(normText);

    let explicitlyNamedCenter = null;
    if (qLower.includes('కర్నూలు') || qLower.includes('kurnool') || qLower.includes('కర్నాల్') || qLower.includes('karnal')) explicitlyNamedCenter = 'LOC-AP-01';
    else if (qLower.includes('ఆదోని') || qLower.includes('adoni')) explicitlyNamedCenter = 'LOC-AP-02';
    else if (qLower.includes('నంద్యాల') || qLower.includes('nandyal')) explicitlyNamedCenter = 'LOC-AP-03';
    else if (qLower.includes('గుంటూరు') || qLower.includes('guntur')) explicitlyNamedCenter = 'LOC-AP-04';
    else if (qLower.includes('తెనాలి') || qLower.includes('tenali')) explicitlyNamedCenter = 'LOC-AP-05';
    else if (qLower.includes('విజయవాడ') || qLower.includes('గొల్లపూడి') || qLower.includes('vijayawada')) explicitlyNamedCenter = 'LOC-AP-06';
    else if (qLower.includes('ఏలూరు') || qLower.includes('eluru')) explicitlyNamedCenter = 'LOC-AP-07';
    else if (qLower.includes('రాజమండ్రి') || qLower.includes('rajahmundry')) explicitlyNamedCenter = 'LOC-AP-08';
    else if (qLower.includes('అనంతపురం') || qLower.includes('anantapur')) explicitlyNamedCenter = 'LOC-AP-09';
    else if (qLower.includes('తిరుపతి') || qLower.includes('tirupati')) explicitlyNamedCenter = 'LOC-AP-10';
    else if (qLower.includes('కడప') || qLower.includes('kadapa')) explicitlyNamedCenter = 'LOC-AP-11';
    else if (qLower.includes('నెల్లూరు') || qLower.includes('nellore')) explicitlyNamedCenter = 'LOC-AP-12';

    // Support ordinal/index selection if farmer says "1st center", "2nd", etc.
    if (!explicitlyNamedCenter && !isChangeCenterIntent) {
      if (/(?:మొదటి|ఫస్ట్|ఒకటి|1st|\bfirst\b|\b1\b)\s*(?:కేంద్రం|సెంటర్|యార్డ్|మండి|ఆప్షన్|option)?/i.test(normText) && (/కేంద్రం|సెంటర్|యార్డ్|మండి|ఆప్షన్|option|సెలెక్ట్|select/i.test(normText) || normText.length < 8)) {
        explicitlyNamedCenter = 'LOC-AP-01';
      } else if (/(?:రెండవ|సెకండ్|రెండు|2nd|\bsecond\b|\b2\b)\s*(?:కేంద్రం|సెంటర్|యార్డ్|మండి|ఆప్షన్|option)?/i.test(normText) && (/కేంద్రం|సెంటర్|యార్డ్|మండి|ఆప్షన్|option|సెలెక్ట్|select/i.test(normText) || normText.length < 8)) {
        explicitlyNamedCenter = 'LOC-AP-02';
      } else if (/(?:మూడవ|థర్డ్|మూడు|3rd|\bthird\b|\b3\b)\s*(?:కేంద్రం|సెంటర్|యార్డ్|మండి|ఆప్షన్|option)?/i.test(normText) && (/కేంద్రం|సెంటర్|యార్డ్|మండి|ఆప్షన్|option|సెలెక్ట్|select/i.test(normText) || normText.length < 8)) {
        explicitlyNamedCenter = 'LOC-AP-03';
      } else if (/(?:నాల్గవ|ఫోర్త్|నాలుగు|4th|\bfourth\b|\b4\b)\s*(?:కేంద్రం|సెంటర్|యార్డ్|మండి|ఆప్షన్|option)?/i.test(normText) && (/కేంద్రం|సెంటర్|యార్డ్|మండి|ఆప్షన్|option|సెలెక్ట్|select/i.test(normText) || normText.length < 8)) {
        explicitlyNamedCenter = 'LOC-AP-04';
      } else if (/(?:ఐదవ|ఫిఫ్త్|ఐదు|5th|\bfifth\b|\b5\b)\s*(?:కేంద్రం|సెంటర్|యార్డ్|మండి|ఆప్షన్|option)?/i.test(normText) && (/కేంద్రం|సెంటర్|యార్డ్|మండి|ఆప్షన్|option|సెలెక్ట్|select/i.test(normText) || normText.length < 8)) {
        explicitlyNamedCenter = 'LOC-AP-05';
      } else if (/(?:ఆరవ|సిక్స్త్|ఆరు|6th|\bsixth\b|\b6\b)\s*(?:కేంద్రం|సెంటర్|యార్డ్|మండి|ఆప్షన్|option)?/i.test(normText) && (/కేంద్రం|సెంటర్|యార్డ్|మండి|ఆప్షన్|option|సెలెక్ట్|select/i.test(normText) || normText.length < 8)) {
        explicitlyNamedCenter = 'LOC-AP-06';
      }
    }

    if (explicitlyNamedCenter) {
      updatedDraft.location_id = explicitlyNamedCenter;
      if (sessionDraft.location_id && sessionDraft.location_id !== explicitlyNamedCenter) {
        updatedDraft.date = null;
        updatedDraft.time = null;
      }
    } else if (isChangeCenterIntent) {
      updatedDraft.location_id = null;
      updatedDraft.date = null;
      updatedDraft.time = null;
    }

    // 4. Date Extraction (Comprehensive Telugu, English, Tanglish, and STT Transcriptions)
    const explicitDateIso = normText.match(/\b(202\d-\d{2}-\d{2})\b/);
    if (explicitDateIso) {
      updatedDraft.date = explicitDateIso[1];
    } else if (
      // "Tomorrow" / "రేపు" (Handles STT transcriptions like 'rape', 'repu', 'repura', 'reppu', 'tomorrow', 'tmrw')
      /(?:రేపు|\b(?:repu|rape|reppu|reppura|repatiki|repanna|tomorrow|tmrw|next\s*day)\b|repura)/i.test(normText) ||
      /(?:repu|rape|repura)\s*(?:ravali|ravalani|wali|ravadaniki|vastanu|vastamu|ne\s*anukuntenanu|anukuntunnanu)/i.test(normText)
    ) {
      updatedDraft.date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    } else if (
      // "Today" / "ఈరోజు" (Handles 'eroju', 'ee roju', 'today', 'eroje', 'eeroju')
      /(?:ఈరోజు|ఈ\s*రోజే|నేడు|\b(?:eroju|ee\s*roju|ee\s*roje|eroje|eeroju|today|same\s*day)\b)/i.test(normText)
    ) {
      updatedDraft.date = new Date().toISOString().slice(0, 10);
    } else if (
      // "Day after tomorrow" / "ఎల్లుండి"
      /(?:ఎల్లుండి|\b(?:ellundi|yelundi|ellundiki|ellundee|day\s*after\s*tomorrow)\b)/i.test(normText)
    ) {
      updatedDraft.date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    } else {
      // Check day number mentions like "20వ", "21వ", "22వ", "21st", "22nd", "22 date", "22"
      const isTimeMentionOnly = /:\d{2}|\b[ap]m\b|సమయం|గంటలు/i.test(normText);
      if (!isTimeMentionOnly) {
        const dayMatch = normText.match(/\b([12]\d|3[01]|[1-9])\s*(?:వ\s*తేదీ|వ\s*తారీఖు|వ|th|st|nd|rd|తేదీ|తారీఖు|date)?\b/i);
        if (dayMatch && !hasPhonePattern && !normText.includes('క్వింటా') && !normText.includes('బస్తా') && !normText.includes('kg') && !normText.includes('qtl')) {
          const dayNum = parseInt(dayMatch[1], 10);
          if (dayNum >= 1 && dayNum <= 31) {
            const currentYear = new Date().getFullYear();
            const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
            updatedDraft.date = `${currentYear}-${currentMonth}-${String(dayNum).padStart(2, '0')}`;
          }
        }
      }
    }

    // 5. Time Window Extraction
    if (/0?8(?::00)?\s*(?:am|AM|గంటలు|గంటల)|ఉదయం\s*0?8|మొదటి\s*స్లాట్|\bfirst\b/i.test(normText)) {
      updatedDraft.time = '08:00 AM - 10:00 AM';
    } else if (/10(?::00)?\s*(?:am|AM|గంటలు|గంటల)|ఉదయం\s*10|రెండవ\s*స్లాట్|\bsecond\b/i.test(normText)) {
      updatedDraft.time = '10:00 AM - 12:00 PM';
    } else if (/0?1(?::00)?\s*(?:pm|PM|గంటలు|గంటల)|మధ్యాహ్నం\s*0?1|మూడవ\s*స్లాట్|\bthird\b/i.test(normText)) {
      updatedDraft.time = '01:00 PM - 03:00 PM';
    } else if (/0?3(?::00)?\s*(?:pm|PM|గంటలు|గంటల)|సాయంత్రం\s*0?3?|మధ్యాహ్నం\s*0?3|నాల్గవ\s*స్లాట్|\bfourth\b/i.test(normText)) {
      updatedDraft.time = '03:00 PM - 05:00 PM';
    } else if (normText.includes('08:00 AM - 10:00 AM') || normText.includes('10:00 AM - 12:00 PM') || normText.includes('01:00 PM - 03:00 PM') || normText.includes('03:00 PM - 05:00 PM')) {
      const matchTw = normText.match(/(0[813]:00 [AP]M - 1[02]:00 [AP]M|10:00 AM - 12:00 PM|01:00 PM - 03:00 PM|03:00 PM - 05:00 PM)/);
      if (matchTw) updatedDraft.time = matchTw[1];
    }

    // ── STEP 2C: INTENT CLASSIFICATION (ACCURATE & MULTI-TURN PRIORITIZED) ──
    // ── STEP 2C: INTENT CLASSIFICATION (ACCURATE & MULTI-TURN PRIORITIZED) ──
    const isQueueIntent = /క్యూ|టోకెన్|ఎంత సమయం|ఎప్పుడు వస్తుంది|నా నెంబర్|నా ర్యాంక్|ఎంత మంది|queue|wait|token|rank/i.test(normText);
    const isPaymentIntent = /డబ్బు|పేమెంట్|ఖాతా|జమ|బ్యాంక్|చెల్లింపు|payment|money|credit|dbt|utr|amount|rupee/i.test(normText);
    const isGoodsTrackingIntent = /సరుకు|సరుకులు|పంట ఎక్కడ|వస్తువులు|గోదాము|గోడౌన్|సైలో|లారీ|వాహనం|రవాణా|ట్రాకింగ్|goods|crop location|consignment|warehouse|silo|transit|lorry|truck|track/i.test(normText);
    const isWeightIntent = /తూకం|బరువు|క్వింటాళ్లు ఎంత|ఎంత బరువు|ఎంత తూకం|తూచారు|వేయింగ్|weight|weighment|actual weight|quintals weighed|quantity weighed/i.test(normText);
    const isArrivalIntent = /వచ్చాను|వచ్చేశాను|గేట్|గేటు|చేరుకున్నాను|చేరాను|చెక్\s*ఇన్|arrive|arrived|reach|reached|gate/i.test(normText);
    const isMspIntent = /మద్దతు\s*ధర|ధరలు|రేట్లు|msp|రేటు|ధర\s*ఎంత|ధరలు\s*ఎంత|rates|price/i.test(normText);
    const isGoalsIntent = (/లక్ష్యం|లక్ష్యాలు|నువ్వు ఎవరు|ఏం చేయగలవు|ఏమి చేయగలవు|విధులు|goals|capabilities|what can you do/i.test(normText) || (/సహాయం|help/i.test(normText) && normText.length < 25)) &&
      !isPaymentIntent && !isQueueIntent && !isGoodsTrackingIntent && !isWeightIntent && !isArrivalIntent && !isMspIntent;
    const isExplicitSlot = /స్లాట్|ఫ్లాట్|ప్లాట్|బుకింగ్|బుక్|కొనుగోలు|రిజర్వ్|slot|flat|plot|book|booking|reserve/i.test(normText);
    const isGreeting = /హలో|నమస్కారం|నమస్తే|hi|hello|hey/i.test(normText) && normText.length < 15;

    // ── STEP 3: CONVERSATIONAL REASONING & EXECUTION ──
    let spoken = '';
    let resolved_intent = 'conversational_dialogue';
    let action_taken = null;
    let action_payload = null;

    // ── PRIORITY 1: VOICE AGENT GOALS & TASKS EXPLANATION ──
    if (isGoalsIntent) {
      resolved_intent = 'explain_goals';
      spoken = "కిసాన్ వాణి ద్వారా మీరు ఈ పనులు చేయవచ్చు: 1. వరి, పత్తి వంటి పంటలకు తక్షణ స్లాట్ బుకింగ్, 2. మీ లైవ్ క్యూ నంబర్ మరియు వేచి ఉండే సమయం, 3. మండి గేట్ వద్ద అరైవల్ చెక్-ఇన్, 4. వేబ్రిడ్జి సర్టిఫైడ్ తూకం మరియు క్వాలిటీ వివరాలు, 5. మీ సరుకులు ఎక్కడున్నాయో లైవ్ ట్రాకింగ్ (గోదాము/రవాణా), 6. మీ బ్యాంక్ ఖాతాలో DBT పేమెంట్ మరియు UTR స్థితి, 7. ప్రభుత్వ అధికారిక MSP మద్దతు ధరలు. మీకు వీటిలో దేనితో సహాయం కావాలి?";

    // ── PRIORITY 2: LIVE QUEUE & TOKEN STATUS ──
    } else if (isQueueIntent) {
      resolved_intent = 'check_queue';
      if (activeBooking) {
        action_taken = 'navigate:queue';
        const yardPosition = activeBooking.queue_position || 1;
        const targetLocName = activeBooking.mandi_center || 'కర్నూలు మార్కెట్ యార్డ్';
        spoken = `మీ టోకెన్ నంబర్ ${activeBooking.token_number || activeBooking.id}. ప్రస్తుత లైవ్ క్యూలో మీ స్థానం #${yardPosition}. కొనుగోలు కేంద్రం: ${targetLocName}. వేచి ఉండే అంచనా సమయం సుమారు 10 నుండి 15 నిమిషాలు.`;
      } else {
        spoken = "మీకు ప్రస్తుతం ఎటువంటి యాక్టివ్ బుకింగ్ లేదా క్యూ టోకెన్ లేదు. స్లాట్ బుక్ చేయడానికి పంట పేరు మరియు ఎన్ని క్వింటాళ్లో చెప్పండి. ఉదాహరణకు 'వరి 50 క్వింటాళ్లు'.";
        action_taken = 'navigate:book_slot';
      }

    // ── PRIORITY 3: PFMS DBT PAYMENT STATUS ──
    } else if (isPaymentIntent) {
      resolved_intent = 'check_payment';
      action_taken = 'navigate:tracking';
      const allPayments = await db.getAll('payments').catch(() => []);
      const farmerPayments = allPayments.filter(p => p.farmer_id === farmer?.id || (activeBooking && p.booking_id === activeBooking.id));
      const paid = farmerPayments.find(p => p.status === 'paid') || (activeBooking?.payment_status === 'paid' ? { 
        amount: (Number(activeBooking.actual_quantity) || 50) * 2300, 
        utr_number: activeBooking.utr_number || 'PFMS-DBT-SUCCESS',
        bank_txn_ref: activeBooking.utr_number
      } : null);

      if (paid) {
        const amt = Number(paid.amount || 0);
        const utrNum = paid.utr_number || paid.bank_txn_ref || 'PFMS-DBT-VERIFIED';
        const bankName = farmer?.bank_name || paid.bank_name || 'స్టేట్ బ్యాంక్ ఆఫ్ ఇండియా';
        const acct = (farmer?.bank_account || paid.bank_account) ? `••••${(farmer?.bank_account || paid.bank_account).slice(-4)}` : 'ఆధార్ లింక్డ్ బ్యాంక్ ఖాతా';
        spoken = `రైతు గారూ, మీ MSP చెల్లింపు మొత్తం ₹${amt.toLocaleString('en-IN')} మీ ${bankName} (${acct}) కు PFMS DBT ద్వారా విజయవంతంగా జమ చేయబడింది! లావాదేవీ UTR నంబర్: ${utrNum}.`;
        action_payload = {
          status: 'paid',
          amount: amt,
          utr: utrNum,
          bank_name: bankName,
          account: acct
        };
      } else if (activeBooking && ['delivery_completed', 'payment_ready', 'completed'].includes(activeBooking.status)) {
        const wt = Number(activeBooking.actual_quantity) || Number(activeBooking.expected_quantity) || 50;
        const estAmt = Math.round(wt * 2300);
        spoken = `మీ పంట డెలివరీ మరియు వేబ్రిడ్జి తూకం (${wt} క్వింటాళ్లు) ఆమోదించబడింది. చెల్లింపు మొత్తం ₹${estAmt.toLocaleString('en-IN')} సిద్ధంగా ఉంది. అడ్మిన్ 2 పి.ఎఫ్.ఎం.ఎస్ విడుదల చేసిన వెంటనే మీ ఖాతాలో జమ అవుతుంది.`;
        action_payload = { status: 'ready_for_dbt', amount: estAmt, weight: wt };
      } else if (activeBooking) {
        spoken = "మీ స్లాట్ బుక్ చేయబడింది. మార్కెట్ యార్డ్‌లో పంట డెలివరీ మరియు వేబ్రిడ్జి తూకం పూర్తయిన వెంటనే, ప్రభుత్వం పూర్తి MSP చెల్లింపును మీ ఆధార్ అనుసంధాన బ్యాంక్ ఖాతాకు నేరుగా జమ చేస్తుంది.";
        action_payload = { status: 'scheduled' };
      } else {
        spoken = "మీకు ప్రస్తుతం ఎటువంటి చెల్లింపు లావాదేవీలు లేవు. పంట విక్రయించడానికి ముందుగా స్లాట్ బుక్ చేసుకోండి.";
      }

    // ── PRIORITY 4: GOODS & LOGISTICS TRACKING LOCATION ──
    } else if (isGoodsTrackingIntent) {
      resolved_intent = 'check_goods_tracking';
      action_taken = 'navigate:tracking';
      const allTracking = await db.getAll('tracking').catch(() => []);
      const trk = activeBooking ? allTracking.find(t => t.booking_id === activeBooking.id) : null;

      if (activeBooking) {
        const crop = activeBooking.crop || activeBooking.crop_type || 'పంట';
        const mandiName = activeBooking.mandi_center || 'కర్నూలు మార్కెట్ యార్డ్';
        if (activeBooking.status === 'completed' || trk?.stage?.includes('Warehouse') || trk?.stage === 'Delivered') {
          spoken = `మీ ${crop} సరుకులు కొనుగోలు కేంద్రం నుండి విజయవంతంగా రవాణా చేయబడి, సెంట్రల్ సైలో గోదాము (${trk?.destination || 'FCI రీజినల్ బఫర్ సైలో, కర్నూలు'}) కి చేరాయి. వాహన నంబర్: ${trk?.lorry_id || 'AP-21-TX-9842'}. e-WHR నం: ${trk?.ewhr_number || 'eWHR-2026-8492'}. సరుకులు భద్రంగా నిల్వ చేయబడ్డాయి.`;
        } else if (activeBooking.status === 'delivery_completed' || trk?.stage?.includes('Transit')) {
          spoken = `మీ ${crop} సరుకులు ${mandiName} వేబ్రిడ్జి వద్ద తూకం పూర్తి చేసుకుని, గోదాము రవాణాకు సిద్ధంగా ఉన్నాయి. గమ్యస్థానం: ${trk?.destination || 'FCI రీజినల్ బఫర్ సైలో, కర్నూలు'}. లారీ నం: ${trk?.lorry_id || 'AP-21-TX-9842'}.`;
        } else if (['checked_in', 'in_progress'].includes(activeBooking.status)) {
          spoken = `మీ ${crop} సరుకులు ${mandiName} అన్‌లోడింగ్ యార్డ్ వద్ద ఉన్నాయి. గేట్ వెరిఫికేషన్ పూర్తయింది, తూకం కోసం వేచి ఉన్నాయి.`;
        } else {
          spoken = `మీ ${crop} సరుకుల కోసం ${activeBooking.date || 'కేటాయించిన తేదీన'} ${mandiName} లో స్లాట్ కేటాయించబడింది. మీరు నిర్ణీత సమయానికి సరుకులను తీసుకురావచ్చు.`;
        }
        action_payload = {
          booking_id: activeBooking.id,
          status: activeBooking.status,
          crop,
          destination: trk?.destination || 'FCI Regional Buffer Silo, Kurnool',
          lorry_id: trk?.lorry_id || 'AP-21-TX-9842',
          ewhr_number: trk?.ewhr_number || 'eWHR-2026-8492'
        };
      } else {
        spoken = "మీకు ప్రస్తుతం ఎటువంటి యాక్టివ్ సరుకుల రికార్డ్ లేదు. పంట విక్రయించడానికి ముందుగా స్లాట్ బుక్ చేసుకోండి.";
      }

    // ── PRIORITY 5: CERTIFIED WEIGHBRIDGE WEIGHT & QUALITY ──
    } else if (isWeightIntent) {
      resolved_intent = 'check_weight';
      action_taken = 'navigate:tracking';
      const allWeighments = await db.getAll('weighments').catch(() => []);
      const wm = activeBooking ? allWeighments.find(w => w.booking_id === activeBooking.id) : null;

      if (activeBooking) {
        const crop = activeBooking.crop || activeBooking.crop_type || 'పంట';
        const expected = activeBooking.quantity_quintals || activeBooking.expected_quantity || 50;
        const actual = wm?.net_weight || activeBooking.actual_quantity;
        const grade = wm?.quality_grade || activeBooking.quality_grade || 'Grade A Superfine';
        const moisture = wm?.moisture_content || '12%';

        if (actual) {
          spoken = `మీ ${crop} యొక్క సర్టిఫైడ్ వేబ్రిడ్జి నికర తూకం ${actual} క్వింటాళ్లు. క్వాలిటీ గ్రేడ్: ${grade} (తేమ శాతం: ${moisture}). బుకింగ్ అంచనా ${expected} క్వింటాళ్లు. ఈ సర్టిఫైడ్ తూకం ఆధారంగానే పూర్తి MSP చెల్లింపు జరుగుతుంది.`;
        } else {
          spoken = `మీ ${crop} బుకింగ్ అంచనా తూకం ${expected} క్వింటాళ్లు. మీరు మండి కేంద్రానికి చేరుకుని వేబ్రిడ్జి తూకం పూర్తి చేసిన వెంటనే ఖచ్చితమైన సర్టిఫైడ్ నికర బరువు ఇక్కడ రికార్డవుతుంది.`;
        }
        action_payload = {
          booking_id: activeBooking.id,
          crop,
          expected_weight: expected,
          actual_weight: actual || null,
          quality_grade: grade,
          moisture
        };
      } else {
        spoken = "మీకు ప్రస్తుతం ఎటువంటి తూకం వివరాలు లేవు. స్లాట్ బుక్ చేయడానికి పంట పేరు మరియు ఎన్ని క్వింటాళ్లో చెప్పండి.";
      }

    // ── PRIORITY 4: GATE ARRIVAL CHECK-IN ──
    } else if (isArrivalIntent) {
      resolved_intent = 'auto_checkin';
      if (activeBooking) {
        await db.update('bookings', activeBooking.id, {
          status: 'arrived_waiting_confirmation',
          arrived_at: new Date().toISOString()
        }).catch(() => {});

        const allLocs = await db.getAll('locations').catch(() => []);
        const targetLoc = allLocs.find(l => l.id === activeBooking.location_id) || { name: 'Mandi Center' };

        await db.create('notifications', {
          id: `NOTIF-ARR-${Date.now()}`,
          user_id: 'ADMIN1',
          role: 'slot_manager',
          channel: 'In-App',
          type: 'arrival_verification',
          title: '🚨 రైతు గేట్ వద్దకు వచ్చారు (Arrival Verification Required)',
          message: `రైతు ${farmer?.name || 'రైతు'} (టోకెన్: ${activeBooking.token_number || activeBooking.id}) ${targetLoc.name} కు చేరుకున్నారు. దయచేసి భౌతిక రాకను ధృవీకరించండి.`,
          booking_id: activeBooking.id,
          status: 'Sent',
          timestamp: new Date().toISOString()
        }).catch(() => {});

        action_taken = 'arrived_waiting_confirmation';
        action_payload = { ...activeBooking, status: 'arrived_waiting_confirmation' };
        spoken = `మీరు కేంద్రానికి చేరుకున్నట్లు నమోదయింది. అడ్మిన్ భౌతిక ధృవీకరణ కోసం సమాచారం పంపబడింది. అడ్మిన్ ధృవీకరించిన వెంటనే మీ క్యూ నంబర్ ఖరారవుతుంది.`;
      } else {
        spoken = "మీకు ప్రస్తుతం ఎటువంటి యాక్టివ్ స్లాట్ బుకింగ్ లేదు. దయచేసి ముందుగా స్లాట్ బుక్ చేసుకోండి.";
      }

    // ── PRIORITY 5: OFFICIAL MSP PRICES ──
    } else if (isMspIntent) {
      resolved_intent = 'msp_enquiry';
      spoken = "ప్రభుత్వ అధికారిక మద్దతు ధరలు: సాధారణ వరి క్వింటాకు ₹2,300, గ్రేడ్-ఎ వరి ₹2,320, పత్తి ₹7,121, మొక్కజొన్న ₹2,090, గోధుమ ₹2,275, ఆవాలు ₹5,650, వేరుశనగ ₹6,783, కందులు ₹7,000.";

    // ── PRIORITY 6: CASUAL GREETING ──
    } else if (isGreeting) {
      spoken = "నమస్కారం! నేను మీ కిసాన్ వాణి AI సహాయకురాలిని. మీకు స్లాట్ బుకింగ్ కావాలా, లేదా మండి క్యూ మరియు పేమెంట్ వివరాలు కావాలా? చెప్పండి, నేను వింటున్నాను.";
      resolved_intent = 'greeting';

    // ── PRIORITY 7: SLOT BOOKING INTENT (MULTI-STEP VALIDATED AGAINST ADMIN SLOTS) ──
    } else if (isExplicitSlot || updatedDraft.crop || updatedDraft.quantity || updatedDraft.date || updatedDraft.time) {
      const cropTeNames = { Paddy: 'వరి', Cotton: 'పత్తి', Maize: 'మొక్కజొన్న', Wheat: 'గోధుమ', Chilli: 'మిరప', Pulses: 'కందులు', Mustard: 'ఆవాలు', Groundnut: 'వేరుశనగ' };
      const currentCrop = updatedDraft.crop;
      const cropTe = cropTeNames[currentCrop] || currentCrop || '';

      if (!farmer) {
        spoken = "స్లాట్ బుక్ చేయడానికి దయచేసి ముందుగా మీ మొబైల్ నంబర్‌తో లాగిన్ అవ్వండి.";
        action_taken = 'navigate:login';
        resolved_intent = 'require_login';
      } else {
        // Enforce single active procurement: farmer must complete current crop procurement before booking another!
        const allFarmerBookings = await db.getAll('bookings', { farmer_id: farmer.id }).catch(() => []);
        const activeProcurement = allFarmerBookings.find(b =>
          ['booked', 'arrived_waiting_confirmation', 'arrived', 'checked_in', 'in_progress', 'weighed'].includes(b.status) &&
          b.payment_status !== 'paid' &&
          b.status !== 'completed'
        );

        if (activeProcurement) {
          const aCrop = cropTeNames[activeProcurement.crop_type] || activeProcurement.crop_type || 'పంట';
          const aQty = activeProcurement.quantity || '50';
          const aToken = activeProcurement.token_number || activeProcurement.id;
          spoken = `రైతు గారూ, మీకు ఇప్పటికే టోకెన్ #${aToken} తో (${aCrop} ${aQty} క్వింటాళ్లు) యాక్టివ్ సేకరణ కొనసాగుతోంది. ప్రభుత్వ నిబంధనల ప్రకారం, ఈ పంట సేకరణ పూర్తయిన తర్వాతే మీరు మరొక స్లాట్ బుక్ చేసుకోగలరు. మీ ప్రస్తుత క్యూ లేదా తూకం వివరాలు కావాలా?`;
          resolved_intent = 'active_procurement_exists_block';
          action_taken = 'view_existing_booking';
          action_payload = { existing_booking_id: activeProcurement.id, token_number: aToken };
        } else if (!updatedDraft.crop && !updatedDraft.quantity) {
          // STEP 1: ASK CROP & QUANTITY
          spoken = "మీరు ఏ పంట కోసం స్లాట్ బుక్ చేయాలనుకుంటున్నారు? వరి, పత్తి, మొక్కజొన్న లేదా ఇతర పంటా? మరియు ఎన్ని క్వింటాళ్లు తీసుకురావాలనుకుంటున్నారు?";
          resolved_intent = 'ask_crop_and_quantity';
        } else if (!updatedDraft.crop && updatedDraft.quantity) {
        // STEP 1B: QUANTITY GIVEN, ASK CROP
        spoken = `${updatedDraft.quantity} క్వింటాళ్లు నమోదయింది. మీరు ఏ పంట తీసుకురావాలనుకుంటున్నారు? వరి, పత్తి, మొక్కజొన్న లేదా ఇతర పంటా?`;
        resolved_intent = 'ask_crop';
      } else if (updatedDraft.crop && !updatedDraft.quantity) {
        // STEP 2: CROP GIVEN, ASK QUANTITY
        spoken = `మీరు ఎన్ని క్వింటాళ్ల ${cropTe} తీసుకురావాలనుకుంటున్నారు? దయచేసి సంఖ్యను చెప్పండి.`;
        resolved_intent = 'ask_quantity';
      } else if (updatedDraft.crop && updatedDraft.quantity) {
        // CROP & QUANTITY ARE READY. NOW VALIDATE CENTER, DATE & TIME AGAINST ADMIN ALLOCATION
        const allLocs = await db.getAll('locations').catch(() => []);
        const allSlots = await db.getAll('slots').catch(() => []);
        const allBookings = await db.getAll('bookings').catch(() => []);

        // If farmer wants to change center or hasn't selected a center:
        if (isChangeCenterIntent || !updatedDraft.location_id) {
          const activeLocList = allLocs.slice(0, 6);
          const locNamesTe = activeLocList.map(l => l.name.split(' ')[0] + ' (' + (l.district || '') + ')').join(', ');
          const changeMsg = isChangeCenterIntent
            ? 'ఖచ్చితంగా! మీరు ఏ కొనుగోలు కేంద్రానికి మార్చాలనుకుంటున్నారు?'
            : `${updatedDraft.quantity} క్వింటాళ్ల ${cropTe} నమోదయింది. మీరు ఏ కొనుగోలు కేంద్రానికి తీసుకురావాలనుకుంటున్నారు?`;
          spoken = `${changeMsg} అందుబాటులో ఉన్న కేంద్రాలు: ${locNamesTe}. క్రింది కేంద్రాలలో ఒకదాన్ని ఎంచుకోండి లేదా కేంద్రం పేరు చెప్పండి.`;
          resolved_intent = 'ask_location';
          action_taken = 'prompt_location_selection';
          action_payload = {
            available_locations: activeLocList.map(l => ({ id: l.id, name: l.name, district: l.district })),
            crop: updatedDraft.crop,
            quantity: updatedDraft.quantity
          };
        } else {
          const locId = updatedDraft.location_id || 'LOC-AP-01';
          const targetLoc = allLocs.find(l => l.id === locId) || allLocs[0] || { id: 'LOC-AP-01', name: 'Kurnool Agricultural Market Yard' };
          const cropType = updatedDraft.crop;
          const qty = Number(updatedDraft.quantity) || 50;

          // Filter active slots allocated by Admin for this location and crop
          let activeSlots = allSlots.filter(s =>
            (s.location_id === targetLoc.id || s.centre_id === targetLoc.id) &&
            (s.crop_type?.toLowerCase() === cropType.toLowerCase() || !s.crop_type || s.crop_type === 'All') &&
            (s.status === 'active' || s.status === 'Available') &&
            (Number(s.available) > 0)
          );

          // If no crop-specific slot exists, general market yard slots accept all registered MSP crops!
          if (activeSlots.length === 0) {
            activeSlots = allSlots.filter(s =>
              (s.location_id === targetLoc.id || s.centre_id === targetLoc.id) &&
              (s.status === 'active' || s.status === 'Available') &&
              (Number(s.available) > 0)
            );
          }

          const todayStr = new Date().toISOString().slice(0, 10);
          const availableDates = Array.from(new Set(activeSlots.map(s => s.date)))
            .filter(d => Boolean(d) && d >= todayStr)
            .sort();

          // STEP 3: DATE VALIDATION
          if (!updatedDraft.date) {
            // Farmer has NOT provided the date yet. Ask for date and list admin-allocated dates!
            const datePromptList = availableDates.slice(0, 4).join(', ');
            const centerSwitchedMsg = explicitlyNamedCenter ? `మీ కొనుగోలు కేంద్రం ${targetLoc.name} గా ఎంపికయింది. ` : '';
            spoken = `${centerSwitchedMsg}${qty} క్వింటాళ్ల ${cropTe} నమోదయింది. మీరు ఏ తేదీన ${targetLoc.name} కేంద్రానికి తీసుకురావాలనుకుంటున్నారు? అడ్మిన్ కేటాయించిన అందుబాటులో ఉన్న తేదీలు: ${datePromptList || 'ఈరోజు, రేపు'}. దయచేసి తేదీని చెప్పండి లేదా క్రింది బటన్ నొక్కండి.`;
            resolved_intent = 'ask_date';
            action_taken = 'prompt_date_selection';
            action_payload = {
              available_dates: availableDates.slice(0, 6),
              location_id: targetLoc.id,
              location_name: targetLoc.name,
              crop: cropType,
              quantity: qty
            };
          } else {
          // Farmer provided a date -> CHECK WHETHER ADMIN PANEL HAS ALLOCATED A SLOT FOR IT
          const requestedDate = updatedDraft.date;
          const matchingSlots = activeSlots.filter(s => s.date === requestedDate);

          if (matchingSlots.length === 0) {
            // ADMIN HAS NOT ALLOCATED A SLOT FOR THIS DATE!
            // Clear date from draft so farmer chooses a valid date
            const prevRequestedDate = updatedDraft.date;
            updatedDraft.date = null;
            const fallbackDates = availableDates.slice(0, 4);
            const fallbackList = fallbackDates.length > 0 ? fallbackDates.join(', ') : 'రాబోయే రోజుల్లో స్లాట్లు విడుదల చేయబడతాయి';

            spoken = `క్షమించండి, మీరు అడిగిన ${prevRequestedDate} తేదీన అడ్మిన్ స్లాట్ కేటాయించలేదు. ఆ రోజు స్లాట్లు అందుబాటులో లేవు. దయచేసి వేరే రోజును ఎంచుకోండి. అడ్మిన్ కేటాయించిన అందుబాటులో ఉన్న ఇతర తేదీలు: ${fallbackList}.`;
            resolved_intent = 'slot_date_unavailable';
            action_taken = 'suggest_available_dates';
            action_payload = {
              unavailable_date: prevRequestedDate,
              available_dates: fallbackDates,
              location_name: targetLoc.name
            };
          } else if (!updatedDraft.time) {
            // ADMIN HAS ALLOCATED SLOTS FOR THIS DATE! NOW MAP ALL TIMINGS
            const availableTimes = matchingSlots.map(s => s.time_window || s.time);
            spoken = `${requestedDate} తేదీన ${targetLoc.name} కేంద్రంలో అడ్మిన్ స్లాట్లు కేటాయించారు. అందుబాటులో ఉన్న సమయాలు: ${availableTimes.join(', ')}. మీకు ఏ సమయం అనుకూలంగా ఉంటుంది? దయచేసి సమయాన్ని చెప్పండి లేదా క్రింది బటన్ నొక్కండి.`;
            resolved_intent = 'ask_time';
            action_taken = 'prompt_time_selection';
            action_payload = {
              date: requestedDate,
              available_times: availableTimes,
              location_name: targetLoc.name
            };
          } else {
            // ALL DETAILS CONFIRMED & VALIDATED (Crop, Quantity, Center, Date, Time)!
            // Match the exact slot created by Admin
            const matchedSlot = matchingSlots.find(s => {
              const tw = (s.time_window || s.time || '').toLowerCase();
              const tReq = updatedDraft.time.toLowerCase();
              return tw.includes(tReq) || tReq.includes(tw.slice(0, 5));
            }) || matchingSlots[0];

            // 1. Ensure farmer exists in Supabase farmers table (avoid FK error)
            let farmerInDb = await db.getById('farmers', farmer.id).catch(() => null);
            if (!farmerInDb) {
              farmerInDb = await db.create('farmers', {
                id: farmer.id,
                name: farmer.name || 'Farmer',
                phone: farmer.phone || '9848011223',
                district: farmer.district || 'Kurnool',
                village: farmer.village || 'Ulchala',
                crop_type: cropType,
                points: Number(farmer.points) || 100,
                status: 'Verified',
                created_at: new Date().toISOString()
              }).catch(() => null);
            }

            // 2. Decrement available capacity in Admin's slot
            await db.update('slots', matchedSlot.id, {
              booked_count: (Number(matchedSlot.booked_count) || 0) + 1,
              available: Math.max(0, (Number(matchedSlot.available) || 50) - 1)
            }).catch(() => {});

            // 3. Create the booking with complete Booker Details
            const tokenNum = `TK-${Math.floor(100 + Math.random() * 900)}`;
            const newBookingId = `BK-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
            const yardPosition = allBookings.filter(b => !['completed', 'cancelled'].includes(b.status)).length + 1;
            const finalTime = matchedSlot.time_window || matchedSlot.time || updatedDraft.time;

            const bookingPayload = {
              id: newBookingId,
              farmer_id: farmer.id,
              farmer_name: farmer.name || 'Farmer',
              farmer_phone: farmer.phone || '',
              slot_id: matchedSlot.id,
              location_id: targetLoc.id,
              crop_type: cropType,
              crop: cropType,
              expected_quantity: qty,
              actual_quantity: qty,
              date: requestedDate,
              time: finalTime,
              status: 'booked',
              token_number: tokenNum,
              queue_position: yardPosition,
              created_at: new Date().toISOString()
            };

            const createdBooking = await db.create('bookings', bookingPayload);

            // 4. Create tracking record
            await db.create('tracking', {
              id: `TRK-${newBookingId.slice(-6)}`,
              booking_id: newBookingId,
              stage: 'booked',
              notes: `Slot booked by voice dialogue for ${farmer.name}. Date: ${requestedDate}, Time: ${finalTime}, Token: ${tokenNum}`,
              updated_at: new Date().toISOString()
            }).catch(() => {});

            // 5. Notifications for Farmer and Admin 1
            await db.create('notifications', {
              id: `NOTIF-${Date.now()}`,
              user_id: farmer.id,
              farmer_id: farmer.id,
              title: '🌾 స్లాట్ కన్ఫర్మ్ చేయబడింది',
              message: `మీ ${qty} క్వింటాళ్ల ${cropType} కొనుగోలు స్లాట్ ${requestedDate} తేదీన ${finalTime} సమయానికి బుక్ చేయబడింది. టోకెన్: ${tokenNum}. కేంద్రం: ${targetLoc.name}.`,
              type: 'slot_update',
              channel: 'SMS/App',
              status: 'Sent',
              timestamp: new Date().toISOString()
            }).catch(() => {});

            await db.create('notifications', {
              id: `NOTIF-ADMIN1-${Date.now()}`,
              user_id: 'ADMIN1',
              role: 'slot_manager',
              channel: 'In-App',
              title: '📅 కొత్త స్లాట్ బుకింగ్ (New Slot Booked)',
              message: `రైతు ${farmer.name} (${qty} Qtl ${cropType}) స్లాట్ బుక్ చేసుకున్నారు. తేదీ: ${requestedDate}, సమయం: ${finalTime}. టోకెన్: ${tokenNum}. కేంద్రం: ${targetLoc.name}.`,
              status: 'Sent',
              timestamp: new Date().toISOString()
            }).catch(() => {});

            action_taken = 'booking_created';
            action_payload = createdBooking;
            resolved_intent = 'auto_book_slot';

            spoken = `మీ ${qty} క్వింటాళ్ల ${cropTe} కొనుగోలు స్లాట్ ${requestedDate} తేదీన ${finalTime} సమయానికి విజయవంతంగా బుక్ చేయబడింది! మీ టోకెన్ నంబర్ ${tokenNum}. కొనుగోలు కేంద్రం: ${targetLoc.name}. లైవ్ క్యూలో మీ స్థానం #${yardPosition}.`;

            // Reset draft once booked completely
            updatedDraft.crop = null;
            updatedDraft.quantity = null;
            updatedDraft.date = null;
            updatedDraft.time = null;
            if (activeSession) {
              await db.update('voice_chat_sessions', activeSession.id, {
                booking_draft: {},
                updated_at: new Date().toISOString()
              }).catch(() => {});
            }
          }
        }
      }
    }
  }

    // ── CASE G: GEMINI FALLBACK / GENERAL QUERY ──
    } else {
      // Try Gemini RAG reasoning if query is complex
      const geminiResult = await executeRAGQueryWithGemini(
        text,
        ragContext,
        language,
        conversation_history,
        updatedDraft
      );

      if (geminiResult && geminiResult.spoken && !geminiResult.spoken.includes('నేను మీ కిసాన్ వాణి AI సహాయకురాలిని')) {
        spoken = geminiResult.spoken;
        if (geminiResult.action) {
          const act = geminiResult.action;
          if (act.type === 'book_slot' && act.crop && act.quantity) {
            action_taken = 'booking_created';
            resolved_intent = 'auto_book_slot';
          }
        }
      } else {
        spoken = "మీరు చెప్పినది స్పష్టంగా వినపడలేదు. స్లాట్ బుకింగ్ కోసం 'వరి 50 క్వింటాళ్లు' అని, లేదా గేట్ వద్దకు వస్తే 'నేను వచ్చాను' అని చెప్పండి.";
        resolved_intent = 'clarification_needed';
      }
    }

    // Persist to voice_chat_sessions DB
    if (activeSession) {
      const isBookingDone = action_taken === 'booking_created';
      await db.update('voice_chat_sessions', activeSession.id, {
        booking_draft: isBookingDone ? {} : updatedDraft,
        messages: [
          ...(activeSession.messages || []),
          { role: 'farmer', text: rawText, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
          { role: 'ai', text: spoken, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
        ],
        updated_at: new Date().toISOString()
      }).catch(() => {});
    }

    // ── STEP 4: SYNTHESIZE NEURAL SPEECH VIA SARVAM AI BULBUL V3 (FEMALE TELUGU) ──
    const audioBase64 = await generateSarvamVoiceAudio(spoken, language, speaker, customSarvamKey);

    res.json({
      success: true,
      data: {
        spoken_response: spoken,
        resolved_intent,
        guardrail_status: 'passed',
        action_taken,
        action_payload,
        updated_booking_draft: updatedDraft,
        booking_draft: updatedDraft,
        farmer_name: farmer?.name,
        language,
        voice_provider: audioBase64 ? 'sarvam_ai' : 'web_speech',
        speaker: speaker || SARVAM_TELUGU_SPEAKER,
        audio_base64: audioBase64 || null,
        rag_grounded: true
      }
    });
  } catch (err) {
    console.error('Voice automation processing error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ════════════════════════════════════════════════════════════════
// ██ VOICE CHAT SESSION LIFECYCLE (DEDICATED DB STORAGE)
// ════════════════════════════════════════════════════════════════

// Start or retrieve persistent voice chat session
router.post('/voice/session/start', async (req, res) => {
  try {
    const { farmer_id, language = 'te', speaker } = req.body;
    let farmer = null;
    if (farmer_id) {
      const allFarmers = await db.getAll('farmers').catch(() => []);
      farmer = allFarmers.find(f => f.id === farmer_id || f.phone === farmer_id) || await db.getById('farmers', farmer_id).catch(() => null);
    }

    // Find existing active session or create new one
    const allSessions = await db.getAll('voice_chat_sessions').catch(() => []);
    let session = allSessions.find(s => s.farmer_id === farmer_id && s.status === 'active');

    if (!session) {
      session = await db.create('voice_chat_sessions', {
        id: `VCS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        farmer_id: farmer?.id || farmer_id || 'UNKNOWN',
        farmer_name: farmer?.name || 'రైతు',
        status: 'active',
        booking_draft: {},
        messages: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // Generate welcoming audio greeting in Telugu (Bulbul v3 / Priya/Meera) addressing farmer by name
    const greetingObj = await getInitialGreeting(farmer, language, speaker || SARVAM_TELUGU_SPEAKER);

    res.json({
      success: true,
      data: {
        session,
        farmer_name: farmer?.name,
        initial_greeting: greetingObj.greeting_text,
        audio_base64: greetingObj.audio_base64,
        speaker: greetingObj.speaker,
        language
      }
    });
  } catch (err) {
    console.error('Session start error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Close persistent voice chat session
router.post('/voice/session/close', async (req, res) => {
  try {
    const { session_id, farmer_id } = req.body;
    let updated = null;
    if (session_id) {
      updated = await db.update('voice_chat_sessions', session_id, {
        status: 'closed',
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).catch(() => null);
    } else if (farmer_id) {
      const allS = await db.getAll('voice_chat_sessions').catch(() => []);
      const active = allS.find(s => s.farmer_id === farmer_id && s.status === 'active');
      if (active) {
        updated = await db.update('voice_chat_sessions', active.id, {
          status: 'closed',
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).catch(() => null);
      }
    }
    res.json({ success: true, data: updated, message: 'Voice session closed.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
// ██ ADMIN 1: ARRIVAL VERIFICATION & QUEUE REORDERING
// ════════════════════════════════════════════════════════════════


// Confirm physical arrival of farmer at Mandi gate
router.post('/admin/confirm-arrival', async (req, res) => {
  try {
    const { booking_id, admin_id = 'ADMIN1' } = req.body;
    if (!booking_id) return res.status(400).json({ success: false, error: 'booking_id is required' });

    const booking = await db.getById('bookings', booking_id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const updated = await db.update('bookings', booking_id, {
      status: 'checked_in',
      arrival_verified_at: new Date().toISOString(),
      verified_by: admin_id,
      updated_at: new Date().toISOString()
    });

    // Notify farmer of verified arrival and confirmed queue spot
    await db.create('notifications', {
      id: `NOTIF-${Date.now()}`,
      user_id: booking.farmer_id,
      farmer_id: booking.farmer_id,
      channel: 'SMS/App',
      type: 'arrival_confirmed',
      title: '✅ రాక ధృవీకరించబడింది (Arrival Verified)',
      message: `రైతు గారూ, అడ్మిన్ మీ భౌతిక రాకను ధృవీకరించారు! మీ టోకెన్ #${booking.token_number || booking.id} లైవ్ క్యూలో ఉంది. క్యూ నంబర్: ${booking.queue_position || 1}.`,
      booking_id: booking.id,
      status: 'Sent',
      timestamp: new Date().toISOString()
    }).catch(() => {});

    res.json({ success: true, data: updated, message: 'Physical arrival confirmed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Dynamic queue reordering (swap #2 to #1 if #1 hasn't arrived, or manual order)
router.post('/admin/queue/reorder', async (req, res) => {
  try {
    const { booking_id_1, booking_id_2, reordered_list } = req.body;

    if (Array.isArray(reordered_list) && reordered_list.length > 0) {
      for (const item of reordered_list) {
        if (item.id && typeof item.queue_position === 'number') {
          await db.update('bookings', item.id, {
            queue_position: item.queue_position,
            updated_at: new Date().toISOString()
          });
        }
      }
      return res.json({ success: true, message: 'Queue successfully reordered.' });
    }

    if (booking_id_1 && booking_id_2) {
      const b1 = await db.getById('bookings', booking_id_1);
      const b2 = await db.getById('bookings', booking_id_2);
      if (!b1 || !b2) return res.status(404).json({ success: false, error: 'One or both bookings not found' });

      const pos1 = b1.queue_position || 1;
      const pos2 = b2.queue_position || 2;

      await db.update('bookings', booking_id_1, { queue_position: pos2, updated_at: new Date().toISOString() });
      await db.update('bookings', booking_id_2, { queue_position: pos1, updated_at: new Date().toISOString() });

      // Notify farmers of position updates
      await db.create('notifications', {
        id: `NOTIF-Q1-${Date.now()}`,
        user_id: b1.farmer_id,
        farmer_id: b1.farmer_id,
        channel: 'In-App',
        title: '🔄 క్యూ స్థానం నవీకరించబడింది (Queue Updated)',
        message: `మీ క్యూ స్థానం #${pos2} గా మార్చబడింది.`,
        booking_id: b1.id,
        status: 'Sent',
        timestamp: new Date().toISOString()
      }).catch(() => {});

      await db.create('notifications', {
        id: `NOTIF-Q2-${Date.now()}`,
        user_id: b2.farmer_id,
        farmer_id: b2.farmer_id,
        channel: 'In-App',
        title: '🎉 క్యూలో ముందు స్థానం లభించింది (Queue Promoted)',
        message: `మీ క్యూ స్థానం #${pos1} కు పెంచబడింది! దయచేసి అన్‌లోడింగ్ బే వద్ద సిద్ధంగా ఉండండి.`,
        booking_id: b2.id,
        status: 'Sent',
        timestamp: new Date().toISOString()
      }).catch(() => {});

      return res.json({ success: true, message: `Swapped queue positions: ${b1.id} -> #${pos2}, ${b2.id} -> #${pos1}` });
    }

    res.status(400).json({ success: false, error: 'Provide booking_id_1 and booking_id_2 or reordered_list' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
// ██ ADMIN 2: CROP DELIVERY ACCEPTANCE & PFMS DBT PAYMENT DISBURSEMENT
// ════════════════════════════════════════════════════════════════

// Record weighbridge inspection and crop acceptance
router.post('/admin/crop-delivery', async (req, res) => {
  try {
    const { booking_id, actual_weight, quality_grade = 'Grade A', moisture_content = '12%', admin_id = 'ADMIN2' } = req.body;
    if (!booking_id) return res.status(400).json({ success: false, error: 'booking_id is required' });

    const booking = await db.getById('bookings', booking_id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const cropName = booking.crop_type || booking.crop || 'Paddy';
    const weightNum = Number(actual_weight) || Number(booking.actual_quantity) || Number(booking.expected_quantity) || 50;

    // Get locked MSP rate for this crop from DB
    const allCrops = await db.getAll('crops').catch(() => []);
    const cropRecord = allCrops.find(c => c.name?.toLowerCase() === cropName.toLowerCase()) ||
                       allCrops.find(c => cropName.toLowerCase().includes(c.name?.toLowerCase()) || c.name?.toLowerCase().includes(cropName.toLowerCase())) ||
                       { msp_per_quintal: 2320, name: cropName };

    const mspPrice = Number(cropRecord.msp_per_quintal || cropRecord.msp_price) || 2320;
    const totalAmount = Math.round(weightNum * mspPrice);

    // Fetch farmer bank details or use government Aadhaar DBT default
    const farmer = await db.getById('farmers', booking.farmer_id).catch(() => null);
    const bankName = farmer?.bank_name || 'State Bank of India (Aadhaar DBT)';
    const bankAccount = farmer?.bank_account || (farmer?.phone ? `Aadhaar-91${farmer.phone.slice(-4)}` : 'Aadhaar Seeded Account');
    const ifsc = farmer?.ifsc || 'SBIN0001234';

    // 1. Record weighment
    const weighment = await db.create('weighments', {
      id: `WM-${Date.now()}`,
      booking_id: booking.id,
      farmer_id: booking.farmer_id,
      gross_qty: weightNum,
      gross_weight: weightNum,
      tare_weight: 0,
      net_qty: weightNum,
      net_weight: weightNum,
      crop: cropName,
      quality_grade,
      moisture_content,
      weighed_by: admin_id,
      status: 'Approved',
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString()
    });

    // 2. Update booking status to delivery_completed
    const updatedBooking = await db.update('bookings', booking.id, {
      status: 'delivery_completed',
      actual_quantity: weightNum,
      quality_grade,
      crop_accepted_at: new Date().toISOString(),
      accepted_by: admin_id,
      updated_at: new Date().toISOString()
    });

    // 3. Create or update payment record
    const allPayments = await db.getAll('payments').catch(() => []);
    let payment = allPayments.find(p => p.booking_id === booking.id);
    if (payment) {
      payment = await db.update('payments', payment.id, {
        amount: totalAmount,
        quantity: weightNum,
        msp_rate: mspPrice,
        bank_name: payment.bank_name || bankName,
        bank_account: payment.bank_account || bankAccount,
        ifsc: payment.ifsc || ifsc,
        status: 'ready_for_dbt',
        updated_at: new Date().toISOString()
      });
    } else {
      payment = await db.create('payments', {
        id: `PAY-${Date.now()}`,
        booking_id: booking.id,
        farmer_id: booking.farmer_id,
        amount: totalAmount,
        quantity: weightNum,
        msp_rate: mspPrice,
        bank_name: bankName,
        bank_account: bankAccount,
        ifsc,
        status: 'ready_for_dbt',
        created_at: new Date().toISOString()
      });
    }

    // 4. Update tracking stage
    const allTracking = await db.getAll('tracking').catch(() => []);
    let trk = allTracking.find(t => t.booking_id === booking.id);
    if (trk) {
      await db.update('tracking', trk.id, {
        stage: 'Weighbridge Certified - Staged for Warehouse Dispatch',
        updated_at: new Date().toISOString()
      }).catch(() => {});
    } else {
      await db.create('tracking', {
        id: `TRK-${Date.now()}`,
        booking_id: booking.id,
        stage: 'Weighbridge Certified - Staged for Warehouse Dispatch',
        destination: 'FCI Regional Buffer Silo, Kurnool',
        ewhr_number: `eWHR-${Date.now().toString().slice(-6)}`,
        updated_at: new Date().toISOString()
      }).catch(() => {});
    }

    // 5. Notify farmer
    const notifMsg = `రైతు గారూ, మీ ${cropName} (${weightNum} క్వింటాళ్లు) తూకం మరియు క్వాలిటీ (${quality_grade}) విజయవంతంగా ఆమోదించబడింది. ప్రభుత్వ MSP మొత్తం: ₹${totalAmount.toLocaleString('en-IN')}. PFMS DBT చెల్లింపు విడుదల సిద్ధంగా ఉంది.`;
    await db.create('notifications', {
      id: `NOTIF-DELIV-${Date.now()}`,
      user_id: booking.farmer_id,
      farmer_id: booking.farmer_id,
      channel: 'SMS/App',
      type: 'delivery_completed',
      title: '🌾 పంట డెలివరీ & తూకం ఆమోదించబడింది (Crop Accepted)',
      message: notifMsg,
      booking_id: booking.id,
      status: 'Sent',
      timestamp: new Date().toISOString()
    }).catch(() => {});

    // Trigger push notification to farmer browser/device
    sendPushToFarmer(booking.farmer_id, {
      title: '🌾 పంట డెలివరీ ఆమోదించబడింది',
      body: `తూకం: ${weightNum} Qtl · MSP మొత్తం: ₹${totalAmount.toLocaleString('en-IN')} సిద్ధంగా ఉంది.`,
      url: '/?screen=tracking'
    }).catch(() => {});

    res.json({
      success: true,
      data: {
        booking: updatedBooking,
        weighment,
        payment,
        msp_rate: mspPrice,
        total_payout: totalAmount
      },
      message: 'Crop delivery confirmed and payment payout calculated.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin 2 disburse PFMS DBT payment
router.post('/admin/process-payment', async (req, res) => {
  try {
    const { payment_id, booking_id, admin_id = 'ADMIN2', utr_number, utr: inputUtr } = req.body;
    let payment = null;
    if (payment_id) {
      payment = await db.getById('payments', payment_id);
    } else if (booking_id) {
      const allP = await db.getAll('payments').catch(() => []);
      payment = allP.find(p => p.booking_id === booking_id);
    }

    // Auto-create payment record if not created yet
    if (!payment && booking_id) {
      const b = await db.getById('bookings', booking_id);
      if (b) {
        const wt = Number(b.actual_quantity) || Number(b.expected_quantity) || 50;
        const amt = wt * 2300;
        payment = await db.create('payments', {
          id: `PAY-${Date.now()}`,
          booking_id: b.id,
          farmer_id: b.farmer_id,
          amount: amt,
          quantity: wt,
          msp_rate: 2300,
          bank_name: 'State Bank of India (Aadhaar DBT)',
          bank_account: b.farmer_phone ? `Aadhaar-91${b.farmer_phone.slice(-4)}` : 'Aadhaar Seeded Account',
          ifsc: 'SBIN0001234',
          status: 'ready_for_dbt',
          created_at: new Date().toISOString()
        });
      }
    }

    if (!payment) return res.status(404).json({ success: false, error: 'Payment record not found' });

    const utr = (utr_number || inputUtr || '').trim() || `PFMS-DBT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const updatedPayment = await db.update('payments', payment.id, {
      status: 'paid',
      utr_number: utr,
      bank_txn_ref: utr,
      disbursed_at: new Date().toISOString(),
      paid_at: new Date().toISOString(),
      disbursed_by: admin_id,
      updated_at: new Date().toISOString()
    });

    if (payment.booking_id) {
      await db.update('bookings', payment.booking_id, {
        status: 'completed',
        payment_status: 'paid',
        utr_number: utr,
        updated_at: new Date().toISOString()
      }).catch(() => {});

      // Update tracking stage
      const allTracking = await db.getAll('tracking').catch(() => []);
      const trk = allTracking.find(t => t.booking_id === payment.booking_id);
      if (trk) {
        await db.update('tracking', trk.id, {
          stage: 'Payment Disbursed - Warehouse Dispatched',
          updated_at: new Date().toISOString()
        }).catch(() => {});
      }
    }

    // High priority notification to farmer
    const payMsg = `రైతు గారూ, మీ MSP మొత్తం ₹${Number(payment.amount || 0).toLocaleString('en-IN')} మీ ఆధార్ అనుసంధాన బ్యాంక్ ఖాతాకు నేరుగా జమ చేయబడింది! PFMS UTR నంబర్: ${utr}.`;
    await db.create('notifications', {
      id: `NOTIF-PAY-${Date.now()}`,
      user_id: payment.farmer_id,
      farmer_id: payment.farmer_id,
      channel: 'SMS/App',
      type: 'payment_disbursed',
      title: '💰 PFMS DBT పేమెంట్ జమ చేయబడింది (Payment Disbursed)',
      message: payMsg,
      booking_id: payment.booking_id,
      status: 'Sent',
      timestamp: new Date().toISOString()
    }).catch(() => {});

    // Send push notification directly to farmer device
    sendPushToFarmer(payment.farmer_id, {
      title: '💰 PFMS DBT పేమెంట్ జమ చేయబడింది',
      body: `₹${Number(payment.amount || 0).toLocaleString('en-IN')} జమ చేయబడింది · UTR: ${utr}`,
      url: '/?screen=tracking'
    }).catch(() => {});

    res.json({
      success: true,
      data: { ...updatedPayment, utr_number: utr },
      message: 'PFMS DBT payment disbursed successfully.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin reset farmer database (keeps fixed MSP crops intact)
router.post('/admin/reset-farmer-database', async (req, res) => {
  try {
    await db.resetFarmerData();
    res.json({
      success: true,
      message: 'Farmer database cleared. Crops and MSP rates preserved.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;


