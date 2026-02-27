// 測試防重複請假腳本
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// We compile TS to JS logic on the fly or just rewrite the checker in JS for the test
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLeaveConflictsJs(userId, requestedDays) {
    if (!requestedDays || requestedDays.length === 0) return { success: true };

    const datesToCheck = requestedDays.map(d => d.date);

    // We only check for new-style single-day records for this test, 
    // or we check the start_date of existing records.
    const { data: existingLeaves, error } = await supabase
        .from('leaves')
        .select('start_date, end_date, days, status')
        .eq('user_id', userId)
        .in('status', ['pending', 'approved']);

    if (error) {
        return { success: false, error: 'DB Error' };
    }

    const existingDaysMap = {};
    if (existingLeaves) {
        for (const l of existingLeaves) {
            // For old multi-day records, we'd have to expand them. 
            // For new single-day, start_date === end_date. 
            // We expand them all just to be perfectly backward compatible!
            const start = new Date(l.start_date);
            const end = new Date(l.end_date);
            const dailyVal = Number(l.days) / (Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1); // rough distribution

            let cur = new Date(start);
            while (cur <= end) {
                const dateStr = cur.toISOString().split('T')[0];
                existingDaysMap[dateStr] = (existingDaysMap[dateStr] || 0) + dailyVal;
                cur.setDate(cur.getDate() + 1);
            }
        }
    }

    // Now check requested vs existing
    for (const req of requestedDays) {
        const existing = existingDaysMap[req.date] || 0;
        const total = existing + req.days;
        if (total > 1.0) {
            return {
                success: false,
                error: `日期 ${req.date} 已請 ${existing} 天，本次申請 ${req.days} 天，合計超過單日上限！`
            };
        }
    }

    return { success: true };
}

async function runTest() {
    console.log("=== Testing checkLeaveConflicts ===");

    // We need a test user. Let's find one.
    const { data: users } = await supabase.from('users').select('id').limit(1);
    if (!users || users.length === 0) {
        console.log("No users found to test.");
        return;
    }
    const testUserId = users[0].id;
    console.log(`Using Test User: ${testUserId}`);

    // Scenario 1: Clean day
    console.log("\\n[Test 1] Clean 0.5 Day Request...");
    const req1 = [{ date: '2026-10-10', days: 0.5 }];
    const res1 = await checkLeaveConflictsJs(testUserId, req1);
    console.log("Result 1:", res1);

    // Let's manually insert a 0.5 day leaf for this user on 2026-10-10 to test conflict
    await supabase.from('leaves').insert({
        user_id: testUserId,
        leave_type: 'personal_leave',
        start_date: '2026-10-10',
        end_date: '2026-10-10',
        days: 0.5,
        hours: 4.0,
        reason: 'Test half day',
        status: 'approved'
    });

    // Scenario 2: Another 0.5 day on the same date (SHOULD PASS)
    console.log("\\n[Test 2] Another 0.5 Day Request on same date (Should Pass)...");
    const req2 = [{ date: '2026-10-10', days: 0.5 }];
    const res2 = await checkLeaveConflictsJs(testUserId, req2);
    console.log("Result 2:", res2);

    // Scenario 3: Another 1.0 day on the same date (SHOULD FAIL)
    console.log("\\n[Test 3] Requesting 1.0 Day on same date (Should Fail)...");
    const req3 = [{ date: '2026-10-10', days: 1.0 }];
    const res3 = await checkLeaveConflictsJs(testUserId, req3);
    console.log("Result 3:", res3);

    // Cleanup test data
    await supabase.from('leaves').delete().eq('user_id', testUserId).eq('start_date', '2026-10-10');
    console.log("\\nCleanup complete.");
}

runTest();
