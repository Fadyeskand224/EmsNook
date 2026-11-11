// The room itself: a two-storey library after the reference photo. Everything is modelled from boxes, lathes and tubes
// and painted with generated textures, so it is built once, cheaply, with no model files to download.
//
// Space: x runs left to right, y is up, the entrance is at +z and the grand back wall at z = -8.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { woodVars } from '../lib/themes';
import { checkerTexture, firebrickTexture, flameTexture, flutingBump, furTexture, glowTexture, globeTexture, leatherTextures, marbleTexture, paintingTexture, parquetTexture, planksTexture, rng, rugTexture, shaftTexture, stoneTexture, wallTexture, woodTextures } from './textures';
import { DEFAULT_ROOM } from '../../shared/options.js';
import { colorized, loadTex, rotated } from './real.js';
import { buildOutside } from './outside.js';
import { SWATCH } from './looks';

export const ROOM = { x0: -6, x1: 6, z0: -8, z1: 6, h: 9.2, gallery: 4.5 };
const WALLS = {
  forest: '#8a8a63', navy: '#4a5878', aubergine: '#6a4a62', clay: '#a8725a', charcoal: '#58554f', linen: '#c9b896',
  botanical: '#7c8c64', pinstripe: '#b4a384', grasscloth: '#b09a70', brick: '#8a5040', shiplap: '#a8a08e',
};

const V = (x, y, z) => new THREE.Vector3(x, y, z);

const METALS = { brass: [0xc9a049, 0.32], silver: [0xd4d7da, 0.22], black: [0x2a2623, 0.5] };
const TIMES = {
  golden: { win: 0xffe2a8, sun: 0xffd9a0, sunK: 1, hemi: [0xffe1b4, 0x3a2414], hemiK: 1, shaft: 0xffe0a8, shaftK: 1, exp: 1, bg: 0x0d0805 },
  day: { win: 0xf3f8ff, sun: 0xfff6e6, sunK: 1.5, hemi: [0xe6f0ff, 0x4a3a2c], hemiK: 1.7, shaft: 0xfff4dc, shaftK: 1.2, exp: 1.08, bg: 0x141820 },
  night: { win: 0x16213d, sun: 0x8fa8e0, sunK: 0.28, hemi: [0x40507a, 0x1a1210], hemiK: 0.6, shaft: 0x9ab4ff, shaftK: 0.4, exp: 1.0, bg: 0x05060a },
};
/** Stable name of a shelf, saved with each book's place: CASE:row:column. */
export const runKey = (r) => `${r.tag}:${r.row}:${r.col}`;

