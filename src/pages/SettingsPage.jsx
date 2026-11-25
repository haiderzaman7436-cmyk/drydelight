import { useEffect, useState, useMemo } from 'react';
import {
  Save,
  Printer,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  UploadCloud,
  Database,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { usePrint } from '../contexts/PrintContext';
import { checkQzTrayStatus } from '../services/printService';
import Modal from '../components/common/Modal';
import ThermalReceipt from '../components/printing/ThermalReceipt';
import CatalogImportModal from '../components/inventory/CatalogImportModal';

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { isAdmin } = useAuth();
  const { printReceipt } = usePrint();

  const [form, setForm] = useState(settings);
  const [newProfitPin, setNewProfitPin] = useState('');
  const [confirmProfitPin, setConfirmProfitPin] = useState('');
  const [showNewPin, setShowNewPin] = useState(false);
  const [saving, setSaving] = useState(false);

  const [qzStatus, setQzStatus] = useState({ checked: false, connected: false, printers: [], error: '' });
  const [checkingQz, setCheckingQz] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const sampleSale = useMemo(
    () => ({
      invoiceNumber: 'INV-TEST-0001',
      customerName: 'Walk-in Customer',
      createdAt: new Date(),
      items: [
        {
          productId: 'sample-1',
          productName: 'Almond Giri American 500g',
          barcode: '2000000000017',
          quantity: 2,
          unitPrice: 1250,
          lineTotal: 2500,
        },
        {
          productId: 'sample-2',
          productName: 'Kishmish Green Special 250g',
          barcode: '2000000000024',
          quantity: 1,
          unitPrice: 450,
          lineTotal: 450,
        },
      ],
      subtotal: 2950,
      grandTotal: 2950,
      paidAmount: 3000,
      remainingAmount: 0,
      changeAmount: 50,
    }),
    []
  );

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Only administrators can modify system settings.');
      return;
    }

    const trimmedPin = newProfitPin.trim();
    if (trimmedPin) {
      if (trimmedPin.length < 4) {
        toast.error('Profit Lock PIN must be at least 4 characters or digits.');
        return;
      }
      if (trimmedPin !== confirmProfitPin.trim()) {
        toast.error('New Profit Lock PIN and confirmation do not match.');
        return;
      }
    }

    setSaving(true);
    try {
      await updateSettings({
        ...form,
        newProfitPin: trimmedPin,
      });
      setNewProfitPin('');
      setConfirmProfitPin('');
      setShowNewPin(false);
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

        {/* Profit Lock Security */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Profit Lock Security (Today&apos;s &amp; Monthly Profit)
                </h2>
                <p className="text-xs text-slate-500">
                  Protect Today&apos;s Profit, Monthly Profit, and profit charts behind a PIN lock.
                </p>
              </div>
            </div>
            {isAdmin && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                  form.profitLockPinCustomized
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                {form.profitLockPinCustomized ? 'Custom PIN Active' : 'Default PIN: 1234'}
              </span>
            )}
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800">
            <input
              type="checkbox"
              disabled={!isAdmin}
              checked={form.profitLockEnabled !== false}
              onChange={(e) => setForm({ ...form, profitLockEnabled: e.target.checked })}
              className="rounded border-slate-300 text-blue-600"
            />
            Require PIN to unlock and view Today&apos;s Profit &amp; Monthly Profit
          </label>

          {isAdmin && form.profitLockEnabled !== false && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Profit Lock PIN (Optional)
                </label>
                <div className="relative">
                  <input
                    type={showNewPin ? 'text' : 'password'}
                    inputMode="numeric"
                    autoComplete="new-password"
                    value={newProfitPin}
                    onChange={(e) => setNewProfitPin(e.target.value)}
                    placeholder="Min 4 characters (leave blank to keep)"
                    className="w-full pl-3 pr-9 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPin((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                    aria-label={showNewPin ? 'Hide new PIN' : 'Show new PIN'}
                  >
                    {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm New PIN
                </label>
                <input
                  type={showNewPin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="new-password"
                  value={confirmProfitPin}
                  onChange={(e) => setConfirmProfitPin(e.target.value)}
                  placeholder="Re-enter new PIN"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          )}
        </div>

        {/* Thermal Printer Settings */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Thermal Printer Configuration (80mm POS Receipt)
              </h2>
              <p className="text-xs text-slate-500">
                High-contrast bold 80mm receipt formatting for clear reading on thermal printers.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700"
              >
                <Eye className="w-3.5 h-3.5" />
                Preview {form.paperWidth || '80mm'} Invoice
              </button>
              <button
                type="button"
                onClick={handleTestPrint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
              >
                <Printer className="w-3.5 h-3.5" />
                Test Print Receipt
              </button>
            </div>
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
                <option value="browser">Browser Direct Print (@media print 80mm)</option>
                <option value="qz_tray">QZ Tray Silent ESC/POS Print (Recommended for Windows)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Thermal Paper Width
              </label>
              <select
                disabled={!isAdmin}
                value={form.paperWidth || '80mm'}
                onChange={(e) => setForm({ ...form, paperWidth: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-50"
              >
                <option value="80mm">80mm (3-inch POS Thermal Printer — Recommended)</option>
                <option value="58mm">58mm (2-inch Thermal Printer)</option>
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
                    placeholder="e.g., POS-80 or XP-80"
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
                <strong>zero-dialog silent 80mm printing</strong> without QZ Tray, set your 80mm
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

      <Modal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`${form.paperWidth || '80mm'} POS Receipt Preview`}
        subtitle="Exact bold thermal print layout shown on paper."
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleTestPrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Test Receipt
            </button>
          </>
        }
      >
        <div className="bg-slate-200/80 p-4 rounded-xl flex justify-center overflow-x-auto">
          <div className="bg-white shadow-md border border-slate-300 rounded-sm">
            <ThermalReceipt documentData={sampleSale} type="sale" settings={form} />
          </div>
        </div>
      </Modal>

      <CatalogImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />
    </div>
  );
}
