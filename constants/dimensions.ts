// constants/dimensions.ts

export const A3 = {
  WIDTH: 3508,
  HEIGHT: 4961,
  ASPECT_RATIO: 3508 / 4961,
};

export const GRID = {
  COLUMNS: 4,
  ROWS: 4,
  TOTAL_CELLS: 16,
};

// Each Polaroid cell size on the A3 sheet
export const CELL = {
  WIDTH: A3.WIDTH / GRID.COLUMNS, // 877px
  HEIGHT: A3.HEIGHT / GRID.ROWS,  // 1240.25px
};