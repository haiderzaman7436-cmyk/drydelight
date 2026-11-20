/**
 * Formatting and local-date utilities.
 * Uses local calendar dates (YYYY-MM-DD) so daily POS sales align with the store's local day.
 */

export function roundMoney(value) {
  const num = Number(value) || 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(amount, currency = 'PKR') {
  const num = roundMoney(amount);
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${formatted}`;
}

export function formatNumber(value) {
  const num = Number(value) || 0;
  return num.toLocaleString('en-US');
}

export function toLocalDateKey(dateInput = new Date()) {
  const d = normalizeDate(dateInput);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toLocalMonthKey(dateInput = new Date()) {
  const d = normalizeDate(dateInput);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function parseLocalDateKey(dateKey) {
  if (!dateKey || typeof dateKey !== 'string') return new Date();
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

/**
 * Shift a YYYY-MM-DD date string by deltaDays (e.g., +1 for Next Day, -1 for Previous Day).
 * Pure function — never mutates any sale records.
 */
export function shiftDateKey(dateKey, deltaDays) {
  const date = parseLocalDateKey(dateKey);
  date.setDate(date.getDate() + deltaDays);
  return toLocalDateKey(date);
}

export function normalizeDate(value) {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return parseLocalDateKey(value);
  }
  return new Date(value);
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = normalizeDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(value) {
  if (!value) return '—';
  const d = normalizeDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function formatMonthLabel(monthKey) {
  if (!monthKey) return '—';
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

export function getLastNDaysKeys(n, endDateKey = toLocalDateKey()) {
  const keys = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    keys.push(shiftDateKey(endDateKey, -i));
  }
  return keys;
}

export function getLastNMonthsKeys(n, referenceDate = new Date()) {
  const keys = [];
  const base = normalizeDate(referenceDate);
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    keys.push(toLocalMonthKey(d));
  }
  return keys;
}
