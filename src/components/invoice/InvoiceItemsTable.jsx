'use client';

import { Plus, Minus, Trash2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export default function InvoiceItemsTable({
  items,
  onUpdateQuantity,
  onUpdatePrice,
  onRemoveItem,
}) {
  if (!items || items.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl my-3">
        <p className="text-sm font-semibold text-slate-600">No items added to this invoice yet</p>
        <p className="text-xs text-slate-400 mt-1">
          Enter an Item ID in the box above and press Enter to quickly add items.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table Container */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3">Item ID</th>
                <th className="py-2.5 px-3">Item Name</th>
                <th className="py-2.5 px-3 text-center">Unit</th>
                <th className="py-2.5 px-3 text-center w-40">Quantity</th>
                <th className="py-2.5 px-3 text-right w-32">Price (₹)</th>
                <th className="py-2.5 px-3 text-right">Total (₹)</th>
                <th className="py-2.5 px-3 text-center w-14">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {items.map((item, idx) => {
                const total = Number(item.Quantity || 0) * Number(item.Price || 0);
                const step = item.Unit === 'Meter' ? 0.25 : 1;
                const maxStock = item.AvailableStock !== undefined ? Number(item.AvailableStock) : Infinity;
                const isExceeding = Number(item.Quantity) > maxStock;

                return (
                  <tr key={`${item.ItemID}-${idx}`} className="hover:bg-slate-50/60 transition-colors">
                    {/* Item ID */}
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                      #{item.ItemID}
                    </td>

                    {/* Item Name */}
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      <div>{item.ItemName}</div>
                      {item.AvailableStock !== undefined && (
                        <div className="text-[11px] text-slate-400">
                          Available: {item.AvailableStock} {item.Unit}
                        </div>
                      )}
                    </td>

                    {/* Unit */}
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant={item.Unit === 'Meter' ? 'purple' : 'primary'}>
                        {item.Unit || 'Qty'}
                      </Badge>
                    </td>

                    {/* Quantity with +/- Controls */}
                    <td className="py-2.5 px-3">
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                          <button
                            type="button"
                            onClick={() => {
                              const newQty = Math.max(step, Number(item.Quantity) - step);
                              onUpdateQuantity(item.ItemID, Number(newQty.toFixed(2)));
                            }}
                            className="p-1 hover:bg-white text-slate-600 rounded-lg transition-colors"
                            title="Decrease Quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>

                          <input
                            type="number"
                            step={step}
                            min={step}
                            max={maxStock}
                            value={item.Quantity}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              onUpdateQuantity(item.ItemID, isNaN(val) ? '' : val);
                            }}
                            className={`w-16 text-center font-bold text-sm bg-white border rounded-lg py-1 px-1 focus:outline-hidden ${
                              isExceeding ? 'border-red-500 text-red-600' : 'border-slate-200 text-slate-900'
                            }`}
                          />

                          <button
                            type="button"
                            onClick={() => {
                              const nextQty = Number(item.Quantity) + step;
                              if (nextQty <= maxStock) {
                                onUpdateQuantity(item.ItemID, Number(nextQty.toFixed(2)));
                              }
                            }}
                            disabled={Number(item.Quantity) >= maxStock}
                            className="p-1 hover:bg-white text-slate-600 rounded-lg transition-colors disabled:opacity-40"
                            title="Increase Quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {isExceeding && (
                          <span className="text-[10px] text-red-600 font-semibold flex items-center gap-0.5 mt-1">
                            <AlertCircle className="w-3 h-3" /> Max {maxStock}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Price Input (Editable) */}
                    <td className="py-2.5 px-3 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.Price}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          onUpdatePrice(item.ItemID, isNaN(val) ? '' : val);
                        }}
                        className="w-24 text-right font-semibold text-sm bg-white border border-slate-200 rounded-lg py-1 px-2 focus:outline-hidden focus:border-blue-500"
                      />
                    </td>

                    {/* Total */}
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      ₹ {total.toFixed(2)}
                    </td>

                    {/* Remove Action */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.ItemID)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
