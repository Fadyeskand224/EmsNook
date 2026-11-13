// The nook shop: plants and decor a reader can buy with coins earned by finishing books, then place anywhere in the 3D library.
// Ids and prices live here so the server (which checks every purchase) and the app (which draws the shop) always agree.

/** Coins earned for finishing a book: 5, plus 1 for every 100 pages up to 5 more (so 5 to 10). Each book earns once, ever. Things in the shop are meant to be achievements. */
export const rewardFor = (pages) => 5 + (Number.isFinite(pages) && pages > 0 ? Math.min(5, Math.floor(pages / 100)) : 2);

// size: how big it stands in the room (S fits on a desk or shelf, M on the floor, L and XL fill a corner)
export const SHOP = [
  { kind: 'succulent', group: 'plants', name: 'Jade succulent', size: 'S', price: 30, blurb: 'A plump little rosette in a clay pot.' },
  { kind: 'cactus', group: 'plants', name: 'Barrel cactus', size: 'S', price: 40, blurb: 'Round, ribbed, and surprisingly cheerful.' },
  { kind: 'lavender', group: 'plants', name: 'Lavender', size: 'S', price: 50, blurb: 'Purple spikes that make a shelf smell like summer.' },
  { kind: 'bonsai', group: 'plants', name: 'Bonsai', size: 'S', price: 180, blurb: 'A patient little tree in a tray.' },
  { kind: 'fern', group: 'plants', name: 'Boston fern', size: 'M', price: 90, blurb: 'Soft arching fronds that spill over the pot.' },
  { kind: 'pothos', group: 'plants', name: 'Trailing pothos', size: 'M', price: 110, blurb: 'Vines that tumble down from a shelf edge.' },
  { kind: 'snake', group: 'plants', name: 'Snake plant', size: 'M', price: 120, blurb: 'Upright, striped, and impossible to kill.' },
  { kind: 'monstera', group: 'plants', name: 'Monstera', size: 'L', price: 220, blurb: 'Big split leaves that own a corner.' },
  { kind: 'fig', group: 'plants', name: 'Fiddle-leaf fig', size: 'L', price: 280, blurb: 'A tall, glossy tree for beside the armchair.' },
  { kind: 'olive', group: 'plants', name: 'Potted olive tree', size: 'L', price: 340, blurb: 'Silvery leaves and a gnarled trunk.' },
  { kind: 'palm', group: 'plants', name: 'Areca palm', size: 'XL', price: 420, blurb: 'A feathery palm that brushes the ceiling.' },
  { kind: 'candles', group: 'decor', name: 'Candle cluster', size: 'S', price: 40, blurb: 'Three flames on a brass dish.' },
  { kind: 'stack', group: 'decor', name: 'Stack of old books', size: 'S', price: 60, blurb: 'Well-loved, never shelved.' },
  { kind: 'vase', group: 'decor', name: 'Wildflower vase', size: 'S', price: 80, blurb: 'A handful of meadow in a glass vase.' },
  { kind: 'lantern', group: 'decor', name: 'Brass lantern', size: 'M', price: 130, blurb: 'A warm glow for the floor or a window seat.' },
];
export const SHOP_BY_KIND = Object.fromEntries(SHOP.map((i) => [i.kind, i]));
export const MAX_ITEMS = 200;
// Placed items must be inside the library (metres): the room spans roughly x -9..9, z -19..17, up to the gallery.
export const PLACE_LIMITS = { x: 12, z: 22, yLo: -0.5, yHi: 8, sLo: 0.5, sHi: 1.8 };
