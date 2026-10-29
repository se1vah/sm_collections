import { NextResponse } from 'next/server';
import { getItemById, updateItem, deleteItem } from '@/lib/inventory-service';
import { itemUpdateSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const item = await getItemById(id);
    if (!item) {
      return NextResponse.json(
        { success: false, error: `Item with ID ${id} not found` },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error(`GET /api/items/${params?.id} error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch item' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const validation = itemUpdateSchema.safeParse(body);

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

    const updated = await updateItem(id, validation.data);
    return NextResponse.json({
      success: true,
      message: 'Item updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error(`PUT /api/items/${params?.id} error:`, error);
    const status = error.statusCode || 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update item' },
      { status }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const result = await deleteItem(id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error(`DELETE /api/items/${params?.id} error:`, error);
    const status = error.statusCode || 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete item' },
      { status }
    );
  }
}

