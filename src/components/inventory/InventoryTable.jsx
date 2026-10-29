'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Boxes,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StockBadge, Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import ItemForm from './ItemForm';
import { toast } from 'sonner';

export default function InventoryTable() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 15, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modal states
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Delete modal state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchItems = useCallback(async (page = 1, searchQuery = search, category = categoryFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '15',
        search: searchQuery || '',
        category: category || '',
      });

      const res = await fetch(`/api/items?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setItems(data.items || []);
        setPagination(data.pagination || { total: 0, page: 1, limit: 15, totalPages: 1 });
      } else {
        toast.error(data.error || 'Failed to load inventory items');
      }
    } catch (err) {
      toast.error('Network error loading items');
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchItems(1, search, categoryFilter);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, categoryFilter, fetchItems]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormOpen(true);
  };

  const handleOpenDelete = (item) => {
    setItemToDelete(item);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/items/${itemToDelete.ItemID}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(data.message || `Item ${itemToDelete.ItemID} deleted successfully`);
        setDeleteOpen(false);
        setItemToDelete(null);
        fetchItems(pagination.page);
      } else {
        toast.error(data.error || 'Failed to delete item', {
          duration: 6000,
        });
      }
    } catch (err) {
      toast.error('Network error deleting item');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Action Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Item ID, Name, or Category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Quick Filter Reset */}
          {(search || categoryFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setCategoryFilter('');
              }}
              className="text-xs text-slate-500"
            >
              Clear Filters
            </Button>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchItems(pagination.page)}
            disabled={loading}
            title="Refresh table"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button onClick={handleOpenAdd} size="sm">
            <Plus className="w-4 h-4" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Inventory Items Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {loading && items.length === 0 ? (
          <TableSkeleton rows={6} cols={7} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="No inventory items found"
            description={
              search
                ? `No items matching "${search}". Try adjusting your search query.`
                : 'No inventory items yet. Add your first item to begin tracking stock.'
            }
            actionLabel="Add New Item"
            onAction={handleOpenAdd}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Item ID</th>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Unit</th>
                  <th className="py-3 px-4 text-right">Actual Price</th>
                  <th className="py-3 px-4 text-right">Selling Price</th>
                  <th className="py-3 px-4 text-center">Stock Quantity</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {items.map((item) => (
                  <tr
                    key={item.ItemID}
                    className="hover:bg-slate-50/70 transition-colors group"
                  >
                    {/* Item ID */}
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                      #{item.ItemID}
                    </td>

                    {/* Item Name */}
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {item.ItemName}
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4">
                      {item.Category ? (
                        <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                          {item.Category}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">None</span>
                      )}
                    </td>

                    {/* Unit */}
                    <td className="py-3.5 px-4 text-center">
                      <Badge
                        variant={item.Unit === 'Meter' ? 'purple' : 'primary'}
                      >
                        {item.Unit}
                      </Badge>
                    </td>

                    {/* Actual Price */}
                    <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                      ₹ {Number(item.ActualPrice).toFixed(2)}
                    </td>

                    {/* Selling Price */}
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      ₹ {Number(item.SellingPrice).toFixed(2)}
                    </td>

                    {/* Stock Status Badge */}
                    <td className="py-3.5 px-4 text-center">
                      <StockBadge
                        quantity={item.StockQuantity}
                        unit={item.Unit}
                      />
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Item"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(item)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Item"
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

        {/* Pagination Footer */}
        {pagination.total > 0 && (
          <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing{' '}
              <span className="font-semibold text-slate-700">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-slate-700">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{' '}
              of <span className="font-semibold text-slate-700">{pagination.total}</span> items
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1 || loading}
                onClick={() => fetchItems(pagination.page - 1)}
                className="h-8 px-2.5"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </Button>

              <span className="px-3 py-1 font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => fetchItems(pagination.page + 1)}
                className="h-8 px-2.5"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Item Dialog */}
      <Dialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingItem ? `Edit Item #${editingItem.ItemID}` : 'Add New Inventory Item'}
        description={
          editingItem
            ? 'Modify item pricing, category, or stock details.'
            : 'Fill in details to register a new product in inventory.'
        }
      >
        <ItemForm
          item={editingItem}
          onSuccess={() => {
            setFormOpen(false);
            fetchItems(pagination.page);
          }}
          onCancel={() => setFormOpen(false)}
        />
      </Dialog>

      {/* Delete Item Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Item"
        message={
          itemToDelete
            ? `Are you sure you want to permanently delete "${itemToDelete.ItemName}" (ID: #${itemToDelete.ItemID})? Note: Items that appear in any previous invoices cannot be deleted to preserve financial audit integrity.`
            : ''
        }
        confirmText="Delete Item"
        loading={deleteLoading}
      />
    </div>
  );
}

