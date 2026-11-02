import type Phaser from 'phaser';
import type { RoomId } from '../core/types';

/** Original pixel artwork adapted from the approved modular amulet / brick PAK concept. */
export const AMULET_PRODUCTS = [
  { id: 'server', name: 'KageCore', color: '#ff625e' },
  { id: 'office', name: 'Starguard', color: '#b9e4ff' },
  { id: 'perimeter', name: 'SamurAI', color: '#ef61ce' },
  { id: 'production', name: 'ПАК-AI', color: '#a5dfff' },
] as const satisfies readonly { id: RoomId; name: string; color: string }[];

const AMULET_SIZE = 40;
const PAK_WIDTH = 96;
const PAK_HEIGHT = 168;
const canvases = new Map<string, HTMLCanvasElement>();
const urls = new Map<string, string>();
type Context = CanvasRenderingContext2D;

function rect(c: Context, x: number, y: number, w: number, h: number, color: string): void {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function canvas(key: string, width: number, height: number, draw: (c: Context) => void): HTMLCanvasElement {
  let result = canvases.get(key);
  if (!result) {
    result = document.createElement('canvas');
    result.width = width; result.height = height;
    const c = result.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    draw(c);
    canvases.set(key, result);
  }
  return result;
}

function dataUrl(key: string, source: () => HTMLCanvasElement): string {
  let result = urls.get(key);
  if (!result) { result = source().toDataURL('image/png'); urls.set(key, result); }
  return result;
}

function pixels(c: Context, pattern: readonly string[], x: number, y: number, color: string): void {
  pattern.forEach((row, yy) => {
    for (let xx = 0; xx < row.length; xx++) if (row[xx] === '#') rect(c, x + xx, y + yy, 1, 1, color);
  });
}

function emblem(c: Context, id: RoomId, x: number, y: number, accent: string, light: string): void {
  if (id === 'server') {
    // Separate stem and doubled chevron echo the KageCore mark at a 17-pixel width.
    rect(c, x, y + 1, 3, 17, accent);
    for (let i = 0; i < 8; i++) {
      rect(c, x + 12 - i, y + 1 + i, 4, 2, accent);
      rect(c, x + 5 + i, y + 9 + i, 4, 2, accent);
    }
    rect(c, x, y + 1, 1, 16, light);
    for (let i = 0; i < 5; i++) rect(c, x + 11 + i, y + 10 + i, 1, 1, light);
  } else if (id === 'office') {
    pixels(c, [
      '.......###.......',
      '.....#######.....',
      '...####...####...',
      '.####.......####.',
      '###...........###',
      '##.............##',
      '##......#......##',
      '##......#......##',
      '##.....###.....##',
      '##...#######...##',
      '##..#########..##',
      '##.....###.....##',
      '##......#......##',
      '.##.....#.....##.',
      '..##.........##..',
      '...###.....###...',
      '.....##...##.....',
      '......#####......',
      '.......###.......',
    ], x, y, accent);
    rect(c, x + 7, y + 9, 3, 3, light);
    rect(c, x + 7, y, 3, 1, light);
  } else if (id === 'perimeter') {
    rect(c, x + 7, y + 1, 3, 3, light);
    for (let i = 0; i < 8; i++) {
      rect(c, x + 7 - i, y + 3 + i * 2, 2, 3, accent);
      rect(c, x + 8 + i, y + 3 + i * 2, 2, 3, accent);
    }
    rect(c, x + 7, y + 11, 3, 3, light);
    rect(c, x + 6, y + 12, 5, 2, accent);
    // The lower three nodes are connected by single-pixel circuit branches.
    rect(c, x + 6, y + 14, 1, 2, accent); rect(c, x + 10, y + 14, 1, 2, accent);
    rect(c, x + 5, y + 15, 1, 2, accent); rect(c, x + 11, y + 15, 1, 2, accent);
    rect(c, x + 4, y + 17, 3, 3, light); rect(c, x + 10, y + 17, 3, 3, light);
  } else {
    for (const dx of [0, 9]) for (const dy of [2, 11]) {
      rect(c, x + dx, y + dy, 7, 7, accent);
      rect(c, x + dx, y + dy, 7, 2, light);
      rect(c, x + dx, y + dy, 1, 7, light);
    }
  }
}

function drawAmulet(c: Context, id: RoomId, earned: boolean): void {
  const accent = earned ? AMULET_PRODUCTS.find(product => product.id === id)!.color : '#4b616e';
  const light = earned ? ({ server: '#ffd5c7', office: '#ffffff', perimeter: '#ffc9ef', production: '#ffffff' } as const)[id] : '#84939e';
  const metal = earned ? '#b7c6cf' : '#6e808e';
  // Stepped silhouette, left connector tongue and three brick studs.
  rect(c, 6, 6, 32, 31, '#070d13'); rect(c, 9, 4, 26, 35, '#070d13');
  rect(c, 1, 12, 7, 23, '#070d13'); rect(c, 3, 10, 6, 26, '#15212a');
  for (const [x, y, w] of [[9, 3, 7], [20, 1, 7], [30, 3, 6]]) {
    rect(c, x, y, w, 6, '#070d13'); rect(c, x + 1, y + 1, w - 2, 4, metal);
    rect(c, x + 1, y + 1, w - 2, 1, earned ? '#f0f4f6' : '#a2afb8');
  }
  rect(c, 21, 2, 5, 3, accent); rect(c, 22, 2, 4, 1, light);
  rect(c, 7, 7, 30, 28, earned ? '#758d9d' : '#485d6c');
  rect(c, 10, 5, 24, 32, metal);
  rect(c, 9, 6, 25, 2, earned ? '#f2f6f8' : '#a9b7c0');
  rect(c, 8, 8, 2, 25, earned ? '#d5e1e8' : '#8c9ca8');
  rect(c, 35, 8, 2, 27, '#253746');rect(c, 11, 35, 23, 2, '#324554');
  // A single broad face gives the larger emblem space instead of nested bevels.
  rect(c, 11, 8, 23, 26, '#0b1621');
  rect(c, 12, 9, 21, 24, earned ? '#203141' : '#1c2b37');
  rect(c, 12, 9, 21, 1, earned ? '#e0ebf1' : '#8194a2');
  rect(c, 12, 32, 21, 1, '#09121b');
  rect(c, 19, 34, 8, 5, '#070d13');rect(c, 20, 34, 6, 4, metal);
  rect(c, 20, 34, 6, 1, earned ? '#e1ebf0' : '#95a6b1');
  for (let i = 0; i < 5; i++) {
    rect(c, 2, 14 + i * 4, 4, 2, earned ? '#e5b873' : '#776b55');
    rect(c, 2, 14 + i * 4, 3, 1, earned ? '#ffe0a1' : '#94846a');
  }
  for (const x of [8, 35]) {
    rect(c, x, 10, 2, 5, '#101b23'); rect(c, x, 16, 2, 9, '#09121c');
    rect(c, x, 17, 2, 7, accent); rect(c, x, 17, 1, 6, light);
    for (const y of [28, 31]) { rect(c, x, y, 2, 2, '#0b151e'); rect(c, x, y, 2, 1, '#53636c'); }
  }
  // Nearest-neighbour enlargement keeps all four native pixel marks distinct.
  const mark = document.createElement('canvas');mark.width = 17;mark.height = 20;
  emblem(mark.getContext('2d')!, id, 0, 0, accent, light);
  c.drawImage(mark, 13, 10, 20, 22);
}

function amuletCanvas(id: RoomId, earned: boolean): HTMLCanvasElement {
  return canvas(`amulet-${id}-${earned ? 1 : 0}`, AMULET_SIZE, AMULET_SIZE, c => drawAmulet(c, id, earned));
}

/** Both the HUD and Phaser use the same cached, transparent 40 × 40 art. */
export function amuletDataUrl(id: RoomId, earned: boolean): string {
  return dataUrl(`amulet-${id}-${earned ? 1 : 0}`, () => amuletCanvas(id, earned));
}

const FONT: Record<string, readonly string[]> = {
  'П': ['###', '#.#', '#.#', '#.#', '#.#'],
  'А': ['.#.', '#.#', '###', '#.#', '#.#'],
  'К': ['#.#', '#.#', '##.', '#.#', '#.#'],
  'A': ['.#.', '#.#', '###', '#.#', '#.#'],
  'I': ['###', '.#.', '.#.', '.#.', '###'],
  'K': ['#.#', '#.#', '##.', '#.#', '#.#'],
  '2': ['###', '..#', '###', '#..', '###'],
  '-': ['...', '...', '###', '...', '...'],
  'Н': ['#.#', '#.#', '###', '#.#', '#.#'],
  'Е': ['###', '#..', '##.', '#..', '###'],
  'Й': ['.#.', '#.#', '#.#', '###', '#.#'],
  'Р': ['###', '#.#', '###', '#..', '#..'],
  'О': ['###', '#.#', '#.#', '#.#', '###'],
  'Т': ['###', '.#.', '.#.', '.#.', '.#.'],
  'Х': ['#.#', '#.#', '.#.', '#.#', '#.#'],
};

function label(c: Context, text: string, x: number, y: number, color: string): void {
  [...text].forEach((char, index) => { const glyph = FONT[char]; if (glyph) pixels(c, glyph, x + index * 4, y, color); });
}

function pane(c: Context, y: number, height: number): void {
  rect(c, 25, y, 61, height, '#070f16'); rect(c, 27, y + 2, 57, height - 4, '#45535e');
  rect(c, 29, y + 3, 53, height - 6, '#131f29'); rect(c, 31, y + 4, 49, height - 8, '#1b2832');
  rect(c, 29, y + 3, 2, height - 6, '#0c151e'); rect(c, 80, y + 3, 2, height - 6, '#0b131d');
  rect(c, 77, y + 5, 1, height - 10, '#3c535f');
  rect(c, 32, y + 5, 2, height - 10, '#263741');
}

function socket(c: Context, x: number, y: number): void {
  rect(c, x, y, 24, 24, '#080f16'); rect(c, x + 1, y + 1, 22, 22, '#293943');
  rect(c, x + 2, y + 2, 20, 20, '#101e29');
  for (let i = 0; i < 4; i++) {
    rect(c, x + 3 + i * 5, y + 2, 3, 1, '#56707e'); rect(c, x + 3 + i * 5, y + 21, 3, 1, '#405967');
    rect(c, x + 2, y + 3 + i * 5, 1, 3, '#56707e'); rect(c, x + 21, y + 3 + i * 5, 1, 3, '#405967');
  }
  rect(c, x + 9, y + 11, 6, 2, '#3c5261'); rect(c, x + 11, y + 9, 2, 6, '#3c5261');
}

function drawPak(c: Context, mask: number): void {
  const powered = mask === 15;
  const led = powered ? '#86f29b' : mask ? '#e6b365' : '#4c626a';
  // Tall brick-built silhouette: lit top-left edges, darker right edge and short feet.
  rect(c, 10, 9, 80, 150, '#060e15'); rect(c, 7, 13, 83, 141, '#080f16');
  rect(c, 15, 4, 62, 157, '#070f16'); rect(c, 26, 2, 19, 6, '#080f17');
  rect(c, 27, 3, 17, 4, '#68717a'); rect(c, 29, 3, 14, 1, '#949aa0');
  rect(c, 52, 3, 20, 5, '#080f17'); rect(c, 53, 4, 17, 3, '#485761');
  rect(c, 13, 9, 74, 148, '#25323c'); rect(c, 9, 14, 16, 137, '#3b4851');
  rect(c, 11, 14, 2, 136, '#667079'); rect(c, 23, 13, 3, 141, '#46545e');
  rect(c, 26, 13, 59, 140, '#2c3943'); rect(c, 84, 13, 3, 141, '#131f29');
  // Staggered LEGO-like seams continue around the left side and across the crown.
  for (const y of [35, 57, 80, 103, 127, 150]) {
    rect(c, 9, y, 15, 2, '#14212a'); rect(c, 10, y + 2, 13, 1, '#5e6b73');
  }
  for (const y of [14, 57, 103]) rect(c, 17, y, 1, 20, '#303d47');
  rect(c, 14, 8, 27, 8, '#525f68'); rect(c, 15, 8, 25, 1, '#8b9397');
  rect(c, 42, 8, 26, 9, '#45535e'); rect(c, 43, 8, 24, 1, '#77828a');
  rect(c, 69, 10, 18, 7, '#26353f'); rect(c, 70, 10, 15, 1, '#556570');
  rect(c, 25, 17, 61, 3, '#111d27');
  pane(c, 22, 33); pane(c, 59, 57); pane(c, 120, 32);
  // Upper control section, with a tiny native pixel PAK-AI nameplate.
  rect(c, 34, 28, 38, 4, '#31424e'); rect(c, 34, 35, 30, 3, '#293a46');
  rect(c, 35, 29, 2, 2, led); rect(c, 34, 36, 2, 2, powered ? '#70db87' : '#425965');
  label(c, 'ПАК-AI', 41, 43, '#bdcbd5');
  rect(c, 72, 38, 4, 1, '#758a95'); rect(c, 75, 27, 1, 23, powered ? '#50c8d2' : '#2d4655');
  // Slot centres form a fixed 2 × 2 grid. Empty slots remain visible throughout assembly.
  AMULET_PRODUCTS.forEach((product, i) => {
    const x = 30 + (i % 2) * 26, y = 63 + Math.floor(i / 2) * 25;
    if (mask & (1 << i)) {
      rect(c, x, y, 24, 24, '#0b161e');
      c.drawImage(amuletCanvas(product.id, true), x, y, 24, 24);
      rect(c, x + 1, y + 2, 2, 2, powered ? '#7ae99a' : '#b6c1b4');
      if (powered) rect(c, x + 21, y + 20, 2, 2, '#60cb83');
    } else socket(c, x, y);
  });
  // The lower equipment bay carries the K2 mark, grills, and restrained status LEDs.
  for (const x of [33, 37, 41, 45, 49, 53, 57, 61]) {
    rect(c, x, 141, 2, 7, '#0b1923'); rect(c, x, 141, 1, 5, '#3a4f5d');
  }
  label(c, 'K2', 42, 125, '#c0d0da');
  label(c, 'НЕЙРО', 42, 132, '#91a4b1'); label(c, 'ТЕХ', 42, 139, '#91a4b1');
  rect(c, 35, 126, 2, 2, led); rect(c, 71, 128, 2, 2, led);
  rect(c, 69, 140, 4, 1, '#6e838f');
  if (powered) {
    rect(c, 66, 126, 2, 2, '#87efa0'); rect(c, 75, 143, 2, 2, '#6edb89');
    for (const x of [34, 38, 42, 46]) rect(c, x, 146, 1, 2, '#7ce998');
    rect(c, 28, 71, 1, 25, '#59c6c9'); rect(c, 82, 77, 1, 21, '#499ba9');
  }
  // Bottom brick lip and feet keep the rack grounded without a large plinth.
  rect(c, 13, 153, 74, 5, '#3f4f5a'); rect(c, 14, 153, 72, 1, '#61717c');
  rect(c, 14, 158, 72, 2, '#121f29'); rect(c, 40, 154, 1, 4, '#16232c'); rect(c, 65, 154, 1, 4, '#16232c');
  for (const x of [20, 72]) {
    rect(c, x, 160, 12, 7, '#08121a'); rect(c, x + 1, 160, 9, 5, '#3d4b55');
    rect(c, x + 2, 160, 2, 5, '#6d7b83'); rect(c, x + 4, 165, 5, 1, '#192832');
  }
}

function pakMask(amulets: readonly RoomId[]): number {
  return AMULET_PRODUCTS.reduce((mask, product, i) => mask | (amulets.includes(product.id) ? 1 << i : 0), 0);
}

function pakCanvas(mask: number): HTMLCanvasElement {
  return canvas(`pak-${mask}`, PAK_WIDTH, PAK_HEIGHT, c => drawPak(c, mask));
}

/** A transparent 96 × 168 rack; order and duplicate IDs do not change its cache key. */
export function pakDataUrl(amulets: readonly RoomId[]): string {
  const mask = pakMask(amulets);
  return dataUrl(`pak-${mask}`, () => pakCanvas(mask));
}

/** Registers static textures without replacing any textures already used by a scene. */
export function buildPakArt(scene: Phaser.Scene): void {
  for (const product of AMULET_PRODUCTS) {
    const key = `amulet-${product.id}`;
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, amuletCanvas(product.id, true));
  }
  if (!scene.textures.exists('pak-ready')) scene.textures.addCanvas('pak-ready', pakCanvas(15));
  if (!scene.textures.exists('pak-empty')) scene.textures.addCanvas('pak-empty', pakCanvas(0));
}
