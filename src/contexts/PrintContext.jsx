import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { createPortal, flushSync } from 'react-dom';
import toast from 'react-hot-toast';
import { useSettings } from './SettingsContext';
import { printViaQzTray, triggerBrowserThermalPrint } from '../services/printService';
import ThermalReceipt from '../components/printing/ThermalReceipt';

const PrintContext = createContext(null);

function ensurePrintRoot() {
  let root = document.getElementById('thermal-print-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'thermal-print-root';
    document.body.appendChild(root);
  }
  return root;
}

export function PrintProvider({ children }) {
  const { settings } = useSettings();
  const [printJob, setPrintJob] = useState(null);
  const [printing, setPrinting] = useState(false);

  const printReceipt = useCallback(
    async (documentData, type = 'sale', overrideSettings = null) => {
      if (!documentData) return;
      const activeSettings = overrideSettings ? { ...settings, ...overrideSettings } : settings;
      setPrinting(true);

      try {
        if (activeSettings.printerMode === 'qz_tray') {
          try {
            const res = await printViaQzTray({
              documentData,
              type,
              settings: activeSettings,
            });
            toast.success(`Printed silently to ${res.printerName}`);
            return;
          } catch (qzErr) {
            console.warn('QZ Tray unavailable, falling back to browser direct print:', qzErr);
            toast.error(`QZ Tray error (${qzErr.message}). Falling back to browser print.`);
          }
        }

        // Flush DOM synchronously so thermal receipt prints immediately with zero delay
        flushSync(() => {
          setPrintJob({ documentData, type, settings: activeSettings });
        });
        triggerBrowserThermalPrint(activeSettings.paperWidth || '80mm');
      } finally {
        setPrinting(false);
      }
    },
    [settings]
  );

  const value = useMemo(() => ({ printReceipt, printing }), [printReceipt, printing]);
  const printRoot = typeof document !== 'undefined' ? ensurePrintRoot() : null;

  return (
    <PrintContext.Provider value={value}>
      {children}
      {printRoot &&
        printJob &&
        createPortal(
          <ThermalReceipt
            documentData={printJob.documentData}
            type={printJob.type}
            settings={printJob.settings}
          />,
          printRoot
        )}
    </PrintContext.Provider>
  );
}

export function usePrint() {
  const ctx = useContext(PrintContext);
  if (!ctx) throw new Error('usePrint must be used inside PrintProvider');
  return ctx;
}
