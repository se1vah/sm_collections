import { NextResponse } from 'next/server';
import {
  getInvoiceItemById,
  updateSingleInvoiceItem,
  deleteSingleInvoiceItem,
} from '@/lib/invoice-service';
import { singleInvoiceItemUpdateSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const item = await getInvoiceItemById(id);
    if (!item) {
      return NextResponse.json(
        { success: false, error: `Invoice item #${id} not found` },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error(`GET /api/invoice-items/${params?.id} error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch invoice item' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const validation = singleInvoiceItemUpdateSchema.safeParse(body);

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

    const result = await updateSingleInvoiceItem(id, validation.data);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error(`PUT /api/invoice-items/${params?.id} error:`, error);
    const status = error.statusCode || 400;
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update invoice item' },
      { status }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const result = await deleteSingleInvoiceItem(id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error(`DELETE /api/invoice-items/${params?.id} error:`, error);
    const status = error.statusCode || 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete invoice item' },
      { status }
    );
  }
}

