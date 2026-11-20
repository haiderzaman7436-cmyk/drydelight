import { useState, useMemo, useDeferredValue } from 'react';
import { Plus, Search, Pencil, Trash2, FolderTree } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  createCategory,
  updateCategory,
  deleteCategorySafely,
} from '../services/categoryService';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { formatDate } from '../utils/formatters';

export default function CategoriesPage() {
  const { user, isManagerOrAdmin } = useAuth();
  const {
    categories,
    products,
    catalogLoaded,
    upsertCategoryLocal,
    removeCategoryLocal,
  } = useData();

  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [reassignCategoryId, setReassignCategoryId] = useState('');
  const [deleting, setDeleting] = useState(false);

  const productCountByCategory = useMemo(() => {
    const map = new Map();
    for (const p of products) {
      map.set(p.categoryId, (map.get(p.categoryId) || 0) + 1);
    }
    return map;
  }, [products]);

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const list = !q
      ? categories
      : categories.filter(
          (c) =>
            c.name?.toLowerCase().includes(q) ||
            c.description?.toLowerCase().includes(q)
        );
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [categories, deferredSearch]);

  const openCreateModal = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setFormOpen(true);
  };

  const openEditModal = (cat) => {
    setEditing(cat);
    setName(cat.name || '');
    setDescription(cat.description || '');
    setFormOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Category name is required');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const updated = await updateCategory(editing.id, { name, description }, categories);
        upsertCategoryLocal({ ...editing, ...updated });
        toast.success('Category updated');
      } else {
        const created = await createCategory({ name, description }, user?.uid, categories);
        upsertCategoryLocal(created);
        toast.success('Category created');
      }
      setFormOpen(false);
    } catch (err) {
      toast.error(err.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = (cat) => {
    setDeleteTarget(cat);
    const otherCat = categories.find((c) => c.id !== cat.id);
    setReassignCategoryId(otherCat ? otherCat.id : '');
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const count = productCountByCategory.get(deleteTarget.id) || 0;
    const targetCategory =
      count > 0 ? categories.find((c) => c.id === reassignCategoryId) : null;

    if (count > 0 && !targetCategory) {
      toast.error(
        'This category has products. Create another category to reassign them before deleting.'
      );
      return;
    }

    setDeleting(true);
    try {
      const res = await deleteCategorySafely(deleteTarget.id, targetCategory);
      removeCategoryLocal(deleteTarget.id, targetCategory);
      toast.success(
        res.reassignedCount > 0
          ? `Category deleted and ${res.reassignedCount} product(s) reassigned to ${targetCategory.name}`
          : 'Category deleted'
      );
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.message || 'Failed to delete category');
    } finally {
      setDeleting(false);
    }
  };

  const deleteTargetProductCount = deleteTarget
    ? productCountByCategory.get(deleteTarget.id) || 0
    : 0;
  const availableReassignCategories = deleteTarget
    ? categories.filter((c) => c.id !== deleteTarget.id)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories by name or description..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          />
        </div>

        {isManagerOrAdmin && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {!catalogLoaded ? (
          <LoadingSpinner label="Loading categories..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FolderTree}
            title={search ? 'No matching categories' : 'No categories yet'}
            description={
              search
                ? 'Try adjusting your search query.'
                : 'Organize your inventory by creating product categories.'
            }
            action={
              !search &&
              isManagerOrAdmin && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Create First Category
                </button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Category Name</th>
                  <th className="px-5 py-3.5 font-semibold">Description</th>
                  <th className="px-5 py-3.5 font-semibold text-center">Products</th>
                  <th className="px-5 py-3.5 font-semibold">Created</th>
                  {isManagerOrAdmin && (
                    <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((cat) => {
                  const count = productCountByCategory.get(cat.id) || 0;
                  return (
                    <tr key={cat.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{cat.name}</td>
                      <td className="px-5 py-3.5 text-slate-600 max-w-md truncate">
                        {cat.description || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          {count}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">
                        {formatDate(cat.createdAt)}
                      </td>
                      {isManagerOrAdmin && (
                        <td className="px-5 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(cat)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                              title="Edit category"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openDeleteModal(cat)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50"
                              title="Delete category"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editing ? 'Edit Category' : 'Add New Category'}
        subtitle="Categories help group products and track stock performance."
        footer={
          <>
            <button
              type="button"
              disabled={saving}
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="category-form"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Category'}
            </button>
          </>
        }
      >
        <form id="category-form" onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Beverages, Electronics, Stationery"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description for this category..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Category"
        message={
          deleteTargetProductCount > 0
            ? `"${deleteTarget?.name}" currently contains ${deleteTargetProductCount} product(s). Choose another category to reassign them before deleting.`
            : `Are you sure you want to permanently delete "${deleteTarget?.name}"?`
        }
        confirmLabel={
          deleteTargetProductCount > 0 ? 'Reassign & Delete' : 'Delete Category'
        }
        loading={deleting}
      >
        {deleteTargetProductCount > 0 && (
          <div className="space-y-1.5">
            {availableReassignCategories.length === 0 ? (
              <p className="text-xs text-red-600 font-medium">
                No other categories exist. Create another category first before deleting this one.
              </p>
            ) : (
              <>
                <label className="block text-xs font-semibold text-slate-700">
                  Reassign {deleteTargetProductCount} product(s) to:
                </label>
                <select
                  value={reassignCategoryId}
                  onChange={(e) => setReassignCategoryId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {availableReassignCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
