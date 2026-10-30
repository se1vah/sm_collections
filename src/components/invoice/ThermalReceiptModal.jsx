'use client';

import { useRef } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Printer, Download, X, Bluetooth } from 'lucide-react';
import { useBluetoothPrinter } from '@/context/BluetoothPrinterContext';

export default function ThermalReceiptModal({ isOpen, onClose, invoice }) {
  const receiptRef = useRef(null);
  const { isConnected, isPrinting, deviceName, printInvoice } = useBluetoothPrinter();

  if (!isOpen || !invoice) return null;

  const handlePrint = () => {
    // Print using iframe or isolated print window for clean 80mm thermal receipt
    const printContent = receiptRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (!printWindow) {
      window.print();
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt_${invoice.InvoiceID}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", Courier, monospace;
              margin: 0;
              padding: 10px 14px;
              color: #000;
              background: #fff;
              font-size: 11px;
              line-height: 1.35;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              width: 80mm;
              box-sizing: border-box;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .store-name { font-size: 15px; font-weight: bold; margin-bottom: 2px; }
            .tagline { font-size: 10px; margin-bottom: 2px; }
            .address { font-size: 10px; margin-bottom: 2px; }
            .phone { font-size: 10px; margin-bottom: 4px; }
            .dashed-line {
              border-bottom: 1px dashed #000;
              margin: 7px 0;
            }
            .meta-row {
              font-size: 11px;
              margin: 2px 0;
            }
            .table {
              width: 100%;
              border-collapse: collapse;
              margin: 4px 0;
              font-size: 11px;
            }
            .table th {
              font-weight: bold;
              border-bottom: 1px dashed #000;
              padding-bottom: 4px;
            }
            .table td {
              padding: 3px 0;
              vertical-align: top;
            }
            .subtotal-row {
              display: flex;
              justify-content: space-between;
              font-size: 11px;
              margin: 3px 0;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              font-size: 14px;
              font-weight: bold;
              margin: 5px 0;
            }
            .footer {
              margin-top: 10px;
              font-size: 10px;
              line-height: 1.4;
            }
            .terms {
              font-size: 9px;
              letter-spacing: 0.5px;
              margin-top: 6px;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = function() {
              window.focus();
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleDownloadPdf = () => {
    window.open(`/api/invoices/${invoice.InvoiceID}/pdf`, '_blank');
  };

  // Date and Time formatting
  const invDate = new Date(invoice.InvoiceDate);
  const isValidDate = !isNaN(invDate.getTime());
  const pad = (n) => String(n).padStart(2, '0');

  const dateStr = isValidDate
    ? `${pad(invDate.getDate())}-${pad(invDate.getMonth() + 1)}-${invDate.getFullYear()}`
    : String(invoice.InvoiceDate).split(' ')[0] || '';

  let timeStr = '';
  if (isValidDate) {
    let hours = invDate.getHours();
    const minutes = pad(invDate.getMinutes());
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    timeStr = `${pad(hours)}:${minutes} ${ampm}`;
  }

  const billNo = invoice.InvoiceID;
  const paymentMethod = String(invoice.PaymentMethod || 'Cash').toUpperCase();

  const subTotal = Number(invoice.sub_total || invoice.summary?.subTotal || 0).toFixed(2);
  const discount = Number(invoice.Discount || invoice.summary?.discount || 0).toFixed(2);
  const totalAmount = Number(invoice.total_amount || invoice.summary?.totalAmount || 0).toFixed(2);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Thermal Receipt Preview (80mm)"
      description="Exact thermal receipt matching client sample printer output."
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        {/* Receipt Visual Paper Container */}
        <div className="bg-slate-100 p-4 rounded-xl flex justify-center">
          <div
            ref={receiptRef}
            className="w-[78mm] bg-white p-4 shadow-md rounded-xs border border-slate-300 font-mono text-[11px] leading-tight text-black select-text"
          >
            {/* Header */}
            <div className="text-center">
              <div className="font-bold text-[14px] uppercase tracking-wide">
                SM COLLECTION&apos;S
              </div>
              <div className="text-[10px] mt-0.5">Smart Shopping, Better Living</div>
              <div className="text-[10px]">Lakshmana Theertham,</div>
              <div className="text-[10px]">Rameswaram</div>
              <div className="text-[10px]">Ph: 9629967006</div>
            </div>

            {/* Dashed line */}
            <div className="border-b border-dashed border-black my-2" />

            {/* Invoice Details */}
            <div className="space-y-0.5 text-[10.5px]">
              <div className="font-bold">TAX INVOICE</div>
              <div>Bill No : {billNo}</div>
              <div>Date    : {dateStr}</div>
              {timeStr && <div>Time    : {timeStr}</div>}
              <div>Payment method : {paymentMethod}</div>
            </div>

            {/* Dashed line */}
            <div className="border-b border-dashed border-black my-2" />

            {/* Items Table */}
            <table className="w-full text-left border-collapse text-[10.5px]">
              <thead>
                <tr className="border-b border-dashed border-black">
                  <th className="font-bold pb-1 text-left">ITEM</th>
                  <th className="font-bold pb-1 text-right w-10">QTY</th>
                  <th className="font-bold pb-1 text-right w-12">RATE</th>
                  <th className="font-bold pb-1 text-right w-16">AMT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-transparent">
                {(invoice.items || []).map((itm, idx) => {
                  const itmTotal = Number(itm.Quantity || 0) * Number(itm.Price || 0);
                  const qtyStr =
                    Number(itm.Quantity) % 1 === 0
                      ? String(parseInt(itm.Quantity, 10))
                      : Number(itm.Quantity).toFixed(2);
                  const rateStr =
                    Number(itm.Price) % 1 === 0
                      ? String(parseInt(itm.Price, 10))
                      : Number(itm.Price).toFixed(2);

                  return (
                    <tr key={idx} className="align-top">
                      <td className="py-0.5 pr-1 break-words">{itm.ItemName}</td>
                      <td className="py-0.5 text-right font-medium">{qtyStr}</td>
                      <td className="py-0.5 text-right font-medium">{rateStr}</td>
                      <td className="py-0.5 text-right font-medium">{itmTotal.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Dashed line */}
            <div className="border-b border-dashed border-black my-2" />

            {/* Totals */}
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between items-center">
                <span>Subtotal</span>
                <span>{subTotal}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Discount</span>
                <span>{discount}</span>
              </div>
            </div>

            {/* Dashed line */}
            <div className="border-b border-dashed border-black my-2" />

            {/* Total Amount */}
            <div className="flex justify-between items-center font-bold text-[13px] py-0.5">
              <span>TOTAL AMOUNT</span>
              <span>{totalAmount}</span>
            </div>

            {/* Dashed line */}
            <div className="border-b border-dashed border-black my-2" />

            {/* Footer */}
            <div className="text-center text-[10px] space-y-0.5 mt-2">
              <div>Thank You!</div>
              <div>Visit Again</div>
              <div className="text-[9px] uppercase tracking-wider pt-1.5">
                NO RETURNS | NO EXCHANGES
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="space-y-2.5 pt-2">
          {/* Bluetooth Direct Thermal Print Button */}
          <Button
            onClick={() => printInvoice(invoice)}
            loading={isPrinting}
            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 shadow-sm"
          >
            <Bluetooth className="w-4 h-4" />
            {isConnected
              ? `Print to ${deviceName || 'Bluetooth Printer'}`
              : 'Print via Bluetooth Printer'}
          </Button>

          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" onClick={handleDownloadPdf} className="flex-1 gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </Button>

            <Button
              variant="outline"
              onClick={handlePrint}
              className="flex-1 gap-1.5 text-xs text-slate-700 hover:bg-slate-50"
            >
              <Printer className="w-3.5 h-3.5" />
              Browser Print
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

