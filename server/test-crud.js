import { db } from './db.js';

const entities = [
  'farmers',
  'crops',
  'centres',
  'slots',
  'bookings',
  'weighments',
  'payments',
  'logistics',
  'notifications',
  'voiceSessions'
];

async function runAudit() {
  console.log('🧪 Starting Full CRUD Audit & Verification for Kisan Saathi with Supabase...\n');

  let totalPassed = 0;
  let totalTested = 0;

  for (const col of entities) {
    console.log(`--- Testing CRUD for Entity: [${col}] ---`);

    // 1. READ ALL
    const initial = await db.getAll(col);
    console.log(`  [READ ALL] ${col} initial count: ${initial.length}`);

    // 2. CREATE (use proper dummy data with valid foreign keys)
    let testPayload = {
      name: `Test ${col}`
    };

    if (col === 'farmers') {
      testPayload = { id: `FARM-TEST-${Date.now()}`, name: 'Test Farmer', phone: '9999999999', district: 'Test District' };
    } else if (col === 'crops') {
      testPayload = { id: `CROP-TEST-${Date.now()}`, name: 'Test Crop', season: 'Kharif', msp_per_quintal: 2500 };
    } else if (col === 'centres') {
      testPayload = { id: `CEN-TEST-${Date.now()}`, name: 'Test Centre', district: 'Test District' };
    } else if (col === 'slots') {
      const existingCentres = await db.getAll('centres');
      const centreId = existingCentres[0]?.id || 'CENTRE-101';
      testPayload = { id: `SLOT-TEST-${Date.now()}`, centre_id: centreId, date: '2026-09-06', time_window: '09:00 AM', max_capacity: 100, status: 'Available' };
    } else if (col === 'bookings') {
      const [existingFarmers, existingSlots] = await Promise.all([db.getAll('farmers'), db.getAll('slots')]);
      testPayload = { id: `BKG-TEST-${Date.now()}`, farmer_id: existingFarmers[0]?.id || 'FARM-8044', slot_id: existingSlots[0]?.id || 'SLOT-20260907-101-M1', expected_quantity: 50, token_number: 'TK-TEST', status: 'booked' };
    } else if (col === 'weighments') {
      const existingBookings = await db.getAll('bookings');
      testPayload = { id: `WGH-TEST-${Date.now()}`, booking_id: existingBookings[0]?.id || 'BK-1788806601094', gross_qty: 50, bag_count: 100, net_qty: 49.5, quality_grade: 'Grade A' };
    } else if (col === 'payments') {
      const existingBookings = await db.getAll('bookings');
      testPayload = { id: `PAY-TEST-${Date.now()}`, booking_id: existingBookings[0]?.id || 'BK-1788806601094', amount: 50000, status: 'pending' };
    } else if (col === 'logistics') {
      const existingWeighments = await db.getAll('weighments');
      testPayload = { id: `LOG-TEST-${Date.now()}`, weighment_id: existingWeighments[0]?.id || 'WGH-TEST', lorry_id: 'TEST-01' };
    } else if (col === 'notifications') {
      testPayload = { id: `NOTIF-TEST-${Date.now()}`, user_id: 'FARM-8044', message: 'Test Notification', status: 'Sent' };
    } else if (col === 'voiceSessions') {
      testPayload = { id: `VOICE-TEST-${Date.now()}`, transcript: 'Test audio query' };
    }

    const created = await db.create(col, testPayload);
    totalTested++;
    if (created && created.id) {
      console.log(`  [CREATE] Success -> Created ID: ${created.id}`);
      totalPassed++;
    } else {
      console.error(`  [CREATE] Failed for ${col}`);
    }

    // 3. READ ONE
    const fetched = await db.getById(col, created.id);
    totalTested++;
    if (fetched && fetched.id === created.id) {
      console.log(`  [READ ONE] Success -> Fetched ID: ${fetched.id}`);
      totalPassed++;
    } else {
      console.error(`  [READ ONE] Failed for ${col}`);
    }

    // 4. UPDATE (test updating a field appropriate for the entity)
    const updateField = (col === 'bookings' || col === 'payments') ? { status: 'tested' } 
      : (col === 'slots' ? { status: 'tested' }
      : (col === 'weighments' ? { quality_grade: 'Grade A+' } 
      : (col === 'logistics' ? { status: 'tested' } 
      : (col === 'notifications' ? { status: 'Read' } 
      : (col === 'voiceSessions' ? { transcript: 'Updated test query' } 
      : { name: `Updated ${col}` })))));
    const updated = await db.update(col, created.id, updateField);
    totalTested++;
    if (updated) {
      console.log(`  [UPDATE] Success -> Updated item ${created.id}`);
      totalPassed++;
    } else {
      console.error(`  [UPDATE] Failed for ${col}`);
    }

    // 5. DELETE
    const deleted = await db.delete(col, created.id);
    totalTested++;
    if (deleted) {
      console.log(`  [DELETE] Success -> Removed item ${created.id}`);
      totalPassed++;
    } else {
      console.error(`  [DELETE] Failed for ${col}`);
    }

    console.log('');
  }

  console.log('==========================================');
  console.log(`🎯 CRUD Verification Result: ${totalPassed} / ${totalTested} tests passed.`);
  if (totalPassed === totalTested) {
    console.log('✅ Exit Criteria Met: All 10 entities have 100% working Create, Read, Update, Delete CRUD operations in Supabase!');
  } else {
    console.error('❌ Exit Criteria Failed: Some CRUD operations failed.');
    process.exit(1);
  }
}

runAudit();
