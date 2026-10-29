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

    // Create PDF Document with custom font directly in constructor to bypass Helvetica.afm requirement
    const docOptions = {
      size: 'A4',
      margin: 40,
      bufferPages: true,
      info: {
        Title: `Invoice_${invoice.InvoiceID}`,
        Author: 'SM Collections',
        Subject: `Invoice #${invoice.InvoiceID}`,
      },
    };

    if (hasCustomFont) {
      docOptions.font = regularFontPath;
    }

    const doc = new PDFDocument(docOptions);

    if (hasCustomFont) {
      doc.registerFont('AppRegular', regularFontPath);
      doc.registerFont('AppBold', boldFontPath);
    }

    const regularFont = hasCustomFont ? 'AppRegular' : 'Helvetica';
    const boldFont = hasCustomFont ? 'AppBold' : 'Helvetica-Bold';
    const rupeePrefix = hasCustomFont ? '₹ ' : 'Rs. ';

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    const endPromise = new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    // Formatting date
    const invDate = new Date(invoice.InvoiceDate);
    const formattedDate = !isNaN(invDate.getTime())
      ? invDate.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      : String(invoice.InvoiceDate);

    // --- Header ---
    doc.rect(40, 40, 515, 4).fill('#2563eb');

    doc.font(boldFont).fontSize(22).fillColor('#1e3a8a').text('SM COLLECTIONS', 40, 55);
    doc.font(regularFont).fontSize(9).fillColor('#64748b').text('Premium Quality Fabrics & Materials', 40, 80);
    doc.text('Invoice & Inventory Management System', 40, 93);

    doc.font(boldFont).fontSize(20).fillColor('#2563eb').text('TAX INVOICE', 350, 55, { align: 'right' });
    
    // Invoice Meta Box
    doc.rect(365, 80, 190, 45).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.font(boldFont).fontSize(10).fillColor('#0f172a').text('Invoice ID:', 375, 88);
    doc.font(boldFont).fontSize(10).fillColor('#2563eb').text(`#${invoice.InvoiceID}`, 450, 88);

    doc.font(regularFont).fontSize(9).fillColor('#475569').text('Invoice Date:', 375, 105);
    doc.text(formattedDate, 445, 105);

    // Divider
    doc.strokeColor('#cbd5e1').lineWidth(0.75).moveTo(40, 135).lineTo(555, 135).stroke();

    // --- Table Headers ---
    let yPos = 150;
    const colX = {
      sno: 40,
      id: 70,
      name: 120,
      qty: 310,
      unit: 370,
      price: 430,
      total: 495,
    };
    const colWidth = {
      sno: 25,
      id: 45,
      name: 180,
      qty: 55,
      unit: 50,
      price: 60,
      total: 60,
    };

    function drawTableHeader(y) {
      doc.rect(40, y, 515, 22).fill('#1e40af');
      doc.font(boldFont).fontSize(9).fillColor('#ffffff');
      doc.text('S.No', colX.sno + 3, y + 6);
      doc.text('Item ID', colX.id + 3, y + 6);
      doc.text('Item Name', colX.name, y + 6);
      doc.text('Quantity', colX.qty, y + 6, { width: colWidth.qty, align: 'right' });
      doc.text('Unit', colX.unit, y + 6, { width: colWidth.unit, align: 'center' });
      doc.text('Price', colX.price, y + 6, { width: colWidth.price, align: 'right' });
      doc.text('Total', colX.total, y + 6, { width: colWidth.total, align: 'right' });
    }

    drawTableHeader(yPos);
    yPos += 24;

    // --- Table Body ---
    let sNo = 1;
    for (const item of invoice.items) {
      // Check page overflow
      if (yPos > 700) {
        doc.addPage();
        yPos = 50;
        drawTableHeader(yPos);
        yPos += 24;
      }

      const rowBg = sNo % 2 === 0 ? '#f8fafc' : '#ffffff';
      doc.rect(40, yPos - 2, 515, 22).fill(rowBg);

      doc.font(regularFont).fontSize(9).fillColor('#334155');
      doc.text(String(sNo), colX.sno + 3, yPos + 4);
      doc.text(String(item.ItemID), colX.id + 3, yPos + 4);
      doc.font(boldFont).text(item.ItemName, colX.name, yPos + 4, { width: colWidth.name, ellipsis: true });
      doc.font(regularFont);
      doc.text(Number(item.Quantity).toFixed(2), colX.qty, yPos + 4, { width: colWidth.qty, align: 'right' });
      doc.text(item.Unit || 'Qty', colX.unit, yPos + 4, { width: colWidth.unit, align: 'center' });
      doc.text(`${rupeePrefix}${Number(item.Price).toFixed(2)}`, colX.price, yPos + 4, { width: colWidth.price, align: 'right' });
      doc.font(boldFont).fillColor('#0f172a');
      doc.text(`${rupeePrefix}${Number(item.Total).toFixed(2)}`, colX.total, yPos + 4, { width: colWidth.total, align: 'right' });

      // Line under row
      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, yPos + 20).lineTo(555, yPos + 20).stroke();

      yPos += 22;
      sNo++;
    }

    // Space before summary
    yPos += 15;
    if (yPos > 680) {
      doc.addPage();
      yPos = 50;
    }

    // --- Summary Section ---
    const summaryX = 330;
    const summaryWidth = 225;

    doc.rect(summaryX, yPos, summaryWidth, 80).fillAndStroke('#f1f5f9', '#cbd5e1');

    doc.font(regularFont).fontSize(9.5).fillColor('#475569');
    doc.text('Total Items:', summaryX + 15, yPos + 12);
    doc.font(boldFont).fillColor('#0f172a').text(String(invoice.summary.totalItems), summaryX + 130, yPos + 12, { width: 80, align: 'right' });

    doc.font(regularFont).fillColor('#475569').text('Total Quantity:', summaryX + 15, yPos + 30);
    doc.font(boldFont).fillColor('#0f172a').text(Number(invoice.summary.totalQuantity).toFixed(2), summaryX + 130, yPos + 30, { width: 80, align: 'right' });

    // Grand total highlight
    doc.rect(summaryX + 5, yPos + 48, summaryWidth - 10, 26).fill('#2563eb');
    doc.font(boldFont).fontSize(11).fillColor('#ffffff');
    doc.text('Grand Total:', summaryX + 15, yPos + 55);
    doc.text(`${rupeePrefix}${Number(invoice.summary.grandTotal).toFixed(2)}`, summaryX + 100, yPos + 55, { width: 110, align: 'right' });

    // --- Footer ---
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);

      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, 785).lineTo(555, 785).stroke();
      doc.font(regularFont).fontSize(8).fillColor('#94a3b8');
      doc.text('This is a computer-generated invoice. Thank you for your business!', 40, 795);
      doc.text(`Page ${i + 1} of ${pages.count}`, 350, 795, { align: 'right' });
    }

    doc.end();

    const pdfBuffer = await endPromise;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Invoice_${invoice.InvoiceID}.pdf"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
