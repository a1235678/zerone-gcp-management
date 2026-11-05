/**
 * 匯出 CSV（UTF-8 加 BOM，Excel 直接開啟不會亂碼）。
 * 回傳 false 表示瀏覽器擋下下載（例如嵌在某些預覽框架裡）。
 */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): boolean {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = '﻿' + [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
