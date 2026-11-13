// Little pictures of the shop items, drawn once from the same 3D models that stand in the library.
import * as THREE from 'three';
import { buildItem } from './items3d';

let cache = null;
export function shopThumbs(kinds) {
  if (cache) return cache;
  cache = new Promise((resolve) => {
    // wait a beat so the shop opens first, then draw
    setTimeout(() => {
      const out = {};
      try {
        const SIZE = 220;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        renderer.setSize(SIZE, SIZE); renderer.setPixelRatio(1);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xfff0dc, 0x5a4636, 1.7));
        const sun = new THREE.DirectionalLight(0xffe2b8, 2.4); sun.position.set(2, 3, 2.5); scene.add(sun);
        const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
        for (const kind of kinds) {
          const m = buildItem(kind); scene.add(m);
          const box = new THREE.Box3().setFromObject(m); const c = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3());
          const d = (Math.max(size.y, size.x, size.z) * 0.62) / Math.tan((cam.fov * Math.PI) / 360) + size.z / 2;
          cam.position.set(c.x + d * 0.42, c.y + size.y * 0.12 + d * 0.16, c.z + d * 0.9); cam.lookAt(c);
          renderer.render(scene, cam);
          out[kind] = renderer.domElement.toDataURL('image/png');
          scene.remove(m);
        }
        renderer.dispose(); renderer.forceContextLoss?.();
      } catch { /* no thumbnails: the shop still works with names */ }
      resolve(out);
    }, 60);
  });
  return cache;
}
