'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import BarcodeScannerModal from '@/components/ui/BarcodeScannerModal';
import { toast } from 'sonner';
import { Sparkles, AlertCircle, CheckCircle2, Camera } from 'lucide-react';

export default function ItemForm({ item, onSuccess, onCancel }) {
  const isEdit = Boolean(item && item.ItemID);

  const [formData, setFormData] = useState({
    ItemID: '',
    ItemName: '',
    Category: '',
    Unit: 'Qty',
    ActualPrice: '',
    SellingPrice: '',
    StockQuantity: '',
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [checkingId, setCheckingId] = useState(false);
  const [idStatus, setIdStatus] = useState(null); // { available: boolean, message: string }
  const [scannerOpen, setScannerOpen] = useState(false);

  const checkTimerRef = useRef(null);

  // Auto-suggest next ID when adding new item
  useEffect(() => {
    if (item) {
      setFormData({
        ItemID: item.ItemID || '',
        ItemName: item.ItemName || '',
        Category: item.Category || '',
        Unit: item.Unit || 'Qty',
        ActualPrice: item.ActualPrice !== undefined ? item.ActualPrice : '',
        SellingPrice: item.SellingPrice !== undefined ? item.SellingPrice : '',
        StockQuantity: item.StockQuantity !== undefined ? item.StockQuantity : '',
      });
      setIdStatus(null);
    } else {
      // Fetch recommended next available ID
      fetch('/api/items?suggestNextId=true')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.nextId) {
            setFormData((prev) => ({
              ...prev,
              ItemID: prev.ItemID || String(data.nextId),
            }));
            setIdStatus({ available: true, message: `Suggested unique ID #${data.nextId}` });
          }
        })
        .catch(() => {});
    }
  }, [item]);

  // Real-time duplicate Item ID check (debounced)
  const handleItemIdChange = (val) => {
    setFormData((prev) => ({ ...prev, ItemID: val }));
    setErrors((prev) => ({ ...prev, ItemID: undefined }));
    setIdStatus(null);

    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);

    const trimmed = val.trim();
    if (!trimmed || isNaN(Number(trimmed)) || Number(trimmed) <= 0) {
      return;
    }

    const numericId = Number(trimmed);
    setCheckingId(true);
    checkTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/items/${numericId}`);
        const data = await res.json();
        if (data.success && data.data) {
          setIdStatus({
            available: false,
            message: `Item ID #${numericId} is already in use by "${data.data.ItemName}". Please choose a different ID.`,
          });
        } else {
          setIdStatus({
            available: true,
            message: `Item ID #${numericId} is available!`,
          });
        }
      } catch (err) {
        setIdStatus(null);
      } finally {
        setCheckingId(false);
      }
    }, 350);
  };

  const handleBarcodeScan = (scannedCode) => {
    if (!scannedCode) return;
    const cleanCode = String(scannedCode).trim();
    handleItemIdChange(cleanCode);
    toast.success(`Scanned barcode: ${cleanCode}`);
  };

  const validate = () => {
    const errs = {};
    if (!isEdit) {
      if (!formData.ItemID || isNaN(Number(formData.ItemID)) || Number(formData.ItemID) <= 0) {
        errs.ItemID = 'Valid positive numeric Item ID is required';
      } else if (idStatus && !idStatus.available) {
        errs.ItemID = idStatus.message;
      }
    }
    if (!formData.ItemName.trim()) {
      errs.ItemName = 'Item Name is required';
    }
    if (!['Qty', 'Meter'].includes(formData.Unit)) {
      errs.Unit = 'Unit must be Qty or Meter';
    }
    if (formData.ActualPrice === '' || isNaN(Number(formData.ActualPrice)) || Number(formData.ActualPrice) < 0) {
      errs.ActualPrice = 'Valid price >= 0 is required';
    }
    if (formData.SellingPrice === '' || isNaN(Number(formData.SellingPrice)) || Number(formData.SellingPrice) < 0) {
      errs.SellingPrice = 'Valid price >= 0 is required';
    }
    if (formData.StockQuantity === '' || isNaN(Number(formData.StockQuantity)) || Number(formData.StockQuantity) < 0) {
      errs.StockQuantity = 'Valid stock quantity >= 0 is required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const payload = {
        ItemID: Number(formData.ItemID),
        ItemName: formData.ItemName.trim(),
        Category: formData.Category.trim() || null,
        Unit: formData.Unit,
        ActualPrice: Number(formData.ActualPrice),
        SellingPrice: Number(formData.SellingPrice),
        StockQuantity: Number(formData.StockQuantity),
      };

      const url = isEdit ? `/api/items/${item.ItemID}` : '/api/items';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.isDuplicate) {
          setErrors((prev) => ({ ...prev, ItemID: data.error }));
          setIdStatus({ available: false, message: data.error });
        }
        throw new Error(data.error || 'Operation failed');
      }

      toast.success(isEdit ? 'Item updated successfully' : 'Item added to inventory successfully');
      onSuccess(data.data);
    } catch (err) {
      toast.error(err.message || 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Item ID */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
            Item ID <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                placeholder="e.g. 101, 102..."
                disabled={isEdit}
                value={formData.ItemID}
                onChange={(e) => handleItemIdChange(e.target.value)}
                className={`w-full px-3.5 py-2 text-sm bg-white border rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 transition-all shadow-2xs ${
                  errors.ItemID
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                    : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                } ${isEdit ? 'bg-slate-50 cursor-not-allowed opacity-75' : ''}`}
              />
            </div>
            {!isEdit && (
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                title="Scan barcode with camera"
                aria-label="Scan barcode with camera"
                className="shrink-0 h-[38px] px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 rounded-xl border border-blue-200 flex items-center gap-1.5 text-xs font-semibold transition-all shadow-2xs hover:border-blue-300 cursor-pointer"
              >
                <Camera className="w-4 h-4 text-blue-600" />
                <span className="hidden sm:inline">Scan</span>
              </button>
            )}
          </div>

          {errors.ItemID && (
            <span className="text-xs text-red-600 font-medium">{errors.ItemID}</span>
          )}

          {!errors.ItemID && (
            <span className="text-xs text-slate-500">
              {isEdit ? 'Item ID cannot be altered' : 'Enter unique ID, SKU, or barcode'}
            </span>
          )}

          {!isEdit && idStatus && (
            <div
              className={`text-xs mt-1 flex items-center gap-1.5 font-medium ${
                idStatus.available ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {idStatus.available ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  {idStatus.message}
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {idStatus.message}
                </>
              )}
            </div>
          )}

          {!isEdit && checkingId && (
            <span className="text-[11px] text-slate-400 mt-0.5 block">Checking ID availability...</span>
          )}
        </div>

        {/* Unit */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
            Unit <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.Unit}
            onChange={(e) => setFormData({ ...formData, Unit: e.target.value })}
            className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-100 focus:border-blue-500 shadow-2xs"
          >
            <option value="Qty">Qty (Quantity / Pieces)</option>
            <option value="Meter">Meter (Fabric / Length)</option>
          </select>
          {errors.Unit && <span className="text-xs text-red-600 font-medium">{errors.Unit}</span>}
        </div>
      </div>

      {/* Item Name */}
      <Input
        label="Item Name"
        required
        placeholder="e.g. Pure Cotton Fabric White"
        value={formData.ItemName}
        onChange={(e) => setFormData({ ...formData, ItemName: e.target.value })}
        error={errors.ItemName}
      />

      {/* Category */}
      <Input
        label="Category"
        placeholder="e.g. Cotton, Silk, Accessories"
        value={formData.Category}
        onChange={(e) => setFormData({ ...formData, Category: e.target.value })}
        error={errors.Category}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Actual Price */}
        <Input
          label="Actual Price (₹)"
          required
          type="number"
          step="0.01"
          placeholder="0.00"
          value={formData.ActualPrice}
          onChange={(e) => setFormData({ ...formData, ActualPrice: e.target.value })}
          error={errors.ActualPrice}
        />

        {/* Selling Price */}
        <Input
          label="Selling Price (₹)"
          required
          type="number"
          step="0.01"
          placeholder="0.00"
          value={formData.SellingPrice}
          onChange={(e) => setFormData({ ...formData, SellingPrice: e.target.value })}
          error={errors.SellingPrice}
        />

        {/* Stock Quantity */}
        <Input
          label={`Stock (${formData.Unit})`}
          required
          type="number"
          step={formData.Unit === 'Meter' ? '0.01' : '1'}
          placeholder="0.00"
          value={formData.StockQuantity}
          onChange={(e) => setFormData({ ...formData, StockQuantity: e.target.value })}
          error={errors.StockQuantity}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          type="submit"
          loading={loading}
          disabled={!isEdit && idStatus && !idStatus.available}
        >
          {isEdit ? 'Update Item' : 'Save Item'}
        </Button>
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScan}
        title="Scan Item Barcode"
        description="Position product barcode in front of the camera"
      />
    </form>
  );
}
