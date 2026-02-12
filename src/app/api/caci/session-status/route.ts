import { NextResponse } from 'next/server';

const API_URL = process.env.BAXTERBIDS_API_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const res = await fetch(`${API_URL}/caci/session-status`, {
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({
      valid: false,
      message: `Failed to connect to API server: ${error instanceof Error ? error.message : 'Unknown error'}`,
      cookieCount: 0
    });
  }
}
