import { NextResponse } from 'next/server';
import { getInvoiceById, updateInvoice, deleteInvoice } from '@/lib/invoice-service';
import { invoiceUpdateSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const invoice = await getInvoiceById(id);
    if (!invoice) {
      return NextResponse.json(
        { success: false, error: `Invoice #${id} not found` },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    console.error(`GET /api/invoices/${params?.id} error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch invoice' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const validation = invoiceUpdateSchema.safeParse(body);

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

    const result = await updateInvoice(id, validation.data);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error(`PUT /api/invoices/${params?.id} error:`, error);
    const status = error.statusCode || 400;
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update invoice' },
      { status }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const result = await deleteInvoice(id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error(`DELETE /api/invoices/${params?.id} error:`, error);
    const status = error.statusCode || 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete invoice' },
      { status }
    );
  }
}