export function buildRoom(rawLook) {
  const look = { ...DEFAULT_ROOM, ...rawLook };
  const T = TIMES[look.time] || TIMES.golden;
  const root = new THREE.Group();
  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };

  // ───────── materials ─────────
  const wv = woodVars(look.wood);
  const light = wv['--wood-light'];
  const dark = wv['--wood-dark'];
  const seed = [...look.wood].reduce((a, c) => a + c.charCodeAt(0), 0);
  const tex = woodTextures(light, dark, seed);
  const std = (o) => track(new THREE.MeshStandardMaterial(o));
  // the windows are real openings onto a modelled landscape (outside.js); a faint glass sheen is all that fills them
  const glassMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.05, roughness: 0.02, metalness: 0, envMapIntensity: 1.8, depthWrite: false }));
  const outside = buildOutside(look.time || 'golden');
  const M = {
    woodH: std({ map: tex.h, bumpMap: tex.h, bumpScale: 1.2, roughness: 0.55 }),
    woodV: std({ map: tex.v, bumpMap: tex.v, bumpScale: 1.2, roughness: 0.55 }),
    woodDark: std({ map: tex.h, color: 0x6a5446, roughness: 0.7 }),
    back: std({ color: new THREE.Color(SWATCH.shelfBack[look.shelfBack] || '#1b0f09'), roughness: 0.9 }),
    brass: std({ color: 0xc9a049, metalness: 1, roughness: 0.28, envMapIntensity: 1.5 }),
    metal: std({ color: METALS[look.chandFinish]?.[0] ?? 0xc9a049, metalness: 1, roughness: (METALS[look.chandFinish]?.[1] ?? 0.32) * 0.8, envMapIntensity: 1.7 }),
    cream: std({ color: 0xe9dcc0, roughness: 0.9 }),
    glass: track(new THREE.MeshBasicMaterial({ color: 0xffe2a8 })),
    sky: glassMat,
    ceiling: std({ map: tex.h, color: 0x7a6454, roughness: 0.8 }),
  };
  const leatherChair = leatherTextures(SWATCH.chair[look.chair] || '#6b1d15', false);
  const leatherTuft = leatherTextures('#c2a068', true);
  const leatherTop = leatherTextures(SWATCH.deskTop[look.deskTop] || '#2d4634', false);
  M.red = std({ map: leatherChair.map, bumpMap: leatherChair.bump, bumpScale: 0.6, roughness: 0.42 });
  M.tuft = std({ map: leatherTuft.map, bumpMap: leatherTuft.bump, bumpScale: 3, roughness: 0.6 });
  M.green = std({ map: leatherTop.map, bumpMap: leatherTop.bump, bumpScale: 0.5, roughness: 0.5 });

  const wallTex = (rx, ry) => { const t = wallTexture(WALLS[look.wallpaper] || WALLS.forest).clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return track(t); };
  const wallMats = [];
  const wallMat = (rx, ry) => { const m = std({ map: wallTex(rx, ry), roughness: 0.95 }); m.userData.rep = [rx, ry]; wallMats.push(m); return m; };

  // ───────── helpers ─────────
  const TILE = 1.1;
  function boxGeo(w, h, d) {
    const g = track(new THREE.BoxGeometry(w, h, d));
    const uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, (uv.getX(k) * dims[f][0]) / TILE, (uv.getY(k) * dims[f][1]) / TILE); }
    return g;
  }
  const add = (parent, mesh, x = 0, y = 0, z = 0) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
  const box = (parent, w, h, d, mat, x, y, z) => add(parent, new THREE.Mesh(boxGeo(w, h, d), mat), x, y, z);
  const rbox = (parent, w, h, d, r, mat, x, y, z) => { const m = new THREE.Mesh(track(new RoundedBoxGeometry(w, h, d, 4, r)), mat); m.castShadow = true; return add(parent, m, x, y, z); };
  const cyl = (parent, rt, rb, h, mat, x, y, z, seg = 16) => add(parent, new THREE.Mesh(track(new THREE.CylinderGeometry(rt, rb, h, seg)), mat), x, y, z);

  const candleMatSimple = () => std({ color: 0xf3e8d0, roughness: 0.8 });
  function stackBooks(parent, x, y, z, colors) {
    let yy = y;
    colors.forEach((c, i) => { const h = 0.05 + (i % 2) * 0.012; const bk = box(parent, 0.3 - i * 0.015, h, 0.21, std({ color: c, roughness: 0.6 }), x, yy + h / 2, z); bk.rotation.y = (i - 1) * 0.1; yy += h; });
  }
  const runs = [];
  const pick = { cases: [], globe: null, lamps: [], ladder: [], chandelier: [], floor: null };
  const lights = { chandelier: [], lamps: [], hemi: null, sun: null };
  const flames = [];
  const anim = [];

  // ───────── the shell ─────────
  const shell = new THREE.Group();
  root.add(shell);
  const W = ROOM.x1 - ROOM.x0;
  const D = ROOM.z1 - ROOM.z0;
  const floorBase = look.floor === 'planks' ? planksTexture(light, dark) : look.floor === 'checker' ? checkerTexture() : parquetTexture(light, dark);
  const parquet = floorBase.clone();
  parquet.repeat.set(W / (look.floor === 'planks' ? 3.2 : look.floor === 'checker' ? 3.6 : 2.4), D / (look.floor === 'planks' ? 3.2 : look.floor === 'checker' ? 3.6 : 2.4));
  parquet.needsUpdate = true;
  track(parquet);
  const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(W, D)), std({ map: parquet, bumpMap: parquet, bumpScale: 1, roughness: look.floor === 'checker' ? 0.18 : 0.38 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, (ROOM.z0 + ROOM.z1) / 2);
  floor.receiveShadow = true;
  shell.add(floor);
  pick.floor = floor;

  // walls with real openings cut through them, so the landscape outside is seen in depth
  const rectHole = (x0, y0, x1, y1) => { const p = new THREE.Path(); p.moveTo(x0, y0); p.lineTo(x0, y1); p.lineTo(x1, y1); p.lineTo(x1, y0); p.closePath(); return p; };
  const archHole = (cx, y0, w, h) => { const p = new THREE.Path(); p.moveTo(cx - w / 2, y0); p.lineTo(cx - w / 2, y0 + h - w / 2); p.absarc(cx, y0 + h - w / 2, w / 2, Math.PI, 0, true); p.lineTo(cx + w / 2, y0); p.closePath(); return p; };
  const wallGeo = (width, height, holes) => {
    const sh = new THREE.Shape(); sh.moveTo(-width / 2, 0); sh.lineTo(width / 2, 0); sh.lineTo(width / 2, height); sh.lineTo(-width / 2, height); sh.closePath();
    sh.holes.push(...holes);
    return track(new THREE.ShapeGeometry(sh, 24));
  };
  const zc = (ROOM.z0 + ROOM.z1) / 2;
  const wallBack = new THREE.Mesh(wallGeo(W, ROOM.h, [rectHole(-1.7, 4.75, 1.7, 8.35), archHole(0, 2.55, 1.84, 0.92)]), wallMat(0.5, 0.5));
  wallBack.position.set(0, 0, ROOM.z0);
  shell.add(wallBack);
  const wallFront = new THREE.Mesh(wallGeo(W, ROOM.h, [rectHole(-4.2, 5.3, -3.0, 7.9), rectHole(3.0, 5.3, 4.2, 7.9)]), wallMat(0.5, 0.5));
  wallFront.rotation.y = Math.PI;
  wallFront.position.set(0, 0, ROOM.z1);
  shell.add(wallFront);
  const wallL = new THREE.Mesh(wallGeo(D, ROOM.h, [archHole(-(0.85 - zc), 1.0, 1.1, 2.7), archHole(-(0.85 - zc), ROOM.gallery + 0.9, 1.1, 2.8)]), wallMat(0.5, 0.5));
  wallL.rotation.y = Math.PI / 2;
  wallL.position.set(ROOM.x0, 0, zc);
  shell.add(wallL);
  const wallR = new THREE.Mesh(wallGeo(D, ROOM.h, [archHole(0.85 - zc, 1.0, 1.1, 2.7), archHole(0.85 - zc, ROOM.gallery + 0.9, 1.1, 2.8)]), wallMat(0.5, 0.5));
  wallR.rotation.y = -Math.PI / 2;
  wallR.position.set(ROOM.x1, 0, zc);
  shell.add(wallR);

  // coffered ceiling
  const ceil = new THREE.Mesh(track(new THREE.PlaneGeometry(W, D)), M.ceiling);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, ROOM.h, (ROOM.z0 + ROOM.z1) / 2);
  shell.add(ceil);
  if (look.ceiling !== 'plain') {
    for (let z = ROOM.z0 + 1.2; z < ROOM.z1; z += 3.2) box(shell, W, 0.34, 0.3, M.woodDark, 0, ROOM.h - 0.17, z);
    for (let x = ROOM.x0 + 1.5; x < ROOM.x1; x += 3) box(shell, 0.3, 0.3, D, M.woodDark, x, ROOM.h - 0.15, (ROOM.z0 + ROOM.z1) / 2);
  } else { ceil.material = std({ color: 0xd9ccb2, roughness: 0.95 }); }
  // crown moulding around the top of the walls
  box(shell, W, 0.3, 0.3, M.woodH, 0, ROOM.h - 0.35, ROOM.z0 + 0.15);
  box(shell, W, 0.3, 0.3, M.woodH, 0, ROOM.h - 0.35, ROOM.z1 - 0.15);
  box(shell, 0.3, 0.3, D, M.woodH, ROOM.x0 + 0.15, ROOM.h - 0.35, (ROOM.z0 + ROOM.z1) / 2);
  box(shell, 0.3, 0.3, D, M.woodH, ROOM.x1 - 0.15, ROOM.h - 0.35, (ROOM.z0 + ROOM.z1) / 2);

  // ───────── bookcases ─────────
  const casesRoot = new THREE.Group();
  root.add(casesRoot);
  const PITCH = 0.4;
  const PLINTH = 0.24;
  const LED = track(new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
  const glowPlane = track(new THREE.PlaneGeometry(1, 1));
  const glowMat = track(new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  /** A built-in bookcase. Local x runs along the wall, +z is out into the room. Records every shelf as a run books can stand on. */
  function addCase({ x, y = 0, z, w, h, yaw = 0, upper = false, tag }) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    casesRoot.add(g);
    const d = 0.5;
    const cols = Math.max(1, Math.round(w / 1.2));
    const colW = w / cols;
    const modern = look.shelf === 'modern';
    const carved = look.shelf === 'carved';
    const sideT = modern ? 0.05 : 0.09;
    const shelfT = modern ? 0.03 : 0.04;
    // body
    box(g, w, h - PLINTH - 0.3, 0.03, M.back, 0, PLINTH + (h - PLINTH - 0.3) / 2, -d / 2 + 0.02);
    box(g, sideT, h, d, M.woodV, -w / 2 + sideT / 2, h / 2, 0);
    box(g, sideT, h, d, M.woodV, w / 2 - sideT / 2, h / 2, 0);
    for (let c = 1; c < cols; c++) box(g, modern ? 0.03 : 0.05, h - PLINTH - 0.3, d - 0.04, M.woodV, -w / 2 + c * colW, PLINTH + (h - PLINTH - 0.3) / 2, 0);
    if (modern) {
      // clean lines: a plain plinth and a flat top board
      box(g, w, PLINTH, d - 0.04, M.woodDark, 0, PLINTH / 2, -0.02);
      box(g, w + 0.02, 0.06, d + 0.02, M.woodH, 0, h - 0.03, 0.0);
    } else {
      // plinth with a moulded lip, and the crown
      box(g, w + 0.04, PLINTH, d + 0.08, M.woodH, 0, PLINTH / 2, 0.02);
      box(g, w + 0.08, 0.05, d + 0.12, M.woodH, 0, PLINTH + 0.02, 0.03);
      box(g, w, 0.16, d, M.woodDark, 0, h - 0.18, 0);
      box(g, w + 0.14, 0.09, d + 0.12, M.woodH, 0, h - 0.07, 0.04);
      box(g, w + 0.24, 0.07, d + 0.22, M.woodH, 0, h - 0.015, 0.06);
      box(g, w, 0.025, 0.02, M.brass, 0, h - 0.19, d / 2 + 0.012);
    }
    if (carved) {
      // scalloped fans under the crown, fluted pilasters with capitals, and a carved arch over every bay
      const fans = Math.floor(w / 0.13);
      for (let i = 0; i < fans; i++) {
        const f = cyl(g, 0.055, 0.055, 0.02, M.woodH, -w / 2 + (i + 0.5) * (w / fans), h - 0.3, d / 2 + 0.005, 10);
        f.rotation.x = Math.PI / 2;
      }
      for (let c = 0; c <= cols; c++) {
        const px = -w / 2 + c * colW;
        box(g, 0.07, h - PLINTH - 0.4, 0.05, M.woodV, px, PLINTH + (h - PLINTH - 0.4) / 2, d / 2 + 0.03);
        box(g, 0.12, 0.06, 0.09, M.woodH, px, h - 0.36, d / 2 + 0.03);
        box(g, 0.1, 0.05, 0.08, M.woodH, px, PLINTH + 0.04, d / 2 + 0.03);
      }
      for (let c = 0; c < cols; c++) {
        const arc = new THREE.Mesh(track(new THREE.TorusGeometry(colW / 2 - 0.05, 0.022, 6, 18, Math.PI)), M.woodH);
        arc.position.set(-w / 2 + (c + 0.5) * colW, h - 0.4, d / 2 + 0.02);
        g.add(arc);
      }
    }
    // shelves
    const rows = Math.floor((h - PLINTH - 0.3 - 0.06) / PITCH);
    for (let k = 0; k <= rows; k++) {
      const yTop = PLINTH + 0.05 + k * PITCH;
      if (k < rows) box(g, w - sideT * 2, shelfT, d - 0.02, M.woodH, 0, yTop - shelfT / 2, 0.0);
      box(g, w - sideT * 2, modern ? 0.012 : 0.022, 0.025, M.woodDark, 0, yTop - (modern ? 0.036 : 0.045), d / 2 - 0.005);
    }
    // soft light under each shelf
    if (look.shelfLed === 'warm') {
      for (let k = 1; k <= rows; k++) {
        const yUnder = PLINTH + 0.05 + k * PITCH - shelfT - 0.004;
        box(g, w - sideT * 2 - 0.04, 0.01, 0.012, LED, 0, yUnder, d / 2 - 0.04);
        if (k <= rows) {
          const gl = new THREE.Mesh(glowPlane, glowMat);
          gl.scale.set(w - sideT * 2 - 0.04, PITCH * 0.8, 1);
          gl.position.set(0, yUnder - PITCH * 0.4, -d / 2 + 0.06);
          g.add(gl);
        }
      }
    }
    g.updateMatrixWorld(true);
    const dir = V(1, 0, 0).applyQuaternion(g.quaternion);
    const nrm = V(0, 0, 1).applyQuaternion(g.quaternion);
    for (let k = 0; k < rows; k++) {
      const yTop = PLINTH + 0.05 + k * PITCH;
      for (let c = 0; c < cols; c++) {
        const lx = -w / 2 + c * colW + (c === 0 ? sideT : 0.025);
        const len = colW - (c === 0 ? sideT : 0.025) - (c === cols - 1 ? sideT : 0.025);
        const local = V(lx, yTop, 0.0);
        const p0 = local.applyMatrix4(g.matrixWorld);
        runs.push({ p0, dir: dir.clone(), nrm: nrm.clone(), len, clear: PITCH - 0.06, yaw, upper, tag, row: k, col: c, rows, cols, depth: d - 0.06 });
      }
    }
    g.traverse((o) => { if (o.isMesh) { o.userData.kind = 'case'; o.userData.nrm = nrm; o.userData.upper = upper; } });
    pick.cases.push(g);
    return g;
  }

  const LOW = ROOM.gallery - 0.6;
  const HI = 3.5;
  // lower storey
  addCase({ x: 3.55, z: -7.75, w: 3.6, h: LOW, tag: 'BR' });
  addCase({ x: -3.55, z: -7.75, w: 3.6, h: LOW, tag: 'BL' });
  addCase({ x: 5.75, z: -3.6, w: 7.6, h: LOW, yaw: -Math.PI / 2, tag: 'R' });
  addCase({ x: -5.75, z: -3.6, w: 7.6, h: LOW, yaw: Math.PI / 2, tag: 'L' });
  addCase({ x: 5.75, z: 3.5, w: 4.0, h: LOW, yaw: -Math.PI / 2, tag: 'R2' });
  addCase({ x: -5.75, z: 3.5, w: 4.0, h: LOW, yaw: Math.PI / 2, tag: 'L2' });
  addCase({ x: 3.55, z: 5.75, w: 3.6, h: LOW, yaw: Math.PI, tag: 'FR' });
  addCase({ x: -3.55, z: 5.75, w: 3.6, h: LOW, yaw: Math.PI, tag: 'FL' });
  // upper gallery
  addCase({ x: 3.55, y: ROOM.gallery, z: -7.75, w: 3.6, h: HI, upper: true, tag: 'uBR' });
  addCase({ x: -3.55, y: ROOM.gallery, z: -7.75, w: 3.6, h: HI, upper: true, tag: 'uBL' });
  addCase({ x: 5.75, y: ROOM.gallery, z: -3.6, w: 7.6, h: HI, yaw: -Math.PI / 2, upper: true, tag: 'uR' });
  addCase({ x: -5.75, y: ROOM.gallery, z: -3.6, w: 7.6, h: HI, yaw: Math.PI / 2, upper: true, tag: 'uL' });
  addCase({ x: 5.75, y: ROOM.gallery, z: 3.5, w: 4.0, h: HI, yaw: -Math.PI / 2, upper: true, tag: 'uR2' });
  addCase({ x: -5.75, y: ROOM.gallery, z: 3.5, w: 4.0, h: HI, yaw: Math.PI / 2, upper: true, tag: 'uL2' });

  // ───────── gallery floor, balustrade, columns ─────────
  const gal = new THREE.Group();
  root.add(gal);
  const GY = ROOM.gallery;
  const slab = (x0, x1, z0, z1) => box(gal, x1 - x0, 0.32, z1 - z0, M.woodH, (x0 + x1) / 2, GY - 0.16, (z0 + z1) / 2);
  slab(ROOM.x0, -4.2, ROOM.z0, ROOM.z1);
  slab(4.2, ROOM.x1, ROOM.z0, ROOM.z1);
  slab(-4.2, 4.2, ROOM.z0, -6.2);
  // carved beam under the inner edge, with a row of dentils
  const beam = (x, z, w, d) => {
    box(gal, w, 0.52, d, M.woodH, x, GY - 0.6, z);
    box(gal, w + 0.1, 0.08, d + 0.1, M.woodDark, x, GY - 0.3, z);
    const inner = x + (x < 0 ? w / 2 + 0.03 : -(w / 2 + 0.03));
    const n = Math.floor(d / 0.12);
    for (let i = 0; i < n; i++) box(gal, 0.07, 0.07, 0.06, M.woodH, inner, GY - 0.4, z - d / 2 + (i + 0.5) * (d / n));
  };
  beam(-4.05, -0.1, 0.3, 12.2);
  beam(4.05, -0.1, 0.3, 12.2);
  box(gal, 8.4, 0.52, 0.3, M.woodH, 0, GY - 0.6, -6.35);
  // balustrade: handrail, base rail, turned balusters (instanced), newel posts
  const RAIL = 1.0;
  const profile = [[0.001, 0], [0.05, 0], [0.05, 0.05], [0.032, 0.09], [0.03, 0.14], [0.052, 0.2], [0.034, 0.27], [0.03, 0.34], [0.045, 0.4], [0.03, 0.46], [0.03, 0.54], [0.05, 0.62], [0.03, 0.68], [0.026, 0.74], [0.045, 0.8], [0.034, 0.86], [0.04, 0.9], [0.001, 0.9]].map(([r, y]) => new THREE.Vector2(r, y));
  const balGeo = track(new THREE.LatheGeometry(profile, 10));
  const balRuns = [[-4.2, 5.9, -4.2, -6.2, 'z'], [4.2, 5.9, 4.2, -6.2, 'z'], [-4.2, -6.2, 4.2, -6.2, 'x']];
  const spots = [];
  for (const [ax, az, bx, bz, axis] of balRuns) {
    const len = axis === 'z' ? Math.abs(bz - az) : Math.abs(bx - ax);
    const n = Math.floor(len / 0.15);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      spots.push([ax + (bx - ax) * t, GY + 0.1, az + (bz - az) * t]);
    }
    const mx = (ax + bx) / 2; const mz = (az + bz) / 2;
    if (axis === 'z') { box(gal, 0.15, 0.1, len + 0.15, M.woodH, mx, GY + RAIL + 0.04, mz); box(gal, 0.1, 0.1, len, M.woodDark, mx, GY + 0.05, mz); }
    else { box(gal, len + 0.15, 0.1, 0.15, M.woodH, mx, GY + RAIL + 0.04, mz); box(gal, len, 0.1, 0.1, M.woodDark, mx, GY + 0.05, mz); }
  }
  const bal = new THREE.InstancedMesh(balGeo, M.woodV, spots.length);
  const mtx = new THREE.Matrix4();
  spots.forEach((s, i) => { mtx.makeTranslation(s[0], s[1], s[2]); bal.setMatrixAt(i, mtx); });
  gal.add(bal);
  for (const [px, pz] of [[-4.2, 5.9], [4.2, 5.9], [-4.2, -6.2], [4.2, -6.2]]) {
    box(gal, 0.2, RAIL + 0.14, 0.2, M.woodH, px, GY + (RAIL + 0.14) / 2, pz);
    add(gal, new THREE.Mesh(track(new THREE.SphereGeometry(0.11, 12, 10)), M.woodH), px, GY + RAIL + 0.2, pz);
  }

  // fluted columns under the gallery's front corners, and half-columns beside the door
  const flutes = flutingBump();
  const colMat = std({ map: tex.v, bumpMap: flutes, bumpScale: 4, roughness: 0.5 });
  const colProfile = [[0.34, 0], [0.34, 0.12], [0.28, 0.2], [0.22, 0.3], [0.2, 0.5], [0.2, 3.6], [0.22, 3.75], [0.26, 3.82], [0.34, 3.9], [0.4, 3.95]].map(([r, y]) => new THREE.Vector2(r, y));
  const colGeo = track(new THREE.LatheGeometry(colProfile, 24));
  const column = (x, z, s = 1) => {
    const c = new THREE.Mesh(colGeo, colMat);
    c.scale.set(s, 1, s);
    c.position.set(x, 0.0, z);
    root.add(c);
    box(root, 0.8 * s, 0.22, 0.8 * s, M.woodH, x, 0.11, z);
    box(root, 0.9 * s, 0.24, 0.9 * s, M.woodH, x, 4.05 - 0.04, z);
    box(root, 0.7 * s, 0.1, 0.7 * s, M.woodDark, x, 3.92, z);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(root, new THREE.Mesh(track(new THREE.SphereGeometry(0.08, 8, 8)), M.woodH), x + sx * 0.3 * s, 3.85, z + sz * 0.3 * s);
  };
  column(-4.2, 2.6);
  column(4.2, 2.6);
  column(-4.2, -2.2);
  column(4.2, -2.2);
  column(-4.2, 5.4);
  column(4.2, 5.4);

  // ───────── the back wall: arched double door under a carved pediment, tall windows above the gallery ─────────
  const back = new THREE.Group();
  root.add(back);
  const doorZ = ROOM.z0 + 0.04;
  const arch = (r, z) => {
    const m = new THREE.Mesh(track(new THREE.CircleGeometry(r, 24, 0, Math.PI)), M.sky);
    m.position.set(0, 2.55, z);
    return m;
  };
  box(back, 2.2, 0.3, 0.3, M.woodH, 0, 0.15, doorZ + 0.1);
  box(back, 0.16, 2.6, 0.2, M.woodV, -1.0, 1.4, doorZ + 0.08);
  box(back, 0.16, 2.6, 0.2, M.woodV, 1.0, 1.4, doorZ + 0.08);
  box(back, 1.84, 2.4, 0.04, M.woodDark, 0, 1.3, doorZ + 0.02);
  const archGlass = arch(0.92, doorZ + 0.04);
  back.add(archGlass);
  const frameArc = new THREE.Mesh(track(new THREE.TorusGeometry(0.96, 0.08, 8, 24, Math.PI)), M.woodH);
  frameArc.position.set(0, 2.55, doorZ + 0.1);
  back.add(frameArc);
  for (const sx of [-1, 1]) {
    box(back, 0.74, 1.3, 0.05, M.woodH, sx * 0.45, 1.0, doorZ + 0.06);
    box(back, 0.6, 1.1, 0.06, M.woodDark, sx * 0.45, 1.0, doorZ + 0.08);
    box(back, 0.74, 0.06, 0.06, M.woodH, sx * 0.45, 2.0, doorZ + 0.08);
    const gl = new THREE.Mesh(track(new THREE.PlaneGeometry(0.62, 0.7)), M.sky);
    gl.position.set(sx * 0.45, 2.45, doorZ + 0.05);
    back.add(gl);
    box(back, 0.04, 0.8, 0.07, M.woodH, sx * 0.45, 2.45, doorZ + 0.08);
  }
  for (const kx of [-0.1, 0.1]) cyl(back, 0.025, 0.025, 0.05, M.brass, kx, 1.2, doorZ + 0.12, 8).rotation.x = Math.PI / 2;
  // pediment: a carved frieze with scrolls and a brass shell
  box(back, 2.6, 0.2, 0.22, M.woodH, 0, 3.78, doorZ + 0.12);
  box(back, 2.9, 0.1, 0.3, M.woodH, 0, 3.96, doorZ + 0.14);
  box(back, 2.3, 0.4, 0.12, M.woodDark, 0, 4.18, doorZ + 0.1);
  for (const s of [-1, 1]) {
    const sc = new THREE.Mesh(track(new THREE.TorusGeometry(0.2, 0.05, 8, 20, Math.PI * 1.6)), M.woodH);
    sc.position.set(s * 0.72, 4.16, doorZ + 0.2);
    sc.rotation.z = s > 0 ? Math.PI * 0.1 : Math.PI * 0.9;
    back.add(sc);
    const sc2 = sc.clone(); sc2.scale.set(0.55, 0.55, 1); sc2.position.set(s * 1.0, 4.08, doorZ + 0.2); back.add(sc2);
  }
  add(back, new THREE.Mesh(track(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), M.brass), 0, 4.15, doorZ + 0.22).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) column(s * 1.3, ROOM.z0 + 0.5, 0.55);

  // the big upper window: warm daylight in cross-barred panes
  const winGlass = M.sky;
  const win = new THREE.Mesh(track(new THREE.PlaneGeometry(3.4, 3.6)), winGlass);
  win.position.set(0, 6.55, ROOM.z0 + 0.03);
  back.add(win);
  box(back, 3.7, 0.16, 0.16, M.woodH, 0, 8.4, ROOM.z0 + 0.1);
  box(back, 3.7, 0.2, 0.2, M.woodH, 0, 4.75, ROOM.z0 + 0.1);
  for (let i = 0; i < 4; i++) box(back, 0.1, 3.6, 0.1, M.woodH, -1.7 + i * (3.4 / 3), 6.55, ROOM.z0 + 0.09);
  for (let j = 1; j < 3; j++) box(back, 3.4, 0.08, 0.08, M.woodH, 0, 4.9 + j * 1.2, ROOM.z0 + 0.09);

  // ───────── windows in the side walls (a seat below, a tall arched light above) ─────────
  function archWindow(x, y0, z, yaw, w, h) {
    const g = new THREE.Group();
    g.position.set(x, y0, z);
    g.rotation.y = yaw;
    root.add(g);
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2, h - w / 2); sh.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); sh.lineTo(-w / 2, 0);
    const glass = new THREE.Mesh(track(new THREE.ShapeGeometry(sh)), M.sky);
    glass.position.z = 0.01;
    g.add(glass);
    const arc = new THREE.Mesh(track(new THREE.TorusGeometry(w / 2 + 0.03, 0.045, 6, 22, Math.PI)), M.woodH);
    arc.position.set(0, h - w / 2, 0.05); g.add(arc);
    for (const sx of [-1, 1]) box(g, 0.09, h - w / 2, 0.1, M.woodV, sx * (w / 2 + 0.03), (h - w / 2) / 2, 0.05);
    box(g, 0.05, h, 0.06, M.woodH, 0, h / 2, 0.04);
    for (const yy of [h * 0.28, h * 0.58]) box(g, w, 0.05, 0.06, M.woodH, 0, yy, 0.04);
    box(g, w + 0.3, 0.07, 0.22, M.woodH, 0, -0.02, 0.1);
    return g;
  }
  for (const sx of [-1, 1]) {
    const wallX = sx * (ROOM.x1 - 0.02);
    const yaw = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
    archWindow(wallX, 1.0, 0.85, yaw, 1.1, 2.7);
    archWindow(wallX, ROOM.gallery + 0.9, 0.85, yaw, 1.1, 2.8);
    // the window seat under the lower one
    const seat = new THREE.Group(); seat.position.set(sx * (ROOM.x1 - 0.3), 0, 0.85); root.add(seat);
    box(seat, 0.5, 0.42, 1.3, M.woodH, 0, 0.21, 0);
    rbox(seat, 0.5, 0.1, 1.24, 0.04, M.tuft, 0, 0.47, 0);
    for (const dz of [-0.4, 0.4]) rbox(seat, 0.26, 0.2, 0.3, 0.08, M.red, 0, 0.62, dz);
  }

  // ───────── the fireplace: the entrance wall, behind where you walk in ─────────
  const fp = new THREE.Group();
  fp.position.set(0, 0, ROOM.z1);
  fp.rotation.y = Math.PI; // local +z points into the room
  root.add(fp);
  const surfMat = look.fireplace === 'stone'
    ? (() => { const t = stoneTexture().clone(); t.repeat.set(2, 2); t.needsUpdate = true; track(t); return std({ map: t, bumpMap: t, bumpScale: 2, roughness: 0.92 }); })()
    : look.fireplace === 'wood' ? M.woodH
      : std({ map: marbleTexture(), roughness: 0.18 });
  const trimMat = look.fireplace === 'wood' ? M.woodDark : look.fireplace === 'stone' ? M.woodH : std({ color: 0xd8d2c6, roughness: 0.3 });
  const panelMat = look.fireplace === 'wood' ? M.woodV : wallMat(1.6, 3.6);
  const OPEN_W = 1.5;
  const OPEN_H = 1.18;
  const BREAST = 3.5;
  // surround: jambs, lintel, mantel shelf, hearth
  const jamb = (BREAST - OPEN_W) / 2;
  for (const sx of [-1, 1]) {
    const j = box(fp, jamb, 2.6, 0.5, surfMat, sx * (OPEN_W / 2 + jamb / 2), 1.3, 0.25);
    j.userData.kind = 'fire';
    cyl(fp, 0.1, 0.12, OPEN_H + 0.06, trimMat, sx * (OPEN_W / 2 + 0.06), 0.62, 0.55, 14);
    box(fp, 0.3, 0.1, 0.3, trimMat, sx * (OPEN_W / 2 + 0.06), 1.28, 0.55);
    box(fp, 0.28, 0.12, 0.28, trimMat, sx * (OPEN_W / 2 + 0.06), 0.06, 0.55);
    box(fp, 0.2, 0.3, 0.4, trimMat, sx * 1.35, 2.36, 0.3);
  }
  box(fp, OPEN_W, 2.6 - OPEN_H - 0.08, 0.5, surfMat, 0, OPEN_H + 0.08 + (2.6 - OPEN_H - 0.08) / 2, 0.25);
  box(fp, OPEN_W + 0.4, 0.1, 0.56, trimMat, 0, OPEN_H + 0.1, 0.28);
  box(fp, 3.7, 0.13, 0.78, trimMat, 0, 2.66, 0.38);
  box(fp, 3.5, 0.07, 0.66, surfMat, 0, 2.555, 0.34);
  const hearth = box(fp, 3.9, 0.07, 1.15, std({ map: marbleTexture(), roughness: 0.2, color: look.fireplace === 'stone' ? 0x6a625a : 0xffffff }), 0, 0.035, 0.62);
  hearth.userData.kind = 'fire';
  // inside: firebrick, a dark roof and sides
  const brick = firebrickTexture();
  const inner = std({ map: brick, roughness: 1 });
  const back2 = new THREE.Mesh(track(new THREE.PlaneGeometry(OPEN_W, OPEN_H)), inner);
  back2.position.set(0, 0.07 + OPEN_H / 2, 0.09);
  back2.userData.kind = 'fire';
  fp.add(back2);
  for (const sx of [-1, 1]) { const sp = new THREE.Mesh(track(new THREE.PlaneGeometry(0.5, OPEN_H)), inner); sp.rotation.y = -sx * Math.PI / 2; sp.position.set(sx * (OPEN_W / 2 - 0.02), 0.07 + OPEN_H / 2, 0.32); sp.scale.x = 0.9; fp.add(sp); }
  const roof = new THREE.Mesh(track(new THREE.PlaneGeometry(OPEN_W, 0.5)), std({ color: 0x0a0604, roughness: 1 })); roof.rotation.x = Math.PI / 2; roof.position.set(0, OPEN_H + 0.045, 0.32); roof.scale.set(0.97, 0.9, 1); fp.add(roof);
  const floorIn = new THREE.Mesh(track(new THREE.PlaneGeometry(OPEN_W, 0.5)), std({ color: 0x15100c, roughness: 1 })); floorIn.rotation.x = -Math.PI / 2; floorIn.position.set(0, 0.085, 0.32); floorIn.scale.set(0.97, 0.9, 1); fp.add(floorIn);
  // chimney breast above the mantel, with a framed painting
  box(fp, BREAST - 0.02, ROOM.h - 2.74, 0.33, panelMat, 0, 2.74 + (ROOM.h - 2.74) / 2, 0.165);
  box(fp, BREAST + 0.2, 0.18, 0.4, M.woodH, 0, ROOM.h - 0.55, 0.2);
  const frame = box(fp, 2.4, 1.7, 0.08, M.woodH, 0, 4.0, 0.38);
  frame.userData.kind = 'fire';
  const inFrame = box(fp, 2.15, 1.45, 0.02, M.brass, 0, 4.0, 0.43);
  const art = new THREE.Mesh(track(new THREE.PlaneGeometry(2.0, 1.3)), std({ map: paintingTexture(), roughness: 0.6, emissive: 0x201008, emissiveMap: paintingTexture(), emissiveIntensity: 0.35 }));
  art.position.set(0, 4.0, 0.45);
  fp.add(art);
  inFrame.visible = true;
  // things on the mantel: clock, candlesticks, vase, books
  const clock = new THREE.Group(); clock.position.set(0, 2.73, 0.4); fp.add(clock);
  box(clock, 0.34, 0.42, 0.14, M.woodH, 0, 0.21, 0);
  const faceC = new THREE.Mesh(track(new THREE.CircleGeometry(0.12, 24)), M.cream); faceC.position.set(0, 0.25, 0.075); clock.add(faceC);
  box(clock, 0.012, 0.09, 0.005, M.brass, 0, 0.29, 0.08); box(clock, 0.07, 0.012, 0.005, M.brass, 0.03, 0.25, 0.08);
  add(clock, new THREE.Mesh(track(new THREE.SphereGeometry(0.06, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)), M.brass), 0, 0.42, 0);
  const candleF = track(new THREE.SpriteMaterial({ map: flameTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  const mantelFlames = [];
  for (const sx of [-1, 1]) {
    const cs = new THREE.Group(); cs.position.set(sx * 1.05, 2.73, 0.4); fp.add(cs);
    cyl(cs, 0.07, 0.09, 0.03, M.brass, 0, 0.015, 0, 14); cyl(cs, 0.014, 0.02, 0.26, M.brass, 0, 0.16, 0, 8); cyl(cs, 0.04, 0.03, 0.03, M.brass, 0, 0.3, 0, 10);
    cyl(cs, 0.02, 0.02, 0.2, candleMatSimple(), 0, 0.42, 0, 8);
    const f = new THREE.Sprite(candleF); f.scale.set(0.07, 0.14, 1); f.position.y = 0.58; cs.add(f); mantelFlames.push(f);
  }
  const vase = new THREE.Mesh(track(new THREE.LatheGeometry([[0.001, 0], [0.08, 0], [0.1, 0.08], [0.05, 0.2], [0.04, 0.25], [0.07, 0.3]].map(([r, y]) => new THREE.Vector2(r, y)), 14)), std({ color: 0x3d5a6c, roughness: 0.25 }));
  vase.position.set(1.45, 2.73, 0.38); fp.add(vase);
  stackBooks(fp, -1.45, 2.73, 0.38, [0x5a1f2c, 0x2f4a3a, 0x7a3a22]);
  // fire: logs, tongues of flame, embers, and a flickering light
  const fireGroup = new THREE.Group(); fireGroup.position.set(0, 0.1, 0.22); fp.add(fireGroup);
  box(fireGroup, 1.0, 0.04, 0.04, M.metal, 0, 0.1, 0.12);
  for (const sx of [-1, 1]) { box(fireGroup, 0.04, 0.2, 0.04, M.metal, sx * 0.5, 0.1, 0.12); box(fireGroup, 0.04, 0.04, 0.3, M.metal, sx * 0.5, 0.06, 0); }
  const logMat = track(new THREE.MeshStandardMaterial({ color: 0x2a160c, emissive: 0x7a2a00, emissiveIntensity: 1.2, roughness: 0.9 }));
  for (const [lx, ly, lz, rz] of [[-0.12, 0.08, 0, 0.08], [0.15, 0.08, 0.02, -0.12], [0, 0.2, 0.0, 0.0]]) { const l = cyl(fireGroup, 0.07, 0.08, 0.95, logMat, lx, ly, lz, 10); l.rotation.z = Math.PI / 2 + rz; l.rotation.y = lz * 6; }
  const fireMat = track(new THREE.SpriteMaterial({ map: flameTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  const tongues = [];
  for (let i = 0; i < 9; i++) {
    const f = new THREE.Sprite(fireMat);
    const x = -0.45 + (i / 8) * 0.9;
    f.position.set(x, 0.38, 0.1);
    fireGroup.add(f);
    tongues.push({ s: f, x, ph: i * 1.3, h: 0.55 + (1 - Math.abs(x) / 0.5) * 0.4 });
  }
  const emberGlow = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9, color: 0xff6a20 })));
  emberGlow.scale.set(1.3, 0.6, 1); emberGlow.position.set(0, 0.3, 0.12); fireGroup.add(emberGlow);
  const fireLight = new THREE.PointLight(0xff8a3c, 14, 11, 1.5);
  fireLight.position.set(0, 0.8, 0.9);
  fp.add(fireLight);
  const hearthLight = new THREE.PointLight(0xff7a30, 4, 5, 2); hearthLight.position.set(0, 0.3, 1.2); fp.add(hearthLight);
  pick.fire = fp;
  fp.userData.kind = 'fire';
  // a soft rug in front of the fire
  const fur = new THREE.Mesh(track(new THREE.CircleGeometry(0.95, 36)), std({ map: furTexture(), roughness: 1, color: 0xb5a890 }));
  fur.rotation.x = -Math.PI / 2; fur.scale.set(1.6, 1, 1); fur.position.set(0, 0.014, ROOM.z1 - 2.2); fur.receiveShadow = true; root.add(fur);
  fur.visible = look.rug !== 'none';
  // wall sconces on the chimney breast
  for (const sx of [-1, 1]) {
    const sc = new THREE.Group(); sc.position.set(sx * 2.15, 3.4, 0.0); fp.add(sc);
    box(sc, 0.1, 0.3, 0.04, M.brass, 0, 0, 0.03);
    cyl(sc, 0.02, 0.02, 0.2, M.brass, 0, 0.0, 0.14, 8).rotation.x = Math.PI / 2;
    cyl(sc, 0.05, 0.04, 0.12, M.cream, 0, 0.1, 0.22, 10);
    const sg = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 })));
    sg.scale.setScalar(0.9); sg.position.set(0, 0.2, 0.26); sc.add(sg);
  }
  // two tall windows high on the front wall, above the bookcases
  for (const sx of [-1, 1]) {
    const wg = new THREE.Mesh(track(new THREE.PlaneGeometry(1.2, 2.6)), M.sky); wg.position.set(sx * 3.6, 6.6, ROOM.z1 - 0.03); wg.rotation.y = Math.PI; root.add(wg);
    box(root, 1.5, 0.14, 0.14, M.woodH, sx * 3.6, 7.95, ROOM.z1 - 0.08); box(root, 1.5, 0.18, 0.18, M.woodH, sx * 3.6, 5.28, ROOM.z1 - 0.08);
    for (const dx of [-0.6, 0, 0.6]) box(root, 0.08, 2.7, 0.1, M.woodH, sx * 3.6 + dx, 6.6, ROOM.z1 - 0.08);
    box(root, 1.2, 0.07, 0.08, M.woodH, sx * 3.6, 6.6, ROOM.z1 - 0.08);
  }

  // ───────── rug ─────────
  const rugMat = std({ map: rugTexture(look.rug === 'none' ? 'persian' : look.rug), roughness: 1 });
  const rug = new THREE.Mesh(track(new THREE.PlaneGeometry(5.6, 8.4)), rugMat);
  rug.rotation.x = -Math.PI / 2;
  rug.rotation.z = Math.PI / 2;
  rug.position.set(0, 0.012, -1.6);
  rug.receiveShadow = true;
  rug.visible = look.rug !== 'none';
  root.add(rug);
  rug.scale.set(1, 0.62, 1);
  pick.rug = rug;

  // ───────── furniture ─────────
  // writing desk
  const desk = new THREE.Group();
  desk.position.set(-0.3, 0, -3.3);
  root.add(desk);
  if (look.desk === 'modern') {
    box(desk, 1.9, 0.045, 0.9, M.woodH, 0, 0.78, 0).castShadow = true;
    const inl = new THREE.Mesh(track(new THREE.PlaneGeometry(1.5, 0.6)), M.green);
    inl.rotation.x = -Math.PI / 2; inl.position.set(0, 0.803, 0); desk.add(inl);
    for (const [lx, lz] of [[-0.9, 0.4], [0.9, 0.4], [-0.9, -0.4], [0.9, -0.4]]) { const l = box(desk, 0.04, 0.76, 0.04, M.metal, lx, 0.38, lz); l.castShadow = true; }
    box(desk, 0.5, 0.12, 0.7, M.woodDark, -0.55, 0.68, 0);
    box(desk, 0.46, 0.08, 0.02, M.woodH, -0.55, 0.68, 0.36);
    cyl(desk, 0.012, 0.012, 0.14, M.metal, -0.55, 0.68, 0.38, 8).rotation.z = Math.PI / 2;
  } else if (look.desk === 'executive') {
    rbox(desk, 2.2, 0.07, 1.05, 0.02, M.woodH, 0, 0.8, 0).receiveShadow = true;
    const inl = new THREE.Mesh(track(new THREE.PlaneGeometry(1.9, 0.8)), M.green);
    inl.rotation.x = -Math.PI / 2; inl.position.set(0, 0.838, 0); desk.add(inl);
    for (const sx of [-1, 1]) {
      const ped = box(desk, 0.58, 0.72, 0.9, M.woodH, sx * 0.78, 0.38, 0);
      ped.castShadow = true;
      box(desk, 0.64, 0.05, 0.96, M.woodDark, sx * 0.78, 0.025, 0);
      for (let i = 0; i < 3; i++) {
        box(desk, 0.5, 0.2, 0.02, M.woodDark, sx * 0.78, 0.18 + i * 0.22, 0.455);
        cyl(desk, 0.02, 0.02, 0.05, M.brass, sx * 0.78, 0.18 + i * 0.22, 0.48, 10).rotation.x = Math.PI / 2;
      }
    }
    box(desk, 1.0, 0.6, 0.03, M.woodDark, 0, 0.4, -0.42);
    box(desk, 1.0, 0.1, 0.04, M.woodH, 0, 0.72, 0.44);
  } else {
  const DT = rbox(desk, 1.8, 0.06, 0.95, 0.02, M.woodH, 0, 0.78, 0);
  DT.receiveShadow = true;
  const inlay = new THREE.Mesh(track(new THREE.PlaneGeometry(1.52, 0.7)), M.green);
  inlay.rotation.x = -Math.PI / 2; inlay.position.set(0, 0.812, 0); desk.add(inlay);
  box(desk, 1.64, 0.14, 0.04, M.woodH, 0, 0.67, 0.4).castShadow = true;
  box(desk, 1.64, 0.14, 0.04, M.woodH, 0, 0.67, -0.4);
  box(desk, 0.04, 0.14, 0.8, M.woodH, -0.8, 0.67, 0);
  box(desk, 0.04, 0.14, 0.8, M.woodH, 0.8, 0.67, 0);
  for (const sx of [-1, 1]) {
    box(desk, 0.5, 0.1, 0.02, M.woodDark, sx * 0.45, 0.67, 0.425);
    cyl(desk, 0.03, 0.03, 0.04, M.brass, sx * 0.45, 0.67, 0.45, 12).rotation.x = Math.PI / 2;
  }
  for (const [lx, lz] of [[-0.8, 0.38], [0.8, 0.38], [-0.8, -0.38], [0.8, -0.38]]) {
    const leg = cyl(desk, 0.032, 0.05, 0.72, M.woodV, lx, 0.36, lz, 10);
    leg.castShadow = true;
    add(desk, new THREE.Mesh(track(new THREE.SphereGeometry(0.052, 10, 8)), M.woodH), lx, 0.02, lz);
  }
  }
  const flameMat0 = track(new THREE.SpriteMaterial({ map: flameTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  // ───────── what stands on the desk (each of these is a Customize choice) ─────────
  const TY = look.desk === 'executive' ? 0.84 : 0.81;
  const ceramic = std({ color: 0xf3efe6, roughness: 0.12, metalness: 0, envMapIntensity: 1.2 });
  const darkMetal = std({ color: 0x1b1a19, roughness: 0.45, metalness: 0.7 });
  const lathe = (pts, mat, seg = 28) => new THREE.Mesh(track(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg)), mat);
  const stack = (sx, sz, n, colors) => {
    let y = TY;
    for (let i = 0; i < n; i++) {
      const h = 0.045 + (i % 2) * 0.01;
      const bk = box(desk, 0.26 - i * 0.012, h, 0.19, std({ color: colors[i % colors.length], roughness: 0.6 }), sx + (i % 2 ? 0.01 : -0.01), y + h / 2, sz);
      bk.castShadow = true; bk.rotation.y = (i - 1) * 0.08;
      y += h;
    }
  };
  if (look.deskBooks === 'stack') {
    stack(-0.62, 0.05, 4, [0x7a2218, 0x2f4a3a, 0x3a2a1c]);
    stack(-0.3, 0.2, 2, [0x23364f, 0x5a1f2c]);
  } else if (look.deskBooks === 'open') {
    // an open book, its pages ruled with lines of text
    const pc = document.createElement('canvas'); pc.width = 128; pc.height = 176;
    const pg = pc.getContext('2d'); pg.fillStyle = '#efe6cf'; pg.fillRect(0, 0, 128, 176); pg.fillStyle = 'rgba(60,40,20,0.55)';
    for (let y = 18; y < 160; y += 7) pg.fillRect(14, y, 100 - ((y * 7) % 30), 2);
    const pageTex = new THREE.CanvasTexture(pc); pageTex.colorSpace = THREE.SRGBColorSpace; track(pageTex);
    const bk = new THREE.Group(); bk.position.set(-0.5, TY, 0.1); bk.rotation.y = 0.25; desk.add(bk);
    box(bk, 0.4, 0.016, 0.25, std({ color: 0x5a1f2c, roughness: 0.6 }), 0, 0.008, 0);
    for (const sx of [-1, 1]) {
      const page = new THREE.Mesh(track(new THREE.PlaneGeometry(0.18, 0.23)), std({ map: pageTex, roughness: 0.9 }));
      page.rotation.x = -Math.PI / 2; page.rotation.z = sx * 0.05; page.position.set(sx * 0.095, 0.036 - Math.abs(sx) * 0.004, 0);
      bk.add(page);
      box(bk, 0.185, 0.02, 0.235, std({ color: 0xe8dfc6, roughness: 0.9 }), sx * 0.095, 0.024, 0);
    }
    box(bk, 0.004, 0.09, 0.01, std({ color: 0xb83a25, roughness: 0.6 }), 0.02, 0.02, 0.13);
  }
  const paper = new THREE.Mesh(track(new THREE.PlaneGeometry(0.28, 0.2)), std({ color: 0xe6dcc0, roughness: 1 }));
  paper.rotation.x = -Math.PI / 2; paper.rotation.z = 0.2; paper.position.set(0.0, TY + 0.003, 0.1);
  paper.visible = look.deskWrite === 'inkwell'; desk.add(paper);

  // writing: an inkwell and quill, or a typewriter
  if (look.deskWrite === 'inkwell') {
    const ink = new THREE.Group(); ink.position.set(0.18, TY, 0.24); desk.add(ink);
    ink.add(lathe([[0.001, 0], [0.04, 0], [0.045, 0.02], [0.04, 0.05], [0.02, 0.065], [0.02, 0.075]], std({ color: 0x9bb8c8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.55 })));
    cyl(ink, 0.018, 0.018, 0.02, M.brass, 0, 0.085, 0, 12);
    const quill = new THREE.Group(); quill.position.set(0.01, 0.09, 0); quill.rotation.set(0.3, 0, -0.5); ink.add(quill);
    cyl(quill, 0.002, 0.003, 0.3, std({ color: 0xf1ead8, roughness: 0.6 }), 0, 0.15, 0, 5);
    const feather = new THREE.Mesh(track(new THREE.PlaneGeometry(0.07, 0.2)), std({ color: 0xf6f1e4, roughness: 0.8, side: THREE.DoubleSide })); feather.position.set(0.02, 0.2, 0); quill.add(feather);
  } else if (look.deskWrite === 'typewriter') {
    const tw = new THREE.Group(); tw.position.set(0.02, TY, 0.12); tw.rotation.y = -0.06; desk.add(tw);
    const body = rbox(tw, 0.36, 0.09, 0.28, 0.02, darkMetal, 0, 0.06, 0); body.castShadow = true;
    const hood = rbox(tw, 0.34, 0.1, 0.14, 0.03, darkMetal, 0, 0.13, -0.07); hood.rotation.x = 0.1;
    const platen = cyl(tw, 0.022, 0.022, 0.4, std({ color: 0x0c0b0a, roughness: 0.7 }), 0, 0.2, -0.1, 14); platen.rotation.z = Math.PI / 2;
    for (const sx of [-1, 1]) { cyl(tw, 0.026, 0.026, 0.012, M.brass, sx * 0.205, 0.2, -0.1, 12).rotation.z = Math.PI / 2; }
    const sheet = new THREE.Mesh(track(new THREE.PlaneGeometry(0.22, 0.2)), std({ color: 0xf3ecd8, roughness: 1, side: THREE.DoubleSide })); sheet.position.set(0, 0.3, -0.1); tw.add(sheet);
    const keyGeo = track(new THREE.CylinderGeometry(0.0085, 0.0085, 0.012, 10));
    const keyMat = std({ color: 0xe8e2d2, roughness: 0.35 });
    const keys = new THREE.InstancedMesh(keyGeo, keyMat, 44); const km = new THREE.Matrix4(); let n = 0;
    for (let row = 0; row < 4; row++) for (let i = 0; i < 11; i++) { km.makeTranslation(-0.145 + i * 0.029 + row * 0.006, 0.108 + row * 0.012, 0.115 - row * 0.03); keys.setMatrixAt(n++, km); }
    tw.add(keys);
    box(tw, 0.2, 0.012, 0.03, M.brass, 0, 0.105, 0.133);
  }

  // tea for one
  if (look.deskTea === 'teapot') {
    const tea = new THREE.Group(); tea.position.set(0.4, TY, 0.28); desk.add(tea);
    tea.add(lathe([[0.001, 0], [0.05, 0.002], [0.075, 0.04], [0.078, 0.08], [0.06, 0.115], [0.035, 0.125], [0.03, 0.135]], ceramic));
    const lid = lathe([[0.001, 0.13], [0.04, 0.128], [0.03, 0.145], [0.012, 0.15], [0.01, 0.165], [0.001, 0.17]], ceramic); tea.add(lid);
    const spout = new THREE.Mesh(track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.06, 0.05, 0), V(0.1, 0.08, 0), V(0.125, 0.125, 0)]), 12, 0.012, 8)), ceramic); tea.add(spout);
    const handle = new THREE.Mesh(track(new THREE.TorusGeometry(0.045, 0.01, 8, 18, Math.PI * 1.2)), ceramic); handle.position.set(-0.07, 0.085, 0); handle.rotation.z = Math.PI * 0.4; tea.add(handle);
    const ringG = new THREE.Mesh(track(new THREE.TorusGeometry(0.056, 0.003, 6, 24)), M.brass); ringG.rotation.x = Math.PI / 2; ringG.position.y = 0.118; tea.add(ringG);
    const cupG = new THREE.Group(); cupG.position.set(0.19, 0, 0.02); tea.add(cupG);
    cupG.add(lathe([[0.001, 0], [0.06, 0], [0.065, 0.008], [0.03, 0.012]], ceramic));
    cupG.add(lathe([[0.001, 0.012], [0.03, 0.012], [0.04, 0.05], [0.042, 0.06], [0.036, 0.06], [0.001, 0.016]], ceramic));
    const handleC = new THREE.Mesh(track(new THREE.TorusGeometry(0.018, 0.005, 6, 12, Math.PI)), ceramic); handleC.position.set(0.04, 0.04, 0); handleC.rotation.z = -Math.PI / 2; cupG.add(handleC);
  }

  // a small plant in a clay pot
  if (look.deskPlant === 'succulent') {
    const pl = new THREE.Group(); pl.position.set(0.72, TY, 0.3); desk.add(pl);
    pl.add(lathe([[0.001, 0], [0.04, 0], [0.055, 0.07], [0.06, 0.08], [0.056, 0.085], [0.001, 0.085]], std({ color: 0xa65a3a, roughness: 0.9 })));
    const leaf = track(new THREE.SphereGeometry(0.03, 8, 6)); leaf.scale(0.4, 1.4, 0.2);
    const leaves = new THREE.InstancedMesh(leaf, std({ color: 0x5d8a4a, roughness: 0.5 }), 36); const lm = new THREE.Object3D();
    for (let i = 0; i < 36; i++) { const ring = i % 3; const a2 = i * 2.4; lm.position.set(Math.cos(a2) * 0.012 * (ring + 1), 0.09 + ring * 0.012, Math.sin(a2) * 0.012 * (ring + 1)); lm.rotation.set(0.5 + ring * 0.3, -a2, 0); lm.rotateX(0); lm.scale.setScalar(1 - ring * 0.18); lm.updateMatrix(); leaves.setMatrixAt(i, lm.matrix); }
    pl.add(leaves);
  }

  // a carriage clock
  if (look.deskClock === 'carriage') {
    const ck = new THREE.Group(); ck.position.set(-0.34, TY, -0.3); desk.add(ck);
    box(ck, 0.15, 0.015, 0.09, M.brass, 0, 0.0075, 0);
    box(ck, 0.15, 0.012, 0.09, M.brass, 0, 0.14, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(ck, 0.005, 0.005, 0.13, M.brass, sx * 0.068, 0.075, sz * 0.038, 6);
    const glassC = new THREE.Mesh(track(new THREE.BoxGeometry(0.13, 0.12, 0.075)), std({ color: 0xdfe9ef, roughness: 0.03, transparent: true, opacity: 0.16 })); glassC.position.y = 0.075; ck.add(glassC);
    const face = new THREE.Mesh(track(new THREE.CircleGeometry(0.047, 28)), std({ color: 0xf4efe0, roughness: 0.6 })); face.position.set(0, 0.078, 0.034); ck.add(face);
    box(ck, 0.003, 0.034, 0.002, darkMetal, 0, 0.092, 0.036); const mh = box(ck, 0.028, 0.003, 0.002, darkMetal, 0.01, 0.078, 0.036); mh.rotation.z = 0.5;
    const hnd = new THREE.Mesh(track(new THREE.TorusGeometry(0.035, 0.004, 6, 16, Math.PI)), M.brass); hnd.position.y = 0.146; ck.add(hnd);
  }

  // globe, or an armillary sphere
  const globe = new THREE.Group();
  globe.position.set(look.desk === 'executive' ? 0.75 : 0.5, TY, -0.05);
  desk.add(globe);
  const spinner = new THREE.Group();
  if (look.deskGlobe === 'terrestrial') {
    cyl(globe, 0.12, 0.14, 0.03, M.brass, 0, 0.015, 0, 24);
    cyl(globe, 0.02, 0.03, 0.2, M.brass, 0, 0.12, 0, 10);
    const tilt = new THREE.Group();
    tilt.position.y = 0.4;
    tilt.rotation.z = 0.4;
    globe.add(tilt);
    const ball = new THREE.Mesh(track(new THREE.SphereGeometry(0.2, 40, 28)), std({ map: globeTexture(), roughness: 0.45 }));
    ball.castShadow = true;
    tilt.add(ball);
    const ring = new THREE.Mesh(track(new THREE.TorusGeometry(0.225, 0.011, 8, 48)), M.brass);
    ring.rotation.y = Math.PI / 2;
    globe.add(ring); ring.position.y = 0.4;
    ring.rotation.z = 0.4 + 0;
    tilt.add(cyl(tilt, 0.007, 0.007, 0.5, M.brass, 0, 0, 0, 6));
    ball.userData.kind = 'globe';
    pick.globe = { ball, spin: 0 };
  } else if (look.deskGlobe === 'armillary') {
    cyl(globe, 0.1, 0.12, 0.025, M.brass, 0, 0.0125, 0, 24);
    cyl(globe, 0.015, 0.025, 0.12, M.brass, 0, 0.08, 0, 10);
    spinner.position.y = 0.3; spinner.rotation.z = 0.41; globe.add(spinner);
    for (const [rad, rx, ry] of [[0.2, 0, 0], [0.2, Math.PI / 2, 0], [0.2, 0, Math.PI / 2], [0.15, Math.PI / 2, 0.5], [0.24, Math.PI / 2, 0]]) { const r = new THREE.Mesh(track(new THREE.TorusGeometry(rad, 0.007, 8, 56)), M.brass); r.rotation.set(rx, ry, 0); r.userData.kind = 'globe'; spinner.add(r); }
    const core = new THREE.Mesh(track(new THREE.SphereGeometry(0.05, 20, 14)), std({ map: globeTexture(), roughness: 0.4 })); core.userData.kind = 'globe'; spinner.add(core);
    cyl(spinner, 0.004, 0.004, 0.56, M.brass, 0, 0, 0, 6).userData.kind = 'globe';
    pick.globe = { ball: spinner, spin: 0 };
  } else {
    pick.globe = { ball: new THREE.Object3D(), spin: 0 };
  }

  // banker's lamp on the desk
  function lamp(parent, x, y, z, { shade = 0x2e6b4f, brassBase = true, glowSize = 0.9 } = {}) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    cyl(g, 0.07, 0.09, 0.03, M.brass, 0, 0.015, 0, 16);
    cyl(g, 0.012, 0.016, 0.3, M.brass, 0, 0.18, 0, 8);
    const shadeMat = track(new THREE.MeshStandardMaterial({ color: shade, emissive: 0xffc070, emissiveIntensity: 0.9, roughness: 0.7, side: THREE.DoubleSide }));
    const sh = cyl(g, 0.1, 0.17, 0.16, shadeMat, 0, 0.36, 0, 20);
    sh.userData.kind = 'lamp';
    sh.userData.lampIndex = pick.lamps.length;
    const glow = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })));
    glow.scale.setScalar(glowSize);
    glow.position.y = 0.34;
    g.add(glow);
    const pl = new THREE.PointLight(0xffb866, 7, 7, 1.8);
    pl.position.set(0, 0.34, 0.02);
    g.add(pl);
    const entry = { on: true, light: pl, glow, mat: shadeMat, base: 7 };
    pick.lamps.push(entry);
    lights.lamps.push(entry);
    return g;
  }
  if (look.deskLamp === 'banker') lamp(desk, -0.72, TY, -0.28, { shade: 0x2e6b4f });
  else if (look.deskLamp === 'oil') {
    // a brass oil lamp: turned base, a glass font and chimney, a steady flame
    const g = new THREE.Group(); g.position.set(-0.72, TY, -0.28); desk.add(g);
    g.add(lathe([[0.001, 0], [0.065, 0], [0.07, 0.02], [0.03, 0.05], [0.025, 0.09], [0.04, 0.12], [0.001, 0.125]], M.brass));
    const font = new THREE.Mesh(track(new THREE.SphereGeometry(0.06, 20, 14)), std({ color: 0xdfe9ef, roughness: 0.04, transparent: true, opacity: 0.4 })); font.position.y = 0.17; g.add(font);
    cyl(g, 0.03, 0.03, 0.05, M.brass, 0, 0.23, 0, 14);
    const chimMat = track(new THREE.MeshStandardMaterial({ color: 0xf2f4f6, emissive: 0xffc070, emissiveIntensity: 0.6, roughness: 0.04, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
    const chim = lathe([[0.034, 0], [0.05, 0.05], [0.028, 0.12], [0.026, 0.22], [0.03, 0.24]], chimMat, 20); chim.position.y = 0.255; g.add(chim);
    chim.userData.kind = 'lamp'; chim.userData.lampIndex = pick.lamps.length;
    const gl = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }))); gl.scale.setScalar(0.8); gl.position.y = 0.34; g.add(gl);
    const fl = new THREE.Sprite(flameMat0); fl.scale.set(0.05, 0.1, 1); fl.position.y = 0.3; g.add(fl);
    const pl = new THREE.PointLight(0xffb866, 6, 7, 1.8); pl.position.set(0, 0.34, 0.02); g.add(pl);
    const entry = { on: true, light: pl, glow: gl, mat: chimMat, base: 6 };
    pick.lamps.push(entry); lights.lamps.push(entry);
  }

  // writing chair
  const chair = new THREE.Group();
  chair.position.set(-0.3, 0, -4.3);
  root.add(chair);
  rbox(chair, 0.55, 0.12, 0.5, 0.05, M.tuft, 0, 0.5, 0);
  rbox(chair, 0.5, 0.6, 0.1, 0.05, M.tuft, 0, 0.88, -0.22).rotation.x = -0.08;
  box(chair, 0.58, 0.07, 0.54, M.woodH, 0, 0.43, 0);
  for (const [lx, lz] of [[-0.24, 0.22], [0.24, 0.22], [-0.24, -0.22], [0.24, -0.22]]) cyl(chair, 0.022, 0.035, 0.42, M.woodV, lx, 0.21, lz, 8).castShadow = true;
  for (const sx of [-1, 1]) box(chair, 0.04, 0.7, 0.05, M.woodV, sx * 0.27, 0.78, -0.23);
  box(chair, 0.58, 0.05, 0.05, M.woodH, 0, 1.17, -0.23);

  // two leather club chairs turned toward the fire, and a side table with a second lamp
  const blobTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); const gr = g.createRadialGradient(64, 64, 6, 64, 64, 62); gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return track(new THREE.CanvasTexture(cv)); })();
  const blobMat = track(new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.8 }));
  /** A leather club chair: turned legs that run up into a real frame, a seat cushion, a reclined back with button tufting, and rolled arms with brass studs. */
  function armchair(x, z, yaw) {
    const a = new THREE.Group();
    a.position.set(x, 0, z);
    a.rotation.y = yaw;
    root.add(a);
    const shadow = new THREE.Mesh(track(new THREE.PlaneGeometry(1.5, 1.5)), blobMat);
    shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, 0.014, -0.02); a.add(shadow);
    // legs: tapered, brass-capped, and long enough to be buried in the frame so nothing floats
    for (const [lx, lz] of [[-0.36, 0.34], [0.36, 0.34], [-0.36, -0.32], [0.36, -0.32]]) {
      const leg = lathe([[0.001, 0], [0.034, 0], [0.034, 0.025], [0.026, 0.06], [0.03, 0.14], [0.042, 0.2], [0.05, 0.27], [0.001, 0.27]], M.woodH, 14);
      leg.position.set(lx, 0, lz); a.add(leg);
      cyl(a, 0.036, 0.04, 0.02, M.brass, lx, 0.01, lz, 12);
    }
    // frame, seat, back
    const frame = rbox(a, 0.92, 0.2, 0.88, 0.045, M.red, 0, 0.3, 0.0); frame.castShadow = true;
    const seat = rbox(a, 0.66, 0.17, 0.62, 0.075, M.red, 0, 0.485, 0.1); seat.castShadow = true;
    const back = rbox(a, 0.9, 0.86, 0.25, 0.1, M.red, 0, 0.83, -0.34); back.rotation.x = -0.2; back.castShadow = true;
    // arms: a panel from the frame up to a rolled top with a scrolled front
    for (const sx of [-1, 1]) {
      rbox(a, 0.17, 0.5, 0.82, 0.055, M.red, sx * 0.46, 0.5, 0.02).castShadow = true;
      const roll = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.1, 0.66, 8, 16)), M.red);
      roll.rotation.x = Math.PI / 2; roll.position.set(sx * 0.46, 0.78, 0.03); roll.castShadow = true; a.add(roll);
      for (let i = 0; i < 9; i++) { const st = new THREE.Mesh(track(new THREE.SphereGeometry(0.0125, 8, 6)), M.brass); st.position.set(sx * 0.46 + sx * 0.0, 0.3 + i * 0.045, 0.435); st.scale.z = 0.5; a.add(st); }
      for (let i = 0; i < 8; i++) { const st = new THREE.Mesh(track(new THREE.SphereGeometry(0.0125, 8, 6)), M.brass); st.position.set(sx * 0.31 + sx * 0.0, 0.215, 0.43 - i * 0.0); st.position.x = sx * (0.1 + i * 0.03); st.position.z = 0.445; st.position.y = 0.4; a.add(st); }
    }
    // button tufting down the back
    const btn = track(new THREE.SphereGeometry(0.02, 8, 6));
    for (const by of [0.66, 0.86, 1.06]) for (const bx of [-0.27, 0, 0.27]) {
      const bt = new THREE.Mesh(btn, M.brass); bt.position.set(bx, by + (bx === 0 ? 0 : 0.09), -0.205 + (by - 0.83) * -0.2 - 0.0); bt.scale.set(1, 1, 0.55); a.add(bt);
    }
    return a;
  }
  armchair(1.9, 2.9, -0.63);
  armchair(-1.9, 2.9, 0.63);
  const side = new THREE.Group();
  side.position.set(4.7, 0, -2.5);
  root.add(side);
  cyl(side, 0.34, 0.34, 0.05, M.woodH, 0, 0.62, 0, 28).castShadow = true;
  cyl(side, 0.035, 0.05, 0.6, M.woodV, 0, 0.3, 0, 10);
  cyl(side, 0.22, 0.24, 0.04, M.woodH, 0, 0.03, 0, 20);
  lamp(side, 0.0, 0.645, 0.0, { shade: 0xe8d9b4, glowSize: 1.3 });
  const stack2 = new THREE.Group(); side.add(stack2); stack2.position.set(0.15, 0.645, 0.12);
  for (let i = 0; i < 3; i++) { const b = box(stack2, 0.2, 0.04, 0.15, std({ color: [0x5a1f2c, 0x40472a, 0x7a3a22][i], roughness: 0.6 }), 0, 0.02 + i * 0.04, 0); b.rotation.y = i * 0.3; }

  // the rolling ladder, leaning from the floor to the gallery rail
  const ladder = new THREE.Group();
  ladder.position.set(-3.1, 0, -4.4);
  ladder.rotation.z = 0.187;
  root.add(ladder);
  const LL = 5.7;
  for (const s of [-1, 1]) { const rail = box(ladder, 0.06, LL, 0.045, M.woodV, 0, LL / 2, s * 0.25); rail.castShadow = true; rail.userData.kind = 'ladder'; pick.ladder.push(rail); }
  for (let y = 0.35; y < LL - 0.2; y += 0.34) { const r = cyl(ladder, 0.02, 0.02, 0.52, M.woodH, 0, y, 0, 8); r.rotation.x = Math.PI / 2; r.userData.kind = 'ladder'; pick.ladder.push(r); }
  const hook = box(ladder, 0.05, 0.05, 0.62, M.brass, -0.05, LL - 0.02, 0);
  hook.userData.kind = 'ladder';
  pick.ladder.push(hook);

  // ───────── chandelier (four styles, in the finish you chose) ─────────
  const chand = new THREE.Group();
  chand.position.set(0, 6.0, -2.6);
  root.add(chand);
  for (let y = 0.2; y < ROOM.h - 6.0; y += 0.14) { const l = new THREE.Mesh(track(new THREE.TorusGeometry(0.03, 0.007, 5, 10)), M.metal); l.position.y = y; l.rotation.y = (y * 20) % 3; chand.add(l); }
  const candleMat = std({ color: 0xf3e8d0, roughness: 0.8 });
  const flameMat = track(new THREE.SpriteMaterial({ map: flameTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  const chandLights = []; // everything that goes dark when the chandelier is switched off
  const chandGlow = [];   // emissive materials that dim with it
  const emissive = (color, intensity = 1) => { const m = track(new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: color, emissiveIntensity: intensity, roughness: 0.35 })); chandGlow.push([m, intensity]); return m; };
  const haloMat = track(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
  const flameAt = (x, y, z, scale = 0.34) => {
    const f = new THREE.Sprite(flameMat);
    f.scale.set(scale * 0.5, scale, 1); f.position.set(x, y, z); chand.add(f);
    const halo = new THREE.Sprite(haloMat); halo.scale.setScalar(scale * 2.4); halo.position.set(x, y - 0.02, z); chand.add(halo);
    flames.push({ s: f, ph: x * 7 + z * 3, base: scale * 0.5 }); chandLights.push(f, halo);
  };
  const candleAt = (x, y, z) => { cyl(chand, 0.045, 0.03, 0.04, M.metal, x, y, z, 10); cyl(chand, 0.022, 0.022, 0.2, candleMat, x, y + 0.12, z, 8); flameAt(x, y + 0.29, z); };
  const arm = (a, r, rise, y0 = 0) => {
    const curve = new THREE.CatmullRomCurve3([V(0, y0, 0), V(Math.cos(a) * r * 0.38, y0 - 0.18, Math.sin(a) * r * 0.38), V(Math.cos(a) * r * 0.84, y0 - 0.1, Math.sin(a) * r * 0.84), V(Math.cos(a) * r, y0 + rise, Math.sin(a) * r)]);
    chand.add(new THREE.Mesh(track(new THREE.TubeGeometry(curve, 24, 0.014, 6)), M.metal));
  };
  if (look.chandelier === 'crystal') {
    cyl(chand, 0.05, 0.05, 0.9, M.metal, 0, -0.2, 0, 10);
    const glass = track(new THREE.MeshStandardMaterial({ color: 0xdfeeff, roughness: 0.05, metalness: 0.15, emissive: 0x6a5a40, emissiveIntensity: 0.35, envMapIntensity: 2.2 }));
    chandGlow.push([glass, 0.35]);
    const prism = track(new THREE.ConeGeometry(0.022, 0.2, 5));
    const tiers = [[0.38, 0.1, 14], [0.66, -0.12, 20], [0.95, -0.34, 26]];
    const total = tiers.reduce((n, t) => n + t[2], 0);
    const inst = new THREE.InstancedMesh(prism, glass, total);
    const m4 = new THREE.Matrix4(); let n = 0;
    for (const [r, y, count] of tiers) {
      const ring = new THREE.Mesh(track(new THREE.TorusGeometry(r, 0.016, 6, 40)), M.metal); ring.rotation.x = Math.PI / 2; ring.position.y = y; chand.add(ring);
      for (let i = 0; i < 6; i++) { const aa = (i / 6) * Math.PI * 2; const sp = new THREE.Mesh(track(new THREE.CylinderGeometry(0.008, 0.008, r, 4)), M.metal); sp.position.set(Math.cos(aa) * r / 2, y, Math.sin(aa) * r / 2); sp.rotation.set(0, -aa, Math.PI / 2); chand.add(sp); }
      for (let i = 0; i < count; i++) { const aa = (i / count) * Math.PI * 2; m4.makeRotationX(Math.PI); m4.setPosition(Math.cos(aa) * r, y - 0.11, Math.sin(aa) * r); inst.setMatrixAt(n++, m4); }
    }
    chand.add(inst);
    for (let i = 0; i < 8; i++) { const aa = (i / 8) * Math.PI * 2; candleAt(Math.cos(aa) * 0.38, 0.1, Math.sin(aa) * 0.38); }
    const drop = new THREE.Mesh(track(new THREE.OctahedronGeometry(0.1)), glass); drop.scale.y = 2.2; drop.position.y = -0.75; chand.add(drop);
  } else if (look.chandelier === 'globes') {
    cyl(chand, 0.16, 0.16, 0.05, M.metal, 0, 0.0, 0, 20);
    const bulb = emissive(0xffc870, 1.1);
    for (let i = 0; i < 6; i++) {
      const aa = (i / 6) * Math.PI * 2; const r = 0.55; const drop = 0.35 + (i % 2) * 0.28;
      const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(Math.cos(aa) * r * 0.5, 0.04, Math.sin(aa) * r * 0.5), V(Math.cos(aa) * r, -0.02, Math.sin(aa) * r)]);
      chand.add(new THREE.Mesh(track(new THREE.TubeGeometry(curve, 12, 0.01, 5)), M.metal));
      cyl(chand, 0.005, 0.005, drop, M.metal, Math.cos(aa) * r, -drop / 2, Math.sin(aa) * r, 4);
      const g = new THREE.Mesh(track(new THREE.SphereGeometry(0.15, 20, 14)), bulb); g.position.set(Math.cos(aa) * r, -drop - 0.12, Math.sin(aa) * r); chand.add(g);
      const gl = new THREE.Sprite(flameMat); gl.scale.setScalar(0.8); gl.position.copy(g.position); chand.add(gl); chandLights.push(gl);
    }
    const centre = new THREE.Mesh(track(new THREE.SphereGeometry(0.22, 24, 16)), bulb); centre.position.y = -0.3; chand.add(centre);
    cyl(chand, 0.02, 0.02, 0.3, M.metal, 0, -0.15, 0, 6);
  } else if (look.chandelier === 'iron') {
    cyl(chand, 0.08, 0.08, 0.12, M.metal, 0, 0.0, 0, 12);
    const hoop = new THREE.Mesh(track(new THREE.TorusGeometry(0.85, 0.032, 8, 48)), M.metal); hoop.rotation.x = Math.PI / 2; hoop.position.y = -0.35; chand.add(hoop);
    const hoop2 = new THREE.Mesh(track(new THREE.TorusGeometry(0.5, 0.022, 8, 40)), M.metal); hoop2.rotation.x = Math.PI / 2; hoop2.position.y = -0.2; chand.add(hoop2);
    for (let i = 0; i < 4; i++) { const aa = (i / 4) * Math.PI * 2 + 0.4; const c2 = new THREE.CatmullRomCurve3([V(0, 0, 0), V(Math.cos(aa) * 0.85, -0.35, Math.sin(aa) * 0.85)]); chand.add(new THREE.Mesh(track(new THREE.TubeGeometry(c2, 2, 0.01, 4)), M.metal)); }
    for (let i = 0; i < 8; i++) { const aa = (i / 8) * Math.PI * 2; candleAt(Math.cos(aa) * 0.85, -0.33, Math.sin(aa) * 0.85); }
    for (let i = 0; i < 4; i++) { const aa = (i / 4) * Math.PI * 2 + 0.78; candleAt(Math.cos(aa) * 0.5, -0.18, Math.sin(aa) * 0.5); }
    const fin = new THREE.Mesh(track(new THREE.ConeGeometry(0.06, 0.3, 8)), M.metal); fin.rotation.x = Math.PI; fin.position.y = -0.55; chand.add(fin);
  } else {
    // a classic two-tier brass chandelier: a turned stem, scrolled arms, dished candle cups, wax candles with drips,
    // swags of beads and hanging crystal drops
    const stem = [[0.001, 0.34], [0.05, 0.3], [0.09, 0.26], [0.05, 0.2], [0.075, 0.14], [0.04, 0.08], [0.11, 0.0], [0.06, -0.08], [0.13, -0.16], [0.05, -0.24], [0.17, -0.34], [0.21, -0.43], [0.15, -0.52], [0.06, -0.6], [0.035, -0.7], [0.001, -0.74]].map(([r, y]) => new THREE.Vector2(r, y));
    chand.add(new THREE.Mesh(track(new THREE.LatheGeometry(stem, 28)), M.metal));
    const finial = new THREE.Mesh(track(new THREE.SphereGeometry(0.05, 16, 12)), M.metal); finial.position.y = -0.76; chand.add(finial);
    const glow = emissive(0xffc870, 0.55);
    const orb = new THREE.Mesh(track(new THREE.SphereGeometry(0.15, 20, 14)), glow); orb.position.y = -0.34; chand.add(orb);
    const cup = track(new THREE.LatheGeometry([[0.001, 0], [0.05, 0], [0.058, 0.012], [0.042, 0.03], [0.03, 0.04], [0.026, 0.07], [0.001, 0.07]].map(([r, y]) => new THREE.Vector2(r, y)), 14));
    const wax = std({ color: 0xf4ead2, roughness: 0.55 });
    const prism = track(new THREE.OctahedronGeometry(0.02));
    const beadGeo = track(new THREE.SphereGeometry(0.011, 8, 6));
    const crystal = track(new THREE.MeshStandardMaterial({ color: 0xe8f2ff, roughness: 0.04, metalness: 0.2, emissive: 0x6a5a40, emissiveIntensity: 0.4, envMapIntensity: 2.4 }));
    chandGlow.push([crystal, 0.4]);
    const drops = []; const beads = [];
    const tiers = [{ n: 6, r: 0.92, y: -0.22, a0: 0, rise: 0.24 }, { n: 6, r: 0.58, y: -0.5, a0: Math.PI / 6, rise: 0.18 }];
    for (const tier of tiers) {
      const tips = [];
      for (let i = 0; i < tier.n; i++) {
        const a2 = tier.a0 + (i / tier.n) * Math.PI * 2;
        const dx = Math.cos(a2); const dz = Math.sin(a2);
        // an S-shaped arm that curls out and up, with a small scroll half way along
        const pts = [V(dx * 0.12, tier.y + 0.02, dz * 0.12), V(dx * tier.r * 0.35, tier.y - 0.12, dz * tier.r * 0.35), V(dx * tier.r * 0.62, tier.y - 0.1, dz * tier.r * 0.62), V(dx * tier.r * 0.82, tier.y + tier.rise * 0.2, dz * tier.r * 0.82), V(dx * tier.r, tier.y + tier.rise, dz * tier.r)];
        const curve = new THREE.CatmullRomCurve3(pts);
        chand.add(new THREE.Mesh(track(new THREE.TubeGeometry(curve, 36, 0.016, 8)), M.metal));
        const scroll = new THREE.Mesh(track(new THREE.TorusGeometry(0.055, 0.008, 6, 18, Math.PI * 1.5)), M.metal);
        scroll.position.set(dx * tier.r * 0.5, tier.y - 0.2, dz * tier.r * 0.5); scroll.rotation.set(0, -a2, 0.3); chand.add(scroll);
        const tx = dx * tier.r; const tz = dz * tier.r; const ty = tier.y + tier.rise;
        tips.push([tx, ty, tz]);
        const cupM = new THREE.Mesh(cup, M.metal); cupM.position.set(tx, ty, tz); chand.add(cupM);
        cyl(chand, 0.021, 0.021, 0.17, wax, tx, ty + 0.15, tz, 12);
        cyl(chand, 0.024, 0.021, 0.012, wax, tx, ty + 0.235, tz, 12);
        const drip = cyl(chand, 0.006, 0.004, 0.05, wax, tx + 0.02, ty + 0.2, tz, 5); drip.rotation.z = 0.1;
        flameAt(tx, ty + 0.31, tz, 0.3);
        for (let k = 0; k < 6; k++) drops.push([tx + (k - 2.5) * 0.015, ty - 0.05 - (k % 2) * 0.03, tz + (k % 3 - 1) * 0.015]);
      }
      // swags of beads between neighbouring arms
      for (let i = 0; i < tips.length; i++) {
        const A = tips[i]; const B = tips[(i + 1) % tips.length];
        for (let k = 1; k < 12; k++) {
          const t = k / 12; const sag = Math.sin(t * Math.PI) * 0.1;
          beads.push([A[0] + (B[0] - A[0]) * t, A[1] - 0.04 + (B[1] - A[1]) * t - sag, A[2] + (B[2] - A[2]) * t]);
        }
        const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - 0.2, (A[2] + B[2]) / 2];
        for (let k = 0; k < 4; k++) drops.push([mid[0], mid[1] - k * 0.05, mid[2]]);
      }
    }
    const dropMesh = new THREE.InstancedMesh(prism, crystal, drops.length);
    const beadMesh = new THREE.InstancedMesh(beadGeo, M.metal, beads.length);
    const m4 = new THREE.Matrix4(); const sc = new THREE.Matrix4().makeScale(1, 2.4, 1);
    drops.forEach((d, i) => { m4.makeTranslation(d[0], d[1], d[2]).multiply(sc); dropMesh.setMatrixAt(i, m4); });
    beads.forEach((d, i) => { m4.makeTranslation(d[0], d[1], d[2]); beadMesh.setMatrixAt(i, m4); });
    chand.add(dropMesh, beadMesh);
    const big = new THREE.Mesh(track(new THREE.OctahedronGeometry(0.07)), crystal); big.scale.y = 2.6; big.position.y = -0.92; chand.add(big);
  }
  const chandLight = new THREE.PointLight(0xffc27a, 16, 18, 1.4);
  chandLight.position.set(0, -0.1, 0);
  chand.add(chandLight);
  lights.chandelier = [chandLight];
  chand.traverse((o) => { if (o.isMesh) o.userData.kind = 'chandelier'; });
  pick.chandelier = [chand];
  anim.push((t) => { chand.rotation.z = Math.sin(t * 0.35) * 0.012; chand.rotation.x = Math.cos(t * 0.28) * 0.01; });

  // a soft pool of light on the desk, with shadows (the only shadow caster, to keep the room light to draw)
  const spot = new THREE.SpotLight(0xffcf8f, 22, 14, 0.55, 0.7, 1.4);
  spot.position.set(0, 5.9, -2.6);
  spot.target.position.set(-0.2, 0.5, -3.3);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0004;
  root.add(spot, spot.target);
  lights.chandelier.push(spot);

  // ambience: hemisphere fill, a window sun, light shafts and dust
  const hemi = new THREE.HemisphereLight(T.hemi[0], T.hemi[1], 0.5);
  root.add(hemi);
  lights.hemi = hemi;
  const sun = new THREE.DirectionalLight(T.sun, 1.0);
  sun.position.copy(outside.sunDir).multiplyScalar(14);
  sun.target.position.set(0, 0, -1);
  root.add(sun, sun.target);
  lights.sun = sun;

  const shafts = new THREE.Group();
  shafts.visible = look.shafts !== 'off';
  root.add(shafts);
  const shaftMat = track(new THREE.MeshBasicMaterial({ map: shaftTexture(), color: T.shaft, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  const dirs = [[-1.4, -0.9], [-0.7, -0.3], [0, 0.1], [0.7, 0.5], [1.4, 0.9]];
  dirs.forEach(([wx, dx], i) => {
    const from = V(wx * 0.85, 7.6 - (i % 2) * 0.8, ROOM.z0 + 0.3);
    const to = V(wx * 1.8 + dx * 2, 0.1, ROOM.z0 + 7.6 - (i % 3) * 0.7);
    const dir = to.clone().sub(from);
    const len = dir.length();
    for (const rot of [0, Math.PI / 2]) {
      const m = new THREE.Mesh(track(new THREE.PlaneGeometry(1.1 + (i % 2) * 0.5, len)), shaftMat);
      m.position.copy(from).addScaledVector(dir, 0.5);
      m.quaternion.setFromUnitVectors(V(0, 1, 0).multiplyScalar(-1), dir.clone().normalize());
      m.rotateY(rot);
      shafts.add(m);
    }
  });
  const extraShaft = (from, to, w) => {
    const dir = to.clone().sub(from); const len = dir.length();
    for (const rot of [0, Math.PI / 2]) {
      const m = new THREE.Mesh(track(new THREE.PlaneGeometry(w, len)), shaftMat);
      m.position.copy(from).addScaledVector(dir, 0.5);
      m.quaternion.setFromUnitVectors(V(0, 1, 0).multiplyScalar(-1), dir.clone().normalize());
      m.rotateY(rot);
      shafts.add(m);
    }
  };
  // through the glass over the doors, and across the room from the side windows
  extraShaft(V(0, 3.3, ROOM.z0 + 0.3), V(0.6, 0.1, ROOM.z0 + 5.2), 1.3);
  extraShaft(V(-0.4, 3.0, ROOM.z0 + 0.3), V(-1.2, 0.1, ROOM.z0 + 4.2), 0.8);
  for (const sx of [-1, 1]) {
    extraShaft(V(sx * 5.8, 2.4, 0.85), V(sx * 1.6, 0.1, 2.9), 1.0);
    extraShaft(V(sx * 5.8, 6.8, 0.85), V(sx * 0.9, 0.1, 3.4), 1.2);
  }
  const dustN = 420;
  const dustPos = new Float32Array(dustN * 3);
  const dr = rng(5);
  for (let i = 0; i < dustN; i++) { dustPos[i * 3] = (dr() - 0.5) * 9; dustPos[i * 3 + 1] = dr() * 8; dustPos[i * 3 + 2] = ROOM.z0 + 1 + dr() * 11; }
  const dustGeo = track(new THREE.BufferGeometry());
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, track(new THREE.PointsMaterial({ map: glowTexture(), size: 0.07, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true })));
  dust.visible = look.shafts !== 'off';
  root.add(dust);
  anim.push((t, dt) => {
    for (let i = 0; i < dustN; i++) {
      dustPos[i * 3 + 1] += (0.015 + (i % 5) * 0.004) * dt * 4;
      dustPos[i * 3] += Math.sin(t * 0.2 + i) * 0.002;
      if (dustPos[i * 3 + 1] > 8) dustPos[i * 3 + 1] = 0.2;
    }
    dustGeo.attributes.position.needsUpdate = true;
  });

  // ───────── state and update ─────────
  const state = { level: look.light, chandelier: true, fire: look.fire };
  const LEVELS = { low: { hemi: 0.28, sun: 0.55, exp: 0.95, shaft: 0.1 }, medium: { hemi: 0.55, sun: 1.0, exp: 1.05, shaft: 0.15 }, bright: { hemi: 0.95, sun: 1.6, exp: 1.2, shaft: 0.22 } };
  const night = look.time === 'night';
  const applyLevel = () => {
    const L = LEVELS[state.level] || LEVELS.low;
    hemi.intensity = L.hemi * T.hemiK;
    sun.intensity = L.sun * T.sunK;
    shaftMat.opacity = L.shaft * T.shaftK;
    const on = state.chandelier;
    chandLight.intensity = on ? (night ? 22 : 16) : 0;
    spot.intensity = on ? (night ? 30 : 22) : 0;
    chandLights.forEach((f) => (f.visible = on));
    chandGlow.forEach(([m, k]) => { m.emissiveIntensity = on ? k : 0; });
    // the fire
    const f = state.fire;
    fireLight.intensity = f === 'lit' ? 14 : f === 'embers' ? 3.2 : 0;
    hearthLight.intensity = f === 'lit' ? 4 : f === 'embers' ? 1 : 0;
    emberGlow.material.opacity = f === 'lit' ? 0.9 : f === 'embers' ? 0.55 : 0.05;
    logMat.emissiveIntensity = f === 'lit' ? 1.2 : f === 'embers' ? 0.7 : 0.05;
    tongues.forEach((t) => (t.s.visible = f === 'lit'));
    mantelFlames.forEach((m) => (m.visible = on));
    return L;
  };
  applyLevel();

  // ───────── photographic upgrade: real wood grain, leather, floor, plaster and a real sky arrive after the first frame ─────────
  let alive = true;
  const shade = (hex, k) => `#${[1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0')).join('')}`;
  const upgrade = async () => {
    const [wc, wn, wr] = await Promise.all([colorized('wood.webp', light, dark, { gamma: 0.85 }), loadTex('wood-n.webp'), loadTex('wood-r.webp')]);
    if (!alive) return;
    const wcv = rotated(wc); const wnv = rotated(wn); const wrv = rotated(wr);
    const set = (mat, m, n, r, rough = 1) => { mat.map = m; mat.normalMap = n; mat.roughnessMap = r; mat.bumpMap = null; mat.normalScale.set(0.9, 0.9); mat.roughness = rough; mat.needsUpdate = true; };
    set(M.woodH, wc, wn, wr, 0.95); set(M.woodV, wcv, wnv, wrv, 0.95); set(M.woodDark, wc, wn, wr, 1); set(M.ceiling, wc, wn, wr, 1); set(colMat, wcv, wnv, wrv, 0.9);
  };
  const upgradeFloor = async () => {
    const [name, size] = look.floor === 'planks' ? ['planks', 3.2] : look.floor === 'checker' ? ['marble', 3.4] : ['parquet', 2.4];
    const [m, n, r] = await Promise.all([loadTex(`${name}.webp`, { srgb: true }), loadTex(`${name}-n.webp`), loadTex(`${name}-r.webp`)]);
    if (!alive) return;
    const fix = (t) => { const c = t.clone(); c.repeat.set(W / size, D / size); c.needsUpdate = true; return c; };
    const fm = floor.material;
    fm.map = fix(m); fm.normalMap = fix(n); fm.roughnessMap = fix(r); fm.bumpMap = null; fm.roughness = look.floor === 'checker' ? 0.7 : 0.95; fm.normalScale.set(0.7, 0.7);
    fm.color.setHex(look.floor === 'checker' ? 0xe8e2d8 : 0xb8a692);
    fm.needsUpdate = true;
  };
  const upgradeLeather = async () => {
    const [n, r] = await Promise.all([loadTex('leather-n.webp'), loadTex('leather-r.webp')]);
    for (const [mat, hex] of [[M.red, SWATCH.chair[look.chair] || '#6b1d15'], [M.green, SWATCH.deskTop[look.deskTop] || '#2d4634']]) {
      const c = await colorized('leather.webp', shade(hex, 1.5), shade(hex, 0.38), { gamma: 1 });
      if (!alive) return;
      mat.map = c.clone(); mat.map.repeat.set(2, 2); mat.normalMap = n.clone(); mat.normalMap.repeat.set(2, 2); mat.roughnessMap = r.clone(); mat.roughnessMap.repeat.set(2, 2);
      mat.bumpMap = null; mat.roughness = 0.9; mat.normalScale.set(1.1, 1.1); mat.needsUpdate = true;
    }
  };
  const upgradeWalls = async () => {
    const n = await loadTex('plaster-n.webp');
    if (!alive) return;
    for (const m of wallMats) { const c = n.clone(); c.repeat.set(m.userData.rep[0] * 1.5, m.userData.rep[1] * 1.5); c.needsUpdate = true; m.normalMap = c; m.normalScale.set(0.55, 0.55); m.needsUpdate = true; }
  };
  const upgradeMisc = async () => {
    const [wool, woolN] = await Promise.all([loadTex('wool.webp'), loadTex('wool-n.webp')]);
    if (!alive) return;
    const a = wool.clone(); a.repeat.set(9, 14); a.needsUpdate = true; const b = woolN.clone(); b.repeat.set(9, 14); b.needsUpdate = true;
    rugMat.bumpMap = a; rugMat.bumpScale = 0.8; rugMat.normalMap = b; rugMat.normalScale.set(0.6, 0.6); rugMat.needsUpdate = true;
    if (look.fireplace === 'stone') {
      const [sm, sn] = await Promise.all([loadTex('stone.webp', { srgb: true }), loadTex('stone-n.webp')]);
      if (!alive) return;
      const a2 = sm.clone(); a2.repeat.set(1.6, 1.6); a2.needsUpdate = true; const b2 = sn.clone(); b2.repeat.set(1.6, 1.6); b2.needsUpdate = true;
      surfMat.map = a2; surfMat.normalMap = b2; surfMat.bumpMap = null; surfMat.needsUpdate = true;
    }
  };
  for (const job of [upgrade, upgradeFloor, upgradeLeather, upgradeWalls, upgradeMisc]) job().catch(() => { /* offline: the painted versions stay */ });

  const t0 = performance.now();
  return {
    root,
    runs,
    pick,
    lights,
    state,
    exposure: () => (LEVELS[state.level] || LEVELS.low).exp * T.exp,
    background: T.bg,
    outside,
    toggleFire() { state.fire = state.fire === 'lit' ? 'embers' : state.fire === 'embers' ? 'off' : 'lit'; applyLevel(); },
    setLevel(level) { state.level = level; applyLevel(); },
    toggleChandelier() { state.chandelier = !state.chandelier; applyLevel(); },
    toggleLamp(i) {
      const l = pick.lamps[i];
      if (!l) return;
      l.on = !l.on;
      l.light.intensity = l.on ? l.base : 0;
      l.glow.visible = l.on;
      l.mat.emissiveIntensity = l.on ? 0.9 : 0;
    },
    spinGlobe(speed = 7) { pick.globe.spin = Math.min(14, pick.globe.spin + speed); },
    update(dt) {
      const t = (performance.now() - t0) / 1000;
      anim.forEach((fn) => fn(t, dt));
      flames.forEach((f) => { const k = (f.base || 0.34) * (0.9 + Math.sin(t * 9 + f.ph) * 0.09 + Math.sin(t * 23 + f.ph * 2) * 0.06); f.s.scale.set(k, k * 2.1, 1); });
      if (state.fire !== 'off') {
        const lit = state.fire === 'lit';
        if (lit) {
          tongues.forEach((tg) => {
            const k = tg.h * (0.82 + Math.sin(t * 8 + tg.ph) * 0.14 + Math.sin(t * 19 + tg.ph * 1.7) * 0.08);
            tg.s.scale.set(0.34 * (0.9 + Math.sin(t * 6 + tg.ph) * 0.1), k, 1);
            tg.s.position.set(tg.x + Math.sin(t * 4 + tg.ph) * 0.03, 0.14 + k * 0.5, 0);
          });
        }
        fireLight.intensity = (lit ? 14 : 3.2) * (0.86 + Math.sin(t * 11) * 0.08 + Math.sin(t * 27) * 0.06);
        emberGlow.scale.set(1.4 + Math.sin(t * 3) * 0.1, 0.7 + Math.sin(t * 5) * 0.05, 1);
      }
      mantelFlames.forEach((m, i) => { const k = 1 + Math.sin(t * 10 + i * 2) * 0.1; m.scale.set(0.07 * k, 0.14 * k, 1); });
      const g = pick.globe;
      g.ball.rotation.y += g.spin * dt;
      g.spin *= Math.pow(0.35, dt);
      if (g.spin < 0.02) g.spin = 0.02;
    },
    dispose() {
      alive = false;
      outside.dispose();
      disposables.forEach((d) => d.dispose?.());
      root.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose?.(); });
    },
  };
}
