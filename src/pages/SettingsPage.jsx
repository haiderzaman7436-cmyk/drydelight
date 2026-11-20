import { useEffect, useState } from 'react';
import {
  Save,
  Printer,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  UploadCloud,
  Sparkles,
  Database,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { usePrint } from '../contexts/PrintContext';
import { checkQzTrayStatus } from '../services/printService';
import CatalogImportModal from '../components/inventory/CatalogImportModal';

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { isAdmin } = useAuth();
  const { printReceipt } = usePrint();

  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);

  const [qzStatus, setQzStatus] = useState({ checked: false, connected: false, printers: [], error: '' });
  const [checkingQz, setCheckingQz] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Only administrators can modify system settings.');
      return;
    }

    setSaving(true);
    try {
      await updateSettings(form);
      toast.success('Store & printer settings saved');
    } catch (err) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckQzTray = async () => {
    setCheckingQz(true);
    try {
      const res = await checkQzTrayStatus();
      setQzStatus({ checked: true, ...res });
      if (res.connected) {
        toast.success(`QZ Tray connected (${res.printers.length} printer(s) detected)`);
      } else {
        toast.error(res.error || 'QZ Tray not detected');
      }
    } finally {
      setCheckingQz(false);
    }
  };

  const handleTestPrint = () => {
    const sampleSale = {
      invoiceNumber: 'INV-TEST-0001',
      customerName: 'Test Customer',
      createdAt: new Date(),
      items: [
        {
          productId: 'sample-1',
          productName: 'Sample Product Item A',
          barcode: '2000000000017',
          quantity: 2,
          unitPrice: 250,
          lineTotal: 500,
        },
        {
          productId: 'sample-2',
          productName: 'Sample Item B (58mm Test)',
          barcode: '2000000000024',
          quantity: 1,
          unitPrice: 150,
          lineTotal: 150,
        },
      ],
      subtotal: 650,
      grandTotal: 650,
      paidAmount: 1000,
      remainingAmount: 0,
      changeAmount: 350,
    };

    printReceipt(sampleSale, 'sale', form);
  };

  return (
    <div className="max-w-4xl space-y-6">
      {!isAdmin && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>You are viewing settings in read-only mode. Only administrators can save changes.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Business Profile */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900">Business Information</h2>
            <p className="text-xs text-slate-500">
              Printed on thermal invoices and PDF sales reports.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Business Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={!isAdmin}
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contact Number
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={form.contactNumber}
                onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
                placeholder="+92 300 0000000"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Business Address
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={form.businessAddress}
                onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
                placeholder="Shop #, Street, City"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Currency Code
              </label>
              <input
                type="text"
                maxLength={6}
                disabled={!isAdmin}
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                placeholder="PKR"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Minimum Stock Level
              </label>
              <input
                type="number"
                min="0"
                step="1"
                disabled={!isAdmin}
                value={form.defaultMinStockLevel}
                onChange={(e) =>
                  setForm({ ...form, defaultMinStockLevel: Number(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50"
              />
            </div>
          </div>
        </div>

        {/* Invoice Customization */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900">Invoice Header &amp; Footer</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Invoice Header Tagline
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={form.invoiceHeader}
                onChange={(e) => setForm({ ...form, invoiceHeader: e.target.value })}
                placeholder="Optional tagline shown below address"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Invoice Footer (Thank You Message)
              </label>
              <textarea
                rows={2}
                disabled={!isAdmin}
                value={form.invoiceFooter}
                onChange={(e) => setForm({ ...form, invoiceFooter: e.target.value })}
                placeholder="Thank you for your business!"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50"
              />
            </div>

            <div className="flex flex-wrap gap-6 pt-1">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={Boolean(form.autoPrintAfterSale)}
                  onChange={(e) =>
                    setForm({ ...form, autoPrintAfterSale: e.target.checked })
                  }
                  className="rounded border-slate-300 text-blue-600"
                />
                Auto-print invoice immediately after completing sale
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={Boolean(form.showBarcodeOnReceipt)}
                  onChange={(e) =>
                    setForm({ ...form, showBarcodeOnReceipt: e.target.checked })
                  }
                  className="rounded border-slate-300 text-blue-600"
                />
                Show product barcode number under item name on receipt
              </label>
            </div>
          </div>
        </div>

        {/* Thermal Printer Settings */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Thermal Printer Configuration (58mm / 2-inch)
              </h2>
              <p className="text-xs text-slate-500">
                Configure direct browser 58mm printing or QZ Tray silent ESC/POS printing.
              </p>
            </div>
            <button
              type="button"
              onClick={handleTestPrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
            >
              <Printer className="w-3.5 h-3.5" />
              Test Print Receipt
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Printing Engine
              </label>
              <select
                disabled={!isAdmin}
                value={form.printerMode}
                onChange={(e) => setForm({ ...form, printerMode: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-50"
              >
                <option value="browser">Browser Direct Print (@media print 58mm)</option>
                <option value="qz_tray">QZ Tray Silent ESC/POS Print (Recommended for Windows)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Thermal Paper Width
              </label>
              <select
                disabled={!isAdmin}
                value={form.paperWidth}
                onChange={(e) => setForm({ ...form, paperWidth: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-50"
              >
                <option value="58mm">58mm (2-inch Thermal Printer)</option>
                <option value="80mm">80mm (3-inch Thermal Printer)</option>
              </select>
            </div>
          </div>

          {form.printerMode === 'qz_tray' ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800">
                  QZ Tray Local Bridge (Silent ESC/POS)
                </span>
                <button
                  type="button"
                  disabled={checkingQz}
                  onClick={handleCheckQzTray}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingQz ? 'animate-spin' : ''}`} />
                  Detect QZ Tray &amp; Printers
                </button>
              </div>

              {qzStatus.checked && (
                <div
                  className={`text-xs flex items-center gap-2 ${
                    qzStatus.connected ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {qzStatus.connected ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>
                    {qzStatus.connected
                      ? `Connected! Found ${qzStatus.printers.length} installed printer(s).`
                      : qzStatus.error}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Windows Printer Name (leave blank to use OS default printer)
                </label>
                {qzStatus.printers.length > 0 ? (
                  <select
                    disabled={!isAdmin}
                    value={form.printerName}
                    onChange={(e) => setForm({ ...form, printerName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">Use Windows Default Printer</option>
                    {qzStatus.printers.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={form.printerName}
                    onChange={(e) => setForm({ ...form, printerName: e.target.value })}
                    placeholder="e.g., POS-58 or XP-58"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-blue-900 leading-relaxed">
              <p className="font-semibold">Silent Printing Tip for Windows Chrome/Edge:</p>
              <p className="mt-1">
                Standard browsers show a print dialog for security reasons. To enable{' '}
                <strong>zero-dialog silent 58mm printing</strong> without QZ Tray, set your 58mm
                thermal printer as the Windows default printer and launch Chrome with{' '}
                <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-blue-200">
                  chrome.exe --kiosk-printing
                </code>
                . Or switch to <strong>QZ Tray</strong> above for native raw ESC/POS silent printing.
              </p>
            </div>
          )}
        </div>

        {/* Scraped Register Catalog & Inventory Seeder */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Register Inventory Import &amp; Database Tools
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
              372 Scraped Products
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            All 32 handwritten register photos in <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">img/</code> have been transcribed, categorized across 11 departments, assigned valid EAN-13 barcodes, and sorted alphabetically. You can populate or synchronize Firestore at any time.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => setImportModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <UploadCloud className="w-4 h-4" />
              Open Catalog Importer
            </button>
            <span className="text-[11px] text-slate-400">
              Includes GS1 check-digit barcodes and initial notebook quantities
            </span>
          </div>
        </div>

        {isAdmin && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving Settings...' : 'Save All Settings'}
            </button>
          </div>
        )}
      </form>

      <CatalogImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />
    </div>
  );
}
