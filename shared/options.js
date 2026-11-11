// The customization choices a reader can make. Ids only: the visuals live in src/lib/themes.js.
// The server uses these lists to accept nothing but known values.
export const WALLPAPERS = ['forest', 'navy', 'aubergine', 'clay', 'charcoal', 'linen', 'botanical', 'pinstripe', 'grasscloth', 'brick', 'shiplap'];
export const WOODS = ['mahogany', 'walnut', 'oak', 'cherry', 'teak', 'ebony', 'whitewash', 'driftwood'];
export const LIGHTS = ['low', 'medium', 'bright'];
export const DECORS = ['full', 'plants', 'none'];
export const FILLS = ['stocked', 'mine'];

// The 3D room: every piece of it can be restyled. Ids only; src/room/looks.js turns them into materials and models.
export const ROOM_OPTIONS = {
  chandelier: ['candles', 'crystal', 'globes', 'iron'],
  chandFinish: ['brass', 'silver', 'black'],
  shelf: ['classic', 'modern', 'carved'],
  shelfBack: ['dark', 'green', 'navy', 'cream'],
  shelfLed: ['off', 'warm'],
  desk: ['writing', 'executive', 'modern'],
  deskTop: ['green', 'red', 'black', 'tan'],
  rug: ['persian', 'navy', 'forest', 'cream', 'none'],
  floor: ['parquet', 'planks', 'checker'],
  chair: ['oxblood', 'forest', 'navy', 'tan'],
  fireplace: ['marble', 'stone', 'wood'],
  fire: ['lit', 'embers', 'off'],
  ceiling: ['coffered', 'plain'],
  time: ['golden', 'day', 'night'],
  shafts: ['on', 'off'],
  // what stands on the desk
  deskLamp: ['banker', 'oil', 'none'],
  deskGlobe: ['terrestrial', 'armillary', 'none'],
  deskBooks: ['stack', 'open', 'none'],
  deskWrite: ['inkwell', 'typewriter', 'none'],
  deskTea: ['teapot', 'none'],
  deskPlant: ['succulent', 'none'],
  deskClock: ['carriage', 'none'],
};

export const DEFAULT_ROOM = {
  chandelier: 'candles', chandFinish: 'brass', shelf: 'classic', shelfBack: 'dark', shelfLed: 'off', desk: 'writing', deskTop: 'green',
  rug: 'persian', floor: 'parquet', chair: 'oxblood', fireplace: 'marble', fire: 'lit', ceiling: 'coffered', time: 'golden', shafts: 'on',
  deskLamp: 'banker', deskGlobe: 'terrestrial', deskBooks: 'stack', deskWrite: 'inkwell', deskTea: 'none', deskPlant: 'none', deskClock: 'none',
};

// Shelves start empty: the reader fills them with their own books.
export const DEFAULT_SETTINGS = { wallpaper: 'forest', wood: 'mahogany', light: 'low', decor: 'full', fill: 'mine', ...DEFAULT_ROOM };
