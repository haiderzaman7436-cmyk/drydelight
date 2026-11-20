import { useRef, useState, useCallback, useEffect } from 'react';
import { normalizeBarcode } from '../utils/barcode';

/**
 * Low-latency USB Keyboard-Wedge Barcode Scanner Hook
 * - Auto-focuses input immediately
 * - Detects Enter key termination with 80ms duplicate-bounce guard
 * - Clears input and maintains focus synchronously after every scan
 */
export function useBarcodeScanner({ onScan, autoFocus = true, debounceMs = 80 }) {
  const inputRef = useRef(null);
  const lastScanRef = useRef({ code: '', time: 0 });
  const [value, setValue] = useState('');
  const [scanning, setScanning] = useState(false);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (autoFocus) focusInput();
  }, [autoFocus, focusInput]);

  const handleKeyDown = useCallback(
    async (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();

      const code = normalizeBarcode(value);
      setValue('');
      if (!code || scanning) {
        focusInput();
        return;
      }

      const now = Date.now();
      if (
        lastScanRef.current.code === code &&
        now - lastScanRef.current.time < debounceMs
      ) {
        focusInput();
        return;
      }

      lastScanRef.current = { code, time: now };
      setScanning(true);

      try {
        await onScan(code);
      } finally {
        setScanning(false);
        focusInput();
      }
    },
    [value, scanning, debounceMs, onScan, focusInput]
  );

  return {
    inputRef,
    value,
    setValue,
    scanning,
    handleKeyDown,
    focusInput,
  };
}
