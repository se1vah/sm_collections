import { NextResponse } from 'next/server';
import { getAllInvoices, createInvoice } from '@/lib/invoice-service';
import { invoiceCreateSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const date = searchParams.get('date') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    const invoices = await getAllInvoices({ search, date, startDate, endDate });
    return NextResponse.json({ success: true, data: invoices });
  } catch (error) {
    console.error('GET /api/invoices error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const validation = invoiceCreateSchema.safeParse(body);

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

    const result = await createInvoice(validation.data);
    return NextResponse.json(
      { success: true, ...result },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/invoices error:', error);
    const status = error.statusCode || 400;
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create invoice' },
      { status }
    );
  }
}

