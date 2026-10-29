import { NextResponse } from 'next/server';
import { getAllInvoiceItems, createSingleInvoiceItem } from '@/lib/invoice-service';
import { singleInvoiceItemCreateSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const items = await getAllInvoiceItems();
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error('GET /api/invoice-items error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch invoice items' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const validation = singleInvoiceItemCreateSchema.safeParse(body);

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

    const result = await createSingleInvoiceItem(validation.data);
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    console.error('POST /api/invoice-items error:', error);
    const status = error.statusCode || 400;
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to add item to invoice' },
      { status }
    );
  }
}

