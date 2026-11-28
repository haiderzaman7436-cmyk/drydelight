/**
 * ProductPhotosPage — bulk photo manager for all products.
 * Tap any product card → pick a real photo → it saves to Firestore and
 * shows everywhere in the app (Products, Inventory, POS, Dashboard).
 */
import { useState, useRef, useCallback, useMemo } from 'react';
import { Camera, CheckCircle2, Search, Upload, X, ImageIcon, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useData } from '../contexts/DataContext';
import { getProductImage, compressImageFileToDataUrl } from '../utils/productImages';
import { updateProduct } from '../services/productService';

/* ───── category colour map ───── */
const CAT_COLORS = {
  'Cheese & Dairy':                 'border-yellow-400 bg-yellow-50',
  'Atta, Maida & Flours':           'border-amber-400 bg-amber-50',
  'Cooking Oils & Ghee':            'border-orange-400 bg-orange-50',
  'Spices, Seasonings & Marinades': 'border-red-400 bg-red-50',
  'Sauces, Mayo & Condiments':      'border-green-400 bg-green-50',
  'Packaging, Disposables & Boxes': 'border-indigo-400 bg-indigo-50',
  'Canned & Preserved Foods':       'border-cyan-400 bg-cyan-50',
  'Pasta & Noodles':                'border-orange-300 bg-orange-50',
  'Frozen & Meats':                 'border-blue-400 bg-blue-50',
  'Cleaning, Hygiene & Supplies':   'border-purple-400 bg-purple-50',
  'Bakery, Buns & Breads':          'border-yellow-700 bg-yellow-50',
};

function catBorder(cat) {
  return CAT_COLORS[cat] || 'border-slate-300 bg-slate-50';
}

export default function ProductPhotosPage() {
  const { products, refreshCatalog } = useData();
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('All');
  const [uploading, setUploading] = useState(null); // productId being uploaded
  const [localImages, setLocalImages] = useState({}); // productId → data URL preview
  const fileInputRef = useRef(null);
  const pendingProductRef = useRef(null);

  const categories = useMemo(() => {
    const cats = [...new Set(products.map((p) => p.categoryName).filter(Boolean))].sort();
    return ['All', ...cats];
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter((p) => {
      const matchCat = selectedCat === 'All' || p.categoryName === selectedCat;
      const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [products, search, selectedCat]);

  const hasCustomImage = useCallback(
    (prod) => {
      const url = localImages[prod.id] || prod.imageUrl || '';
      return url.startsWith('data:') || url.startsWith('http');
    },
    [localImages]
  );

  const handleCardClick = useCallback((prod) => {
    pendingProductRef.current = prod;
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || !pendingProductRef.current) return;
      const prod = pendingProductRef.current;
      pendingProductRef.current = null;

      setUploading(prod.id);
      try {
        const dataUrl = await compressImageFileToDataUrl(file, 400, 0.85);
        // Optimistic preview
        setLocalImages((prev) => ({ ...prev, [prod.id]: dataUrl }));
        // Persist to Firestore
        await updateProduct(prod.id, { imageUrl: dataUrl });
        toast.success(`Photo saved for "${prod.name}"`, { duration: 2000 });
        refreshCatalog();
      } catch (err) {
        console.error(err);
        toast.error('Failed to save photo. Try a smaller image.');
        setLocalImages((prev) => {
          const copy = { ...prev };
          delete copy[prod.id];
          return copy;
        });
      } finally {
        setUploading(null);
      }
    },
    [refreshCatalog]
  );

  const handleRemoveImage = useCallback(
    async (e, prod) => {
      e.stopPropagation();
      if (!confirm(`Remove photo for "${prod.name}"?`)) return;
      setUploading(prod.id);
      try {
        await updateProduct(prod.id, { imageUrl: '' });
        setLocalImages((prev) => {
          const copy = { ...prev };
          delete copy[prod.id];
          return copy;
        });
        toast.success('Photo removed');
        refreshCatalog();
      } catch {
        toast.error('Failed to remove photo');
      } finally {
        setUploading(null);
      }
    },
    [refreshCatalog]
  );

  const withPhotoCount = filtered.filter(hasCustomImage).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-[#0f2347] flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-600" />
            Product Photos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tap any card to upload a real product photo · {withPhotoCount}/{filtered.length} have photos
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
          <Upload className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Take a photo of the product bag/box and tap the card to upload it</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
                selectedCat === cat
                  ? 'bg-[#0f2347] text-white border-[#0f2347]'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-700'
              }`}
            >
              {cat === 'All' ? `All (${products.length})` : cat.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-xs">
        <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
          <div
            className="h-2.5 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${filtered.length ? (withPhotoCount / filtered.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs font-bold text-slate-700 shrink-0">
          {withPhotoCount}/{filtered.length} photos
        </span>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Product Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {filtered.map((prod) => {
          const isUploading = uploading === prod.id;
          const localImg = localImages[prod.id];
          const displayImg = localImg || (hasCustomImage(prod) ? prod.imageUrl : null);
          const fallbackImg = getProductImage(prod);
          const hasReal = !!displayImg;

          return (
            <div
              key={prod.id}
              onClick={() => !isUploading && handleCardClick(prod)}
              className={`relative group rounded-2xl border-2 overflow-hidden cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] ${
                hasReal
                  ? 'border-emerald-400 shadow-sm'
                  : catBorder(prod.categoryName)
              }`}
            >
              {/* Image area */}
              <div className="w-full aspect-square bg-white relative flex items-center justify-center overflow-hidden">
                {displayImg ? (
                  <img
                    src={displayImg}
                    alt={prod.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={fallbackImg}
                    alt={prod.name}
                    className="w-4/5 h-4/5 object-contain"
                  />
                )}

                {/* Upload overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                  {isUploading ? (
                    <RefreshCw className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <>
                      <Camera className="w-6 h-6 text-white" />
                      <span className="text-white text-[11px] font-semibold">
                        {hasReal ? 'Change Photo' : 'Add Photo'}
                      </span>
                    </>
                  )}
                </div>

                {/* Has-photo badge */}
                {hasReal && !isUploading && (
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow">
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  </div>
                )}

                {/* Remove button */}
                {hasReal && !isUploading && (
                  <button
                    onClick={(e) => handleRemoveImage(e, prod)}
                    className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-red-500 opacity-0 group-hover:opacity-100 flex items-center justify-center shadow transition-opacity"
                    title="Remove photo"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                )}
              </div>

              {/* Name label */}
              <div className="px-2 py-1.5 bg-white border-t border-slate-100">
                <p className="text-[11px] font-bold text-[#0f2347] line-clamp-2 leading-tight text-center">
                  {prod.name}
                </p>
                <p className="text-[10px] text-slate-400 text-center mt-0.5 truncate">
                  {prod.categoryName?.split(' ')[0]}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">No products match your filter</p>
        </div>
      )}
    </div>
  );
}
