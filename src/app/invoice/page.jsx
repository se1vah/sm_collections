import InvoiceTable from '@/components/invoice/InvoiceTable';
import { Receipt, IndianRupee, TrendingUp } from 'lucide-react';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function getInvoiceStats() {
  try {
    const totalInvoicesRows = await query('SELECT COUNT(*) AS total FROM Invoices');
    const revenueRows = await query(
      'SELECT COALESCE(SUM(Quantity * Price), 0) AS totalRevenue FROM Invoice_Items'
    );
    const totalInvoices = totalInvoicesRows[0]?.total || 0;
    const totalRevenue = Number(revenueRows[0]?.totalRevenue || 0);
    const avgInvoice = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;

    return {
      totalInvoices,
      totalRevenue,
      avgInvoice,
    };
  } catch (error) {
    console.error('Failed to get invoice stats:', error);
    return { totalInvoices: 0, totalRevenue: 0, avgInvoice: 0 };
  }
}

export default async function InvoicePage() {
  const stats = await getInvoiceStats();

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Invoice Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Create, manage, and download GST tax invoices with real-time stock synchronization.
          </p>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Invoices
            </p>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">{stats.totalInvoices}</h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <IndianRupee className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Revenue
            </p>
            <h3 className="text-xl font-bold text-emerald-600 mt-0.5">
              ₹ {Number(stats.totalRevenue).toFixed(2)}
            </h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Avg. Invoice Value
            </p>
            <h3 className="text-xl font-bold text-purple-700 mt-0.5">
              ₹ {Number(stats.avgInvoice).toFixed(2)}
            </h3>
          </div>
        </div>
      </div>

      {/* Main Invoices Table */}
      <InvoiceTable />
    </div>
  );
}

