import { NextResponse } from 'next/server';
import { getItems, createItem, getNextSuggestedItemId } from '@/lib/inventory-service';
import { itemSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    if (searchParams.get('suggestNextId') === 'true') {
      const nextId = await getNextSuggestedItemId();
      return NextResponse.json({ success: true, nextId });
    }

    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '50';

    const result = await getItems({ search, category, page, limit });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('GET /api/items error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch items' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
    const validation = itemSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const created = await createItem(validation.data);
    return NextResponse.json(
      { success: true, message: 'Item created successfully', data: created },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/items error:', error);
    const isDup = error.isDuplicate || error.code === 'ER_DUP_ENTRY' || error.errno === 1062;
    const status = isDup ? 409 : (error.statusCode || 500);
    const message = isDup
      ? (error.message || `Item ID #${body?.ItemID} already exists. Please choose a different unique Item ID.`)
      : (error.message || 'Failed to create item');

    return NextResponse.json(
      { success: false, error: message, isDuplicate: isDup },
      { status }
    );
  }
}
