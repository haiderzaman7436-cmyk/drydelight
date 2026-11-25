import { buildEscPosReceipt } from '../utils/escpos';

const QZ_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.min.js';
const PAGE_SIZE_STYLE_ID = 'thermal-page-size-style';
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

export function isWebSerialSupported() {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export async function getPairedSerialPorts() {
  if (!isWebSerialSupported()) return [];
  try {
    return await navigator.serial.getPorts();
  } catch {
    return [];
  }
}

export async function requestSerialPrinterPort() {
  if (!isWebSerialSupported()) {
    throw new Error('Direct COM/USB Serial requires Google Chrome or Microsoft Edge.');
  }
  return navigator.serial.requestPort();
}

export async function printViaWebSerial({ documentData, type = 'sale', settings = {} }) {
  if (!isWebSerialSupported()) {
    throw new Error('WebSerial is not supported in this browser. Use Chrome or Edge.');
  }

  const ports = await navigator.serial.getPorts();
  let port = ports[0];
  if (!port) {
    port = await navigator.serial.requestPort();
  }

  const baudRate = Number(settings.serialBaudRate || 9600);
  const escposPayload = buildEscPosReceipt({ documentData, type, settings }).join('');
  const bytes = new TextEncoder().encode(escposPayload);

  let openedHere = false;
  if (!port.readable && !port.writable) {
    await port.open({ baudRate });
    openedHere = true;
  }

  const writer = port.writable.getWriter();
  try {
    for (let i = 0; i < bytes.length; i += 256) {
      await writer.write(bytes.slice(i, i + 256));
    }
  } finally {
    writer.releaseLock();
    if (openedHere) {
      await port.close().catch(() => {});
    }
  }

  return { mode: 'serial', baudRate };
}

function setThermalPageSizeStyle(paperWidth) {
  let styleEl = document.getElementById(PAGE_SIZE_STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = PAGE_SIZE_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  const widthCss = paperWidth === '58mm' ? '58mm' : '80mm';
  styleEl.textContent = `@media print { @page { size: ${widthCss} auto; margin: 0mm; } }`;
}

function removeThermalPageSizeStyle() {
  const existing = document.getElementById(PAGE_SIZE_STYLE_ID);
  if (existing) existing.remove();
}

export function triggerBrowserThermalPrint(paperWidth = '80mm') {
  const body = document.body;
  body.classList.remove('printing-report', 'thermal-80mm');
  body.classList.add('printing-thermal');
  if (paperWidth !== '58mm') {
    body.classList.add('thermal-80mm');
  }
  setThermalPageSizeStyle(paperWidth);

  let cleaned = false;
  let fallbackTimer = null;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (fallbackTimer) clearTimeout(fallbackTimer);
    body.classList.remove('printing-thermal', 'thermal-80mm');
    removeThermalPageSizeStyle();
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);
  // Safety cleanup in case afterprint does not fire in certain browser/kiosk wrappers
  fallbackTimer = setTimeout(cleanup, 3000);
  window.print();
}

export function triggerBrowserReportPrint() {
  const body = document.body;
  body.classList.remove('printing-thermal', 'thermal-80mm');
  removeThermalPageSizeStyle();
  body.classList.add('printing-report');

  let cleaned = false;
  let fallbackTimer = null;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (fallbackTimer) clearTimeout(fallbackTimer);
    body.classList.remove('printing-report');
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);
  fallbackTimer = setTimeout(cleanup, 3000);
  window.print();
}
