import InventoryTable from '@/components/inventory/InventoryTable';
import { Boxes, PackageCheck, AlertTriangle } from 'lucide-react';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function getInventoryStats() {
  try {
    const totalItemsRows = await query('SELECT COUNT(*) AS total FROM Items');
    const totalStockRows = await query('SELECT COALESCE(SUM(StockQuantity), 0) AS totalStock FROM Items');
    const lowStockRows = await query('SELECT COUNT(*) AS lowStock FROM Items WHERE StockQuantity > 0 AND StockQuantity <= 10');
    const outOfStockRows = await query('SELECT COUNT(*) AS outOfStock FROM Items WHERE StockQuantity <= 0');

    return {
      totalItems: totalItemsRows[0]?.total || 0,
      totalStock: Number(totalStockRows[0]?.totalStock || 0),
      lowStock: lowStockRows[0]?.lowStock || 0,
      outOfStock: outOfStockRows[0]?.outOfStock || 0,
    };
  } catch (error) {
    console.error('Failed to get inventory stats:', error);
    return { totalItems: 0, totalStock: 0, lowStock: 0, outOfStock: 0 };
  }
}

export default async function InventoryPage() {
  const stats = await getInventoryStats();

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Inventory Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage your product catalog, real-time stock levels, units, and pricing.
          </p>
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Products
            </p>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">{stats.totalItems}</h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Stock Units
            </p>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">
              {Number(stats.totalStock).toFixed(2)}
            </h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Low Stock Items
            </p>
            <h3 className="text-xl font-bold text-amber-600 mt-0.5">{stats.lowStock}</h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Out of Stock
            </p>
            <h3 className="text-xl font-bold text-red-600 mt-0.5">{stats.outOfStock}</h3>
          </div>
        </div>
      </div>

      {/* Main Inventory Table */}
      <InventoryTable />
    </div>
  );
}

