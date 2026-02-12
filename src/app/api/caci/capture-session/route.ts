import { NextResponse } from 'next/server';

const API_URL = process.env.BAXTERBIDS_API_URL || 'http://localhost:8000';

export async function POST() {
  try {
    const res = await fetch(`${API_URL}/caci/capture-session`, {
      method: 'POST',
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `Failed to connect to API server: ${error instanceof Error ? error.message : 'Unknown error'}`,
      cookieCount: 0
    });
  }
}
