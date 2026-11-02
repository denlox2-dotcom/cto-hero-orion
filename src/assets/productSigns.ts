import type Phaser from 'phaser';
import type { RoomId } from '../core/types';
import kagecore from './brands/kagecore.svg?no-inline';
import starguard from './brands/starguard.png';

const SIGNS: Record<RoomId, { name: string; layer: number; accent: string }> = {
  server: { name: 'KageCore', layer: 1, accent: '#a96062' },
  office: { name: 'STARGUARD', layer: 2, accent: '#9aabbc' },
  perimeter: { name: 'SamurAI', layer: 3, accent: '#b45c86' },
  production: { name: 'ПАК-AI', layer: 4, accent: '#7b93b5' },
};

export function preloadProductSigns(scene: Phaser.Scene): void {
  if (!scene.textures.exists('brand-kagecore')) scene.load.svg('brand-kagecore', kagecore);
  if (!scene.textures.exists('brand-starguard')) scene.load.image('brand-starguard', starguard);
}

// Render once at the background's half resolution: letter edges share its pixel grid.
// The resulting plate is baked into the depth-0 wall, below all platforms and actors.
export function drawProductSign(scene: Phaser.Scene, context: CanvasRenderingContext2D, room: RoomId): void {
  const sign = SIGNS[room];
  const plate = document.createElement('canvas'); plate.width = 296; plate.height = 64;
  const c = plate.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  const rect = (x: number, y: number, w: number, h: number, color: string) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
  rect(0, 0, 296, 64, '#14222b');
  rect(1, 1, 294, 62, '#435763');
  rect(2, 2, 292, 59, '#22323d');
  rect(9, 20, 278, 1, '#354954');
  rect(12, 11, 3, 3, sign.accent);
  c.font = '8px "IBM Plex Mono"'; c.fillStyle = '#8398a7';
  c.fillText(`КОМНАТА 0${sign.layer} / 04`, 21, 15);
  // The stack fills upwards as the player progresses through the four layers.
  for (let layer = 1; layer <= 4; layer++) rect(263, 16 - layer * 3, 17, 2, layer <= sign.layer ? sign.accent : '#3b4b58');
  for (const x of [4, 289]) for (const y of [4, 57]) rect(x, y, 2, 2, '#667780');

  if (room === 'office') {
    const image = scene.textures.get('brand-starguard').getSourceImage() as HTMLImageElement;
    const width = 240, height = Math.round(width * image.height / image.width);
    c.globalAlpha = 0.65;
    c.drawImage(image, 28, 29, width, height);
    c.globalAlpha = 1;
  } else {
    const font = 'IBM Plex Sans';
    c.font = `34px "${font}"`; c.textBaseline = 'alphabetic';
    const measured = c.measureText(sign.name).width;
    const left = room === 'server' ? 52 : 22, available = room === 'server' ? 224 : 252;
    const scale = Math.min(1, available / measured);
    const x = left + (available - measured * scale) / 2;
    if (room === 'server') {
      c.globalAlpha = 0.72;
      c.drawImage(scene.textures.get('brand-kagecore').getSourceImage() as HTMLImageElement, 16, 29, 27, 27);
      c.globalAlpha = 1;
    }
    c.save(); c.translate(x, 54); c.scale(scale, 1); c.fillStyle = '#a6b6c1';
    if (room === 'perimeter') {
      c.fillText('Samur', 0, 0); c.fillStyle = sign.accent;
      c.fillText('AI', c.measureText('Samur').width, 0);
    } else c.fillText(sign.name, 0, 0);
    c.restore();
  }
  context.save(); context.imageSmoothingEnabled = false;
  context.drawImage(plate, 92, 79); context.restore();
}
