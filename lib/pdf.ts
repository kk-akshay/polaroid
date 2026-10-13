// lib/pdf.ts
// Dependency-free, print-exact PDF writer + verifier for "Polaroid Print Mode".
//  - Page size is written in PDF points from millimetres (1 pt = 1/72 in), so 297 x 420 mm is exact.
//  - The 300 DPI canvas image (JPEG) is placed 1:1 over the whole page.
//  - Card outlines are real vector rectangles at exact millimetre positions (also used for verification).
//  - /ViewerPreferences /PrintScaling /None makes viewers default the print dialog to 100% / Actual Size.

export const MM_TO_PT = 72 / 25.4;

export interface PdfCardMm {
  x: number; // mm from left of sheet
  y: number; // mm from top of sheet
  w: number;
  h: number;
}

export interface JpegInfo {
  width: number;
  height: number;
  components: number;
  bitsPerComponent: number;
}

export interface BuildPdfInput {
  jpeg: Uint8Array;
  pageWidthMm: number;
  pageHeightMm: number;
  cards: PdfCardMm[];
  /** true: stroke thin cut guides on every card edge; false: geometry is kept but nothing is painted */
  drawGuides: boolean;
  title?: string;
}

const enc = new TextEncoder();
const f = (v: number) => v.toFixed(4);

/** Reads size/colour info from the JPEG start-of-frame marker. */
export function readJpegInfo(b: Uint8Array): JpegInfo {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) throw new Error('Not a JPEG image');
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    if (marker === 0xff) { i++; continue; }
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) { i += 2; continue; }
    const len = (b[i + 2] << 8) | b[i + 3];
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      return {
        bitsPerComponent: b[i + 4],
        height: (b[i + 5] << 8) | b[i + 6],
        width: (b[i + 7] << 8) | b[i + 8],
        components: b[i + 9],
      };
    }
    i += 2 + len;
  }
  throw new Error('JPEG size marker not found');
}

