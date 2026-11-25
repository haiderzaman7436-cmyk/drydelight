import { buildEscPosReceipt } from '../utils/escpos';

const QZ_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.min.js';
let qzLoadPromise = null;

function loadQzScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window unavailable'));
  if (window.qz) return Promise.resolve(window.qz);
  if (qzLoadPromise) return qzLoadPromise;

  qzLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = QZ_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.qz) resolve(window.qz);
      else reject(new Error('QZ Tray script loaded but window.qz was not found.'));
    };
    script.onerror = () => {
      qzLoadPromise = null;
      reject(new Error('Failed to load QZ Tray client library.'));
    };
    document.head.appendChild(script);
  });

  return qzLoadPromise;
}

export async function connectQzTray() {
  const qz = await loadQzScript();
  if (!qz.websocket.isActive()) {
    await qz.websocket.connect({ retries: 1, delay: 1 });
  }
  return qz;
}

export async function checkQzTrayStatus() {
  try {
    const qz = await connectQzTray();
    const printers = await qz.printers.find();
    return {
      connected: true,
      printers: Array.isArray(printers) ? printers : [printers].filter(Boolean),
    };
  } catch (err) {
    return {
      connected: false,
      printers: [],
      error: err?.message || 'QZ Tray is not running on this machine.',
    };
  }
}

export async function printViaQzTray({ documentData, type = 'sale', settings = {} }) {
  const qz = await connectQzTray();
  const printerName = settings.printerName || (await qz.printers.getDefault());
  if (!printerName) {
    throw new Error('No thermal printer selected or configured as default in Windows.');
  }

  const config = qz.configs.create(printerName, {
    encoding: 'UTF-8',
    copies: 1,
  });

  const rawData = buildEscPosReceipt({ documentData, type, settings });
  await qz.print(config, rawData);
  return { mode: 'qz_tray', printerName };
}

export function triggerBrowserThermalPrint(paperWidth = '80mm') {
  const body = document.body;
  body.classList.remove('printing-report', 'thermal-80mm');
  body.classList.add('printing-thermal');
  if (paperWidth === '80mm') {
    body.classList.add('thermal-80mm');
  }

  const cleanup = () => {
    body.classList.remove('printing-thermal', 'thermal-80mm');
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);
  window.print();
  // Immediate cleanup after synchronous print dialog returns
  cleanup();
}

export function triggerBrowserReportPrint() {
  const body = document.body;
  body.classList.remove('printing-thermal', 'thermal-80mm');
  body.classList.add('printing-report');

  const cleanup = () => {
    body.classList.remove('printing-report');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  cleanup();
}
