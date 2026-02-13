import { determineAttendanceStatus } from '../utils/attendance-calculations'

function testStatus() {
    console.log('--- Testing Attendance Status Logic ---')

    const workStart = '09:00:00'
    const workEnd = '18:00:00'

    const cases = [
        { in: '09:00:00', out: '18:00:00', expected: 'normal' },
        { in: '09:00:01', out: '18:00:00', expected: 'late' },
        { in: '08:59:59', out: '18:00:00', expected: 'normal' },
        { in: '09:30:00', out: '18:00:00', expected: 'late' },
        { in: '09:00:00', out: '17:59:59', expected: 'early_leave' },
        { in: '09:30:00', out: '17:59:59', expected: 'late early_leave' },
        { in: '08:30:00', out: null, expected: 'normal' }, // Checking logic for no clock out
        { in: '09:30:00', out: null, expected: 'late' },
    ]

    cases.forEach(c => {
        const result = determineAttendanceStatus(c.in, c.out, workStart, workEnd)
        const pass = result === c.expected
        console.log(`[${pass ? 'PASS' : 'FAIL'}] In: ${c.in}, Out: ${c.out} -> ${result} (Exp: ${c.expected})`)
    })

    // Simulate Timezone Conversion
    console.log('\n--- Testing Timezone Conversion Simulation ---')
    const utcClockIn = '2026-02-13T00:50:00.000Z' // 08:50 Taipei
    const converted = new Date(utcClockIn).toLocaleTimeString('en-GB', { timeZone: 'Asia/Taipei', hour12: false })
    console.log(`UTC: ${utcClockIn} -> Taipei: ${converted}`)

    // Test logic with converted
    const status = determineAttendanceStatus(converted, null, workStart, workEnd)
    console.log(`Status for 08:50: ${status}`)
}

testStatus()