export function buildPdf(input: BuildPdfInput): Uint8Array<ArrayBuffer> {
  const { jpeg, pageWidthMm, pageHeightMm, cards, drawGuides } = input;
  const info = readJpegInfo(jpeg);
  const colorSpace = info.components === 1 ? '/DeviceGray' : info.components === 4 ? '/DeviceCMYK' : '/DeviceRGB';
  const W = pageWidthMm * MM_TO_PT;
  const H = pageHeightMm * MM_TO_PT;
  const title = (input.title ?? 'A3 Polaroid Print Sheet').replace(/[()\\]/g, '');

  // --- page content: image 1:1 over the page, then card rectangles at exact mm positions
  let content = `q\n${f(W)} 0 0 ${f(H)} 0 0 cm\n/Im0 Do\nQ\n`;
  content += `q\n0.7 G\n0.25 w\n`;
  for (const c of cards) {
    const x = c.x * MM_TO_PT;
    const y = H - (c.y + c.h) * MM_TO_PT; // PDF origin is bottom-left
    content += `${f(x)} ${f(y)} ${f(c.w * MM_TO_PT)} ${f(c.h * MM_TO_PT)} re\n`;
  }
  content += (drawGuides ? 'S' : 'n') + '\nQ\n';
  const contentBytes = enc.encode(content);

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let offset = 0;
  const push = (d: string | Uint8Array) => {
    const u = typeof d === 'string' ? enc.encode(d) : d;
    chunks.push(u);
    offset += u.length;
  };
  const begin = (n: number) => { offsets[n] = offset; push(`${n} 0 obj\n`); };
  const end = () => push('endobj\n');

  push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // %PDF-1.7 + binary marker

  begin(1);
  push('<< /Type /Catalog /Pages 2 0 R /PageLayout /SinglePage /ViewerPreferences << /PrintScaling /None /PickTrayByPDFSize true >> >>\n');
  end();

  begin(2);
  push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n');
  end();

  const box = `[0 0 ${f(W)} ${f(H)}]`;
  begin(3);
  push(`<< /Type /Page /Parent 2 0 R /MediaBox ${box} /CropBox ${box} /TrimBox ${box} /Resources << /XObject << /Im0 5 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 4 0 R >>\n`);
  end();

  begin(4);
  push(`<< /Length ${contentBytes.length} >>\nstream\n`);
  push(contentBytes);
  push('\nendstream\n');
  end();

  begin(5);
  push(`<< /Type /XObject /Subtype /Image /Width ${info.width} /Height ${info.height} /ColorSpace ${colorSpace} /BitsPerComponent ${info.bitsPerComponent} /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  push(jpeg);
  push('\nendstream\n');
  end();

  begin(6);
  push(`<< /Title (${title}) /Producer (A3_FACTORY_PRO) >>\n`);
  end();

  const xrefPos = offset;
  push(`xref\n0 7\n0000000000 65535 f \n`);
  for (let n = 1; n <= 6; n++) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  const out = new Uint8Array(offset);
  let p = 0;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------------------------

export interface PdfExpectation {
  pageWidthMm: number;
  pageHeightMm: number;
  cardWidthMm: number;
  cardHeightMm: number;
  cardCount: number;
  marginMm: number;
  imageWidthPx: number;
  imageHeightPx: number;
  targetDpi: number;
}

export interface PdfCheck { label: string; ok: boolean; detail: string }
export interface PdfVerification { ok: boolean; checks: PdfCheck[] }

function bytesToLatin1(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return s;
}

/** Re-reads the finished PDF bytes and checks page size, image DPI, print scaling and card geometry. */
export function verifyPdf(bytes: Uint8Array, exp: PdfExpectation): PdfVerification {
  const checks: PdfCheck[] = [];
  const add = (label: string, ok: boolean, detail: string) => checks.push({ label, ok, detail });
  const mm = (pt: number) => (pt / MM_TO_PT).toFixed(3);
  const text = bytesToLatin1(bytes);

  // 1. structure: header, EOF, xref offsets, stream lengths
  const startxref = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(text);
  let structOk = text.startsWith('%PDF-') && !!startxref;
  if (startxref) {
    const xo = Number(startxref[1]);
    const m = /^xref\s+0 (\d+)\s/.exec(text.slice(xo, xo + 40));
    if (!m) structOk = false;
    else {
      const count = Number(m[1]);
      const first = xo + m[0].length;
      for (let n = 1; n < count; n++) {
        const entry = text.slice(first + n * 20, first + n * 20 + 20);
        const off = Number(entry.slice(0, 10));
        if (!text.startsWith(`${n} 0 obj`, off)) structOk = false;
      }
    }
  }
  const lenRe = /\/Length (\d+)[^>]*>>\s*stream\n/g;
  let lm: RegExpExecArray | null;
  while ((lm = lenRe.exec(text))) {
    const start = lm.index + lm[0].length;
    if (!text.startsWith('\nendstream', start + Number(lm[1]))) structOk = false;
  }
  add('PDF structure (xref + stream lengths)', structOk, structOk ? 'valid' : 'corrupt');

  // 2. page size
  const mb = /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(text);
  if (mb) {
    const w = Number(mb[3]) - Number(mb[1]);
    const h = Number(mb[4]) - Number(mb[2]);
    const ok = Math.abs(w - exp.pageWidthMm * MM_TO_PT) < 0.01 && Math.abs(h - exp.pageHeightMm * MM_TO_PT) < 0.01;
    add('Page size', ok, `${mm(w)} x ${mm(h)} mm (${w.toFixed(2)} x ${h.toFixed(2)} pt) - expected ${exp.pageWidthMm} x ${exp.pageHeightMm} mm`);
  } else add('Page size', false, 'MediaBox missing');

  // 3. print scaling
  const noScale = /\/PrintScaling\s*\/None/.test(text);
  add('Print scaling', noScale, noScale ? 'PrintScaling = None (Actual Size)' : 'not set');

  // 4. image resolution
  const im = /\/Subtype \/Image \/Width (\d+) \/Height (\d+)/.exec(text);
  if (im) {
    const iw = Number(im[1]);
    const ih = Number(im[2]);
    const dpiX = iw / (exp.pageWidthMm / 25.4);
    const dpiY = ih / (exp.pageHeightMm / 25.4);
    const ok = iw === exp.imageWidthPx && ih === exp.imageHeightPx &&
      Math.abs(dpiX - exp.targetDpi) < 0.5 && Math.abs(dpiY - exp.targetDpi) < 0.5;
    add('Image resolution', ok, `${iw} x ${ih} px = ${dpiX.toFixed(1)} x ${dpiY.toFixed(1)} DPI`);
  } else add('Image resolution', false, 'image missing');

  // 5. image placed 1:1 on the page, card rectangles
  const cStart = text.indexOf('4 0 obj');
  const cEnd = text.indexOf('endstream', cStart);
  const content = cStart >= 0 && cEnd > cStart ? text.slice(cStart, cEnd) : '';
  const cm = /([\d.]+) 0 0 ([\d.]+) 0 0 cm/.exec(content);
  const placed = !!cm && !!mb && Math.abs(Number(cm[1]) - exp.pageWidthMm * MM_TO_PT) < 0.01 && Math.abs(Number(cm[2]) - exp.pageHeightMm * MM_TO_PT) < 0.01;
  add('Image placement', placed, placed ? 'covers the page 1:1, no scaling' : 'not 1:1');

  const rects = [...content.matchAll(/(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) re\n/g)].map(r => ({
    x: Number(r[1]), y: Number(r[2]), w: Number(r[3]), h: Number(r[4]),
  }));
  const cwPt = exp.cardWidthMm * MM_TO_PT;
  const chPt = exp.cardHeightMm * MM_TO_PT;
  const sizeOk = rects.length > 0 && rects.every(r => Math.abs(r.w - cwPt) < 0.001 && Math.abs(r.h - chPt) < 0.001);
  add('Card size', sizeOk && rects.length > 0,
    rects.length ? `${mm(rects[0].w)} x ${mm(rects[0].h)} mm on all ${rects.length} cards - expected ${exp.cardWidthMm} x ${exp.cardHeightMm} mm` : 'no cards found');
  add('Card count', rects.length === exp.cardCount, `${rects.length} cards (expected ${exp.cardCount})`);

  if (rects.length && mb) {
    const pw = Number(mb[3]);
    const ph = Number(mb[4]);
    const minEdge = Math.min(...rects.map(r => Math.min(r.x, r.y, pw - (r.x + r.w), ph - (r.y + r.h))));
    add('Printable-area margin', minEdge / MM_TO_PT >= exp.marginMm - 0.001,
      `closest card is ${mm(minEdge)} mm from the paper edge (min ${exp.marginMm} mm)`);
  }

  return { ok: checks.every(c => c.ok), checks };
}
