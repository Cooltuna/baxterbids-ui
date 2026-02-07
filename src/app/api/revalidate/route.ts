import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function POST(request: NextRequest) {
  try {
    // Verify the webhook secret
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.REVALIDATE_TOKEN || 'baxterbids-webhook-secret';
    
    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the source from request body (optional)
    let source = 'manual';
    try {
      const body = await request.json();
      source = body.source || 'manual';
    } catch {
      // No body is fine
    }

    // Revalidate the main page and API routes
    revalidatePath('/');
    revalidatePath('/api/bids');
    revalidatePath('/api/rfqs');

    console.log(`[Revalidate] Triggered by: ${source} at ${new Date().toISOString()}`);

    return NextResponse.json({
      success: true,
      message: 'Revalidation triggered',
      source,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Revalidation error:', error);
    return NextResponse.json(
      { success: false, error: 'Revalidation failed' },
      { status: 500 }
    );
  }
}

// Also support GET for easy testing
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const expectedToken = process.env.REVALIDATE_TOKEN || 'baxterbids-webhook-secret';
  
  if (token !== expectedToken) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized - provide ?token=YOUR_TOKEN' },
      { status: 401 }
    );
  }

  revalidatePath('/');
  revalidatePath('/api/bids');
  revalidatePath('/api/rfqs');

  return NextResponse.json({
    success: true,
    message: 'Revalidation triggered via GET',
    timestamp: new Date().toISOString(),
  });
}
