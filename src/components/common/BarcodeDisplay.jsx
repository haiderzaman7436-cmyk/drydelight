import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export default function BarcodeDisplay({ value, height = 44, fontSize = 12 }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      const format = /^\d{13}$/.test(value) ? 'EAN13' : 'CODE128';
      JsBarcode(svgRef.current, String(value), {
        format,
        width: 1.6,
        height,
        displayValue: true,
        fontSize,
        margin: 4,
        background: '#ffffff',
        lineColor: '#0f172a',
      });
    } catch {
      // Fallback to CODE128 if check digit of 13-digit external code doesn't match EAN13
      try {
        JsBarcode(svgRef.current, String(value), {
          format: 'CODE128',
          width: 1.5,
          height,
          displayValue: true,
          fontSize,
          margin: 4,
          background: '#ffffff',
          lineColor: '#0f172a',
        });
      } catch {
        // Ignore unrenderable strings
      }
    }
  }, [value, height, fontSize]);

  if (!value) {
    return <span className="text-xs text-slate-400 italic">No barcode assigned</span>;
  }

  return (
    <div className="inline-flex items-center justify-center bg-white border border-slate-200 rounded-lg px-2 py-1">
      <svg ref={svgRef} className="max-w-full" />
    </div>
  );
}
