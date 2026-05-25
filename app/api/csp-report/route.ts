import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const report = await request.json()

    console.warn('[CSP Violation]', JSON.stringify(report, null, 2))

    if (process.env.CSP_REPORT_WEBHOOK_URL) {
      fetch(process.env.CSP_REPORT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true })
}
