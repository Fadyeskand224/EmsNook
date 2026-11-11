// Names, and for colour choices a swatch, for every restyling option of the 3D room (ids live in shared/options.js).
export const LABELS = {
  chandelier: { candles: 'Candles', crystal: 'Crystal', globes: 'Glass globes', iron: 'Iron ring' },
  chandFinish: { brass: 'Brass', silver: 'Silver', black: 'Black iron' },
  shelf: { classic: 'Classic', modern: 'Modern', carved: 'Carved' },
  shelfBack: { dark: 'Dark', green: 'Green', navy: 'Navy', cream: 'Cream' },
  shelfLed: { off: 'Off', warm: 'Warm glow' },
  desk: { writing: 'Writing desk', executive: 'Executive', modern: 'Modern' },
  deskTop: { green: 'Green', red: 'Oxblood', black: 'Black', tan: 'Tan' },
  rug: { persian: 'Persian', navy: 'Navy', forest: 'Forest', cream: 'Cream', none: 'No rug' },
  floor: { parquet: 'Parquet', planks: 'Wide planks', checker: 'Marble' },
  chair: { oxblood: 'Oxblood', forest: 'Forest', navy: 'Navy', tan: 'Tan' },
  fireplace: { marble: 'Marble', stone: 'Stone', wood: 'Carved wood' },
  fire: { lit: 'Roaring', embers: 'Embers', off: 'Out' },
  ceiling: { coffered: 'Coffered', plain: 'Plain' },
  time: { golden: 'Golden hour', day: 'Daylight', night: 'Night' },
  shafts: { on: 'Light rays', off: 'No rays' },
  deskLamp: { banker: 'Banker’s lamp', oil: 'Oil lamp', none: 'None' },
  deskGlobe: { terrestrial: 'Antique globe', armillary: 'Armillary sphere', none: 'None' },
  deskBooks: { stack: 'Stacked books', open: 'Open book', none: 'None' },
  deskWrite: { inkwell: 'Inkwell & quill', typewriter: 'Typewriter', none: 'None' },
  deskTea: { teapot: 'Tea for one', none: 'None' },
  deskPlant: { succulent: 'Succulent', none: 'None' },
  deskClock: { carriage: 'Carriage clock', none: 'None' },
};

export const SWATCH = {
  shelfBack: { dark: '#1b0f09', green: '#27422f', navy: '#1d2a44', cream: '#d8c9a4' },
  deskTop: { green: '#2d4634', red: '#6b1d15', black: '#1c1a19', tan: '#b88a52' },
  chair: { oxblood: '#6b1d15', forest: '#2b4a35', navy: '#1f2f50', tan: '#b48a55' },
  chandFinish: { brass: '#c9a049', silver: '#cfd2d6', black: '#2a2623' },
  rug: { persian: '#7d1d1b', navy: '#1c2a4a', forest: '#24422e', cream: '#dccdaa', none: 'transparent' },
};

/** Sections of the 3D customizer: one tab each. */
export const TABS = [
  { id: 'look', title: 'Look' },
  { id: 'room', title: 'Room', keys: ['floor', 'rug', 'ceiling', 'time', 'shafts'] },
  { id: 'shelves', title: 'Shelves', keys: ['shelf', 'shelfBack', 'shelfLed', 'fill'] },
  { id: 'furniture', title: 'Furniture', keys: ['desk', 'deskTop', 'chair'] },
  { id: 'desk', title: 'On the desk', keys: ['deskLamp', 'deskGlobe', 'deskBooks', 'deskWrite', 'deskTea', 'deskPlant', 'deskClock'] },
  { id: 'fire', title: 'Fire & light', keys: ['fireplace', 'fire', 'chandelier', 'chandFinish', 'light'] },
];
export const TITLES = {
  floor: 'Floor', rug: 'Rug', ceiling: 'Ceiling', time: 'Time of day', shafts: 'Window light', shelf: 'Shelf style', shelfBack: 'Shelf back', shelfLed: 'Shelf lighting',
  fill: 'Shelves', desk: 'Desk', deskTop: 'Desk top', chair: 'Armchair', deskLamp: 'Lamp', deskGlobe: 'Globe', deskBooks: 'Books', deskWrite: 'Writing', deskTea: 'Tea', deskPlant: 'Plant', deskClock: 'Clock', fireplace: 'Fireplace', fire: 'Fire', chandelier: 'Chandelier', chandFinish: 'Chandelier finish', light: 'Brightness',
};
