'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  FileDown,
  Printer,
  Receipt,
  RefreshCw,
  X,
  CreditCard,
  Bluetooth,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import InvoiceForm from './InvoiceForm';
import ThermalReceiptModal from './ThermalReceiptModal';
import { useBluetoothPrinter } from '@/context/BluetoothPrinterContext';
import { toast } from 'sonner';

export default function InvoiceTable() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [printingInvoiceId, setPrintingInvoiceId] = useState(null);
  const { isConnected, isPrinting, deviceName, printInvoice } = useBluetoothPrinter();

  // Filters
  const [searchId, setSearchId] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [fetchingInvoiceDetail, setFetchingInvoiceDetail] = useState(false);

  // Thermal print modal
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [invoiceToPrint, setInvoiceToPrint] = useState(null);

  // Delete modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchInvoices = useCallback(async (search = searchId, date = filterDate) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search && search.trim() !== '') {
        params.append('search', search.trim());
      }
      if (date && date.trim() !== '') {
        params.append('date', date.trim());
      }

      const res = await fetch(`/api/invoices?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setInvoices(data.data || []);
      } else {
        toast.error(data.error || 'Failed to fetch invoices');
      }
    } catch (err) {
      toast.error('Network error loading invoices');
    } finally {
      setLoading(false);
    }
  }, [searchId, filterDate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInvoices(searchId, filterDate);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchId, filterDate, fetchInvoices]);

  const handleCreateInvoice = () => {
    setEditingInvoice(null);
    setFormOpen(true);
  };

  const handleEditInvoice = async (invoice) => {
    setFetchingInvoiceDetail(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.InvoiceID}`);
      const data = await res.json();
      if (data.success && data.data) {
        setEditingInvoice(data.data);
        setFormOpen(true);
      } else {
        toast.error(data.error || 'Failed to load invoice details');
      }
    } catch (err) {
      toast.error('Error fetching invoice for edit');
    } finally {
      setFetchingInvoiceDetail(false);
    }
  };

  const handleOpenPrint = async (invoice) => {
    try {
      const res = await fetch(`/api/invoices/${invoice.InvoiceID}`);
      const data = await res.json();
      if (data.success && data.data) {
        setInvoiceToPrint(data.data);
        setPrintModalOpen(true);
      } else {
        toast.error('Failed to load invoice receipt details');
      }
    } catch (err) {
      toast.error('Error opening thermal receipt');
    }
  };

  const handleDeleteClick = (invoice) => {
    setInvoiceToDelete(invoice);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!invoiceToDelete) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceToDelete.InvoiceID}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(
          data.message || `Invoice #${invoiceToDelete.InvoiceID} deleted and stock restored.`
        );
        setDeleteOpen(false);
        setInvoiceToDelete(null);
        fetchInvoices();
      } else {
        toast.error(data.error || 'Failed to delete invoice');
      }
    } catch (err) {
      toast.error('Network error deleting invoice');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDownloadPDF = (invoiceId) => {
    window.open(`/api/invoices/${invoiceId}/pdf`, '_blank');
  };

  const handleDirectBluetoothPrint = async (invoice) => {
    setPrintingInvoiceId(invoice.InvoiceID);
    try {
      let fullInvoice = invoice;
      if (!invoice.items || invoice.items.length === 0) {
        const res = await fetch(`/api/invoices/${invoice.InvoiceID}`);
        const data = await res.json();
        if (data.success && data.data) {
          fullInvoice = data.data;
        } else {
          toast.error('Failed to load invoice items for printing');
          return;
        }
      }
      await printInvoice(fullInvoice);
    } catch (err) {
      toast.error('Error printing via Bluetooth: ' + err.message);
    } finally {
      setPrintingInvoiceId(null);
    }
  };

  const formatInvoiceDate = (dateVal) => {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
  };

  const getPaymentBadgeVariant = (method) => {
    switch (method) {
      case 'Cash':
        return 'success';
      case 'UPI':
        return 'primary';
      case 'Card':
        return 'purple';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Date Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-3">
          {/* Search by Invoice ID */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="number"
              placeholder="Search by Invoice ID..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all font-mono"
            />
          </div>

          {/* Filter by Date */}
          <div className="relative flex-1 max-w-xs">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Reset Filters */}
          {(searchId || filterDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchId('');
                setFilterDate('');
              }}
              className="text-xs text-slate-500 self-center"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </Button>
          )}
        </div>

        {/* Toolbar Actions */}
        <div className="flex items-center gap-2">
          {/* Bluetooth Printer Status Quick Link */}
          <Link
            href="/settings"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              isConnected
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 shadow-2xs'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
            title={isConnected ? `Connected to ${deviceName}` : 'Click to configure Bluetooth printer in Settings'}
          >
            <Printer className="w-3.5 h-3.5" />
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <span className="hidden sm:inline">
              {isConnected ? `${deviceName || 'KPC307'} Ready` : 'Printer Offline'}
            </span>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchInvoices()}
            disabled={loading}
            title="Refresh Invoices"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button onClick={handleCreateInvoice} size="sm">
            <Plus className="w-4 h-4" />
            Create Invoice
          </Button>
        </div>
      </div>

      {/* Invoices Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {loading && invoices.length === 0 ? (
          <TableSkeleton rows={5} cols={7} />
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No invoices found"
            description={
              searchId || filterDate
                ? 'No invoices match your selected filters. Try clearing them.'
                : 'No invoices created yet. Generate your first invoice to get started.'
            }
            actionLabel="Create Invoice"
            onAction={handleCreateInvoice}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice ID</th>
                  <th className="py-3 px-4">Invoice Date</th>
                  <th className="py-3 px-4 text-center">Payment</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                  <th className="py-3 px-4 text-right">Discount</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {invoices.map((inv) => (
                  <tr
                    key={inv.InvoiceID}
                    className="hover:bg-slate-50/70 transition-colors group"
                  >
                    {/* Invoice ID */}
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                      #{inv.InvoiceID}
                    </td>

                    {/* Invoice Date */}
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {formatInvoiceDate(inv.InvoiceDate)}
                    </td>

                    {/* Payment Method Badge */}
                    <td className="py-3.5 px-4 text-center">
                      <Badge variant={getPaymentBadgeVariant(inv.PaymentMethod)}>
                        {inv.PaymentMethod || 'Cash'}
                      </Badge>
                    </td>

                    {/* Items count */}
                    <td className="py-3.5 px-4 text-center text-xs text-slate-600">
                      <span className="bg-slate-100 px-2.5 py-1 rounded-md font-semibold">
                        {inv.totalItems} item{inv.totalItems === 1 ? '' : 's'}
                      </span>
                    </td>

                    {/* Subtotal */}
                    <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                      ₹ {Number(inv.sub_total || 0).toFixed(2)}
                    </td>

                    {/* Discount */}
                    <td className="py-3.5 px-4 text-right font-medium text-amber-700">
                      {Number(inv.Discount || 0) > 0 ? `- ₹ ${Number(inv.Discount).toFixed(2)}` : '₹ 0.00'}
                    </td>

                    {/* Total Amount */}
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      ₹ {Number(inv.total_amount || 0).toFixed(2)}
                    </td>

                    {/* Actions: Direct Bluetooth Print, Thermal Preview, Download PDF, Edit, Delete */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleDirectBluetoothPrint(inv)}
                          disabled={printingInvoiceId === inv.InvoiceID}
                          className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Print directly to KPC307 Bluetooth Thermal Printer"
                        >
                          <Bluetooth className={`w-4 h-4 ${printingInvoiceId === inv.InvoiceID ? 'animate-bounce text-emerald-600' : ''}`} />
                        </button>
                        <button
                          onClick={() => handleOpenPrint(inv)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View / Print Thermal Receipt"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadPDF(inv.InvoiceID)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Download Receipt PDF"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditInvoice(inv)}
                          disabled={fetchingInvoiceDetail}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Invoice"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(inv)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Invoice"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Invoice Dialog */}
      <Dialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingInvoice ? `Edit Invoice #${editingInvoice.InvoiceID}` : 'Create New Invoice'}
        description={
          editingInvoice
            ? 'Update invoice date, items, discount, or payment method. Inventory adjusts automatically.'
            : 'Enter an Item ID and press Enter to quickly add items to the invoice.'
        }
        maxWidth="max-w-4xl"
      >
        <InvoiceForm
          invoice={editingInvoice}
          onSuccess={() => {
            fetchInvoices();
          }}
          onCancel={() => setFormOpen(false)}
        />
      </Dialog>

      {/* Thermal Receipt Preview Modal */}
      <ThermalReceiptModal
        isOpen={printModalOpen}
        onClose={() => {
          setPrintModalOpen(false);
          setInvoiceToPrint(null);
        }}
        invoice={invoiceToPrint}
      />

      {/* Delete Invoice Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setInvoiceToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Invoice"
        message={
          invoiceToDelete
            ? `Are you sure you want to permanently delete Invoice #${invoiceToDelete.InvoiceID}? All ${invoiceToDelete.totalItems} invoiced item quantities will be restored back to inventory automatically.`
            : ''
        }
        confirmText="Delete Invoice"
        loading={deleteLoading}
      />
    </div>
  );
}
