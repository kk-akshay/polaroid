// constants/printMode.ts
// Geometry for the optional "Polaroid Print Mode" (additive; nothing here is used when the mode is off).
import { A3 } from './dimensions';

/** Physical A3 sheet in millimetres. */
export const A3_MM = { WIDTH: 297, HEIGHT: 420 };

/** Outer size of one mini Polaroid card (entire white border included). */
export const POLAROID_MM = { WIDTH: 37.5, HEIGHT: 45 };

export const PRINT_DEFAULTS = {
  MARGIN_MM: 5, // keeps every card inside the printable area of most A3 printers
  GAP_MM: 0,    // 0 = cards share cut lines (most efficient)
};

export const MM_PER_INCH = 25.4;

/**
 * Pixels-per-millimetre of the existing A3 canvas (3508 x 4961 px = 300 DPI).
 * X and Y are derived independently from the canvas size so that when the canvas image is
 * stretched onto the exact 297 x 420 mm PDF page, every card lands on exact millimetres.
 */
export const PX_PER_MM_X = A3.WIDTH / A3_MM.WIDTH;   // ~11.8114 (300.0 DPI)
export const PX_PER_MM_Y = A3.HEIGHT / A3_MM.HEIGHT; // ~11.8119 (300.0 DPI)

export interface PrintCard {
  index: number;
  col: number;
  row: number;
  /** top-left corner, millimetres from the top-left of the sheet */
  xMm: number;
  yMm: number;
}

export interface PrintLayout {
  cols: number;
  rows: number;
  total: number;
  cards: PrintCard[];
  /** smallest distance (mm) between any card and the sheet edge */
  edgeMarginMm: number;
}

/** Packs as many 37.5 x 45 mm cards as fit inside the margins, centred on the A3 sheet. */
export function computePrintLayout(marginMm: number, gapMm: number): PrintLayout {
  const EPS = 1e-9;
  const usableW = A3_MM.WIDTH - 2 * marginMm;
  const usableH = A3_MM.HEIGHT - 2 * marginMm;
  const cols = Math.max(0, Math.floor((usableW + gapMm + EPS) / (POLAROID_MM.WIDTH + gapMm)));
  const rows = Math.max(0, Math.floor((usableH + gapMm + EPS) / (POLAROID_MM.HEIGHT + gapMm)));

  const gridW = cols * POLAROID_MM.WIDTH + Math.max(0, cols - 1) * gapMm;
  const gridH = rows * POLAROID_MM.HEIGHT + Math.max(0, rows - 1) * gapMm;
  const originX = (A3_MM.WIDTH - gridW) / 2;
  const originY = (A3_MM.HEIGHT - gridH) / 2;

  const cards: PrintCard[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cards.push({
        index: row * cols + col,
        col,
        row,
        xMm: originX + col * (POLAROID_MM.WIDTH + gapMm),
        yMm: originY + row * (POLAROID_MM.HEIGHT + gapMm),
      });
    }
  }

  return {
    cols,
    rows,
    total: cols * rows,
    cards,
    edgeMarginMm: cols && rows ? Math.min(originX, originY) : 0,
  };
}
