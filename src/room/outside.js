// The world outside the windows: a generated landscape, not a picture. A palace-castle of cream stone and blue-green roofs
// stands on a terraced crag above a lake, with a waterfall, a forested valley, a village among fields, mountains in layers of
// haze, and a sky with sun, clouds, moon and stars. It is one fixed place; the time of day only changes its light.
// Birds cross it now and then and, rarely, a dragon flies by as a silhouette. It is drawn in its own pass behind the room.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from './textures';
import { loadTex } from './real.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

const hash2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function noise(x, y) {
  const xi = Math.floor(x); const yi = Math.floor(y); const xf = x - xi; const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf); const v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
}
const fbm = (x, y, o = 5) => { let a = 0.5; let s = 0; let f = 1; for (let i = 0; i < o; i++) { s += a * noise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; };
const ridge = (x, y) => { const n = 1 - Math.abs(fbm(x, y, 4) * 2 - 1); return n * n; };

export const CASTLE = [14, -300];
const VIA = [CASTLE[0] + 213, CASTLE[1] - 13]; // the rock where the long viaduct ends
const LAKE = [40, -200];
const VILLAGE = [-120, -130];
export const WATER_Y = -38;

/** Ground height at a point. Near the room it is a flat terrace, falling away into a valley. */
export function terrainY(x, z) {
  const dRoom = Math.max(Math.abs(x) - 16, Math.abs(z + 1) - 18, 0);
  const p = smooth(8, 95, dRoom);
  let h = -1.4 - 33 * p;
  h += (fbm(x * 0.006 + 3, z * 0.006) - 0.5) * 2 * (2 + 10 * p) * p;
  h += (fbm(x * 0.03 + 11, z * 0.03) - 0.5) * 2.2 * p;
  const dc = Math.hypot(x - CASTLE[0], z - CASTLE[1]);
  const flank = smooth(80, 130, dc);
  h += 114 * Math.exp(-Math.pow(dc / 112, 8)) * (1 + 0.2 * (ridge(x * 0.03 + 4, z * 0.03 + 2) - 0.4) * flank + 0.05 * Math.sin(dc * 0.35) * flank);
  h += 114 * Math.exp(-Math.pow(Math.hypot(x - VIA[0], z - VIA[1]) / 46, 8)) * (1 + 0.15 * (ridge(x * 0.04 + 8, z * 0.04) - 0.4));
  h += 12 * Math.exp(-Math.pow(dc / 120, 2)) * fbm(x * 0.05, z * 0.05, 3);
  const dl = Math.hypot(x - LAKE[0], z - LAKE[1]);
  h -= 17 * Math.exp(-Math.pow(dl / 78, 2));
  const dv = Math.hypot(x - VILLAGE[0], z - VILLAGE[1]);
  h = lerp(h, -31, smooth(95, 50, dv));
  const dm = Math.hypot(x, z);
  h += smooth(430, 760, dm) * (60 + 200 * ridge(x * 0.0035 + 9, z * 0.0035));
  return h;
}

// A full lighting and colour state per time of day. The place is the same; only this changes.
const TIMES = {
  golden: { zenith: '#3d5b92', horizon: '#ffc48e', haze: '#f0bb98', hemiSky: '#ffd9ae', hemiGround: '#6b5240', hemiK: 1.35, sun: '#ffb870', sunK: 3.9, sunDir: [0.85, 0.13, -0.15], windows: 0.55, stars: 0, cloudLit: '#ffe0b8', cloudShade: '#b07890', moon: false, fog: [120, 1500], tint: 1.05, glow: 0.8 },
  day: { zenith: '#2468c4', horizon: '#c8e2f8', haze: '#bcd8ee', hemiSky: '#d6e8ff', hemiGround: '#6e7a52', hemiK: 1.7, sun: '#fff1d6', sunK: 4.0, sunDir: [-0.5, 0.62, 0.3], windows: 0, stars: 0, cloudLit: '#ffffff', cloudShade: '#b4c4d8', moon: false, fog: [160, 1700], tint: 1.08, glow: 0 },
  night: { zenith: '#02040f', horizon: '#1a2c52', haze: '#12203e', hemiSky: '#4d64a0', hemiGround: '#18202e', hemiK: 1.15, sun: '#a8c0ff', sunK: 1.25, sunDir: [0.4, 0.42, -0.5], windows: 1.8, stars: 1, cloudLit: '#7486b4', cloudShade: '#222c4a', moon: true, fog: [110, 1400], tint: 0.9, glow: 1 },
};

const SKY_VERT = 'varying vec3 vDir; void main(){ vDir = position; vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.99999; }';
const SKY_FRAG = `
  varying vec3 vDir;
  uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uHaze; uniform vec3 uSunDir; uniform vec3 uSunColor;
  uniform vec3 uCloudLit; uniform vec3 uCloudShade; uniform float uStars; uniform float uMoon; uniform float uTime;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
  float fbm(vec2 p){ float a = 0.5; float s = 0.0; for (int i = 0; i < 6; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
  void main(){
    vec3 d = normalize(vDir);
    float t = pow(clamp(d.y + 0.03, 0.0, 1.0), 0.45);
    vec3 col = mix(uHorizon, uZenith, t);
    col = mix(col, uHaze, smoothstep(0.0, -0.1, d.y));
    vec3 sd3 = normalize(uSunDir);
    float sd = max(dot(d, sd3), 0.0);
    if (uMoon < 0.5) {
      col += uSunColor * (pow(sd, 1100.0) * 10.0 + pow(sd, 30.0) * 0.55 + pow(sd, 5.0) * 0.2);
      col = mix(col, uSunColor * 0.9, pow(sd, 3.0) * 0.12 * (1.0 - clamp(d.y * 3.0, 0.0, 1.0)));
    }
    if (uStars > 0.0 && d.y > 0.0) {
      vec2 sp = d.xz / (d.y + 0.25) * 150.0; vec2 g = floor(sp); float r = hash(g);
      vec2 f = fract(sp) - 0.5 - (vec2(hash(g + 1.0), hash(g + 2.0)) - 0.5) * 0.6;
      float star = step(0.975, r) * smoothstep(0.16, 0.0, length(f)) * (0.5 + 0.8 * hash(g + 7.0)) * smoothstep(0.0, 0.3, d.y);
      float tw = 0.7 + 0.3 * sin(uTime * 2.0 + r * 40.0);
      col += vec3(star * tw) * uStars;
      float band = smoothstep(0.35, 0.0, abs(dot(d, normalize(vec3(0.6, 0.35, -0.7))))) * fbm(d.xz * 5.0 + 3.0);
      col += vec3(0.16, 0.18, 0.28) * band * uStars * 0.7;
    }
    if (uMoon > 0.5) {
      float md = dot(d, sd3);
      float disc = smoothstep(0.99935, 0.99955, md);
      vec3 mc = mix(vec3(0.92, 0.94, 1.0), vec3(0.6, 0.64, 0.78), smoothstep(0.4, 0.8, fbm(d.xz * 600.0 + 2.0)));
      col = mix(col, mc, disc) + vec3(0.4, 0.5, 0.8) * (pow(sd, 120.0) * 0.6 + pow(sd, 12.0) * 0.14);
    }
    if (d.y > 0.01) {
      vec2 cp = d.xz / (d.y + 0.2) * 1.1 + vec2(uTime * 0.0025, uTime * 0.0012);
      float c = fbm(cp * 1.4);
      float cov = smoothstep(0.48, 0.74, c);
      float toward = fbm(cp * 1.4 + sd3.xz * 0.22);
      float lit = clamp((c - toward) * 5.0 + 0.55, 0.0, 1.0);
      vec3 cc = mix(uCloudShade, uCloudLit, lit);
      cc += uSunColor * pow(sd, 6.0) * 0.3 * cov;
      col = mix(col, cc, cov * smoothstep(0.01, 0.2, d.y) * 0.94);
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

const WATER_FRAG = `
  varying vec3 vW;
  uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uDeep; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uTime; uniform vec3 uHaze; uniform vec2 uFog;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
  void main(){
    vec3 V = normalize(cameraPosition - vW);
    vec2 p = vW.xz * 0.06;
    vec3 N = normalize(vec3((noise(p + uTime * 0.05) - 0.5) * 0.35 + (noise(p * 3.1 - uTime * 0.07) - 0.5) * 0.2, 1.0, (noise(p.yx + 3.0 - uTime * 0.04) - 0.5) * 0.35 + (noise(p.yx * 2.7 + uTime * 0.06) - 0.5) * 0.2));
    float fres = pow(1.0 - clamp(dot(V, N), 0.0, 1.0), 3.0);
    vec3 R = reflect(-V, N);
    vec3 sky = mix(uHorizon, uZenith, pow(clamp(R.y, 0.0, 1.0), 0.5));
    vec3 col = mix(uDeep, sky, 0.25 + 0.75 * fres);
    vec3 sd = normalize(uSunDir);
    col += uSunColor * pow(max(dot(R, sd), 0.0), 220.0) * 3.0;
    float dist = length(vW - cameraPosition);
    float f = smoothstep(uFog.x, uFog.y, dist);
    col = mix(col, uHaze, f);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

export function buildOutside(timeId) {
  const T = TIMES[timeId] || TIMES.golden;
  const scene = new THREE.Scene();
  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };
  const C = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);
  const haze = new THREE.Color(T.haze);
  scene.background = new THREE.Color(T.haze);
  scene.fog = new THREE.Fog(haze, T.fog[0], T.fog[1]);
  const dm4 = new THREE.Object3D();
  const wc = new THREE.Color();
  const shaders = [];

  scene.add(new THREE.HemisphereLight(new THREE.Color(T.hemiSky), new THREE.Color(T.hemiGround), T.hemiK));
  const sunDir = new THREE.Vector3(...T.sunDir).normalize();
  const sun = new THREE.DirectionalLight(new THREE.Color(T.sun), T.sunK);
  sun.position.copy(sunDir).multiplyScalar(500);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(new THREE.Color(T.hemiSky), 0.55 * T.hemiK);
  fill.position.set(-sunDir.x, 0.4, -sunDir.z).multiplyScalar(300);
  scene.add(fill);

  // ───────── sky ─────────
  const skyMat = track(new THREE.ShaderMaterial({
    uniforms: {
      uZenith: { value: new THREE.Color(T.zenith) }, uHorizon: { value: new THREE.Color(T.horizon) }, uHaze: { value: haze.clone() },
      uSunDir: { value: sunDir }, uSunColor: { value: new THREE.Color(T.sun) }, uCloudLit: { value: new THREE.Color(T.cloudLit) }, uCloudShade: { value: new THREE.Color(T.cloudShade) },
      uStars: { value: T.stars }, uMoon: { value: T.moon ? 1 : 0 }, uTime: { value: 0 },
    },
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
  }));
  const sky = new THREE.Mesh(track(new THREE.SphereGeometry(2400, 32, 20)), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  // ───────── land ─────────
  const SEG = 300; const SIZE = 1500;
  const tg = track(new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG));
  tg.rotateX(-Math.PI / 2);
  const pos = tg.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) pos.setY(i, terrainY(pos.getX(i), pos.getZ(i)));
  tg.computeVertexNormals();
  const nor = tg.attributes.normal;
  const col = new THREE.Color();
  const meadow = ['#5c9a3a', '#6aa840', '#4c8a34', '#82a840', '#56983c'].map((h) => new THREE.Color(h));
  const fieldCols = ['#c9b04a', '#8fb44a', '#6aa23c', '#a8884a', '#b8a860', '#7a9a3a', '#c4b860'].map((h) => new THREE.Color(h));
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i); const z = pos.getZ(i); const h = pos.getY(i); const slope = 1 - nor.getY(i);
    const n = fbm(x * 0.02, z * 0.02); const n2 = fbm(x * 0.12 + 5, z * 0.12);
    col.copy(meadow[Math.floor(n * 4.99)]).lerp(meadow[(Math.floor(n * 4.99) + 1) % 5], n2);
    col.lerp(new THREE.Color('#8fb050'), smooth(0.55, 0.8, fbm(x * 0.008 + 17, z * 0.008)) * 0.45);
    const dV = Math.hypot(x - VILLAGE[0], z - VILLAGE[1]); const dL = Math.hypot(x - LAKE[0], z - LAKE[1]);
    const inValley = smooth(-26, -33, h) * (1 - smooth(0.04, 0.12, slope)) * smooth(190, 90, Math.min(dV, dL + 90));
    if (inValley > 0.01) {
      const cx = Math.floor((x + noise(z * 0.01, 3) * 30) / 34); const cz = Math.floor((z + noise(x * 0.01, 9) * 30) / 30);
      const f = fieldCols[Math.floor(hash2(cx, cz) * fieldCols.length)];
      const stripe = 0.93 + 0.07 * Math.sin((hash2(cx, cz) > 0.5 ? x : z) * 0.9);
      col.lerp(wc.copy(f).multiplyScalar(stripe), inValley * 0.85);
    }
    const forest = smooth(0.5, 0.64, fbm(x * 0.012 + 40, z * 0.012 + 13)) * (1 - smooth(-4, 24, h));
    col.lerp(new THREE.Color('#2f5a28'), forest * 0.55);
    if (h < WATER_Y + 2.2) col.lerp(new THREE.Color('#9a9068'), smooth(WATER_Y + 2.2, WATER_Y - 0.4, h) * 0.9);
    const dcast = Math.hypot(x - CASTLE[0], z - CASTLE[1]);
    const rock = smooth(0.07, 0.24, slope + (h > 40 ? 0.1 : 0) + n2 * 0.07);
    const strata = 0.5 + 0.5 * Math.sin(h * 0.9 + n2 * 4);
    col.lerp(wc.set(dcast < 150 ? '#6e675a' : '#7c7664').lerp(new THREE.Color('#9a927e'), strata * 0.45).lerp(new THREE.Color('#463f35'), smooth(0.45, 0.9, n2) * 0.6), rock);
    if (dcast < 100 && h > 20) col.lerp(new THREE.Color('#5d9040'), smooth(0.12, 0.02, slope) * 0.55);
    col.lerp(new THREE.Color('#f0f3f7'), smooth(100, 140, h + n2 * 20));
    if (Math.max(Math.abs(x) - 16, Math.abs(z + 1) - 18) < 3) col.lerp(new THREE.Color('#58903c'), 0.8);
    col.lerp(haze, smooth(-24, -42, h) * 0.18);
    const k = T.tint;
    colors[i * 3] = col.r * k; colors[i * 3 + 1] = col.g * k; colors[i * 3 + 2] = col.b * k;
  }
  tg.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const landMat = track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  landMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWP;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n21(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      float dd = clamp(length(vWP.xz) / 400.0, 0.0, 1.0);
      float mott = 0.78 + 0.44 * (0.5 * n21(vWP.xz * 0.9) + 0.3 * n21(vWP.xz * 3.1) + 0.2 * n21(vWP.xz * 11.0));
      diffuseColor.rgb *= mix(mott, 1.0, dd * 0.7);`);
  };
  scene.add(new THREE.Mesh(tg, landMat));

  const waterMat = track(new THREE.ShaderMaterial({
    uniforms: { uZenith: { value: new THREE.Color(T.zenith) }, uHorizon: { value: new THREE.Color(T.horizon) }, uDeep: { value: new THREE.Color('#12485a').multiplyScalar(T.tint * 0.9) }, uSunDir: { value: sunDir }, uSunColor: { value: new THREE.Color(T.sun) }, uTime: { value: 0 }, uHaze: { value: haze.clone() }, uFog: { value: new THREE.Vector2(...T.fog) } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: WATER_FRAG,
  }));
  const water = new THREE.Mesh(track(new THREE.PlaneGeometry(1600, 1600)), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.y = WATER_Y;
  scene.add(water);

  // ───────── mist: soft cards low in the valley ─────────
  const softTex = track(new THREE.CanvasTexture((() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return cv; })()));
  const mr = rng(404);
  const mistCol = new THREE.Color(T.haze).lerp(new THREE.Color('#ffffff'), T.windows > 0 ? 0.0 : 0.25);
  for (let i = 0; i < 46; i++) {
    const a = mr() * 6.283; const r = 80 + mr() * 420;
    const x = Math.cos(a) * r * 0.9; const z = -40 + Math.sin(a) * r;
    const h = terrainY(x, z);
    const sp = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: softTex, color: mistCol, transparent: true, depthWrite: false, opacity: 0.22 + mr() * 0.12 })));
    sp.position.set(x, Math.max(h, WATER_Y) + 6 + mr() * 16, z);
    const s = 90 + mr() * 160; sp.scale.set(s * 1.8, s * 0.35, 1);
    scene.add(sp);
  }

  // ───────── materials for the buildings ─────────
  const stoneMat = track(new THREE.MeshStandardMaterial({ color: C('#cfcac1', T.tint * 1.55), roughness: 0.92 }));
  loadTex('stone.webp', { srgb: true }).then((t) => { const c = t.clone(); c.needsUpdate = true; stoneMat.map = c; stoneMat.needsUpdate = true; }).catch(() => {});
  const darkStone = track(new THREE.MeshStandardMaterial({ color: C('#85817b', T.tint), roughness: 0.96 }));
  const roofTeal = track(new THREE.MeshStandardMaterial({ color: C('#3b434e', T.tint), roughness: 0.62, metalness: 0.12 }));
  const roofBlue = track(new THREE.MeshStandardMaterial({ color: C('#2b3138', T.tint), roughness: 0.62, metalness: 0.12 }));
  const gold = track(new THREE.MeshStandardMaterial({ color: C('#35312d', T.tint), roughness: 0.5, metalness: 0.45 }));
  const woodMat = track(new THREE.MeshStandardMaterial({ color: C('#6a4a34', T.tint), roughness: 0.9 }));
  const uvScale = (g, sx, sy) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy); return g; };
  const TILE = 14;
  const mkBox = (w, h, d) => { const g = track(new THREE.BoxGeometry(w, h, d)); const uv = g.attributes.uv; const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, (uv.getX(k) * dims[f][0]) / TILE, (uv.getY(k) * dims[f][1]) / TILE); } return g; };
  const mkCyl = (r, h, seg = 18) => uvScale(track(new THREE.CylinderGeometry(r * 0.96, r, h, seg, 1)), (2 * Math.PI * r) / TILE, h / TILE);
  const mkCone = (r, h, seg = 18) => track(new THREE.ConeGeometry(r, h, seg, 1));

  const winTex = track(new THREE.CanvasTexture((() => {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const g = cv.getContext('2d');
    g.clearRect(0, 0, 64, 128);
    const arch = (inset, color) => { g.fillStyle = color; g.beginPath(); g.moveTo(inset, 128 - inset); g.lineTo(inset, 50); g.quadraticCurveTo(inset, inset, 32, inset); g.quadraticCurveTo(64 - inset, inset, 64 - inset, 50); g.lineTo(64 - inset, 128 - inset); g.closePath(); g.fill(); };
    arch(2, '#2a2420'); arch(7, '#ffffff');
    g.fillStyle = '#2a2420'; g.fillRect(30, 8, 4, 116); g.fillRect(8, 56, 48, 4); g.fillRect(8, 92, 48, 3);
    return cv;
  })()));
  const winMat = track(new THREE.MeshBasicMaterial({ map: winTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
  const wGeo = track(new THREE.PlaneGeometry(1, 1));

  // ───────── the castle ─────────
  const castle = new THREE.Group();
  const cy = terrainY(CASTLE[0], CASTLE[1]);
  castle.position.set(CASTLE[0], cy + 3, CASTLE[1]);
  castle.rotation.y = 0.06;
  castle.scale.setScalar(1.4);
  scene.add(castle);
  castle.updateMatrixWorld(true);
  const gl = (lx, lz) => (terrainY(...(() => { const w = castle.localToWorld(new THREE.Vector3(lx, 0, lz)); return [w.x, w.z]; })()) - castle.position.y) / 1.4; // ground height at a point in the castle's own space
  const windows = [];
  const battle = [];
  const put = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); castle.add(m); return m; };
  const crenel = (x, y, z, yaw) => battle.push([x, y, z, yaw]);
  const crenRing = (cx, cz, r, y, n) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; crenel(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, -a); } };
  const crenLine = (x0, z0, x1, z1, y, step = 2.6) => { const len = Math.hypot(x1 - x0, z1 - z0); const n = Math.max(2, Math.floor(len / step)); for (let i = 0; i <= n; i++) { const t = i / n; crenel(lerp(x0, x1, t), y, lerp(z0, z1, t), -Math.atan2(z1 - z0, x1 - x0)); } };
  const spire = (x, z, r, h, roofH, roofMat, base = 0, opts = {}) => {
    put(mkCyl(r, h, 20), stoneMat, x, base + h / 2, z);
    for (const f of [0.28, 0.6]) put(mkCyl(r * 1.06, 0.7, 20), darkStone, x, base + h * f, z);
    put(mkCyl(r * 1.22, 1.4, 20), darkStone, x, base + h - 0.7, z);
    crenRing(x, z, r * 1.18, base + h + 0.3, Math.round(r * 5));
    put(mkCyl(r * 1.0, 2.2, 20), stoneMat, x, base + h + 1.1, z);
    put(mkCone(r * 1.3, roofH * 1.55, 20), roofMat, x, base + h + 2.2 + roofH * 0.775 - 0.3, z);
    put(mkCone(0.3, 5, 6), gold, x, base + h + 2.2 + roofH * 1.55 + 2, z);
    for (let a = 0; a < 5; a++) for (let y = 8; y < h - 5; y += 9) windows.push([x + Math.cos(a * 1.2566 + 0.4) * (r + 0.1), base + y, z + Math.sin(a * 1.2566 + 0.4) * (r + 0.1), -(a * 1.2566 + 0.4) + Math.PI / 2, 1.5, 3.0]);
  };
  // a battered stone plinth that runs down the cliff face to the ground, so the castle grows out of the rock
  put(uvScale(track(new THREE.CylinderGeometry(56, 74, 90, 48, 1)), 24, 6), darkStone, 0, -41, 0);
  put(mkCyl(56, 9, 48), darkStone, 0, 0.5, 0);
  put(mkCyl(54, 3, 48), stoneMat, 0, 6, 0);
  crenRing(0, 0, 53.4, 8, 84);
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; put(mkBox(3.2, 12, 4.4), darkStone, Math.cos(a) * 56, 0, Math.sin(a) * 56).rotation.y = -a; }
  put(mkBox(54, 24, 18), stoneMat, 0, 20, 14);
  const gable = new THREE.Shape(); gable.moveTo(-10.5, 0); gable.lineTo(10.5, 0); gable.lineTo(0, 15); gable.closePath();
  const gg = track(new THREE.ExtrudeGeometry(gable, { depth: 58, bevelEnabled: false })); gg.translate(0, 0, -29);
  put(gg, roofBlue, 0, 32, 14).rotation.y = Math.PI / 2;
  put(mkBox(58.4, 0.9, 0.7), gold, 0, 47.2, 14);
  for (let i = -4; i <= 4; i++) { windows.push([i * 5.6, 22, 23.15, 0, 3.4, 10]); put(mkBox(1.6, 15, 4.6), stoneMat, i * 5.6 + 2.8, 17, 25); const cap = put(mkCone(1.5, 8, 4), roofBlue, i * 5.6 + 2.8, 28, 25.5); cap.rotation.y = Math.PI / 4; }
  for (let i = -3; i <= 3; i++) { put(mkBox(4.4, 5.6, 4.6), stoneMat, i * 7.4, 37.5, 22); const dr = put(mkCone(3.6, 5, 4), roofTeal, i * 7.4, 42.8, 22); dr.rotation.y = Math.PI / 4; windows.push([i * 7.4, 37.5, 24.4, 0, 1.6, 3.4]); }
  crenLine(-27, 23.1, 27, 23.1, 32.6); crenLine(-27, 5, 27, 5, 32.6);
  put(mkBox(26, 62, 26), stoneMat, 0, 31, -12);
  for (const y of [20, 40, 58]) put(mkBox(28, 1.2, 28), darkStone, 0, y, -12);
  put(mkCone(21, 66, 4), roofTeal, 0, 62 + 33, -12).rotation.y = Math.PI / 4;
  put(mkCone(0.4, 16, 6), gold, 0, 62 + 66 + 7, -12);
  put(track(new THREE.CircleGeometry(4.4, 28)), track(new THREE.MeshStandardMaterial({ color: C('#f4ecd0', T.tint), roughness: 0.6, emissive: C('#ffcf80', T.windows > 0 ? 0.55 : 0) })), 0, 50, 1.2);
  put(track(new THREE.TorusGeometry(4.5, 0.4, 8, 28)), gold, 0, 50, 1.3);
  for (let k = -1; k <= 1; k++) for (const y of [14, 28, 42]) windows.push([k * 7.5, y, 1.15, 0, 2.2, 5.2]);
  for (let k = -1; k <= 1; k++) { put(mkBox(5, 0.8, 3), darkStone, k * 7.5, 11, 2.2); crenLine(k * 7.5 - 2.4, 3.6, k * 7.5 + 2.4, 3.6, 12.5, 0.9); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) spire(sx * 13.5, -12 + sz * 13.5, 4, 70, 26, sx * sz > 0 ? roofTeal : roofBlue, 0);
  for (const sx of [-1, 1]) {
    put(mkBox(22, 40, 20), stoneMat, sx * 40, 20, 2);
    put(mkCone(17, 30, 4), sx > 0 ? roofBlue : roofTeal, sx * 40, 55, 2).rotation.y = Math.PI / 4;
    put(mkBox(24, 1, 22), darkStone, sx * 40, 40.2, 2);
    for (let k = -1; k <= 1; k++) for (const y of [12, 26]) windows.push([sx * 40 + k * 6, y, 12.15, 0, 2.2, 5]);
    spire(sx * 54, 10, 5.2, 52, 22, sx > 0 ? roofTeal : roofBlue, 0);
    spire(sx * 30, -26, 3.6, 62, 24, roofTeal, 0);
    spire(sx * 24, 24, 4.4, 40, 18, roofBlue, 0);
  }
  put(mkBox(14, 30, 26), stoneMat, 66, 15, -16);
  put(mkCone(11, 24, 4), roofTeal, 66, 42, -16).rotation.y = Math.PI / 4;
  put(track(new THREE.CircleGeometry(3, 24)), track(new THREE.MeshBasicMaterial({ color: C(T.windows > 0 ? '#ffb55a' : '#5a7ab0', 1) })), 66, 22, -2.8);
  put(track(new THREE.TorusGeometry(3.1, 0.35, 8, 24)), darkStone, 66, 22, -2.7);
  for (let i = 0; i < 3; i++) { const fb = put(mkBox(0.9, 0.9, 13), darkStone, 59.5, 20 - i * 2.2, -16 + (i - 1) * 7); fb.rotation.z = 0.5; }
  spire(66, 4, 3.2, 44, 20, roofBlue, 0);
  put(mkBox(16, 24, 10), stoneMat, 0, 12, 40);
  put(mkBox(7, 9, 0.3), track(new THREE.MeshBasicMaterial({ color: C(T.windows > 0 ? '#ffc070' : '#16110e') })), 0, 5, 45.05);
  for (const sx of [-1, 1]) spire(sx * 12, 40, 5, 30, 14, roofBlue, 0);
  crenLine(-6, 45, 6, 45, 24.6);
  for (const sx of [-1, 1]) { put(mkBox(30, 16, 3.5), stoneMat, sx * 30, 8, 42); crenLine(sx * 15, 43.8, sx * 45, 43.8, 16.4); }
  put(mkBox(84, 3, 7), stoneMat, 108, 30, 8);
  crenLine(66, 11.2, 148, 11.2, 33.6); crenLine(66, 4.8, 148, 4.8, 33.6);
  put(mkBox(9, 20, 9), darkStone, 73, 40, 8); put(mkCone(7, 20, 4), roofBlue, 73, 60, 8).rotation.y = Math.PI / 4; // a gatehouse where the bridge meets the castle
  for (let i = 0; i < 8; i++) {
    const ax = 70 + i * 10; const g = gl(ax, 8) - 4; const hgt = 31 - g;
    put(mkBox(3.6, hgt, 5.6), darkStone, ax, g + hgt / 2, 8);
    put(mkBox(5.2, 3, 7), darkStone, ax, g + 1.5, 8);
    for (const ay of [8, -22, -52, -82]) if (ay > g + 6 && i < 7) put(track(new THREE.TorusGeometry(4.2, 1.0, 8, 16, Math.PI)), stoneMat, ax + 5, ay, 8);
    if (i < 7) put(track(new THREE.TorusGeometry(3.4, 1.1, 8, 14, Math.PI)), stoneMat, ax + 5, 26, 8);
  }
  const endBase = gl(150, 8);
  put(mkCyl(9, 30, 22), darkStone, 150, endBase - 8, 8);
  spire(150, 8, 5, 34, 18, roofTeal, endBase);
  const wMesh = new THREE.InstancedMesh(wGeo, winMat, windows.length);
  const wr = rng(21);
  windows.forEach((w, i) => {
    dm4.position.set(w[0], w[1], w[2]); dm4.rotation.set(0, w[3], 0); dm4.scale.set(w[4], w[5], 1); dm4.updateMatrix(); wMesh.setMatrixAt(i, dm4.matrix);
    const lit = T.windows > 0 ? wr() < 0.7 : T.glow === 0 ? false : wr() < 0.45;
    wc.set(lit ? '#ffc470' : T.windows > 0 ? '#1a2234' : '#6f8fb8').multiplyScalar(lit ? 1.7 : 1);
    wMesh.setColorAt(i, wc);
  });
  castle.add(wMesh);
  const cMesh = new THREE.InstancedMesh(track(new THREE.BoxGeometry(1.5, 1.4, 1.1)), stoneMat, battle.length);
  battle.forEach((b, i) => { dm4.position.set(b[0], b[1] + 0.7, b[2]); dm4.rotation.set(0, b[3], 0); dm4.scale.set(1, 1, 1); dm4.updateMatrix(); cMesh.setMatrixAt(i, dm4.matrix); });
  castle.add(cMesh);
  if (T.windows > 0 || T.glow > 0) {
    const glow = track(new THREE.SpriteMaterial({ map: softTex, color: 0xffb060, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: T.windows > 0 ? 0.9 : 0.45 }));
    for (const [x, y, z, s] of [[-4, 7, 46, 14], [4, 7, 46, 14], [0, 36, 4, 22], [-30, 20, 45, 12], [30, 20, 45, 12], [66, 22, -2, 16], [112, 34, 8, 16]]) { const sp = new THREE.Sprite(glow); sp.position.set(x, y, z); sp.scale.setScalar(s); castle.add(sp); }
  }

  // ───────── waterfall: a ribbon down the crag into the lake ─────────
  {
    const a0 = Math.PI / 2 + 0.55; let x = CASTLE[0] + Math.cos(a0) * 104; let z = CASTLE[1] + Math.sin(a0) * 104;
    const pts = [];
    for (let i = 0; i < 90; i++) {
      const h = terrainY(x, z); pts.push([x, h, z]); if (h < WATER_Y + 1) break;
      const gx = terrainY(x + 2, z) - terrainY(x - 2, z); const gz = terrainY(x, z + 2) - terrainY(x, z - 2);
      const l = Math.hypot(gx, gz) || 1; x -= (gx / l) * 3.2; z -= (gz / l) * 3.2;
    }
    if (pts.length > 4) {
      const pos2 = []; const uv = []; const idx = [];
      pts.forEach((p, i) => {
        const nx = pts[Math.min(i + 1, pts.length - 1)]; const pv = pts[Math.max(i - 1, 0)];
        const tx = nx[0] - pv[0]; const tz = nx[2] - pv[2]; const l = Math.hypot(tx, tz) || 1; const w = lerp(2.4, 6, i / pts.length);
        pos2.push(p[0] + (-tz / l) * w, p[1] + 0.5, p[2] + (tx / l) * w, p[0] - (-tz / l) * w, p[1] + 0.5, p[2] - (tx / l) * w);
        uv.push(0, i / 6, 1, i / 6);
        if (i > 0) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
      });
      const wg = track(new THREE.BufferGeometry()); wg.setAttribute('position', new THREE.Float32BufferAttribute(pos2, 3)); wg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); wg.setIndex(idx);
      const fm = track(new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uTint: { value: new THREE.Color(T.windows > 0 ? '#6a86b8' : '#eaf6ff') } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `varying vec2 vUv; uniform float uTime; uniform vec3 uTint;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float n(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
          void main(){ float s = n(vec2(vUv.x * 7.0, vUv.y * 3.0 - uTime * 2.2)) * 0.6 + n(vec2(vUv.x * 18.0, vUv.y * 9.0 - uTime * 4.0)) * 0.4;
            float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
            gl_FragColor = vec4(uTint * (0.8 + s * 0.5), edge * (0.55 + s * 0.4));\n#include <colorspace_fragment>\n}`,
      }));
      shaders.push(fm);
      scene.add(new THREE.Mesh(wg, fm));
    }
  }

  // ───────── the village among the fields ─────────
  const vr = rng(77);
  const houses = [];
  for (let i = 0; i < 80; i++) {
    const a = vr() * 6.283; const rr = Math.sqrt(vr()) * 62;
    const x = VILLAGE[0] + Math.cos(a) * rr * 1.25; const z = VILLAGE[1] + Math.sin(a) * rr;
    if (houses.some((q) => Math.hypot(q.x - x, q.z - z) < 11)) continue;
    houses.push({ x, z, w: 7 + vr() * 6, d: 6 + vr() * 5, h: 5 + vr() * 4, yaw: Math.round(vr() * 4) * 1.5708 + (vr() - 0.5) * 0.25 });
  }
  const bodyMesh = new THREE.InstancedMesh(track(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), track(new THREE.MeshStandardMaterial({ roughness: 0.95 })), houses.length + 1);
  const roofMesh = new THREE.InstancedMesh(track(new THREE.ConeGeometry(0.78, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0)), track(new THREE.MeshStandardMaterial({ roughness: 0.7 })), houses.length + 1);
  const walls = ['#f0e6cc', '#e2d0a8', '#f6efdc', '#d6bf98', '#ead8b4', '#f2dcc0']; const roofs = ['#b4573a', '#a24a34', '#c0663f', '#8a5a48', '#58708a'];
  const vWin = []; const smokes = [];
  houses.forEach((hs, i) => {
    const y = terrainY(hs.x, hs.z);
    dm4.position.set(hs.x, y, hs.z); dm4.rotation.set(0, hs.yaw, 0); dm4.scale.set(hs.w, hs.h, hs.d); dm4.updateMatrix(); bodyMesh.setMatrixAt(i, dm4.matrix);
    bodyMesh.setColorAt(i, wc.set(walls[i % walls.length]).multiplyScalar(T.tint));
    dm4.position.set(hs.x, y + hs.h, hs.z); dm4.scale.set(hs.w * 1.1, hs.h * 0.85, hs.d * 1.1); dm4.updateMatrix(); roofMesh.setMatrixAt(i, dm4.matrix);
    roofMesh.setColorAt(i, wc.set(roofs[(i * 7) % roofs.length]).multiplyScalar(T.tint));
    for (let k = 0; k < 3; k++) vWin.push({ x: hs.x + Math.cos(hs.yaw) * (k - 1) * hs.w * 0.28 + Math.sin(hs.yaw) * hs.d * 0.51, y: y + hs.h * 0.55, z: hs.z - Math.sin(hs.yaw) * (k - 1) * hs.w * 0.28 + Math.cos(hs.yaw) * hs.d * 0.51, yaw: hs.yaw });
    if (vr() < 0.35) smokes.push({ x: hs.x + hs.w * 0.2, y: y + hs.h * 1.5, z: hs.z });
  });
  const chY = terrainY(VILLAGE[0] + 5, VILLAGE[1] - 40);
  dm4.position.set(VILLAGE[0] + 5, chY, VILLAGE[1] - 40); dm4.rotation.set(0, 0.3, 0); dm4.scale.set(10, 14, 28); dm4.updateMatrix(); bodyMesh.setMatrixAt(houses.length, dm4.matrix); bodyMesh.setColorAt(houses.length, wc.set('#f2e8d2').multiplyScalar(T.tint));
  dm4.position.set(VILLAGE[0] + 5, chY + 14, VILLAGE[1] - 40); dm4.scale.set(11, 7, 29); dm4.updateMatrix(); roofMesh.setMatrixAt(houses.length, dm4.matrix); roofMesh.setColorAt(houses.length, wc.set('#58708a').multiplyScalar(T.tint));
  scene.add(bodyMesh, roofMesh);
  const spireV = new THREE.Mesh(track(new THREE.ConeGeometry(3.4, 28, 8)), roofBlue); spireV.position.set(VILLAGE[0] + 9, chY + 30, VILLAGE[1] - 52); scene.add(spireV);
  const towV = new THREE.Mesh(track(new THREE.BoxGeometry(6, 18, 6)), stoneMat); towV.position.set(VILLAGE[0] + 9, chY + 9, VILLAGE[1] - 52); scene.add(towV);
  const vwMesh = new THREE.InstancedMesh(wGeo, track(new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })), vWin.length);
  vWin.forEach((w, i) => {
    dm4.position.set(w.x, w.y, w.z); dm4.rotation.set(0, w.yaw, 0); dm4.scale.set(1.3, 1.5, 1); dm4.updateMatrix(); vwMesh.setMatrixAt(i, dm4.matrix);
    const lit = T.windows > 0 && vr() < 0.55;
    vwMesh.setColorAt(i, wc.set(lit ? '#ffc060' : T.windows > 0 ? '#0e1420' : '#5a6a80').multiplyScalar(lit ? 1.6 : 1));
  });
  scene.add(vwMesh);
  const smokeSprites = [];
  smokes.forEach((s0, i) => {
    for (let k = 0; k < 6; k++) {
      const sp = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: softTex, transparent: true, depthWrite: false, opacity: 0.3, color: T.windows > 0 ? 0x4a5468 : 0xf0ece6 })));
      sp.userData = { x: s0.x, y: s0.y, z: s0.z, ph: (k / 6 + i * 0.13) % 1 };
      scene.add(sp); smokeSprites.push(sp);
    }
  });

  // ───────── trees ─────────
  const tr = rng(5);
  const withColor = (g, fn) => { const geo = g.index ? g.toNonIndexed() : g; const p = geo.attributes.position; const arr = new Float32Array(p.count * 3); const c3 = new THREE.Color(); for (let i = 0; i < p.count; i++) { fn(c3, p.getX(i), p.getY(i), p.getZ(i), i); arr[i * 3] = c3.r; arr[i * 3 + 1] = c3.g; arr[i * 3 + 2] = c3.b; } geo.setAttribute('color', new THREE.BufferAttribute(arr, 3)); geo.deleteAttribute('uv'); return geo; };
  const pineGeo = (tiers, seg) => {
    const parts = [];
    for (let i = 0; i < tiers; i++) {
      const t = i / (tiers - 1); const r = lerp(1.0, 0.28, t); const h = 0.5; const y = 0.24 + t * 0.7;
      const g = new THREE.ConeGeometry(r, h, seg, 1, false); g.translate(0, y, 0);
      const pp = g.attributes.position;
      for (let v = 0; v < pp.count; v++) { if (pp.getY(v) < y) { const a = Math.atan2(pp.getZ(v), pp.getX(v)); const s = 0.8 + 0.2 * Math.sin(a * 6 + i * 1.7); pp.setX(v, pp.getX(v) * s); pp.setZ(v, pp.getZ(v) * s); pp.setY(v, pp.getY(v) - 0.05 * Math.sin(a * 6 + i)); } }
      parts.push(withColor(g, (c, x, yy) => { const k = clamp((yy - (y - h / 2)) / h, 0, 1); c.setRGB(lerp(0.6, 1.05, k), lerp(0.7, 1.1, k), lerp(0.58, 0.85, k)); }));
    }
    const trunk = new THREE.CylinderGeometry(0.05, 0.08, 0.34, 5).translate(0, 0.17, 0);
    parts.push(withColor(trunk, (c) => c.setRGB(0.35, 0.24, 0.16)));
    return track(mergeGeometries(parts));
  };
  const crownGeo = (blobs, detail) => {
    const parts = [];
    blobs.forEach(([x, y, z, r], bi) => {
      const g = new THREE.IcosahedronGeometry(r, detail); g.translate(x, y, z);
      const pp = g.attributes.position;
      for (let v = 0; v < pp.count; v++) { const n = 1 + 0.22 * (noise(pp.getX(v) * 3 + bi, pp.getZ(v) * 3 + pp.getY(v) * 2) - 0.5) * 2; const cx = pp.getX(v) - x; const cyy = pp.getY(v) - y; const cz = pp.getZ(v) - z; pp.setXYZ(v, x + cx * n, y + cyy * n, z + cz * n); }
      parts.push(withColor(g, (c, vx, vy) => { const k = clamp((vy - (y - r)) / (2 * r), 0, 1); c.setRGB(lerp(0.5, 1.12, k), lerp(0.62, 1.14, k), lerp(0.5, 0.95, k)); }));
    });
    const trunk = new THREE.CylinderGeometry(0.07, 0.11, 0.7, 6).translate(0, 0.35, 0);
    parts.push(withColor(trunk, (c) => c.setRGB(0.4, 0.28, 0.2)));
    return track(mergeGeometries(parts));
  };
  const BLOBS = [[0, 1.05, 0, 0.55], [0.34, 0.9, 0.2, 0.4], [-0.32, 0.92, -0.18, 0.42], [0.05, 1.42, -0.05, 0.38], [-0.1, 0.78, 0.3, 0.34]];
  const geos = { pineNear: pineGeo(6, 11), pineFar: pineGeo(3, 6), crownNear: crownGeo(BLOBS, 1), crownFar: crownGeo(BLOBS.slice(0, 3), 0) };
  const cand = [];
  for (let i = 0; i < 14000 && cand.length < 3600; i++) {
    const a = tr() * 6.283; const r = 40 + Math.pow(tr(), 0.78) * 730;
    const x = Math.cos(a) * r; const z = Math.sin(a) * r;
    const h = terrainY(x, z);
    if (h < WATER_Y + 2.2 || h > 64) continue;
    const dc = Math.hypot(x - CASTLE[0], z - CASTLE[1]); if (dc < 130 || Math.hypot(x - VIA[0], z - VIA[1]) < 70) continue;
    if (Math.hypot(x - VILLAGE[0], z - VILLAGE[1]) < 78 && tr() < 0.88) continue;
    const e = 3; const sl = Math.abs(terrainY(x + e, z) - h) + Math.abs(terrainY(x, z + e) - h); if (sl > 3.4) continue;
    const dens = fbm(x * 0.012 + 40, z * 0.012 + 13);
    if (h < -26 && h > -34 && dens < 0.5 && tr() < 0.85) continue;
    if (r < 90 ? tr() > 0.12 : dens < 0.42 && tr() > 0.1) continue;
    const pine = h > -14 || tr() < 0.3;
    cand.push({ x, y: h, z, r, s: (r < 120 ? 4.5 + tr() * 3 : 8 + tr() * 9), pine, t: tr(), far: r > 260 });
  }
  const palettePine = ['#4f9a54', '#44904a', '#5aa55a', '#3d8444'];
  const paletteLeaf = ['#5da63a', '#6cb242', '#4e9636', '#88b43c', '#5aa044', '#d6b436', '#d8782e', '#e89ab4'];
  cand.forEach((t) => {
    if (t.pine) t.col = palettePine[Math.floor(t.t * 3.99)];
    else { const roll = tr(); t.col = roll < 0.07 ? paletteLeaf[7] : roll < 0.14 ? paletteLeaf[6] : roll < 0.24 ? paletteLeaf[5] : paletteLeaf[Math.floor(roll * 5) % 5]; }
  });
  const addTrees = (geo, items, fn) => {
    if (!items.length) return;
    const m = new THREE.InstancedMesh(geo, track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })), items.length);
    items.forEach((t, i) => { dm4.rotation.set(0, t.t * 6.28, 0); fn(t); dm4.updateMatrix(); m.setMatrixAt(i, dm4.matrix); m.setColorAt(i, wc.set(t.col).multiplyScalar(T.tint)); });
    scene.add(m);
  };
  addTrees(geos.pineNear, cand.filter((t) => t.pine && !t.far), (t) => { dm4.position.set(t.x, t.y - 0.4, t.z); dm4.scale.set(t.s * 0.46, t.s * 1.9, t.s * 0.46); });
  addTrees(geos.pineFar, cand.filter((t) => t.pine && t.far), (t) => { dm4.position.set(t.x, t.y - 0.4, t.z); dm4.scale.set(t.s * 0.5, t.s * 1.9, t.s * 0.5); });
  addTrees(geos.crownNear, cand.filter((t) => !t.pine && !t.far), (t) => { dm4.position.set(t.x, t.y - 0.3, t.z); dm4.scale.set(t.s, t.s * 1.05, t.s); });
  addTrees(geos.crownFar, cand.filter((t) => !t.pine && t.far), (t) => { dm4.position.set(t.x, t.y - 0.3, t.z); dm4.scale.set(t.s, t.s, t.s); });

  // grass that sways, and wildflowers, on the lawns and meadows around the house
  const grassGeo = track(new THREE.BufferGeometry());
  grassGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.05, 0, 0, 0.05, 0, 0, 0.0, 1, 0], 3));
  grassGeo.setAttribute('color', new THREE.Float32BufferAttribute([0.28, 0.42, 0.14, 0.28, 0.42, 0.14, 0.78, 1.0, 0.45], 3));
  const GN = 9000;
  const grassMat = track(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 }));
  grassMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = { value: 0 };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat sw = sin(uTime * 1.8 + instanceMatrix[3].x * 0.5 + instanceMatrix[3].z * 0.35) * 0.3 * position.y;\ntransformed.x += sw; transformed.z += sw * 0.5;');
    grassMat.userData.shader = sh;
  };
  const grass = new THREE.InstancedMesh(grassGeo, grassMat, GN);
  const gr = rng(808); let gi = 0;
  for (let i = 0; i < GN * 3 && gi < GN; i++) {
    const x = (gr() - 0.5) * 120; const z = -70 + gr() * 120;
    if (Math.abs(x) < 17 && z > -20 && z < 19) continue;
    const h = terrainY(x, z); if (h < -6) continue;
    dm4.position.set(x, h, z); dm4.rotation.set(0, gr() * 6.28, 0); const s = 0.5 + gr() * 0.9; dm4.scale.set(s * 2, s * 1.1, s * 2); dm4.updateMatrix(); grass.setMatrixAt(gi, dm4.matrix);
    grass.setColorAt(gi, wc.set('#ffffff').multiplyScalar(T.tint * (0.85 + gr() * 0.3))); gi++;
  }
  grass.count = gi; scene.add(grass);
  const FN = 1400;
  const flowers = new THREE.InstancedMesh(track(new THREE.IcosahedronGeometry(0.1, 0)), track(new THREE.MeshStandardMaterial({ roughness: 0.8, emissive: new THREE.Color('#222222') })), FN);
  const fcols = ['#fff4c4', '#ffd23a', '#f2f2ff', '#c58aff', '#ff8aa8', '#ffa43a'];
  let fi = 0;
  for (let i = 0; i < FN * 3 && fi < FN; i++) {
    const x = (gr() - 0.5) * 110; const z = -60 + gr() * 100;
    if (Math.abs(x) < 18 && z > -21 && z < 20) continue;
    if (fbm(x * 0.05 + 70, z * 0.05) < 0.5) continue;
    const h = terrainY(x, z); if (h < -6) continue;
    dm4.position.set(x, h + 0.45 + gr() * 0.25, z); dm4.rotation.set(0, 0, 0); dm4.scale.setScalar(0.8 + gr()); dm4.updateMatrix(); flowers.setMatrixAt(fi, dm4.matrix);
    flowers.setColorAt(fi, wc.set(fcols[Math.floor(gr() * fcols.length)]).multiplyScalar(T.tint)); fi++;
  }
  flowers.count = fi; scene.add(flowers);

  // ───────── things that fly: birds, and a dragon as a silhouette ─────────
  const fliers = new THREE.Group();
  scene.add(fliers);
  const inkCol = T.windows > 0 ? new THREE.Color('#020308') : T.glow > 0 ? new THREE.Color('#0d0709') : new THREE.Color('#10131c');
  const birdMat = track(new THREE.MeshBasicMaterial({ color: inkCol, side: THREE.DoubleSide, fog: true }));
  const wingShape = new THREE.Shape(); wingShape.moveTo(0, 0); wingShape.quadraticCurveTo(0.4, 0.4, 1.3, 0.12); wingShape.quadraticCurveTo(0.8, -0.02, 0.55, -0.3); wingShape.closePath();
  const wingGeo = track(new THREE.ShapeGeometry(wingShape));
  const flocks = [];
  const spawnFlock = (frng) => {
    const g = new THREE.Group(); const n = 6 + Math.floor(frng() * 10); const birds = [];
    for (let i = 0; i < n; i++) {
      const b = new THREE.Group(); const wl = new THREE.Mesh(wingGeo, birdMat); const wr2 = new THREE.Mesh(wingGeo, birdMat); wr2.scale.x = -1; b.add(wl, wr2);
      const row = Math.ceil(i / 2); const side = i % 2 ? 1 : -1; b.position.set(side * row * 2.4, 0, row * 2.6);
      b.userData = { wl, wr: wr2, ph: frng() * 6 }; g.add(b); birds.push(b);
    }
    const dir = frng() < 0.5 ? 1 : -1;
    const f = { g, birds, a: -Math.PI / 2 - dir * (0.5 + frng() * 0.6), R: 60 + frng() * 150, dir, y: 12 + frng() * 70, life: 0, max: 36 + frng() * 22, w: 0.09 + frng() * 0.04 };
    fliers.add(g); flocks.push(f);
  };
  let dragon = null; let dragonState = null;
  const er = rng(1234);
  let nextFlock = 4 + er() * 6; let nextDragon = 25 + er() * 45;
  let clock = 0;
  // ───────── the dragon: a real 3D beast (tapering body, bones, leathery wings that join at the shoulders) ─────────
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const UP = new THREE.Vector3(0, 1, 0);
  const fireCols = [new THREE.Color('#fff0b0'), new THREE.Color('#ff8a22'), new THREE.Color('#7a1c08')];
  const night = T.windows > 0;
  // painted once: overlapping armoured scales (colour and relief), and a veined leather membrane
  const paint = (w, h, fn, repeat) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; fn(cv.getContext('2d'), w, h); const t = track(new THREE.CanvasTexture(cv)); t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); } return t; };
  const scalePat = (g, w, h, light, dark, n) => {
    const sw = w / n; const sh = sw * 0.8;
    for (let row = -1; row < h / sh + 1; row++) for (let c = -1; c < n + 1; c++) {
      const x = c * sw + (row % 2 ? sw / 2 : 0); const y = row * sh * 0.62;
      const gr = g.createRadialGradient(x, y + sh * 0.25, 1, x, y + sh * 0.3, sh * 0.75); gr.addColorStop(0, light); gr.addColorStop(1, dark);
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - sw / 2, y); g.quadraticCurveTo(x - sw / 2, y + sh, x, y + sh); g.quadraticCurveTo(x + sw / 2, y + sh, x + sw / 2, y); g.quadraticCurveTo(x, y + sh * 0.22, x - sw / 2, y); g.fill();
    }
  };
  const hideTex = paint(512, 256, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); const tone = night ? ['#07080c', '#12141c'] : ['#1b1511', '#4a3626'];
    bg.addColorStop(0, tone[0]); bg.addColorStop(0.5, tone[1]); bg.addColorStop(1, tone[0]); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.55; scalePat(g, w, h, 'rgba(255,230,200,0.22)', 'rgba(0,0,0,0.45)', 32); g.globalAlpha = 1;
  });
  const reliefTex = paint(256, 256, (g, w, h) => { g.fillStyle = '#555'; g.fillRect(0, 0, w, h); scalePat(g, w, h, '#fff', '#222', 16); }, [16, 2]);
  const membTex = paint(256, 256, (g, w, h) => {
    g.fillStyle = night ? '#120c10' : '#43241b'; g.fillRect(0, 0, w, h);
    const mr = rng(5);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${night ? '40,20,28' : '120,62,44'},${0.05 + mr() * 0.09})`; g.beginPath(); g.arc(mr() * w, mr() * h, 6 + mr() * 20, 0, 6.3); g.fill(); }
    g.strokeStyle = 'rgba(14,6,5,0.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(3, 0); g.lineTo(3, h); g.moveTo(w - 3, 0); g.lineTo(w - 3, h); g.stroke();
    g.lineWidth = 1.6; g.strokeStyle = 'rgba(22,9,7,0.6)';
    for (let k = 0; k < 11; k++) { let x = w * (0.1 + k * 0.08); g.beginPath(); g.moveTo(w / 2, 0); for (let y = 0; y <= h; y += 16) { x += (mr() - 0.5) * 8 + (x < w / 2 ? -1 : 1) * 3; g.lineTo(x, y); } g.stroke(); }
  });
  const dragMat = track(new THREE.MeshStandardMaterial({ map: hideTex, bumpMap: reliefTex, bumpScale: 2.2, roughness: 0.52, metalness: 0.2, side: THREE.DoubleSide }));
  const membMat = track(new THREE.MeshStandardMaterial({ map: membTex, emissiveMap: membTex, emissive: night ? 0x1a0c10 : 0xff6a3a, emissiveIntensity: night ? 0.2 : 0.5, roughness: 0.7, side: THREE.DoubleSide }));
  const boneMat = track(new THREE.MeshStandardMaterial({ color: night ? '#0a0a0d' : '#241c17', roughness: 0.55, metalness: 0.2 }));
  const hornMat = track(new THREE.MeshStandardMaterial({ color: '#3a322b', roughness: 0.4, metalness: 0.15 }));
  const toothMat = track(new THREE.MeshStandardMaterial({ color: '#d8cfb8', roughness: 0.4 }));
  const eyeMat = track(new THREE.MeshBasicMaterial({ color: 0xff7a1c, fog: false }));
  function makeDragon() {
    const own = [];
    const mk = (o) => { own.push(o); return o; };
    const g = new THREE.Group(); g.rotation.order = 'YXZ';
    const inner = new THREE.Group(); g.add(inner);
    const SEG = 96; const RAD = 14;
    const bodyGeo = mk(new THREE.BufferGeometry());
    const bp = new Float32Array((SEG + 1) * (RAD + 1) * 3); const buv = new Float32Array((SEG + 1) * (RAD + 1) * 2);
    const idx = [];
    for (let i = 0; i <= SEG; i++) for (let j = 0; j <= RAD; j++) { const o = (i * (RAD + 1) + j) * 2; buv[o] = i / SEG; buv[o + 1] = j / RAD; }
    for (let i = 0; i < SEG; i++) for (let j = 0; j < RAD; j++) { const a = i * (RAD + 1) + j; const b = a + RAD + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    bodyGeo.setIndex(idx); bodyGeo.setAttribute('position', new THREE.BufferAttribute(bp, 3)); bodyGeo.setAttribute('uv', new THREE.BufferAttribute(buv, 2));
    const body = new THREE.Mesh(bodyGeo, dragMat); body.frustumCulled = false; inner.add(body);
    // a lean, muscular shape: deep chest, tucked waist, powerful haunches, a whip of a tail
    const radius = (u) => {
      if (u < 0.05) return 0.014 + 0.007 * (u / 0.05);
      if (u < 0.3) return 0.021 + 0.022 * sstep(0.05, 0.3, u);
      if (u < 0.58) return 0.043 + 0.03 * Math.sin((Math.PI * (u - 0.3)) / 0.28) + 0.012 * Math.exp(-Math.pow((u - 0.5) / 0.05, 2));
      return 0.043 * Math.pow(Math.max(0, 1 - (u - 0.58) / 0.42), 1.5) + 0.0015;
    };
    const C = Array.from({ length: SEG + 1 }, () => new THREE.Vector3());
    const Upv = Array.from({ length: SEG + 1 }, () => new THREE.Vector3());
    const Sd = Array.from({ length: SEG + 1 }, () => new THREE.Vector3());
    const Tn = new THREE.Vector3();
    const pose = (t) => {
      for (let i = 0; i <= SEG; i++) {
        const u = i / SEG;
        // the neck rises in an S and the head is carried high; the tail trails and snakes
        const y = 0.085 * (1 - sstep(0.04, 0.3, u)) + 0.018 * Math.sin(Math.PI * sstep(0.04, 0.3, u)) - 0.025 * sstep(0.55, 1, u) + Math.sin(t * 2.4 - u * 5) * 0.012 * sstep(0.5, 1, u) + Math.sin(t * 1.6 - u * 4) * 0.008 * (1 - sstep(0, 0.3, u));
        const z = Math.sin(t * 2.0 - u * 6) * 0.024 * sstep(0.45, 1, u) + Math.sin(t * 1.4 - u * 5) * 0.014 * (1 - sstep(0, 0.32, u));
        C[i].set(0.52 - u, y, z);
      }
      for (let i = 0; i <= SEG; i++) {
        Tn.subVectors(C[Math.min(SEG, i + 1)], C[Math.max(0, i - 1)]).normalize();
        Sd[i].crossVectors(Tn, UP).normalize(); Upv[i].crossVectors(Sd[i], Tn).normalize();
        const r = radius(i / SEG);
        for (let j = 0; j <= RAD; j++) {
          const th = (j / RAD) * Math.PI * 2; const o = (i * (RAD + 1) + j) * 3;
          const cx = Math.cos(th) * r * (Math.cos(th) < 0 ? 0.82 : 0.95); const sx = Math.sin(th) * r * 0.92;
          bp[o] = C[i].x + Upv[i].x * cx + Sd[i].x * sx; bp[o + 1] = C[i].y + Upv[i].y * cx + Sd[i].y * sx; bp[o + 2] = C[i].z + Upv[i].z * cx + Sd[i].z * sx;
        }
      }
      bodyGeo.attributes.position.needsUpdate = true; bodyGeo.computeVertexNormals();
    };
    const at = (u) => Math.round(u * SEG);
    const _d = new THREE.Vector3();
    const bone = (m, a, b) => { _d.subVectors(b, a); const L = _d.length() || 1e-4; m.position.copy(a).addScaledVector(_d, 0.5); m.quaternion.setFromUnitVectors(UP, _d.divideScalar(L)); m.scale.set(1, L, 1); };
    const mkBone = (r1, r2, mat = boneMat) => { const m = new THREE.Mesh(mk(new THREE.CylinderGeometry(r2, r1, 1, 7)), mat); m.frustumCulled = false; inner.add(m); return m; };
    const ball = (r, mat, parent, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(mk(new THREE.SphereGeometry(r, 12, 9)), mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m; };
    const spike = (r, h, mat, parent, x, y, z, rx, ry, rz) => { const m = new THREE.Mesh(mk(new THREE.ConeGeometry(r, h, 6)), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m; };

    // ── head: heavy skull, brow ridges, long snout, a mouth of teeth, swept horns and cheek frills
    const head = new THREE.Group(); inner.add(head);
    ball(1, dragMat, head, 0.02, 0, 0, 0.052, 0.03, 0.034);
    const snout = new THREE.Mesh(mk(new THREE.ConeGeometry(0.024, 0.11, 12)), dragMat); snout.rotation.z = -Math.PI / 2; snout.scale.set(1, 1, 0.85); snout.position.set(0.088, -0.003, 0); head.add(snout);
    ball(0.011, dragMat, head, 0.145, 0.002, 0, 1, 0.8, 1.1);
    for (const sz of [-1, 1]) {
      ball(1, hornMat, head, 0.044, 0.02, sz * 0.021, 0.02, 0.008, 0.012).rotation.set(sz * 0.3, 0, 0.1);
      ball(0.0045, eyeMat, head, 0.045, 0.012, sz * 0.026);
      ball(0.004, boneMat, head, 0.14, 0.006, sz * 0.008);
      spike(0.0085, 0.1, hornMat, head, -0.035, 0.028, sz * 0.021, sz * 0.4, 0, 1.95);
      spike(0.006, 0.045, hornMat, head, -0.012, 0.022, sz * 0.03, sz * 0.9, 0, 1.6);
      for (let k = 0; k < 3; k++) spike(0.004, 0.03 - k * 0.006, hornMat, head, -0.02 - k * 0.012, -0.002 - k * 0.002, sz * (0.034 + k * 0.003), sz * 1.2, 0, 1.9 + k * 0.1);
      for (let k = 0; k < 7; k++) spike(0.0028, 0.016, toothMat, head, 0.045 + k * 0.014, -0.0155, sz * (0.012 - k * 0.0006), 0, 0, Math.PI);
    }
    const jaw = new THREE.Group(); jaw.position.set(0.0, -0.02, 0); head.add(jaw);
    ball(1, dragMat, jaw, 0.062, 0, 0, 0.062, 0.011, 0.021);
    for (const sz of [-1, 1]) for (let k = 0; k < 6; k++) spike(0.0026, 0.015, toothMat, jaw, 0.045 + k * 0.014, 0.012, sz * (0.013 - k * 0.0006), 0, 0, 0);
    // flames are a stream of soft puffs from the mouth
    const N = 52; const puffs = [];
    for (let i = 0; i < N; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: 0xff8a22, transparent: true, depthWrite: false, opacity: 0, fog: false, blending: i % 3 === 0 ? THREE.AdditiveBlending : THREE.NormalBlending }));
      mk(sp.material); sp.visible = false; head.add(sp); puffs.push(sp);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: 0xffb050, transparent: true, depthWrite: false, opacity: 0, fog: false, blending: THREE.AdditiveBlending })); mk(glow.material); glow.position.set(0.12, 0, 0); head.add(glow);

    // ── a crest of spines from the skull down the back to the tail
    const spikes = [];
    for (let u = 0.07; u < 0.9; u += 0.032) { const big = u < 0.3 ? 1.1 : 1; const m = new THREE.Mesh(mk(new THREE.ConeGeometry(0.0085 * big, 0.04 * big, 5)), hornMat); m.userData.u = u; inner.add(m); spikes.push(m); }
    // ── legs: a heavy thigh, a bent shin, and a taloned foot (forelegs are lighter)
    const legs = [];
    for (const sz of [-1, 1]) for (const [u, k] of [[0.35, 0.8], [0.53, 1.25]]) {
      const foot = new THREE.Group(); inner.add(foot);
      for (let c = -1; c <= 1; c++) spike(0.0055 * k, 0.032 * k, hornMat, foot, 0.014 * k, -0.01, c * 0.012 * k, 0, 0, -2.2);
      const thigh = u > 0.5 ? ball(1, dragMat, inner, 0, 0, 0, 0.034, 0.05, 0.026) : null;
      legs.push({ sz, u, k, foot, thigh, a: mkBone(0.015 * k, 0.009 * k, dragMat), b: mkBone(0.009 * k, 0.004 * k, dragMat), pa: new THREE.Vector3(), pb: new THREE.Vector3(), pc: new THREE.Vector3() });
    }
    // a spade at the tip of the tail
    const spade = new THREE.Mesh(mk(new THREE.ConeGeometry(0.02, 0.07, 4)), membMat); spade.scale.set(1, 1, 0.22); inner.add(spade);

    // ── wings: arm, forearm, a wrist claw and four long fingers; membrane is a smooth, sagging, scalloped sheet between them
    const RN = 9; const SN = 7; const SECT = 4;
    const wvec = (RN + 1) * (SN + 1);
    const wIdx = []; const wUv = new Float32Array(SECT * wvec * 2);
    for (let k = 0; k < SECT; k++) {
      for (let r = 0; r <= RN; r++) for (let s2 = 0; s2 <= SN; s2++) { const o = (k * wvec + r * (SN + 1) + s2) * 2; wUv[o] = s2 / SN; wUv[o + 1] = r / RN; }
      for (let r = 0; r < RN; r++) for (let s2 = 0; s2 < SN; s2++) { const a = k * wvec + r * (SN + 1) + s2; const b = a + SN + 1; wIdx.push(a, b, a + 1, a + 1, b, b + 1); }
    }
    const mkWing = (sg) => {
      const geo = mk(new THREE.BufferGeometry()); const arr = new Float32Array(SECT * wvec * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(wUv, 2)); geo.setIndex(wIdx);
      const mesh = new THREE.Mesh(geo, membMat); mesh.frustumCulled = false; inner.add(mesh);
      const claw = spike(0.006, 0.04, hornMat, inner, 0, 0, 0, 0, 0, 0);
      return { sg, geo, arr, pts: Array.from({ length: 12 }, () => new THREE.Vector3()), claw, arm: mkBone(0.013, 0.009), fore: mkBone(0.009, 0.006), fingers: [0, 1, 2, 3].map(() => mkBone(0.0055, 0.0016)) };
    };
    const wings = [mkWing(1), mkWing(-1)];
    const YAW = [0.6, 0.08, -0.42, -0.9]; const LEN = [0.43, 0.48, 0.42, 0.33];
    const dirv = (out, phi, yaw, len, sg) => out.set(Math.sin(yaw) * len, Math.sin(phi) * Math.cos(yaw) * len, sg * Math.cos(phi) * Math.cos(yaw) * len);
    const _v = new THREE.Vector3(); const rays = Array.from({ length: SECT + 1 }, () => new THREE.Vector3()); const rv = new THREE.Vector3();
    const beat = (x) => Math.sin(x) + 0.28 * Math.sin(2 * x + 0.6); // a strong downstroke and a quicker recovery
    const wingPose = (w, t, amp) => {
      const P = w.pts; const sg = w.sg; const w0 = 2.5;
      const sh = at(0.33);
      P[0].copy(C[sh]).addScaledVector(Upv[sh], radius(0.33) * 0.7).addScaledVector(Sd[sh], sg * 0.012);
      const fold = Math.max(0, Math.cos(t * w0 - 0.25)) * amp; // the wing draws in on the upstroke
      dirv(_v, 0.12 + amp * 0.7 * beat(t * w0), -0.25, 0.22, sg); P[1].copy(P[0]).add(_v);
      dirv(_v, 0.04 + amp * 0.55 * beat(t * w0 - 0.55), 0.12 + fold * 0.25, 0.26, sg); P[2].copy(P[1]).add(_v);
      for (let i = 0; i < 4; i++) { dirv(_v, -0.05 + amp * 0.5 * beat(t * w0 - 0.95 - 0.13 * i), YAW[i] - fold * 0.2, LEN[i] * (1 - 0.22 * fold), sg); P[3 + i].copy(P[2]).add(_v); }
      const hb = at(0.52); P[11].copy(C[hb]).addScaledVector(Sd[hb], sg * radius(0.52) * 0.8).addScaledVector(Upv[hb], -0.012);
      // the membrane: each panel runs from the wrist out between two bones; the free edge is a curve, and it sags and billows
      rays[0].subVectors(P[3], P[2]); rays[1].subVectors(P[4], P[2]); rays[2].subVectors(P[5], P[2]); rays[3].subVectors(P[6], P[2]); rays[4].subVectors(P[11], P[2]);
      const lift = Math.sin(t * w0 - 0.9) * 0.012 * amp;
      for (let k = 0; k < SECT; k++) for (let r = 0; r <= RN; r++) for (let s2 = 0; s2 <= SN; s2++) {
        const rr = r / RN; const ss = s2 / SN;
        rv.lerpVectors(rays[k], rays[k + 1], ss).multiplyScalar(rr * (1 - 0.2 * Math.sin(Math.PI * ss) * rr * rr));
        const o = (k * wvec + r * (SN + 1) + s2) * 3;
        w.arr[o] = P[2].x + rv.x; w.arr[o + 1] = P[2].y + rv.y - 0.016 * Math.sin(Math.PI * ss) * rr + lift * rr * Math.sin(Math.PI * ss); w.arr[o + 2] = P[2].z + rv.z;
      }
      bone(w.arm, P[0], P[1]); bone(w.fore, P[1], P[2]); w.fingers.forEach((f, i) => bone(f, P[2], P[3 + i]));
      w.claw.position.copy(P[2]).add(_v.set(0.02, 0.006, sg * 0.004)); w.claw.rotation.set(0, 0, -0.6);
      w.geo.attributes.position.needsUpdate = true; w.geo.computeVertexNormals();
    };

    const hv = new THREE.Vector3();
    const update = (t, burn) => {
      pose(t);
      const amp = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.35));
      inner.position.y = -beat(t * 2.5) * 0.016 * amp;
      wings.forEach((w) => wingPose(w, t, amp));
      const hi = at(0.045); hv.subVectors(C[0], C[hi]).normalize();
      head.position.copy(C[hi]); head.rotation.set(0, -Math.atan2(hv.z, hv.x), Math.atan2(hv.y, Math.hypot(hv.x, hv.z)) - 0.14 + burn * 0.3);
      jaw.rotation.z = -0.06 - burn * 0.5;
      spikes.forEach((m) => { const i = at(m.userData.u); const k = 1 - m.userData.u * 0.6; m.position.copy(C[i]).addScaledVector(Upv[i], radius(m.userData.u) * 0.93 + 0.01); m.quaternion.setFromUnitVectors(UP, Upv[i]); m.scale.setScalar(k); });
      legs.forEach((l) => {
        const i = at(l.u);
        l.pa.copy(C[i]).addScaledVector(Sd[i], l.sz * radius(l.u) * 0.75).addScaledVector(Upv[i], -radius(l.u) * 0.55);
        l.pb.copy(l.pa).add(_v.set(-0.035 * l.k, -0.055, l.sz * 0.014)); l.pc.copy(l.pb).add(_v.set(0.045 * l.k, -0.038, l.sz * 0.01));
        bone(l.a, l.pa, l.pb); bone(l.b, l.pb, l.pc); l.foot.position.copy(l.pc);
        if (l.thigh) l.thigh.position.copy(l.pa).add(_v.set(-0.012, -0.015, 0));
      });
      const te = at(0.97); _d.subVectors(C[SEG - 4], C[SEG]).normalize(); spade.position.copy(C[te]); spade.quaternion.setFromUnitVectors(UP, _d.negate());
      glow.material.opacity = burn * 0.9; glow.scale.setScalar(0.09 + burn * 0.12);
      puffs.forEach((sp, i) => {
        sp.visible = burn > 0.02;
        if (!sp.visible) return;
        const p = (t * 1.7 + i / N) % 1;
        sp.position.set(0.15 + p * 0.85, Math.sin(i * 12.9) * 0.03 * p + p * p * 0.05, Math.sin(i * 7.3) * 0.04 * p);
        const sz = 0.05 + p * 0.27; sp.scale.set(sz, sz, 1);
        sp.material.opacity = burn * Math.pow(1 - p, 0.8) * Math.min(1, p * 9) * 1.25;
        if (p < 0.4) sp.material.color.lerpColors(fireCols[0], fireCols[1], p / 0.4); else sp.material.color.lerpColors(fireCols[1], fireCols[2], (p - 0.4) / 0.6);
      });
    };
    pose(0);
    g.scale.setScalar(125);
    return { g, update, own };
  }

  const velV = new THREE.Vector3();
  const update = (dt, camPos) => {
    clock += dt;
    skyMat.uniforms.uTime.value = clock; waterMat.uniforms.uTime.value = clock;
    shaders.forEach((m) => { if (m.uniforms?.uTime) m.uniforms.uTime.value = clock; });
    if (grassMat.userData.shader) grassMat.userData.shader.uniforms.uTime.value = clock;
    sky.position.copy(camPos);
    smokeSprites.forEach((sp) => { const u = sp.userData; u.ph = (u.ph + dt * 0.05) % 1; sp.position.set(u.x + u.ph * 14 + Math.sin(u.ph * 9) * 1.5, u.y + u.ph * 34, u.z + u.ph * 4); const s = 4 + u.ph * 20; sp.scale.set(s, s, 1); sp.material.opacity = 0.32 * (1 - u.ph) * Math.min(1, u.ph * 8); });
    if (clock > nextFlock) { spawnFlock(er); nextFlock = clock + 7 + er() * 14; }
    for (let i = flocks.length - 1; i >= 0; i--) {
      const f = flocks[i];
      f.life += dt; f.a += f.dir * (f.w * 100 / f.R) * dt;
      f.g.position.set(Math.cos(f.a) * f.R, f.y + Math.sin(f.life * 0.6) * 6, Math.sin(f.a) * f.R - 20);
      f.g.rotation.y = -f.a + (f.dir > 0 ? 0 : Math.PI);
      f.birds.forEach((b) => { const u = b.userData; const flap = Math.sin(clock * 9 + u.ph); u.wl.rotation.z = flap * 0.7; u.wr.rotation.z = -flap * 0.7; b.position.y = Math.sin(clock * 2 + u.ph) * 0.5; });
      f.g.scale.setScalar(1.9);
      if (f.life > f.max) { fliers.remove(f.g); flocks.splice(i, 1); }
    }
    if (!dragon && clock > nextDragon) {
      dragon = makeDragon(); fliers.add(dragon.g);
      // each visit takes its own path: it flies in from the distance, or off into it, always off to one side of the castle
      dragonState = { t: 0, T: 26 + er() * 10, side: er() < 0.5 ? -1 : 1, d0: 1.45 + er() * 0.3, d1: 0.38 + er() * 0.45, r0: 190 + er() * 90, r1: 520 + er() * 90, y: 70 + er() * 100, rev: er() < 0.5, breathes: er() < 0.3, fireAt: 6 + er() * 12, prev: null };
    }
    if (dragon) {
      const s = dragonState; s.t += dt;
      let a; let R;
      if (s.hold) { a = s.a; R = 250; } else {
        const u0 = Math.min(1, s.t / s.T); const u = s.rev ? 1 - u0 : u0;
        a = -Math.PI / 2 + s.side * lerp(s.d0, s.d1, u); R = lerp(s.r0, s.r1, u * u);
      }
      const x = Math.cos(a) * R; const z = Math.sin(a) * R - 20; const y = s.y + Math.sin(s.t * 0.45) * 9;
      dragon.g.position.set(x, y, z);
      if (s.hold) velV.set(-Math.sin(a) * (s.side || 1), 0, Math.cos(a) * (s.side || 1)); else if (s.prev) velV.set(x - s.prev.x, 0, z - s.prev.z);
      if (velV.lengthSq() > 1e-8) s.heading = Math.atan2(-velV.z, velV.x);
      s.prev = { x, z };
      // turned a little towards the window so its wings can be seen
      dragon.g.rotation.set(-s.side * 0.14 + Math.sin(s.t * 0.5) * 0.05, (s.heading ?? 0) + s.side * 0.35, Math.cos(s.t * 0.45) * 0.07);
      const k = (s.t - s.fireAt) / 3;
      const burn = s.breathes && k > 0 && k < 1 ? Math.pow(Math.sin(Math.PI * k), 0.6) : 0;
      dragon.update(clock, burn);
      if (s.t > s.T && !s.hold) { fliers.remove(dragon.g); dragon.own.forEach((o) => o.dispose?.()); dragon = null; nextDragon = clock + 60 + er() * 140; }
    }
  };

  return {
    scene,
    update,
    sunDir,
    summon: (what) => { if (what === 'dragon') nextDragon = 0; else nextFlock = 0; },
    hold: (a, fire) => { if (dragonState) { dragonState.hold = true; dragonState.a = a; dragonState.t = 3; if (fire) { dragonState.breathes = true; dragonState.fireAt = 4; } } },
    windows: T.windows,
    sunColor: T.sun,
    dispose() { disposables.forEach((o) => o.dispose?.()); },
  };
}
