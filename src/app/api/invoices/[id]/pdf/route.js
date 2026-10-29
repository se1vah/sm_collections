import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { getInvoiceById } from '@/lib/invoice-service.js';

export const runtime = 'nodejs';
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

    // Determine font paths
    const regularFontPath = path.join(process.cwd(), 'src', 'assets', 'fonts', 'segoeui.ttf');
    const boldFontPath = path.join(process.cwd(), 'src', 'assets', 'fonts', 'segoeuib.ttf');
    const hasCustomFont = fs.existsSync(regularFontPath) && fs.existsSync(boldFontPath);

    // 80mm standard thermal roll width = 80mm * (72 / 25.4) = ~226.77 pt
    const receiptWidth = 226;
    const marginLeft = 10;
    const marginRight = 10;
    const contentWidth = receiptWidth - marginLeft - marginRight; // 206 pt

    // Calculate dynamic receipt height based on content
    const itemsCount = invoice.items.length;
    // Base height: Header (~70) + Meta (~65) + TableHeader (~16) + Totals (~55) + Footer (~50) + Margins (~30)
    let calculatedHeight = 295 + (itemsCount * 16);
    // Add extra padding for wrapped long item names
    for (const item of invoice.items) {
      if (item.ItemName && item.ItemName.length > 18) {
        calculatedHeight += 12;
      }
    }
    const receiptHeight = Math.max(320, calculatedHeight);

    const docOptions = {
      size: [receiptWidth, receiptHeight],
      margins: { top: 12, bottom: 12, left: marginLeft, right: marginRight },
      bufferPages: true,
      info: {
        Title: `Receipt_${invoice.InvoiceID}`,
        Author: 'SM Collections',
        Subject: `Thermal Receipt #${invoice.InvoiceID}`,
      },
    };

    if (hasCustomFont) {
      docOptions.font = regularFontPath;
    }

    const doc = new PDFDocument(docOptions);

    if (hasCustomFont) {
      doc.registerFont('ReceiptRegular', regularFontPath);
      doc.registerFont('ReceiptBold', boldFontPath);
    }

    const fontRegular = hasCustomFont ? 'ReceiptRegular' : 'Helvetica';
    const fontBold = hasCustomFont ? 'ReceiptBold' : 'Helvetica-Bold';

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    const endPromise = new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    // Parse date and time
    const invDate = new Date(invoice.InvoiceDate);
    const isValidDate = !isNaN(invDate.getTime());
    const pad = (n) => String(n).padStart(2, '0');
    
    // DD-MM-YYYY format matching sample receipt
    const dateStr = isValidDate
      ? `${pad(invDate.getDate())}-${pad(invDate.getMonth() + 1)}-${invDate.getFullYear()}`
      : String(invoice.InvoiceDate).split(' ')[0] || '';

    // 12-hour hh:mm am/pm matching sample receipt
    let timeStr = '';
    if (isValidDate) {
      let hours = invDate.getHours();
      const minutes = pad(invDate.getMinutes());
      const ampm = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12;
      hours = hours ? hours : 12; // '0' becomes '12'
      timeStr = `${pad(hours)}:${minutes} ${ampm}`;
    }

    // Bill Number set directly to Invoice ID
    const formattedBillNo = invoice.InvoiceID;
    const paymentMethodDisplay = String(invoice.PaymentMethod || 'Cash').toUpperCase();

    // Helper to draw dashed divider matching thermal receipt
    function drawDashedLine(y) {
      doc
        .save()
        .strokeColor('#111827')
        .lineWidth(0.6)
        .dash(2.5, { space: 2 })
        .moveTo(marginLeft, y)
        .lineTo(receiptWidth - marginRight, y)
        .stroke()
        .undash()
        .restore();
    }

    let y = 14;

    // --- 1. STORE HEADER (Centered) ---
    doc.font(fontBold).fontSize(11).fillColor('#000000');
    doc.text("SM COLLECTION'S", marginLeft, y, { width: contentWidth, align: 'center' });
    y += 14;

    doc.font(fontRegular).fontSize(7.5);
    doc.text('Smart Shopping, Better Living', marginLeft, y, { width: contentWidth, align: 'center' });
    y += 10;
    doc.text('Lakshmana Theertham,', marginLeft, y, { width: contentWidth, align: 'center' });
    y += 10;
    doc.text('Rameswaram', marginLeft, y, { width: contentWidth, align: 'center' });
    y += 10;
    doc.text('Ph: 9629967006', marginLeft, y, { width: contentWidth, align: 'center' });
    y += 14;

    // Divider
    drawDashedLine(y);
    y += 8;

    // --- 2. INVOICE DETAILS (Left aligned) ---
    doc.font(fontBold).fontSize(8).fillColor('#000000');
    doc.text('TAX INVOICE', marginLeft, y);
    y += 11;

    doc.font(fontRegular).fontSize(8);
    doc.text(`Bill No : ${formattedBillNo}`, marginLeft, y);
    y += 11;

    doc.text(`Date    : ${dateStr}`, marginLeft, y);
    y += 11;

    if (timeStr) {
      doc.text(`Time    : ${timeStr}`, marginLeft, y);
      y += 11;
    }

    doc.text(`Payment method : ${paymentMethodDisplay}`, marginLeft, y);
    y += 13;

    // Divider
    drawDashedLine(y);
    y += 8;

    // --- 3. ITEMS TABLE HEADER ---
    // Columns: ITEM (left), QTY (right), RATE (right), AMT (right)
    const colItem = marginLeft;
    const colQty = marginLeft + 95;
    const colRate = marginLeft + 125;
    const colAmt = marginLeft + 160;

    const widthItem = 90;
    const widthQty = 25;
    const widthRate = 33;
    const widthAmt = 46;

    doc.font(fontBold).fontSize(7.5).fillColor('#000000');
    doc.text('ITEM', colItem, y, { width: widthItem });
    doc.text('QTY', colQty, y, { width: widthQty, align: 'right' });
    doc.text('RATE', colRate, y, { width: widthRate, align: 'right' });
    doc.text('AMT', colAmt, y, { width: widthAmt, align: 'right' });
    y += 12;

    // --- 4. ITEM ROWS ---
    doc.font(fontRegular).fontSize(7.5).fillColor('#000000');
    for (const itm of invoice.items) {
      const itmTotal = Number(itm.Quantity || 0) * Number(itm.Price || 0);
      const qtyStr = Number(itm.Quantity) % 1 === 0 ? String(parseInt(itm.Quantity, 10)) : Number(itm.Quantity).toFixed(2);
      const rateStr = Number(itm.Price) % 1 === 0 ? String(parseInt(itm.Price, 10)) : Number(itm.Price).toFixed(2);
      const amtStr = itmTotal.toFixed(2);

      const startY = y;

      // Print Item Name (can wrap if long)
      doc.text(itm.ItemName, colItem, startY, { width: widthItem });
      const nameHeight = doc.heightOfString(itm.ItemName, { width: widthItem });

      // Print numbers aligned with top of item row
      doc.text(qtyStr, colQty, startY, { width: widthQty, align: 'right' });
      doc.text(rateStr, colRate, startY, { width: widthRate, align: 'right' });
      doc.text(amtStr, colAmt, startY, { width: widthAmt, align: 'right' });

      y += Math.max(13, nameHeight + 2);
    }

    y += 3;
    drawDashedLine(y);
    y += 8;

    // --- 5. SUBTOTAL & DISCOUNT ---
    const subTotalVal = Number(invoice.sub_total || invoice.summary.subTotal || 0).toFixed(2);
    const discountVal = Number(invoice.Discount || invoice.summary.discount || 0).toFixed(2);
    const totalAmountVal = Number(invoice.total_amount || invoice.summary.totalAmount || 0).toFixed(2);

    doc.font(fontRegular).fontSize(8).fillColor('#000000');
    doc.text('Subtotal', marginLeft, y);
    doc.text(subTotalVal, colAmt - 10, y, { width: widthAmt + 10, align: 'right' });
    y += 12;

    doc.text('Discount', marginLeft, y);
    doc.text(discountVal, colAmt - 10, y, { width: widthAmt + 10, align: 'right' });
    y += 14;

    // Divider
    drawDashedLine(y);
    y += 8;

    // --- 6. TOTAL AMOUNT (Bold / Prominent) ---
    doc.font(fontBold).fontSize(10.5).fillColor('#000000');
    doc.text('TOTAL AMOUNT', marginLeft, y);
    doc.text(totalAmountVal, colAmt - 20, y, { width: widthAmt + 20, align: 'right' });
    y += 16;

    // Divider
    drawDashedLine(y);
    y += 10;

    // --- 7. FOOTER (Centered) ---
    doc.font(fontRegular).fontSize(8).fillColor('#000000');
    doc.text('Thank You!', marginLeft, y, { width: contentWidth, align: 'center' });
    y += 11;
    doc.text('Visit Again', marginLeft, y, { width: contentWidth, align: 'center' });
    y += 14;

    doc.font(fontRegular).fontSize(7).fillColor('#000000');
    doc.text('NO RETURNS  |  NO EXCHANGES', marginLeft, y, { width: contentWidth, align: 'center' });

    doc.end();

    const pdfBuffer = await endPromise;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Receipt_${invoice.InvoiceID}.pdf"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Thermal Receipt PDF generation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate thermal receipt' },
      { status: 500 }
    );
  }
}
