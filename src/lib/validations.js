import { z } from 'zod';

export const itemSchema = z.object({
  ItemID: z.coerce.number().int().positive({ message: 'Item ID must be a positive integer' }).max(Number.MAX_SAFE_INTEGER, { message: 'Item ID is too large' }),
  ItemName: z.string().trim().min(1, { message: 'Item Name is required' }).max(150, { message: 'Item Name cannot exceed 150 characters' }),
  Category: z.string().trim().max(100, { message: 'Category cannot exceed 100 characters' }).nullable().optional().default(''),
  Unit: z.enum(['Qty', 'Meter'], { errorMap: () => ({ message: "Unit must be either 'Qty' or 'Meter'" }) }),
  ActualPrice: z.coerce.number().min(0, { message: 'Actual Price must be greater than or equal to 0' }),
  SellingPrice: z.coerce.number().min(0, { message: 'Selling Price must be greater than or equal to 0' }),
  StockQuantity: z.coerce.number().min(0, { message: 'Stock Quantity cannot be negative' }),
});

export const itemUpdateSchema = z.object({
  ItemID: z.coerce.number().int().positive().optional(),
  ItemName: z.string().trim().min(1, { message: 'Item Name is required' }).max(150),
  Category: z.string().trim().max(100).nullable().optional().default(''),
  Unit: z.enum(['Qty', 'Meter']),
  ActualPrice: z.coerce.number().min(0),
  SellingPrice: z.coerce.number().min(0),
  StockQuantity: z.coerce.number().min(0),
});

export const invoiceItemInputSchema = z.object({
  InvoiceItemID: z.coerce.number().int().positive().optional(),
  ItemID: z.coerce.number().int().positive({ message: 'Valid Item ID is required' }),
  ItemName: z.string().trim().min(1, { message: 'Item Name is required' }).max(150),
  Quantity: z.coerce.number().positive({ message: 'Quantity must be greater than 0' }),
  Price: z.coerce.number().min(0, { message: 'Price cannot be negative' }),
});

export const invoiceCreateSchema = z.object({
  InvoiceDate: z.string().optional(),
  Discount: z.coerce.number().min(0, { message: 'Discount cannot be negative' }).default(0.00),
  PaymentMethod: z.enum(['Cash', 'UPI', 'Card']).default('Cash'),
  sub_total: z.coerce.number().min(0).optional(),
  total_amount: z.coerce.number().min(0).optional(),
  items: z.array(invoiceItemInputSchema).min(1, { message: 'At least one item is required in the invoice' }),
});

export const invoiceUpdateSchema = z.object({
  InvoiceDate: z.string().optional(),
  Discount: z.coerce.number().min(0, { message: 'Discount cannot be negative' }).default(0.00),
  PaymentMethod: z.enum(['Cash', 'UPI', 'Card']).default('Cash'),
  sub_total: z.coerce.number().min(0).optional(),
  total_amount: z.coerce.number().min(0).optional(),
  items: z.array(invoiceItemInputSchema).min(1, { message: 'At least one item is required in the invoice' }),
});

export const singleInvoiceItemCreateSchema = z.object({
  InvoiceID: z.coerce.number().int().positive({ message: 'Valid Invoice ID is required' }),
  ItemID: z.coerce.number().int().positive({ message: 'Valid Item ID is required' }),
  ItemName: z.string().trim().min(1).max(150).optional(),
  Quantity: z.coerce.number().positive({ message: 'Quantity must be greater than 0' }),
  Price: z.coerce.number().min(0, { message: 'Price cannot be negative' }),
});

export const singleInvoiceItemUpdateSchema = z.object({
  Quantity: z.coerce.number().positive({ message: 'Quantity must be greater than 0' }).optional(),
  Price: z.coerce.number().min(0, { message: 'Price cannot be negative' }).optional(),
});
