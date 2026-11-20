import { formatDateTime, roundMoney } from './formatters';

/**
 * ESC/POS raw thermal printer formatter for 58mm (32 columns) and 80mm (42 columns) printers.
 * Used by QZ Tray silent direct printing integration on Windows POS terminals.
 */

const ESC = '\x1B';
const GS = '\x1D';

const CMD = {
  INIT: `${ESC}@`,
  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  ALIGN_RIGHT: `${ESC}a\x02`,
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  DOUBLE_HEIGHT_ON: `${GS}!\x01`,
  NORMAL_SIZE: `${GS}!\x00`,
  FEED_AND_CUT: `\n\n\n${GS}V\x41\x03`,
};

function sanitize(text) {
  return String(text ?? '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .trim();
}

export function padRow(left, right, width = 32) {
  const l = sanitize(left);
  const r = sanitize(right);
  const maxLeft = Math.max(1, width - r.length - 1);
  const clippedLeft = l.length > maxLeft ? l.slice(0, maxLeft) : l;
  const spaces = Math.max(1, width - clippedLeft.length - r.length);
  return `${clippedLeft}${' '.repeat(spaces)}${r}`;
}

export function wrapText(text, width = 32) {
  const clean = sanitize(text);
  if (!clean) return [];
  const words = clean.split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    if (word.length > width) {
      if (current) {
        lines.push(current);
        current = '';
      }
      for (let i = 0; i < word.length; i += width) {
        lines.push(word.slice(i, i + width));
      }
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= width) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function money(val, currency) {
  const num = roundMoney(val);
  const str = num.toLocaleString('en-US', {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${str}`;
}

/**
 * Builds an array of ESC/POS strings ready to be sent to QZ Tray `qz.print(config, data)`.
 */
export function buildEscPosReceipt({ documentData, type = 'sale', settings = {} }) {
  const width = settings.paperWidth === '80mm' ? 42 : 32;
  const currency = settings.currency || 'PKR';
  const divider = '-'.repeat(width);
  const thickDivider = '='.repeat(width);
  const lines = [];

  lines.push(CMD.INIT);
  lines.push(CMD.ALIGN_CENTER);
  lines.push(CMD.BOLD_ON);
  lines.push(CMD.DOUBLE_HEIGHT_ON);
  for (const l of wrapText(settings.businessName || 'Dry Delight', width)) {
    lines.push(`${l}\n`);
  }
  lines.push(CMD.NORMAL_SIZE);
  lines.push(CMD.BOLD_OFF);

  if (settings.businessAddress) {
    for (const l of wrapText(settings.businessAddress, width)) {
      lines.push(`${l}\n`);
    }
  }
  if (settings.contactNumber) {
    lines.push(`Tel: ${sanitize(settings.contactNumber)}\n`);
  }
  if (settings.invoiceHeader) {
    for (const l of wrapText(settings.invoiceHeader, width)) {
      lines.push(`${l}\n`);
    }
  }

  lines.push(`${thickDivider}\n`);
  lines.push(CMD.BOLD_ON);
  lines.push(type === 'return' ? 'SALES RETURN RECEIPT\n' : 'SALES INVOICE\n');
  lines.push(CMD.BOLD_OFF);
  lines.push(`${divider}\n`);

  lines.push(CMD.ALIGN_LEFT);

  if (type === 'return') {
    lines.push(`${padRow('Return #:', documentData.returnInvoiceNumber, width)}\n`);
    lines.push(`${padRow('Orig Inv:', documentData.originalInvoiceNumber, width)}\n`);
    lines.push(`${padRow('Date:', formatDateTime(documentData.createdAt || new Date()), width)}\n`);
    lines.push(`${padRow('Customer:', documentData.customerName || 'Walk-in', width)}\n`);
  } else {
    lines.push(`${padRow('Invoice:', documentData.invoiceNumber, width)}\n`);
    lines.push(`${padRow('Date:', formatDateTime(documentData.createdAt || new Date()), width)}\n`);
    lines.push(`${padRow('Customer:', documentData.customerName || 'Walk-in', width)}\n`);
  }

  lines.push(`${divider}\n`);
  lines.push(CMD.BOLD_ON);
  lines.push(`${padRow('Item (Qty x Price)', 'Total', width)}\n`);
  lines.push(CMD.BOLD_OFF);
  lines.push(`${divider}\n`);

  for (const item of documentData.items || []) {
    const qty = type === 'return' ? item.returnQuantity : item.quantity;
    const total = type === 'return' ? item.lineReturnTotal : item.lineTotal;
    for (const nameLine of wrapText(item.productName, width)) {
      lines.push(`${nameLine}\n`);
    }
    const detail = `  ${qty} x ${roundMoney(item.unitPrice)}`;
    lines.push(`${padRow(detail, money(total, currency), width)}\n`);
  }

  lines.push(`${divider}\n`);

  if (type === 'return') {
    lines.push(CMD.BOLD_ON);
    lines.push(`${padRow('TOTAL REFUND:', money(documentData.totalReturnAmount, currency), width)}\n`);
    lines.push(CMD.BOLD_OFF);
    if (documentData.reason) {
      lines.push(`${divider}\n`);
      for (const r of wrapText(`Reason: ${documentData.reason}`, width)) {
        lines.push(`${r}\n`);
      }
    }
  } else {
    lines.push(`${padRow('Subtotal:', money(documentData.subtotal, currency), width)}\n`);
    lines.push(CMD.BOLD_ON);
    lines.push(`${padRow('GRAND TOTAL:', money(documentData.grandTotal, currency), width)}\n`);
    lines.push(CMD.BOLD_OFF);
    lines.push(`${padRow('Paid:', money(documentData.paidAmount, currency), width)}\n`);
    if (Number(documentData.remainingAmount || 0) > 0) {
      lines.push(`${padRow('Remaining:', money(documentData.remainingAmount, currency), width)}\n`);
    }
    if (Number(documentData.changeAmount || 0) > 0) {
      lines.push(`${padRow('Change:', money(documentData.changeAmount, currency), width)}\n`);
    }
  }

  lines.push(`${thickDivider}\n`);
  lines.push(CMD.ALIGN_CENTER);
  const footer = settings.invoiceFooter || 'Thank you for your business!';
  for (const f of wrapText(footer, width)) {
    lines.push(`${f}\n`);
  }
  lines.push(CMD.FEED_AND_CUT);

  return lines;
}
