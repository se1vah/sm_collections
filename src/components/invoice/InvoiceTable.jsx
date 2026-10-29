'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  FileDown,
  Receipt,
  RefreshCw,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import InvoiceForm from './InvoiceForm';
import { toast } from 'sonner';

export default function InvoiceTable() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters: Search by Invoice ID & Date picker filter
  const [searchId, setSearchId] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [fetchingInvoiceDetail, setFetchingInvoiceDetail] = useState(false);

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

  // Format date helper: DD-MM-YYYY
  const formatInvoiceDate = (dateVal) => {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
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
          <TableSkeleton rows={5} cols={5} />
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
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
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

                    {/* Invoice Date formatted as DD-MM-YYYY */}
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {formatInvoiceDate(inv.InvoiceDate)}
                    </td>

                    {/* Total Items count badge */}
                    <td className="py-3.5 px-4 text-center text-xs text-slate-600">
                      <span className="bg-slate-100 px-2.5 py-1 rounded-md font-semibold">
                        {inv.totalItems} item{inv.totalItems === 1 ? '' : 's'}
                      </span>
                    </td>

                    {/* Grand Total */}
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      ₹ {Number(inv.grandTotal).toFixed(2)}
                    </td>

                    {/* Actions: Download PDF, Edit, Delete */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleDownloadPDF(inv.InvoiceID)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Download PDF"
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
            ? 'Update invoice date, quantities, or prices. Inventory will adjust automatically.'
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

