import { NextResponse } from 'next/server';
import { getInvoiceItemsByInvoiceId } from '@/lib/invoice-service';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const items = await getInvoiceItemsByInvoiceId(id);
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error(`GET /api/invoices/${params?.id}/items error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch invoice items' },
      { status: 500 }
    );
  }
}

