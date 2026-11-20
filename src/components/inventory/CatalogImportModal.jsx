import { useState } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
  Sparkles,
  Barcode,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import { importScrapedCatalog } from '../../services/catalogImportService';
import scrapedCatalog from '../../data/scrapedCatalog.json';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';

export default function CatalogImportModal({ isOpen, onClose }) {
  const { user, isManagerOrAdmin } = useAuth();
  const { refreshCatalog } = useData();

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [updateExistingStock, setUpdateExistingStock] = useState(false);
  const [result, setResult] = useState(null);

  const categoryBreakdown = scrapedCatalog.categories.map((c) => {
    const count = scrapedCatalog.products.filter((p) => p.categoryId === c.id).length;
    return { name: c.name, count };
  });

  const handleStartImport = async () => {
    if (!isManagerOrAdmin) {
      toast.error('Only managers or admins can import inventory');
      return;
    }

    setImporting(true);
    setProgress(5);
    setStatusMsg('Initializing import...');
    setResult(null);

    try {
      const res = await importScrapedCatalog({
        user,
        updateExistingStock,
        onProgress: (p, msg) => {
          setProgress(p);
          setStatusMsg(msg);
        },
      });

      setResult(res);
      await refreshCatalog();
      toast.success(
        `Import complete! Created ${res.productsCreated} products across ${res.categoriesCreated} categories.`
      );
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to import scraped catalog');
      setStatusMsg(`Error: ${err.message || 'Failed'}`);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (importing) return;
    setResult(null);
    setProgress(0);
    setStatusMsg('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Catalog from Handwritten Register Images"
      size="xl"
    >
      <div className="space-y-5">
        {/* Banner summary */}
        <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-blue-950">
            <Sparkles className="w-4 h-4 text-blue-600" />
            32 Register Images Transcribed &amp; Categorized
          </div>
          <p className="leading-relaxed">
            All inventory lists from the <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-blue-200">img/</code> folder
            (images 1 through 32) have been scraped, categorized into 11 departments, assigned valid EAN-13 barcodes, and alphabetized.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
            <div className="p-2 rounded bg-white border border-blue-100">
              <span className="text-slate-500 block">Total Items:</span>
              <span className="font-bold text-slate-900 text-sm">{scrapedCatalog.products.length}</span>
            </div>
            <div className="p-2 rounded bg-white border border-blue-100">
              <span className="text-slate-500 block">Categories:</span>
              <span className="font-bold text-slate-900 text-sm">{scrapedCatalog.categories.length}</span>
            </div>
            <div className="p-2 rounded bg-white border border-blue-100">
              <span className="text-slate-500 block">Barcodes:</span>
              <span className="font-bold text-slate-900 text-sm">GS1 EAN-13</span>
            </div>
            <div className="p-2 rounded bg-white border border-blue-100">
              <span className="text-slate-500 block">Sort Order:</span>
              <span className="font-bold text-slate-900 text-sm">A → Z Sorted</span>
            </div>
          </div>
        </div>

        {/* Category breakdown */}
        <div>
          <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            Department Breakdown
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {categoryBreakdown.map((cat) => (
              <div
                key={cat.name}
                className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between"
              >
                <span className="font-medium text-slate-800 truncate pr-2">{cat.name}</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[11px] shrink-0">
                  {cat.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Options */}
        <div className="p-3 rounded-lg border border-slate-200 bg-white">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              disabled={importing}
              checked={updateExistingStock}
              onChange={(e) => setUpdateExistingStock(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="text-xs">
              <span className="font-semibold text-slate-800 block">
                Update stock on existing products
              </span>
              <span className="text-slate-500">
                If unchecked, already existing products will be skipped safely without overriding manual changes.
              </span>
            </div>
          </label>
        </div>

        {/* Progress display */}
        {importing && (
          <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                {statusMsg || 'Importing...'}
              </span>
              <span className="font-mono text-slate-500 font-bold">{progress}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2 transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Result summary */}
        {result && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-sm text-emerald-950">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Import Succeeded!
            </div>
            <p>
              Categories Created: <span className="font-bold">{result.categoriesCreated}</span> ·
              Products Created: <span className="font-bold">{result.productsCreated}</span> ·
              Updated: <span className="font-bold">{result.productsUpdated}</span> ·
              Skipped: <span className="font-bold">{result.skipped}</span>
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            disabled={importing}
            onClick={handleClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button
              type="button"
              disabled={importing}
              onClick={handleStartImport}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
            >
              <UploadCloud className="w-4 h-4" />
              {importing ? 'Importing...' : 'Start Import into Database'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
