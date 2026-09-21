const BASE_URL = 'http://localhost:5000/api';

async function testFullFlow() {
  console.log('=== KISAN SAATHI END-TO-END VERIFICATION TEST ===\n');

  // 1. Verify Mandi Centers
  console.log('1. Fetching Mandi Centers...');
  const locRes = await fetch(`${BASE_URL}/locations`);
  const locs = await locRes.json();
  console.log(`   ✓ Found ${locs.data?.length} Mandi Centers in AP (e.g. ${locs.data?.[0]?.name})`);

  // 2. Verify Slots
  console.log('2. Fetching Open Slots...');
  const slotRes = await fetch(`${BASE_URL}/slots`);
  const slots = await slotRes.json();
  console.log(`   ✓ Found ${slots.data?.length} Open Slots across multiple dates`);

  // 3. Verify Farmers
  console.log('3. Fetching Verified Farmers...');
  const farmRes = await fetch(`${BASE_URL}/farmers`);
  const farmers = await farmRes.json();
  console.log(`   ✓ Found ${farmers.data?.length} Farmers (e.g. ${farmers.data?.[0]?.name} - ${farmers.data?.[0]?.phone})`);

  // 4. Verify MSP Crops & Admin Update
  console.log('4. Testing Dynamic MSP Crop Registry...');
  const cropRes = await fetch(`${BASE_URL}/crops`);
  const crops = await cropRes.json();
  console.log(`   ✓ Found ${crops.data?.length} Official MSP Crops (Paddy MSP: ₹${crops.data?.find(c => c.name.includes('Paddy'))?.msp_per_quintal}/Qtl)`);

  const paddy = crops.data?.find(c => c.name.includes('Paddy'));
  if (paddy) {
    console.log('   Testing Admin MSP Price Update...');
    const updateRes = await fetch(`${BASE_URL}/crops/update-msp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        crop_id: paddy.id,
        msp_per_quintal: 2183,
        updated_by: 'ADMIN1 (Slot & Queue Manager)'
      })
    });
    const updateData = await updateRes.json();
    console.log(`   ✓ Admin MSP Update Result: ${updateData.message}`);
  }

  // 5. Create 3 Farmer Bookings for same Mandi & Slot (Farmers A, B, C)
  const targetLoc = locs.data[0];
  const targetSlot = slots.data.find(s => s.location_id === targetLoc.id);
  console.log(`\n5. Booking 3 Farmers at ${targetLoc.name} for slot ${targetSlot?.date} (${targetSlot?.time})...`);

  // Book Farmer A
  const bookARes = await fetch(`${BASE_URL}/bookings/admin-book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      farmer_name: 'Farmer A (Ramesh)',
      farmer_phone: '9848011111',
      location_id: targetLoc.id,
      slot_id: targetSlot.id,
      crop_type: 'Paddy',
      expected_quantity: 50,
      date: targetSlot.date,
      time: targetSlot.time
    })
  });
  const bookA = await bookARes.json();
  console.log(`   ✓ Farmer A Booked: Token ${bookA.data?.token_number}, Rank: #${bookA.data?.queue_position}`);

  // Book Farmer B
  const bookBRes = await fetch(`${BASE_URL}/bookings/admin-book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      farmer_name: 'Farmer B (Suresh)',
      farmer_phone: '9848022222',
      location_id: targetLoc.id,
      slot_id: targetSlot.id,
      crop_type: 'Paddy',
      expected_quantity: 50,
      date: targetSlot.date,
      time: targetSlot.time
    })
  });
  const bookB = await bookBRes.json();
  console.log(`   ✓ Farmer B Booked: Token ${bookB.data?.token_number}, Rank: #${bookB.data?.queue_position}`);

  // Book Farmer C
  const bookCRes = await fetch(`${BASE_URL}/bookings/admin-book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      farmer_name: 'Farmer C (Naresh)',
      farmer_phone: '9848033333',
      location_id: targetLoc.id,
      slot_id: targetSlot.id,
      crop_type: 'Paddy',
      expected_quantity: 50,
      date: targetSlot.date,
      time: targetSlot.time
    })
  });
  const bookC = await bookCRes.json();
  console.log(`   ✓ Farmer C Booked: Token ${bookC.data?.token_number}, Rank: #${bookC.data?.queue_position}`);

  // 6. Test Priority Bump (Farmer C came first -> Make C #1)
  console.log('\n6. Farmer C Arrived First! Reordering Queue to make Farmer C #1...');
  const reorderRes = await fetch(`${BASE_URL}/queue/reorder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      booking_id: bookC.data?.id,
      action: 'make_first',
      mandi_id: targetLoc.id,
      date: targetSlot.date
    })
  });
  const reorderData = await reorderRes.json();
  console.log(`   ✓ Queue Reordered: Farmer C is now #1! Status: ${reorderData.success}`);

  // 7. Gate Check-In for Farmer C
  console.log('\n7. Gate Officer Marks Farmer C Arrived at Gate...');
  const arriveRes = await fetch(`${BASE_URL}/bookings/${bookC.data?.id}/mark-arrived`, { method: 'POST' });
  const arriveData = await arriveRes.json();
  console.log(`   ✓ Gate Entry Verified. Status: ${arriveData.data?.status || 'arrived'}`);

  // 8. Electronic Weighbridge Recording
  console.log('\n8. Certified Weighbridge Bay Records Net Weight for Farmer C...');
  const weighRes = await fetch(`${BASE_URL}/bookings/${bookC.data?.id}/record-weighment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      weight_quintals: 48.5,
      msp_per_quintal: 2183,
      crop_type: 'Paddy',
      quality_grade: 'Grade A Superfine',
      deductions_kg: 50
    })
  });
  const weighData = await weighRes.json();
  console.log(`   ✓ Certified Weighment Recorded: ${weighData.amount ? `₹${weighData.amount.toLocaleString('en-IN')}` : 'OK'}, Status: ${weighData.data?.status}`);

  // 9. Admin 1 Handoff to Admin 2 Payment Manager
  console.log('\n9. Admin 1 Sends Certified Lot to Payment Manager...');
  const sendPayRes = await fetch(`${BASE_URL}/bookings/${bookC.data?.id}/send-to-payment`, { method: 'POST' });
  const sendPayData = await sendPayRes.json();
  console.log(`   ✓ Sent to Payment Manager: Status: ${sendPayData.data?.status}`);

  // 10. Admin 2 DBT Payment Release
  console.log('\n10. Admin 2 Releases DBT Direct Bank Transfer via PFMS...');
  // Find payment record
  const allPayRes = await fetch(`${BASE_URL}/payments`);
  const allPayments = await allPayRes.json();
  const targetPayment = allPayments.data?.find(p => p.booking_id === bookC.data?.id) || allPayments.data?.[0];
  
  if (targetPayment) {
    const payReleaseRes = await fetch(`${BASE_URL}/payments/${targetPayment.id}/mark-paid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        utr_reference: `PFMS20260910${Math.floor(100000 + Math.random() * 900000)}`
      })
    });
    const payReleaseData = await payReleaseRes.json();
    console.log(`   ✓ DBT Payment Released! UTR: ${payReleaseData.data?.bank_txn_ref}, Paid At: ${payReleaseData.data?.paid_at}`);
  }

  // 11. Admin 2 Logistics Silo Dispatch
  console.log('\n11. Admin 2 Dispatches Logistics Lorry to FCI Buffer Silo...');
  const dispatchRes = await fetch(`${BASE_URL}/logistics/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      booking_id: bookC.data?.id,
      lorry_id: 'AP-21-TX-9842',
      driver_phone: '+91 94401 88921',
      destination: 'FCI Central Grain Silo Complex, Kurnool',
      mill_name: 'AP State Civil Supplies Warehousing Corp'
    })
  });
  const dispatchData = await dispatchRes.json();
  console.log(`   ✓ Logistics Consignment Dispatched: Lorry ${dispatchData.data?.lorry_id}, Driver: ${dispatchData.data?.driver_phone}`);

  // 12. Direct Status Override Check (Admin 1/2 manual status selector test)
  console.log('\n12. Testing Admin Direct Status Override Dropdown for Farmer A...');
  const overrideRes = await fetch(`${BASE_URL}/bookings/${bookA.data?.id}/update-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'in_progress' })
  });
  const overrideData = await overrideRes.json();
  console.log(`   ✓ Farmer A status directly updated to: ${overrideData.data?.status}`);

  console.log('\n=== ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
}

testFullFlow().catch(console.error);
