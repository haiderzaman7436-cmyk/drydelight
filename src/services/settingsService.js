import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export const DEFAULT_SETTINGS = {
  businessName: 'Dry Delight',
  businessAddress: 'Main Commercial Market, City',
  contactNumber: '+92 300 0000000',
  invoiceHeader: 'Dry Delight — Quality Products & Trusted Service',
  invoiceFooter: 'Thank you for shopping at Dry Delight! Goods once sold can be returned with original receipt.',
  currency: 'PKR',
  defaultMinStockLevel: 5,
  printerMode: 'browser', // 'browser' | 'qz_tray'
  printerName: '',
  paperWidth: '58mm', // '58mm' | '80mm'
  autoPrintAfterSale: true,
  showBarcodeOnReceipt: false,
};

const SETTINGS_DOC_REF = () => doc(db, 'settings', 'storeConfig');

function normalizeBrandSettings(raw) {
  const merged = { ...DEFAULT_SETTINGS, ...raw };
  if (!merged.businessName || merged.businessName === 'My Retail Store') {
    merged.businessName = 'Dry Delight';
  }
  if (merged.invoiceHeader === 'Quality Products & Trusted Service') {
    merged.invoiceHeader = DEFAULT_SETTINGS.invoiceHeader;
  }
  if (
    merged.invoiceFooter ===
    'Thank you for shopping with us! Goods once sold can be returned with original receipt.'
  ) {
    merged.invoiceFooter = DEFAULT_SETTINGS.invoiceFooter;
  }
  return merged;
}

export async function getStoreSettings() {
  const snap = await getDoc(SETTINGS_DOC_REF());
  if (!snap.exists()) {
    return { ...DEFAULT_SETTINGS };
  }
  return normalizeBrandSettings(snap.data());
}

export async function saveStoreSettings(settingsData, userId) {
  const payload = {
    businessName: String(settingsData.businessName || DEFAULT_SETTINGS.businessName).trim(),
    businessAddress: String(settingsData.businessAddress || '').trim(),
    contactNumber: String(settingsData.contactNumber || '').trim(),
    invoiceHeader: String(settingsData.invoiceHeader || '').trim(),
    invoiceFooter: String(settingsData.invoiceFooter || DEFAULT_SETTINGS.invoiceFooter).trim(),
    currency: String(settingsData.currency || 'PKR').trim().toUpperCase(),
    defaultMinStockLevel: Math.max(0, Math.floor(Number(settingsData.defaultMinStockLevel) || 0)),
    printerMode: settingsData.printerMode === 'qz_tray' ? 'qz_tray' : 'browser',
    printerName: String(settingsData.printerName || '').trim(),
    paperWidth: settingsData.paperWidth === '80mm' ? '80mm' : '58mm',
    autoPrintAfterSale: Boolean(settingsData.autoPrintAfterSale),
    showBarcodeOnReceipt: Boolean(settingsData.showBarcodeOnReceipt),
    updatedBy: userId || null,
    updatedAt: serverTimestamp(),
  };

  await setDoc(SETTINGS_DOC_REF(), payload, { merge: true });
  return { ...DEFAULT_SETTINGS, ...payload };
}
