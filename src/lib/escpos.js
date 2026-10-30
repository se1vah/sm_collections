/**
 * ESC/POS Command Generator for 80mm Bluetooth Thermal Printers
 * Specifically formatted for KPC307-UEWB-2EFE and standard 80mm POS receipt printers.
 */

const LINE_WIDTH = 48; // Standard 48 characters for 80mm thermal receipt (Font A)

// Helper to convert ASCII/string to Uint8Array bytes
function stringToBytes(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}

// Concatenate multiple Uint8Arrays
function concatBytes(arrays) {
  let totalLength = 0;
  for (const arr of arrays) {
    totalLength += arr.length;
  }
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// Pad a string to fixed length
function padRight(str, len) {
  const s = String(str || '');
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

function padLeft(str, len) {
  const s = String(str || '');
  return s.length >= len ? s.slice(0, len) : ' '.repeat(len - s.length) + s;
}

function formatTwoColumn(left, right, width = LINE_WIDTH) {
  const l = String(left || '');
  const r = String(right || '');
  const space = width - l.length - r.length;
  if (space <= 0) return l + ' ' + r;
  return l + ' '.repeat(space) + r;
}

// Basic ESC/POS command sequences
export const ESC_POS = {
  INIT: new Uint8Array([0x1b, 0x40]), // ESC @ - Initialize
  ALIGN_LEFT: new Uint8Array([0x1b, 0x61, 0x00]), // ESC a 0
  ALIGN_CENTER: new Uint8Array([0x1b, 0x61, 0x01]), // ESC a 1
  ALIGN_RIGHT: new Uint8Array([0x1b, 0x61, 0x02]), // ESC a 2
  BOLD_ON: new Uint8Array([0x1b, 0x45, 0x01]), // ESC E 1
  BOLD_OFF: new Uint8Array([0x1b, 0x45, 0x00]), // ESC E 0
  FONT_NORMAL: new Uint8Array([0x1d, 0x21, 0x00]), // GS ! 0
  FONT_DOUBLE_HEIGHT: new Uint8Array([0x1d, 0x21, 0x01]), // GS ! 1
  FONT_DOUBLE_WIDTH: new Uint8Array([0x1d, 0x21, 0x10]), // GS ! 16
  FONT_DOUBLE_SIZE: new Uint8Array([0x1d, 0x21, 0x11]), // GS ! 17
  FEED_LINES_4: new Uint8Array([0x1b, 0x64, 0x04]), // ESC d 4
  FEED_LINES_2: new Uint8Array([0x1b, 0x64, 0x02]), // ESC d 2
  CUT_PARTIAL: new Uint8Array([0x1d, 0x56, 0x42, 0x00]), // GS V 66 0
  CUT_FULL: new Uint8Array([0x1d, 0x56, 0x00]), // GS V 0
};

/**
 * Build ESC/POS command bytes for full thermal receipt of an invoice
 */
export function buildInvoiceReceiptCommands(invoice) {
  if (!invoice) return new Uint8Array();

  const commands = [];

  const addText = (text, addNewline = true) => {
    commands.push(stringToBytes(text + (addNewline ? '\n' : '')));
  };

  const addCmd = (cmdBytes) => {
    commands.push(cmdBytes);
  };

  const dashedLine = '-'.repeat(LINE_WIDTH);

  // 1. Initialize
  addCmd(ESC_POS.INIT);

  // 2. Store Header (Centered)
  addCmd(ESC_POS.ALIGN_CENTER);
  addCmd(ESC_POS.BOLD_ON);
  addCmd(ESC_POS.FONT_DOUBLE_HEIGHT);
  addText("SM COLLECTION'S");
  addCmd(ESC_POS.FONT_NORMAL);
  addCmd(ESC_POS.BOLD_OFF);
  addText('Smart Shopping, Better Living');
  addText('Lakshmana Theertham,');
  addText('Rameswaram');
  addText('Ph: 9629967006');

  // Separator
  addCmd(ESC_POS.ALIGN_LEFT);
  addText(dashedLine);

  // 3. Invoice Metadata
  addCmd(ESC_POS.BOLD_ON);
  addText('TAX INVOICE');
  addCmd(ESC_POS.BOLD_OFF);

  const billNo = String(invoice.InvoiceID || invoice.id || '');
  addText(`Bill No : ${billNo}`);

  // Date and Time formatting
  const invDate = new Date(invoice.InvoiceDate);
  const isValidDate = !isNaN(invDate.getTime());
  const pad = (n) => String(n).padStart(2, '0');

  const dateStr = isValidDate
    ? `${pad(invDate.getDate())}-${pad(invDate.getMonth() + 1)}-${invDate.getFullYear()}`
    : String(invoice.InvoiceDate).split(' ')[0] || '';

  addText(`Date    : ${dateStr}`);

  if (isValidDate) {
    let hours = invDate.getHours();
    const minutes = pad(invDate.getMinutes());
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    addText(`Time    : ${pad(hours)}:${minutes} ${ampm}`);
  }

  const paymentMethod = String(invoice.PaymentMethod || 'Cash').toUpperCase();
  addText(`Payment method : ${paymentMethod}`);

  // Separator
  addText(dashedLine);

  // 4. Items Table Header (48 chars: ITEM=22, QTY=6, RATE=8, AMT=12)
  addCmd(ESC_POS.BOLD_ON);
  const tableHeader = `${padRight('ITEM', 22)}${padLeft('QTY', 6)}${padLeft('RATE', 8)}${padLeft('AMT', 12)}`;
  addText(tableHeader);
  addCmd(ESC_POS.BOLD_OFF);
  addText(dashedLine);

  // 5. Table Items
  const items = invoice.items || [];
  for (const itm of items) {
    const qtyNum = Number(itm.Quantity || 0);
    const priceNum = Number(itm.Price || 0);
    const itmTotal = qtyNum * priceNum;

    const qtyStr = qtyNum % 1 === 0 ? String(parseInt(qtyNum, 10)) : qtyNum.toFixed(2);
    const rateStr = priceNum % 1 === 0 ? String(parseInt(priceNum, 10)) : priceNum.toFixed(2);
    const amtStr = itmTotal.toFixed(2);

    const itemName = String(itm.ItemName || 'Item');

    if (itemName.length <= 22) {
      const line = `${padRight(itemName, 22)}${padLeft(qtyStr, 6)}${padLeft(rateStr, 8)}${padLeft(amtStr, 12)}`;
      addText(line);
    } else {
      // Long name: print name on first line, and values on second line aligned right
      addText(itemName);
      const valuesLine = `${' '.repeat(22)}${padLeft(qtyStr, 6)}${padLeft(rateStr, 8)}${padLeft(amtStr, 12)}`;
      addText(valuesLine);
    }
  }

  // Separator
  addText(dashedLine);

  // 6. Subtotal & Discount
  const subTotal = Number(invoice.sub_total || invoice.summary?.subTotal || 0).toFixed(2);
  const discount = Number(invoice.Discount || invoice.summary?.discount || 0).toFixed(2);
  const totalAmount = Number(invoice.total_amount || invoice.summary?.totalAmount || 0).toFixed(2);

  addText(formatTwoColumn('Subtotal', subTotal));
  addText(formatTwoColumn('Discount', discount));

  // Separator
  addText(dashedLine);

  // 7. TOTAL AMOUNT (Bold & Double Height)
  addCmd(ESC_POS.BOLD_ON);
  addCmd(ESC_POS.FONT_DOUBLE_HEIGHT);
  addText(formatTwoColumn('TOTAL AMOUNT', totalAmount));
  addCmd(ESC_POS.FONT_NORMAL);
  addCmd(ESC_POS.BOLD_OFF);

  // Separator
  addText(dashedLine);

  // 8. Footer (Centered)
  addCmd(ESC_POS.ALIGN_CENTER);
  addText('Thank You!');
  addText('Visit Again');
  addText('');
  addText('NO RETURNS | NO EXCHANGES');

  // 9. Feed & Paper Cut
  addCmd(ESC_POS.FEED_LINES_4);
  addCmd(ESC_POS.CUT_PARTIAL);

  return concatBytes(commands);
}

/**
 * Build ESC/POS command bytes for a printer connection test
 */
export function buildTestPrintCommands(printerName = 'KPC307-UEWB-2EFE') {
  const commands = [];
  const dashedLine = '-'.repeat(LINE_WIDTH);

  const addText = (text, addNewline = true) => {
    commands.push(stringToBytes(text + (addNewline ? '\n' : '')));
  };

  const addCmd = (cmdBytes) => {
    commands.push(cmdBytes);
  };

  // Initialize
  addCmd(ESC_POS.INIT);

  // Store Header
  addCmd(ESC_POS.ALIGN_CENTER);
  addCmd(ESC_POS.BOLD_ON);
  addCmd(ESC_POS.FONT_DOUBLE_HEIGHT);
  addText("SM COLLECTION'S");
  addCmd(ESC_POS.FONT_NORMAL);
  addCmd(ESC_POS.BOLD_OFF);
  addText('Thermal Printer Diagnostic Test');
  addText(dashedLine);

  // Details
  addCmd(ESC_POS.ALIGN_LEFT);
  addCmd(ESC_POS.BOLD_ON);
  addText('BLUETOOTH CONNECTION SUCCESSFUL!');
  addCmd(ESC_POS.BOLD_OFF);
  addText(`Printer Model : ${printerName}`);
  addText(`Paper Width   : 80mm Thermal`);
  addText(`Interface     : Bluetooth (GATT ESC/POS)`);
  addText(`Test Date     : ${new Date().toLocaleString('en-IN')}`);

  addText(dashedLine);

  addCmd(ESC_POS.ALIGN_CENTER);
  addCmd(ESC_POS.BOLD_ON);
  addText('READY TO PRINT INVOICES');
  addCmd(ESC_POS.BOLD_OFF);
  addText('System is ready for fast wireless printing.');
  addText(dashedLine);

  // Feed & Cut
  addCmd(ESC_POS.FEED_LINES_4);
  addCmd(ESC_POS.CUT_PARTIAL);

  return concatBytes(commands);
}

