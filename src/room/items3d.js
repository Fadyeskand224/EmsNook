// The plants and decor from the nook shop, built from geometry. Everything stands on y = 0 at the origin, in metres.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from './textures';

const mats = new Map();
const mat = (key, make) => { if (!mats.has(key)) mats.set(key, make()); return mats.get(key); };
const std = (color, o = {}) => mat(`${color}|${JSON.stringify(o)}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o }));
const foliageMat = (o = {}) => mat(`foliage|${JSON.stringify(o)}`, () => new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.55, ...o }));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const m4 = new THREE.Matrix4(); const q4 = new THREE.Quaternion(); const e4 = new THREE.Euler(0, 0, 0, 'YXZ'); const one = new THREE.Vector3();

// a leaf grows up +y from the origin, is widest near the middle, narrows to a point, and curls over towards +z
const leafCache = new Map();
function leafGeo(len, wid, curl = 0.2, round = 0.6) {
  const key = [len, wid, curl, round].join('|');
  if (leafCache.has(key)) return leafCache.get(key);
  const g = new THREE.PlaneGeometry(wid, len, 4, 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = Math.min(1, Math.max(0, (p.getY(i) + len / 2) / len));
    const w = Math.max(0.03, Math.sin(Math.PI * Math.pow(t, round)));
    p.setXYZ(i, p.getX(i) * w, t * len, t * t * curl * len);
  }
  g.computeVertexNormals();
  leafCache.set(key, g);
  return g;
}
const C = (hex, jitter, r) => { const c = new THREE.Color(hex); c.offsetHSL((r() - 0.5) * jitter * 0.1, (r() - 0.5) * jitter, (r() - 0.5) * jitter * 0.6); return c; };
function bundle(parts, material) {
  const geos = parts.map(({ geo, p, yaw = 0, tilt = 0, s = 1, color }) => {
    const g = geo.clone();
    q4.setFromEuler(e4.set(tilt, yaw, 0));
    m4.compose(p, q4, one.set(s, s, s));
    g.applyMatrix4(m4);
    const n = g.attributes.position.count; const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
  return new THREE.Mesh(mergeGeometries(geos), material);
}
const lathe = (pts, material, seg = 28) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), material);
function pot(r, h, color, o = {}) {
  const g = new THREE.Group();
  const ceramic = std(color, { roughness: o.gloss ? 0.25 : 0.85 });
  g.add(lathe([[0.001, 0], [r * 0.72, 0], [r * 0.8, h * 0.06], [r * 0.96, h * 0.9], [r * 1.02, h * 0.92], [r * 1.02, h], [r * 0.92, h], [r * 0.9, h * 0.94], [0.001, h * 0.94]], ceramic));
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, 0.01, 24), std('#2b1d14', { roughness: 1 }));
  soil.position.y = h * 0.9; g.add(soil);
  if (o.saucer) { const s = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r * 0.8, 0.012, 24), ceramic); s.position.y = 0.006; g.add(s); }
  g.userData.top = h * 0.92;
  return g;
}
const tube = (pts, r, material, seg = 20) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 6), material);
const cyl = (r1, r2, h, material, x, y, z, seg = 10) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, h, seg), material); m.position.set(x, y, z); return m; };
const rosette = (r, n, rings) => { // leaves in rings around a point
  const parts = [];
  rings.forEach(({ count, tilt, len, wid, curl, color, y = 0 }, ri) => {
    for (let i = 0; i < count; i++) parts.push({ geo: leafGeo(len, wid, curl), p: V(0, y, 0), yaw: (i / count) * Math.PI * 2 + ri * 0.5 + (r() - 0.5) * 0.3, tilt: tilt + (r() - 0.5) * 0.2, s: 0.9 + r() * 0.2, color: C(color, 0.5, r) });
  });
  return parts;
};
const glowTex = mat('glowTex', () => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 1, 32, 32, 31); gr.addColorStop(0, 'rgba(255,220,150,0.9)'); gr.addColorStop(1, 'rgba(255,170,70,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); });
const glow = (x, y, z, s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 })); sp.position.set(x, y, z); sp.scale.setScalar(s); sp.userData.noPick = true; return sp; };

const BUILD = {
  succulent() {
    const r = rng(11); const g = new THREE.Group(); const p = pot(0.07, 0.085, '#b8643a'); g.add(p);
    const parts = rosette(r, 0, [
      { count: 9, tilt: 1.15, len: 0.075, wid: 0.04, curl: 0.15, color: '#6d9c6a' }, { count: 7, tilt: 0.75, len: 0.065, wid: 0.038, curl: 0.1, color: '#7fae78' }, { count: 5, tilt: 0.35, len: 0.05, wid: 0.034, curl: 0.05, color: '#92c088' }, { count: 3, tilt: 0.1, len: 0.035, wid: 0.028, curl: 0, color: '#a6d09a' },
    ]);
    g.add(bundle(parts.map((q) => ({ ...q, p: V(0, p.userData.top + 0.005, 0) })), foliageMat({ roughness: 0.4 })));
    return g;
  },
  cactus() {
    const r = rng(12); const g = new THREE.Group(); const p = pot(0.075, 0.09, '#c27a4a'); g.add(p);
    const body = new THREE.CylinderGeometry(0.058, 0.066, 0.17, 24, 8);
    const pos = body.attributes.position;
    for (let i = 0; i < pos.count; i++) { const a = Math.atan2(pos.getZ(i), pos.getX(i)); const k = 1 + 0.09 * Math.cos(a * 11); const y = pos.getY(i); const dome = y > 0.06 ? Math.max(0.35, 1 - Math.pow((y - 0.06) / 0.025, 2) * 0.55) : 1; pos.setXYZ(i, pos.getX(i) * k * dome, y, pos.getZ(i) * k * dome); }
    body.computeVertexNormals();
    const m = new THREE.Mesh(body, std('#5f8f54', { roughness: 0.6 })); m.position.y = p.userData.top + 0.085; g.add(m);
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), std('#e46a8e')); bloom.position.set(0.012, p.userData.top + 0.18, 0.005); bloom.scale.y = 0.6; g.add(bloom);
    for (let i = 0; i < 40; i++) { const a = r() * 6.28; const y = (r() - 0.5) * 0.14; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.002, 0.014, 3), std('#efe6c8')); sp.position.set(Math.cos(a) * 0.066, p.userData.top + 0.085 + y, Math.sin(a) * 0.066); sp.rotation.set(Math.sin(a) * 1.4, 0, -Math.cos(a) * 1.4); g.add(sp); }
    return g;
  },
  lavender() {
    const r = rng(13); const g = new THREE.Group(); const p = pot(0.085, 0.11, '#d7c7ac'); g.add(p);
    const stemM = std('#7f9a62'); const bloomM = std('#8e6bc4', { roughness: 0.8 });
    for (let i = 0; i < 18; i++) {
      const a = r() * 6.28; const lean = 0.1 + r() * 0.45; const h = 0.26 + r() * 0.12;
      const grp = new THREE.Group(); grp.position.set(Math.cos(a) * 0.03, p.userData.top, Math.sin(a) * 0.03); grp.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean);
      grp.add(cyl(0.0025, 0.0018, h, stemM, 0, h / 2, 0, 5));
      const spike = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.06, 3, 6), bloomM); spike.position.y = h + 0.02; grp.add(spike);
      g.add(grp);
    }
    const leaves = []; for (let i = 0; i < 16; i++) leaves.push({ geo: leafGeo(0.11, 0.012, 0.3), p: V(0, p.userData.top, 0), yaw: r() * 6.28, tilt: 0.5 + r() * 0.5, color: C('#7d8f66', 0.4, r) });
    g.add(bundle(leaves, foliageMat()));
    return g;
  },
  bonsai() {
    const r = rng(14); const g = new THREE.Group();
    const tray = lathe([[0.001, 0], [0.1, 0], [0.125, 0.012], [0.13, 0.04], [0.12, 0.04], [0.001, 0.034]], std('#35505e', { roughness: 0.3 })); g.add(tray);
    const moss = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.006, 20), std('#4d7a3e', { roughness: 1 })); moss.position.y = 0.038; g.add(moss);
    const bark = std('#4a3626', { roughness: 0.95 });
    g.add(tube([V(0, 0.04, 0), V(0.012, 0.1, 0.01), V(-0.025, 0.17, 0.0), V(0.02, 0.24, 0.015), V(0.0, 0.3, 0.0)], 0.014, bark));
    g.add(tube([V(-0.02, 0.17, 0), V(-0.08, 0.2, 0.02), V(-0.12, 0.2, 0.03)], 0.008, bark));
    g.add(tube([V(0.02, 0.24, 0.015), V(0.08, 0.27, -0.01), V(0.11, 0.3, -0.02)], 0.007, bark));
    const leaf = std('#386b3a', { roughness: 0.6 });
    for (const [x, y, z, s] of [[0, 0.33, 0, 1], [-0.12, 0.23, 0.03, 0.8], [0.11, 0.32, -0.02, 0.75], [0.0, 0.26, 0.06, 0.55]]) {
      const geo = new THREE.IcosahedronGeometry(0.075 * s, 2); const pp = geo.attributes.position;
      for (let i = 0; i < pp.count; i++) { const k = 1 + (Math.sin(pp.getX(i) * 90) * Math.cos(pp.getZ(i) * 80)) * 0.12; pp.setXYZ(i, pp.getX(i) * k * 1.25, pp.getY(i) * k * 0.65, pp.getZ(i) * k * 1.1); }
      geo.computeVertexNormals(); const cloud = new THREE.Mesh(geo, leaf); cloud.position.set(x, y, z); g.add(cloud);
    }
    return g;
  },
  fern() {
    const r = rng(15); const g = new THREE.Group(); const p = pot(0.13, 0.17, '#a9694a', { saucer: true }); g.add(p);
    const parts = [];
    for (let i = 0; i < 22; i++) { const len = 0.42 + r() * 0.2; parts.push({ geo: leafGeo(len, 0.1, 0.55 + r() * 0.3, 0.45), p: V(0, p.userData.top, 0), yaw: (i / 22) * 6.28 + r() * 0.3, tilt: 0.55 + r() * 0.7, color: C('#4d8a44', 0.6, r) }); }
    g.add(bundle(parts, foliageMat({ roughness: 0.5 })));
    return g;
  },
  pothos() {
    const r = rng(16); const g = new THREE.Group();
    // a plant stand lifts the pot so the vines can hang
    const wood = std('#8a6a47', { roughness: 0.8 });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = cyl(0.012, 0.01, 0.5, wood, sx * 0.1, 0.25, sz * 0.1, 6); l.rotation.set(sz * 0.05, 0, -sx * 0.05); g.add(l); }
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 20), wood); top.position.y = 0.5; g.add(top);
    const p = pot(0.115, 0.14, '#ece6da', { gloss: true }); p.position.y = 0.51; g.add(p);
    const base = 0.51 + p.userData.top;
    const parts = [];
    for (let i = 0; i < 16; i++) parts.push({ geo: leafGeo(0.11, 0.1, 0.3, 0.5), p: V((r() - 0.5) * 0.1, base, (r() - 0.5) * 0.1), yaw: r() * 6.28, tilt: 0.3 + r() * 0.9, color: C('#3f8a47', 0.6, r) });
    const vine = std('#4b7a3a');
    for (let s = 0; s < 7; s++) {
      const a = (s / 7) * 6.28 + r() * 0.4; const rr = 0.13;
      const pts = [V(Math.cos(a) * 0.05, base, Math.sin(a) * 0.05), V(Math.cos(a) * rr, base + 0.01, Math.sin(a) * rr), V(Math.cos(a) * (rr + 0.04), base - 0.12, Math.sin(a) * (rr + 0.04)), V(Math.cos(a) * (rr + 0.05 + r() * 0.05), base - 0.3 - r() * 0.15, Math.sin(a) * (rr + 0.05))];
      g.add(tube(pts, 0.0035, vine, 14));
      for (let k = 1; k <= 7; k++) { const t = k / 8; const c = new THREE.CatmullRomCurve3(pts).getPoint(t); parts.push({ geo: leafGeo(0.07, 0.065, 0.1, 0.5), p: c, yaw: a + (r() - 0.5) * 1.5, tilt: Math.PI * 0.82 + (r() - 0.5) * 0.4, color: C('#3f8a47', 0.7, r) }); }
    }
    g.add(bundle(parts, foliageMat({ roughness: 0.4 })));
    return g;
  },
  snake() {
    const r = rng(17); const g = new THREE.Group(); const p = pot(0.14, 0.22, '#3a3d42'); g.add(p);
    const parts = [];
    for (let i = 0; i < 13; i++) { const len = 0.45 + r() * 0.45; parts.push({ geo: leafGeo(len, 0.085, 0.05, 0.35), p: V((r() - 0.5) * 0.12, p.userData.top, (r() - 0.5) * 0.12), yaw: r() * 6.28, tilt: 0.04 + r() * 0.2, color: C(i % 3 ? '#2f6a3b' : '#4a7d3a', 0.4, r) }); }
    g.add(bundle(parts, foliageMat({ roughness: 0.35 })));
    return g;
  },
  monstera() {
    const r = rng(18); const g = new THREE.Group(); const p = pot(0.21, 0.28, '#6f5a4a', { saucer: true }); g.add(p);
    const stem = std('#4f7a3a'); const top0 = p.userData.top;
    // a big heart-shaped leaf with deep scalloped lobes along both sides
    const leaf = (size) => {
      const geo = new THREE.PlaneGeometry(1, 1, 16, 16); const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i) * 2; const t = Math.min(1, Math.max(0, pos.getY(i) + 0.5));
        const prof = Math.sin(Math.PI * Math.pow(t, 0.62)) * (1.1 - 0.15 * t);
        const lobes = Math.pow(Math.max(0, Math.sin(t * Math.PI * 5.5 + 0.4)), 3) * u * u;
        const notch = t < 0.18 ? 0.45 + (t / 0.18) * 0.55 : 1;
        pos.setXYZ(i, u * 0.5 * Math.max(0.02, prof) * (1 - 0.5 * lobes) * notch * size, t * size, t * t * 0.35 * size);
      }
      geo.computeVertexNormals();
      return geo;
    };
    const parts = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 6.28 + r() * 0.4; const h = 0.5 + r() * 0.6; const out = 0.16 + r() * 0.34;
      const topPt = V(Math.cos(a) * out, top0 + h, Math.sin(a) * out);
      g.add(tube([V(Math.cos(a) * 0.04, top0, Math.sin(a) * 0.04), V(Math.cos(a) * out * 0.35, top0 + h * 0.65, Math.sin(a) * out * 0.35), topPt], 0.011, stem, 10));
      parts.push({ geo: leaf(0.38 + r() * 0.16), p: topPt, yaw: Math.PI / 2 - a + (r() - 0.5) * 0.5, tilt: 0.45 + r() * 0.5, color: C('#2f7a3d', 0.45, r) });
    }
    g.add(bundle(parts, foliageMat({ roughness: 0.32 })));
    return g;
  },
  fig() {
    const r = rng(19); const g = new THREE.Group(); const p = pot(0.25, 0.34, '#e8e1d2', { gloss: true }); g.add(p);
    const bark = std('#6a5440', { roughness: 0.9 }); const top = p.userData.top;
    g.add(tube([V(0, top, 0), V(0.02, top + 0.5, 0.01), V(-0.015, top + 0.95, 0), V(0.0, top + 1.2, 0.01)], 0.026, bark));
    const parts = [];
    for (let i = 0; i < 110; i++) {
      const t = r(); const y = top + 0.5 + t * 0.95; const a = r() * 6.28;
      const reach = 0.06 + Math.sin(Math.min(1, t * 0.9 + 0.15) * Math.PI * 0.85) * 0.27 * (0.35 + r() * 0.65);
      parts.push({ geo: leafGeo(0.3, 0.2, 0.3, 0.55), p: V(Math.cos(a) * reach, y, Math.sin(a) * reach), yaw: a + (r() - 0.5) * 0.5, tilt: 0.55 + r() * 0.9, s: 0.85 + r() * 0.5, color: C('#3c8a45', 0.5, r) });
    }
    g.add(bundle(parts, foliageMat({ roughness: 0.28 })));
    return g;
  },
  olive() {
    const r = rng(20); const g = new THREE.Group(); const p = pot(0.26, 0.3, '#8a8a84'); g.add(p); const top = p.userData.top;
    const bark = std('#5d5347', { roughness: 0.95 });
    g.add(tube([V(-0.03, top, 0), V(0.06, top + 0.3, 0.03), V(-0.05, top + 0.65, -0.02), V(0.03, top + 0.95, 0.02)], 0.035, bark));
    g.add(tube([V(0.03, top, 0.02), V(-0.06, top + 0.25, -0.03), V(0.07, top + 0.6, 0.0), V(-0.02, top + 0.9, -0.02)], 0.026, bark));
    const parts = [];
    for (let i = 0; i < 420; i++) {
      const a = r() * 6.28; const b = Math.acos(1 - r() * 1.5); const R = 0.2 + r() * 0.34;
      parts.push({ geo: leafGeo(0.15, 0.035, 0.15, 0.7), p: V(Math.sin(b) * Math.cos(a) * R, top + 1.15 + Math.cos(b) * R * 0.7, Math.sin(b) * Math.sin(a) * R), yaw: a, tilt: 0.5 + r() * 1.4, color: C(i % 2 ? '#93aa7c' : '#b4c4a0', 0.4, r) });
    }
    g.add(bundle(parts, foliageMat({ roughness: 0.45 })));
    return g;
  },
  palm() {
    const r = rng(21); const g = new THREE.Group(); const p = pot(0.3, 0.4, '#a2593a', { saucer: true }); g.add(p); const top = p.userData.top;
    const cane = std('#7a8a3e', { roughness: 0.6 }); const parts = [];
    const fronds = (hx, hz, hy, n) => {
      for (let f = 0; f < n; f++) {
        const yaw = (f / n) * 6.28 + r() * 0.5; const tilt = 0.7 + r() * 0.5; const len = 0.85 + r() * 0.3;
        const rachis = []; const pts = 10;
        for (let k = 0; k <= pts; k++) { const t = k / pts; rachis.push(V(Math.sin(yaw) * Math.sin(tilt) * t * len * (1 - 0.0), hy + Math.cos(tilt) * t * len * 0.8 - t * t * len * 0.55, Math.cos(yaw) * Math.sin(tilt) * t * len)); }
        const rg = new THREE.CatmullRomCurve3(rachis.map((v) => v.clone().add(V(hx, 0, hz))));
        g.add(new THREE.Mesh(new THREE.TubeGeometry(rg, 14, 0.0065, 4), cane));
        for (let k = 2; k <= pts; k++) for (const side of [-1, 1]) {
          const t = k / pts; const c = rg.getPoint(t); const tg = rg.getTangent(t);
          const ly = Math.atan2(tg.x, tg.z) + side * (1.15 - t * 0.35);
          parts.push({ geo: leafGeo(0.28 * (1 - t * 0.45), 0.034, 0.5, 0.7), p: c, yaw: ly, tilt: 1.15 + t * 0.5, color: C('#3f7d3a', 0.5, r) });
        }
      }
    };
    for (const [hx, hz, h] of [[0, 0, 1.55], [0.1, 0.05, 1.25], [-0.09, -0.06, 1.1]]) {
      g.add(cyl(0.013, 0.011, h - top, cane, hx * 0.5, top + (h - top) / 2, hz * 0.5, 6).clone());
      g.children[g.children.length - 1].rotation.set(hz * 0.4, 0, -hx * 0.4);
      fronds(hx, hz, h, 7);
    }
    g.add(bundle(parts, foliageMat({ roughness: 0.4 })));
    return g;
  },
  candles() {
    const g = new THREE.Group(); const brass = std('#b88a3e', { metalness: 0.7, roughness: 0.35 });
    g.add(lathe([[0.001, 0], [0.08, 0], [0.095, 0.012], [0.09, 0.016], [0.001, 0.012]], brass));
    const wax = std('#f1e7cf', { roughness: 0.6 }); const flames = [];
    for (const [x, z, h] of [[-0.03, 0.01, 0.1], [0.035, -0.015, 0.14], [0.005, 0.045, 0.07]]) {
      g.add(cyl(0.018, 0.017, h, wax, x, 0.012 + h / 2, z, 12));
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.026, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a })); f.position.set(x, 0.012 + h + 0.014, z); g.add(f); flames.push(f);
      g.add(glow(x, 0.012 + h + 0.016, z, 0.12));
    }
    g.userData.update = (t) => flames.forEach((f, i) => { f.scale.set(1, 0.9 + Math.sin(t * 9 + i * 2) * 0.12, 1); });
    return g;
  },
  stack() {
    const g = new THREE.Group(); let y = 0; const r = rng(22);
    for (const [w, h, d, col] of [[0.25, 0.045, 0.17, '#6b2f2a'], [0.22, 0.05, 0.16, '#2f4a5e'], [0.24, 0.035, 0.165, '#d9c9a3'], [0.2, 0.04, 0.15, '#3f5d3a'], [0.17, 0.03, 0.13, '#8a5a2a']]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [std('#e6dbc2'), std(col), std('#e6dbc2'), std('#e6dbc2'), std(col), std(col)]);
      b.position.set((r() - 0.5) * 0.02, y + h / 2, (r() - 0.5) * 0.02); b.rotation.y = (r() - 0.5) * 0.4; g.add(b);
      const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.002, h * 0.12, d + 0.002), std('#c9a24a', { metalness: 0.5 })); band.position.copy(b.position); band.position.y += h * 0.3; band.rotation.y = b.rotation.y; g.add(band);
      y += h;
    }
    return g;
  },
  vase() {
    const r = rng(23); const g = new THREE.Group();
    const glass = std('#b8e0dc', { roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.5 });
    g.add(lathe([[0.001, 0], [0.05, 0], [0.07, 0.06], [0.055, 0.15], [0.032, 0.2], [0.04, 0.235], [0.036, 0.236], [0.026, 0.2], [0.048, 0.15], [0.063, 0.06], [0.044, 0.008], [0.001, 0.008]], glass));
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.1, 18), std('#9fd2cf', { transparent: true, opacity: 0.35 })); water.position.y = 0.06; g.add(water);
    const cols = ['#f4f0e6', '#f2c14e', '#e07a8a', '#c9a4e8', '#f08a4b']; const stem = std('#5b8a45');
    for (let i = 0; i < 12; i++) {
      const a = r() * 6.28; const lean = 0.15 + r() * 0.5; const h = 0.3 + r() * 0.16;
      const s = new THREE.Group(); s.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean); s.position.y = 0.03;
      s.add(cyl(0.0022, 0.0022, h, stem, 0, h / 2, 0, 5));
      const c = cols[i % cols.length]; const head = new THREE.Mesh(new THREE.SphereGeometry(0.02 + r() * 0.01, 10, 8), std(c, { roughness: 0.8 })); head.position.y = h; head.scale.y = 0.55; s.add(head);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), std('#e0a52a')); eye.position.y = h + 0.008; s.add(eye);
      g.add(s);
    }
    return g;
  },
  lantern() {
    const g = new THREE.Group(); const brass = std('#a9783a', { metalness: 0.7, roughness: 0.4 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.15), brass); base.position.y = 0.015; g.add(base);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(cyl(0.006, 0.006, 0.26, brass, sx * 0.065, 0.16, sz * 0.065, 6));
    const gl = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.25, 0.125), new THREE.MeshStandardMaterial({ color: 0xffc27a, emissive: 0xff9a3c, emissiveIntensity: 1.1, transparent: true, opacity: 0.72, roughness: 0.2 })); gl.position.y = 0.16; g.add(gl);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.09, 4), brass); cone.rotation.y = Math.PI / 4; cone.position.y = 0.335; g.add(cone);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.005, 6, 16, Math.PI), brass); ring.position.y = 0.38; g.add(ring);
    g.add(glow(0, 0.17, 0, 0.5));
    g.userData.update = (t) => { gl.material.emissiveIntensity = 1.05 + Math.sin(t * 7) * 0.06 + Math.sin(t * 3.3) * 0.05; };
    return g;
  },
};

/** A fresh model of a shop item, standing on y = 0. */
export function buildItem(kind) {
  const g = (BUILD[kind] || BUILD.succulent)();
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  g.userData.kind = 'item';
  g.userData.itemKind = kind;
  const box = new THREE.Box3().setFromObject(g);
  g.userData.height = box.max.y;
  g.userData.radius = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2;
  return g;
}
