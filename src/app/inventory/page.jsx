import InventoryTable from '@/components/inventory/InventoryTable';
import { getInventoryStats } from '@/lib/inventory-service';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  let stats = { totalItems: 0, totalStock: 0, lowStock: 0, outOfStock: 0 };
  try {
    stats = await getInventoryStats();
  } catch (error) {
    console.error('Failed to get inventory stats:', error);
  }

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

      {/* Main Inventory Table with Dynamic Reactive KPI Cards */}
      <InventoryTable initialStats={stats} />
    </div>
  );
}
