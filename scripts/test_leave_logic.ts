import { calculateEntitlement } from '../utils/annual_leave'

function runTest() {
    console.log('--- Testing Annual Leave Calculation ---')

    const today = new Date('2026-02-13') // Fixed date for testing

    const cases = [
        { label: 'Just Onboarded', onboard: '2026-01-01', expectedDays: 0, isGrant: false },
        { label: '6 Months Anniversary', onboard: '2025-08-13', expectedDays: 3, isGrant: true },
        { label: '1 Year Anniversary', onboard: '2025-02-13', expectedDays: 7, isGrant: true },
        { label: '2 Year Anniversary', onboard: '2024-02-13', expectedDays: 10, isGrant: true },
        { label: '3 Year Anniversary', onboard: '2023-02-13', expectedDays: 14, isGrant: true },
        { label: '10 Year Anniversary', onboard: '2016-02-13', expectedDays: 15, isGrant: true },
        { label: '11 Year Anniversary (15+1)', onboard: '2015-02-13', expectedDays: 16, isGrant: true },
        { label: '25 Year Anniversary (Max 30)', onboard: '2001-02-13', expectedDays: 30, isGrant: true },
        { label: 'Not Anniversary', onboard: '2025-02-12', expectedDays: 0, isGrant: false },
    ]

    let passed = 0
    let failed = 0

    cases.forEach(c => {
        const result = calculateEntitlement(new Date(c.onboard), today)
        const daysMatch = result.days === c.expectedDays
        const grantMatch = result.isGrantDate === c.isGrant

        if (daysMatch && grantMatch) {
            console.log(`[PASS] ${c.label}`)
            passed++
        } else {
            console.error(`[FAIL] ${c.label}`)
            console.error(`       Expected: days=${c.expectedDays}, grant=${c.isGrant}`)
            console.error(`       Actual:   days=${result.days}, grant=${result.isGrantDate}`)
            failed++
        }
    })

    console.log(`\nResult: ${passed} Passed, ${failed} Failed`)
    if (failed > 0) process.exit(1)
}

// Since utils/annual_leave imports supabase/server which might fail in standalone script if environment variables or module resolution isn't perfect,
// we might need to mock or run this within the Next.js context. 
// However, calculateEntitlement is pure function (except for date objects).
// Let's try running it. 

// Actually, `utils/annual_leave.ts` imports `server-only` things via `createClient`, usually next/headers.
// Running this with `ts-node` directly might crash if it tries to load the server components.
// We will rely on manual check logic inside the function if needed, but `calculateEntitlement` is exported.
// I will comment out the import in the test file if I were to copy-paste, but here I import it.
// If it fails due to imports, I will refactor `calculateEntitlement` to a separate pure file.

runTest()
