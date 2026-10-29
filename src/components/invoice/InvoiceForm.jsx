'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import InvoiceItemsTable from './InvoiceItemsTable';
import { Download, Save, Search, ArrowRight, CornerDownLeft, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function InvoiceForm({ invoice, onSuccess, onCancel }) {
  const isEdit = Boolean(invoice && invoice.InvoiceID);

  // Default date to current local datetime format YYYY-MM-DDTHH:mm
  const getCurrentDateTime = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };

  const [invoiceDate, setInvoiceDate] = useState(getCurrentDateTime());
  const [items, setItems] = useState([]);
  const [itemIdInput, setItemIdInput] = useState('');
  const [searchingItem, setSearchingItem] = useState(false);
  const [lastFoundItem, setLastFoundItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savedInvoiceId, setSavedInvoiceId] = useState(null);

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
      if (invoice.items && Array.isArray(invoice.items)) {
        // In edit mode, effective available stock = current stock + previously invoiced quantity
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
    }
  }, [invoice]);

  // Search and add item using Item ID
  const handleAddItemById = async (e) => {
    if (e) e.preventDefault();
    const rawId = itemIdInput.trim();
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

      // Check if item is already added to invoice
      const existingIdx = items.findIndex((i) => Number(i.ItemID) === targetId);

      const maxStock = Number(item.StockQuantity);

      if (existingIdx !== -1) {
        // Item already in invoice: increment quantity
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
        // Item not in invoice: check if stock is available
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

      // Clear input and refocus
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

    // Validate quantities and prices
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
      toast.success(
        isEdit ? `Invoice #${generatedId} updated successfully` : `Invoice #${generatedId} created successfully`
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
      toast.error('Save the invoice first to generate PDF');
      return;
    }
    window.open(`/api/invoices/${targetId}/pdf`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Invoice Metadata Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
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
                Generated Automatically upon Save
              </span>
            )}
          </div>
        </div>

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

        <form onSubmit={handleAddItemById} className="flex gap-2">
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
          <Button type="submit" loading={searchingItem} size="md">
            <CornerDownLeft className="w-4 h-4" />
            Add Item
          </Button>
        </form>

        {/* Real-time hint for last found item */}
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

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
        <div>
          {savedInvoiceId && (
            <Button
              variant="outline"
              onClick={() => handleDownloadPDF(savedInvoiceId)}
              className="text-blue-700 border-blue-300 hover:bg-blue-50"
            >
              <Download className="w-4 h-4" />
              Download PDF (Invoice #{savedInvoiceId})
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading} className="gap-2">
            <Save className="w-4 h-4" />
            {isEdit ? 'Update Invoice' : 'Save Invoice'}
          </Button>
        </div>
      </div>
    </div>
  );
}

