export function encodeAsciiToBase64(text: string): string {
  if (typeof globalThis.btoa === 'function' && typeof TextEncoder !== 'undefined') {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return globalThis.btoa(binary);
  }
  return Buffer.from(text, 'utf8').toString('base64');
}

function escapePdfLiteral(input: string): string {
  return input
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Generates a standards-compliant single-page PDF data URL with crisp clinical typography
 * so embedded PDF viewing works reliably out of the box across all browsers.
 */
export function createClinicalPdfDataUrl(title: string, lines: string[]): string {
  const safeTitle = escapePdfLiteral(title);
  const safeLines = lines.slice(0, 28).map((l) => escapePdfLiteral(l));

  const streamOps: string[] = [
    '0.02 0.23 0.17 rg',
    '42 742 528 42 re f',
    'BT',
    '/F2 13 Tf',
    '1 1 1 rg',
    '54 758 Td',
    `(${safeTitle}) Tj`,
    'ET',
    '0.08 0.13 0.11 rg',
    '42 732 m 570 732 l S',
    'BT',
    '/F1 10 Tf',
    '54 710 Td',
    '16 TL',
  ];

  safeLines.forEach((line, idx) => {
    if (idx === 0) {
      streamOps.push(`(${line}) Tj`);
    } else {
      streamOps.push(`T* (${line}) Tj`);
    }
  });
  streamOps.push('ET');

  const streamContent = streamOps.join('\n');
  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
    `6 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return `data:application/pdf;base64,${encodeAsciiToBase64(pdf)}`;
}

export function createClinicalSvgImageDataUrl(params: {
  title: string;
  subtitle: string;
  metrics: Array<{ label: string; value: string }>;
}): string {
  const escapeXml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const rows = params.metrics
    .slice(0, 6)
    .map(
      (m, idx) =>
        `<g transform="translate(36, ${118 + idx * 42})">
          <rect x="0" y="0" width="568" height="34" rx="6" fill="#F6F9F7" stroke="#DDE8E2"/>
          <text x="14" y="21" font-family="Arial, sans-serif" font-size="13" fill="#4B6157">${escapeXml(m.label)}</text>
          <text x="554" y="21" text-anchor="end" font-family="monospace" font-size="13" font-weight="bold" fill="#053B2B">${escapeXml(m.value)}</text>
        </g>`
    )
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
    <rect width="640" height="400" fill="#FFFFFF"/>
    <rect x="0" y="0" width="640" height="84" fill="#053B2B"/>
    <text x="36" y="38" font-family="Arial, sans-serif" font-size="19" font-weight="bold" fill="#FFFFFF">${escapeXml(params.title)}</text>
    <text x="36" y="62" font-family="Arial, sans-serif" font-size="12" fill="#A7F3D0">${escapeXml(params.subtitle)}</text>
    ${rows}
  </svg>`;

  return `data:image/svg+xml;base64,${encodeAsciiToBase64(svg)}`;
}
