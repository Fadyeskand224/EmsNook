// Photographic surfaces for the 3D room: CC0 textures and panoramas from Poly Haven (see lib/plantCredits.js), converted to WebP
// in public/room. They load after the room is built, so the room appears at once with painted stand-ins and then sharpens.
import * as THREE from 'three';

const cache = new Map();
const loader = new THREE.TextureLoader();

function loadImage(url) {
  if (!cache.has(`img:${url}`)) {
    cache.set(`img:${url}`, new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }));
  }
  return cache.get(`img:${url}`);
}

/** A tiling texture straight from public/room. */
export function loadTex(name, { srgb = false, repeat = true } = {}) {
  const key = `tex:${name}:${srgb}:${repeat}`;
  if (!cache.has(key)) {
    cache.set(key, new Promise((res, rej) => {
      loader.load(`/room/${name}`, (t) => {
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = 8;
        res(t);
      }, undefined, rej);
    }));
  }
  return cache.get(key);
}

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Takes a grey photograph and colours it between a dark and a light tone, so one real grain serves every finish. */
export async function colorized(name, light, dark, { gamma = 1, size = 1024 } = {}) {
  const key = `col:${name}:${light}:${dark}:${gamma}`;
  if (!cache.has(key)) {
    cache.set(key, (async () => {
      const img = await loadImage(`/room/${name}`);
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, size, size);
      const d = g.getImageData(0, 0, size, size);
      const L = hexRgb(light); const D = hexRgb(dark);
      for (let i = 0; i < d.data.length; i += 4) {
        const t = Math.pow(d.data[i] / 255, gamma);
        d.data[i] = D[0] + (L[0] - D[0]) * t;
        d.data[i + 1] = D[1] + (L[1] - D[1]) * t;
        d.data[i + 2] = D[2] + (L[2] - D[2]) * t;
      }
      g.putImageData(d, 0, 0);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      return t;
    })());
  }
  return cache.get(key);
}

/** A copy of a texture turned a quarter turn, for grain that runs up and down. */
export const rotated = (t) => {
  const r = t.clone();
  r.center.set(0.5, 0.5);
  r.rotation = Math.PI / 2;
  r.needsUpdate = true;
  return r;
};
