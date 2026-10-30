'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import InvoiceItemsTable from './InvoiceItemsTable';
import ThermalReceiptModal from './ThermalReceiptModal';
import BarcodeScannerModal from '@/components/ui/BarcodeScannerModal';
import {
  Download,
  Save,
  Search,
  CornerDownLeft,
  Printer,
  CreditCard,
  IndianRupee,
  Percent,
  Camera,
  Bluetooth,
} from 'lucide-react';
import { useBluetoothPrinter } from '@/context/BluetoothPrinterContext';
import { toast } from 'sonner';

export default function InvoiceForm({ invoice, onSuccess, onCancel }) {
  const isEdit = Boolean(invoice && invoice.InvoiceID);
  const { printInvoice, isPrinting, isConnected, deviceName } = useBluetoothPrinter();

  const getCurrentDateTime = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };

  const [invoiceDate, setInvoiceDate] = useState(getCurrentDateTime());
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [discount, setDiscount] = useState('0.00');
  const [items, setItems] = useState([]);
  const [itemIdInput, setItemIdInput] = useState('');
  const [searchingItem, setSearchingItem] = useState(false);
  const [lastFoundItem, setLastFoundItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savedInvoiceId, setSavedInvoiceId] = useState(null);
  const [savedInvoiceData, setSavedInvoiceData] = useState(null);

  // Print thermal modal state
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const itemIdInputRef = useRef(null);

  useEffect(() => {
    if (invoice) {
      if (invoice.InvoiceDate) {
        const d = new Date(invoice.InvoiceDate);
        if (!isNaN(d.getTime())) {
          const pad = (n) => String(n).padStart(2, '0');
          setInvoiceDate(
            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
          );
        }
      }
      setPaymentMethod(invoice.PaymentMethod || 'Cash');
      setDiscount(
        invoice.Discount !== undefined ? Number(invoice.Discount).toFixed(2) : '0.00'
      );

      if (invoice.items && Array.isArray(invoice.items)) {
        setItems(
          invoice.items.map((itm) => ({
            ...itm,
            Quantity: Number(itm.Quantity),
            Price: Number(itm.Price),
            AvailableStock:
              itm.AvailableStock !== undefined
                ? Number(itm.AvailableStock) + Number(itm.Quantity)
                : Infinity,
          }))
        );
      }
      setSavedInvoiceId(invoice.InvoiceID);
      setSavedInvoiceData(invoice);
    }
  }, [invoice]);

  // Dynamic Calculations
  const totalItems = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.Quantity || 0), 0);
  const subTotal = Number(
    items.reduce((sum, item) => sum + Number(item.Quantity || 0) * Number(item.Price || 0), 0).toFixed(2)
  );

  const discountNum = Math.max(0, parseFloat(discount) || 0);
  const isDiscountExceeding = discountNum > subTotal;
  const totalAmount = Math.max(0, subTotal - discountNum);

  // Search and add item using Item ID
  const handleAddItemById = async (e, directId = null) => {
    if (e && e.preventDefault) e.preventDefault();
    const rawId = (directId !== null && directId !== undefined ? String(directId) : itemIdInput).trim();
    if (!rawId || isNaN(Number(rawId))) {
      toast.error('Please enter a valid numeric Item ID');
      return;
    }

    const targetId = Number(rawId);
    setSearchingItem(true);
    try {
      const res = await fetch(`/api/items/${targetId}`);
      const data = await res.json();

      if (!res.ok || !data.success || !data.data) {
        toast.error(`Item with ID #${targetId} does not exist in inventory.`);
        return;
      }

      const item = data.data;
      setLastFoundItem(item);

      const existingIdx = items.findIndex((i) => Number(i.ItemID) === targetId);
      const maxStock = Number(item.StockQuantity);

      if (existingIdx !== -1) {
        const existingItem = items[existingIdx];
        const step = item.Unit === 'Meter' ? 0.25 : 1;
        const effectiveMax = isEdit ? existingItem.AvailableStock : maxStock;
        const newQty = Number(existingItem.Quantity) + step;

        if (newQty > effectiveMax) {
          toast.error(
            `Cannot add more "${item.ItemName}". Maximum available stock is ${effectiveMax} ${item.Unit}.`
          );
          return;
        }

        const updatedItems = [...items];
        updatedItems[existingIdx] = {
          ...existingItem,
          Quantity: Number(newQty.toFixed(2)),
        };
        setItems(updatedItems);
        toast.success(`Increased "${item.ItemName}" quantity to ${newQty} ${item.Unit}`);
      } else {
        if (maxStock <= 0) {
          toast.error(`"${item.ItemName}" is out of stock (Available: 0 ${item.Unit}).`);
          return;
        }

        const defaultQty = item.Unit === 'Meter' ? 1.0 : 1;
        const newItem = {
          ItemID: item.ItemID,
          ItemName: item.ItemName,
          Quantity: defaultQty,
          Unit: item.Unit,
          Price: Number(item.SellingPrice),
          AvailableStock: maxStock,
        };

        setItems([...items, newItem]);
        toast.success(`Added "${item.ItemName}" to invoice`);
      }

      setItemIdInput('');
      if (itemIdInputRef.current) {
        itemIdInputRef.current.focus();
      }
    } catch (err) {
      toast.error('Failed to search item: ' + err.message);
    } finally {
      setSearchingItem(false);
    }
  };

  const handleBarcodeScan = async (scannedCode) => {
    if (!scannedCode) return;
    const cleanCode = String(scannedCode).trim();
    // Populate Item ID text input field
    setItemIdInput(cleanCode);
    toast.success(`Scanned Item #${cleanCode}`);
    // Automatically trigger Add Item button functionality
    await handleAddItemById(null, cleanCode);
  };

  const handleUpdateQuantity = (itemId, newQuantity) => {
    setItems((prev) =>
      prev.map((i) => (i.ItemID === itemId ? { ...i, Quantity: newQuantity } : i))
    );
  };

  const handleUpdatePrice = (itemId, newPrice) => {
    setItems((prev) =>
      prev.map((i) => (i.ItemID === itemId ? { ...i, Price: newPrice } : i))
    );
  };

  const handleRemoveItem = (itemId) => {
    setItems((prev) => prev.filter((i) => i.ItemID !== itemId));
    toast.info('Item removed from invoice');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!items || items.length === 0) {
      toast.error('Please add at least one item to the invoice.');
      return;
    }

    if (discountNum < 0) {
      toast.error('Discount cannot be negative.');
      return;
    }

    if (discountNum > subTotal) {
      toast.error(
        `Discount (₹${discountNum.toFixed(2)}) cannot exceed Subtotal (₹${subTotal.toFixed(2)}).`
      );
      return;
    }

    for (const item of items) {
      if (!item.Quantity || Number(item.Quantity) <= 0) {
        toast.error(`Invalid quantity for item "${item.ItemName}". Must be greater than 0.`);
        return;
      }
      if (item.Price === '' || Number(item.Price) < 0) {
        toast.error(`Invalid price for item "${item.ItemName}". Cannot be negative.`);
        return;
      }
      if (item.AvailableStock !== undefined && Number(item.Quantity) > Number(item.AvailableStock)) {
        toast.error(
          `Requested quantity for "${item.ItemName}" exceeds available stock (${item.AvailableStock} ${item.Unit}).`
        );
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        InvoiceDate: invoiceDate ? new Date(invoiceDate).toISOString() : new Date().toISOString(),
        Discount: discountNum,
        PaymentMethod: paymentMethod,
        sub_total: subTotal,
        total_amount: Number(totalAmount.toFixed(2)),
        items: items.map((itm) => ({
          InvoiceItemID: itm.InvoiceItemID,
          ItemID: Number(itm.ItemID),
          ItemName: itm.ItemName,
          Quantity: Number(itm.Quantity),
          Price: Number(itm.Price),
        })),
      };

      const url = isEdit ? `/api/invoices/${invoice.InvoiceID}` : '/api/invoices';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save invoice');
      }

      const generatedId = isEdit ? invoice.InvoiceID : data.InvoiceID;
      setSavedInvoiceId(generatedId);

      const savedData = {
        InvoiceID: generatedId,
        InvoiceDate: invoiceDate,
        PaymentMethod: paymentMethod,
        Discount: discountNum,
        sub_total: subTotal,
        total_amount: Number(totalAmount.toFixed(2)),
        items: items,
        summary: {
          subTotal,
          discount: discountNum,
          totalAmount: Number(totalAmount.toFixed(2)),
        },
      };
      setSavedInvoiceData(savedData);

      toast.success(
        isEdit
          ? `Invoice #${generatedId} updated successfully`
          : `Invoice #${generatedId} created successfully`
      );

      if (onSuccess) {
        onSuccess(generatedId);
      }
    } catch (err) {
      toast.error(err.message || 'Error saving invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = (idToDownload) => {
    const targetId = idToDownload || savedInvoiceId || (invoice && invoice.InvoiceID);
    if (!targetId) {
      toast.error('Save the invoice first to download receipt');
      return;
    }
    window.open(`/api/invoices/${targetId}/pdf`, '_blank');
  };

  const handleOpenPrintModal = () => {
    if (!savedInvoiceData && !savedInvoiceId) {
      toast.error('Please save the invoice first to print the receipt.');
      return;
    }

    const currentInvoiceData = savedInvoiceData || {
      InvoiceID: savedInvoiceId || invoice.InvoiceID,
      InvoiceDate: invoiceDate,
      PaymentMethod: paymentMethod,
      Discount: discountNum,
      sub_total: subTotal,
      total_amount: Number(totalAmount.toFixed(2)),
      items: items,
      summary: {
        subTotal,
        discount: discountNum,
        totalAmount: Number(totalAmount.toFixed(2)),
      },
    };
    setSavedInvoiceData(currentInvoiceData);
    setPrintModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Invoice Metadata Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        {/* Invoice ID */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Invoice ID
          </label>
          <div className="text-base font-bold text-slate-800 flex items-center gap-2">
            {isEdit ? (
              <span className="text-blue-700 font-mono">#{invoice.InvoiceID}</span>
            ) : savedInvoiceId ? (
              <span className="text-emerald-700 font-mono">#{savedInvoiceId} (Saved)</span>
            ) : (
              <span className="text-slate-500 italic font-normal text-sm">
                Generated Automatically
              </span>
            )}
          </div>
        </div>

        {/* Invoice Date & Time */}
        <div>
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1 mb-1">
            Invoice Date & Time <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:border-blue-500"
          />
        </div>

        {/* Payment Method */}
        <div>
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1 mb-1">
            Payment Method <span className="text-red-500">*</span>
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:border-blue-500 font-medium"
          >
            <option value="Cash">Cash</option>
            <option value="UPI">UPI (GPay / PhonePe / QR)</option>
            <option value="Card">Card (Debit / Credit)</option>
          </select>
        </div>
      </div>

      {/* Add Items Box: Item ID input with Enter trigger */}
      <div className="bg-blue-50/60 border border-blue-200 p-4 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-blue-700" />
            Add Items Using Item ID
          </label>
          <span className="text-[11px] text-blue-700 font-medium">
            Type ID & press <kbd className="px-1.5 py-0.5 bg-white border border-blue-200 rounded text-xs font-mono shadow-2xs">Enter ↵</kbd>
          </span>
        </div>

        <form onSubmit={handleAddItemById} className="flex gap-2 items-center">
          <div className="relative flex-1">
            <input
              ref={itemIdInputRef}
              type="number"
              placeholder="Enter Item ID (e.g. 101, 102)..."
              value={itemIdInput}
              onChange={(e) => setItemIdInput(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-blue-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-200 focus:border-blue-600 shadow-2xs font-mono"
            />
          </div>
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            title="Scan barcode with camera"
            aria-label="Scan barcode with camera"
            className="shrink-0 h-[38px] px-3 bg-white hover:bg-blue-100/70 text-blue-700 hover:text-blue-900 rounded-xl border border-blue-300 flex items-center gap-1.5 text-xs font-semibold transition-all shadow-2xs hover:border-blue-400 cursor-pointer"
          >
            <Camera className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">Scan Barcode</span>
          </button>
          <Button type="submit" loading={searchingItem} size="md" className="shrink-0 h-[38px]">
            <CornerDownLeft className="w-4 h-4" />
            Add Item
          </Button>
        </form>

        {lastFoundItem && (
          <div className="text-xs text-blue-800 bg-white/80 p-2.5 rounded-lg border border-blue-100 flex items-center justify-between">
            <div>
              <span className="font-bold">Item #{lastFoundItem.ItemID}:</span> {lastFoundItem.ItemName} ({lastFoundItem.Unit})
            </div>
            <div className="flex gap-3">
              <span>Price: <b>₹{Number(lastFoundItem.SellingPrice).toFixed(2)}</b></span>
              <span>Available Stock: <b>{lastFoundItem.StockQuantity} {lastFoundItem.Unit}</b></span>
            </div>
          </div>
        )}
      </div>

      {/* Invoice Items Table */}
      <InvoiceItemsTable
        items={items}
        onUpdateQuantity={handleUpdateQuantity}
        onUpdatePrice={handleUpdatePrice}
        onRemoveItem={handleRemoveItem}
      />

      {/* Financial Summary & Calculation Controls */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          {/* Quick Metrics */}
          <div className="flex items-center gap-6 text-sm text-slate-600">
            <div>
              <span className="text-slate-500 font-medium">Total Items: </span>
              <span className="font-bold text-slate-900">{totalItems}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Total Quantity: </span>
              <span className="font-bold text-slate-900">{totalQuantity.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Payment: </span>
              <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {paymentMethod}
              </span>
            </div>
          </div>

          {/* Calculations Box */}
          <div className="w-full md:w-80 space-y-2.5 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            {/* Subtotal */}
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600 font-medium">Subtotal:</span>
              <span className="font-bold text-slate-900">₹ {subTotal.toFixed(2)}</span>
            </div>

            {/* Discount Input */}
            <div className="flex justify-between items-center text-sm gap-2">
              <label className="text-slate-600 font-medium flex items-center gap-1 shrink-0">
                <Percent className="w-3.5 h-3.5 text-slate-400" />
                Discount (₹):
              </label>
              <div className="relative w-32">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={subTotal}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className={`w-full text-right font-bold text-sm bg-slate-50 border rounded-lg py-1 px-2.5 focus:outline-hidden focus:bg-white ${
                    isDiscountExceeding
                      ? 'border-red-400 text-red-600 focus:border-red-500'
                      : 'border-slate-300 text-slate-900 focus:border-blue-500'
                  }`}
                  placeholder="0.00"
                />
              </div>
            </div>

            {isDiscountExceeding && (
              <p className="text-[11px] text-red-600 text-right font-medium">
                Discount cannot exceed Subtotal (₹{subTotal.toFixed(2)})
              </p>
            )}

            {/* Divider */}
            <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-800">Total Amount:</span>
              <span className="text-xl font-extrabold text-blue-700">
                ₹ {totalAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
        <div className="flex items-center gap-2">
          {(savedInvoiceId || isEdit) && (
            <>
              <Button
                variant="outline"
                onClick={() => printInvoice(savedInvoiceData)}
                loading={isPrinting}
                className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1.5"
                title="Print directly to KPC307 Bluetooth Thermal Printer"
              >
                <Bluetooth className="w-4 h-4 text-emerald-600" />
                Bluetooth Print
              </Button>

              <Button
                variant="outline"
                onClick={handleOpenPrintModal}
                className="text-slate-700 border-slate-300 hover:bg-slate-100 gap-1.5"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                Print Receipt
              </Button>

              <Button
                variant="outline"
                onClick={() => handleDownloadPDF(savedInvoiceId)}
                className="text-blue-700 border-blue-300 hover:bg-blue-50 gap-1.5"
              >
                <Download className="w-4 h-4 text-blue-600" />
                Download PDF
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={loading}
            disabled={isDiscountExceeding}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            {isEdit ? 'Update Invoice' : 'Save Invoice'}
          </Button>
        </div>
      </div>

      {/* Thermal Receipt Preview Modal */}
      <ThermalReceiptModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        invoice={savedInvoiceData}
      />

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScan}
        title="Scan Item Barcode"
        description="Position product barcode or QR code in front of camera to add to invoice"
      />
    </div>
  );
}
