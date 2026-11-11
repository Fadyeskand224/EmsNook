/** Any ISBN-10 or ISBN-13 as printed to a valid ISBN-13, or null. (The server checks again.) */
export function normIsbn(raw) {
  const d = String(raw ?? '').replace(/[\s-]/g, '').toUpperCase();
  if (/^\d{13}$/.test(d)) {
    const sum = [...d].slice(0, 12).reduce((n, c, i) => n + Number(c) * (i % 2 ? 3 : 1), 0);
    return (10 - (sum % 10)) % 10 === Number(d[12]) && /^97[89]/.test(d) ? d : null;
  }
  if (/^\d{9}[\dX]$/.test(d)) {
    const sum = [...d].reduce((n, c, i) => n + (c === 'X' ? 10 : Number(c)) * (10 - i), 0);
    if (sum % 11 !== 0) return null;
    const core = `978${d.slice(0, 9)}`;
    const s13 = [...core].reduce((n, c, i) => n + Number(c) * (i % 2 ? 3 : 1), 0);
    return core + ((10 - (s13 % 10)) % 10);
  }
  return null;
}
