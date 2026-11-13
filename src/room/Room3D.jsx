import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildRoom, ROOM } from './world';
import { coverCanvas, toTexture } from './textures';
import { createBooks } from './books3d';
import { buildItem } from './items3d';
import { PLACE_LIMITS, SHOP_BY_KIND } from '../../shared/items';
import { spineDesign } from '../lib/spine';
import { percentOf } from '../lib/progress';
import { organizeOrder } from '../lib/series';
import { shelfSort } from '../lib/shelfOrder';
import { usePalettes } from '../lib/coverColors';

const EYE = 1.65;
const UP_EYE = ROOM.gallery + 1.65;
// everything that changes the shape or paint of the room (not the books or the brightness)
const lookKeyOf = (st) => ['wood', 'wallpaper', 'chandelier', 'chandFinish', 'shelf', 'shelfBack', 'shelfLed', 'desk', 'deskTop', 'rug', 'floor', 'chair', 'fireplace', 'fire', 'ceiling', 'time', 'shafts', 'deskLamp', 'deskGlobe', 'deskBooks', 'deskWrite', 'deskTea', 'deskPlant', 'deskClock'].map((k) => st[k]).join('|');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

// where a person can stand: the floor of the room without its furniture, and the narrow walkway of the gallery
const OBST = [[-4.2, 2.6, 0.5], [4.2, 2.6, 0.5], [-4.2, -2.2, 0.5], [4.2, -2.2, 0.5], [-1.1, -3.3, 0.6], [-0.3, -3.3, 0.6], [0.5, -3.3, 0.6], [-0.3, -4.3, 0.45], [1.9, 2.9, 0.62], [-1.9, 2.9, 0.62], [4.7, -2.5, 0.5], [-3.1, -4.4, 0.32]];
function walkable(level, x, z) {
  if (level === 'upper') {
    const inZ = z > -7.0 && z < 5.6;
    return (inZ && ((x > -5.15 && x < -4.6) || (x > 4.6 && x < 5.15))) || (z > -7.0 && z < -6.5 && x > -5.15 && x < 5.15);
  }
  if (x < -5.0 || x > 5.0 || z < -7.0 || z > 4.5) return false;
  return !OBST.some(([ox, oz, r]) => (x - ox) ** 2 + (z - oz) ** 2 < r * r);
}

export default function Room3D({ books, hiddenId, settings, onOpen, onPlace, onPlaceMany, onEnsureSeries, onScan, onFind, onCustomize, onClassic, items = [], placingId = null, onItemSave, onEditDone, immersive = false, menuOpen = false, onMenuClose, menuExtra = null }) {
  const wrap = useRef(null);
  const canvasRef = useRef(null);
  const host = useRef(null);
  const api = useRef({});
  const [hint, setHint] = useState(true);
  useEffect(() => { const t = setTimeout(() => setHint(false), 12000); return () => clearTimeout(t); }, []);
  const [hover, setHover] = useState(null);
  const [level, setLevel] = useState('lower');
  const [dragging, setDragging] = useState(false);
  const [held, setHeld] = useState(null);
  const [browsing, setBrowsing] = useState(false);
  const [note, setNote] = useState('');
  const [failed, setFailed] = useState(false);
  const [lampOn, setLampOn] = useState(true);
  const [editing, setEditing] = useState(null); // the plant or treasure being placed: { id, name }
  const [touch] = useState(() => window.matchMedia?.('(pointer: coarse)').matches);

  usePalettes(books);
  const sorted = useMemo(() => shelfSort(books), [books]);
  const latest = useRef({});
  latest.current = { books, sorted, settings, hiddenId, onOpen, onPlace, onPlaceMany, onEnsureSeries, items, onItemSave, onEditDone };

  // ───────── set up once ─────────
  useEffect(() => {
    // a fresh canvas for every mount: a canvas whose context was released cannot be reused (React's dev double mount)
    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Your library. Drag to look around, use the arrow keys or W A S D to walk, click a book to take it down.');
    host.current.appendChild(canvas);
    canvasRef.current = canvas;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch { canvas.remove(); setFailed(true); return undefined; }
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0805);
    scene.fog = new THREE.Fog(0x120a05, 14, 30);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.28;
    // the book in your hand is drawn last, over everything, so it can never sink into a shelf
    const handScene = new THREE.Scene();
    handScene.environment = scene.environment;
    handScene.environmentIntensity = 0.5;
    handScene.add(new THREE.HemisphereLight(0xfff0d8, 0x4a3020, 1.5));
    const handKey = new THREE.DirectionalLight(0xffe6c0, 2.4);
    handKey.position.set(-1, 2, 1.5);
    handScene.add(handKey);
    renderer.autoClear = false;
    const camera = new THREE.PerspectiveCamera(62, 1, 0.12, 60);
    // the landscape outside is drawn first with its own far-reaching camera, then the room is drawn over it
    const outCam = new THREE.PerspectiveCamera(62, 1, 2, 7000);
    renderer.setClearColor(0x0d0805);
    camera.rotation.order = 'YXZ';

    const S = {
      pos: new THREE.Vector3(0, EYE, 3.6), yaw: 0, pitch: 0.2, level: 'lower', keys: new Set(), joy: { x: 0, y: 0 },
      tween: null, world: null, booksLayer: null, dragId: null, hovered: null, lookKey: '', saving: new Set(), ghost: null,
    };
    api.current.S = S;
    if (import.meta.env.DEV) window.__room = { S, THREE, camera };

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const size = () => {
      const w = wrap.current.clientWidth;
      const h = wrap.current.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = camera.aspect < 0.9 ? 74 : 62;
      camera.updateProjectionMatrix();
      outCam.aspect = camera.aspect; outCam.fov = camera.fov; outCam.updateProjectionMatrix();
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(wrap.current);

    // ───────── world and books ─────────
    const buildAll = () => {
      if (S.world) { scene.remove(S.world.root); scene.remove(S.booksLayer.group); S.booksLayer.dispose(); S.world.dispose(); }
      const { settings: st } = latest.current;
      const tBuild = performance.now();
      S.world = buildRoom(st);
      if (import.meta.env.DEV) console.info(`[room] built in ${Math.round(performance.now() - tBuild)} ms`);
      scene.background = null;
      if (coarse) S.world.root.traverse((o) => { if (o.isSpotLight) o.shadow.mapSize.set(512, 512); });
      scene.add(S.world.root);
      S.booksLayer = createBooks(S.world);
      scene.add(S.booksLayer.group);
      S.booksLayer.setStocked(st.fill !== 'mine');
      S.lookKey = lookKeyOf(st);
      S.sig = '';
      syncBooks(true);
    };
    const entriesOf = (ids) => {
      const byId = new Map(latest.current.sorted.map((b) => [b.id, b]));
      return ids.map((id) => byId.get(id)).filter(Boolean).map((b) => ({ book: b, design: spineDesign(b), pct: b.status === 'reading' && b.pages ? percentOf(b) : null }));
    };
    const syncBooks = (force) => {
      if (!S.booksLayer) return;
      const base = latest.current.sorted;
      const entries = base.map((b) => ({ book: b, design: spineDesign(b), pct: b.status === 'reading' && b.pages ? percentOf(b) : null }));
      const sig = entries.map((e) => `${e.book.id}:${e.design.bg}:${e.pct}:${e.book.status}:${e.design.photo || ''}:${e.design.width}x${e.design.height}:${e.book.place ? `${e.book.place.run}@${e.book.place.x}` : '-'}`).join('|');
      if (!force && sig === S.sig) return;
      S.sig = sig;
      const { auto } = S.booksLayer.setBooks(entries);
      // books that had no place get one now, and keep it
      entries.forEach((e) => { if (e.book.place) S.saving.delete(e.book.id); });
      const fresh = auto.filter((a2) => !S.saving.has(a2.id));
      if (fresh.length) { fresh.forEach((a2) => S.saving.add(a2.id)); latest.current.onPlaceMany?.(fresh); }
    };
    api.current.sync = () => {
      const st = latest.current.settings;
      if (S.world && S.lookKey !== lookKeyOf(st)) buildAll();
      else { syncBooks(false); S.world?.setLevel(st.light); S.booksLayer?.setStocked(st.fill !== 'mine'); }
      const hid = latest.current.hiddenId;
      S.booksLayer?.meshes().forEach((m) => { m.userData.hide = m.userData.book.id === hid; m.visible = !!m.userData.home && !m.userData.hide && !m.userData.held; });
      if (S.held && !S.booksLayer.meshOf(S.held.book.id)) { S.held.src = { userData: {}, visible: false }; S.held.mode = 'out'; S.held.t = 1; S.held.from = { pos: S.held.model.position.clone(), q: S.held.model.quaternion.clone(), s: 1 }; S.held.to = S.held.from; }
    };
    buildAll();

    // ───────── movement ─────────
    const lookAt = (target, from) => {
      const d = target.clone().sub(from);
      return { yaw: Math.atan2(-d.x, -d.z), pitch: clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -1.2, 1.2) };
    };
    const eyeOf = (lvl) => (lvl === 'upper' ? UP_EYE : EYE);
    const glide = (to, dur = 1.1, then, opts = {}) => {
      if (S.tween?.lock && !opts.force) return;
      S.tween = { from: { x: S.pos.x, y: S.pos.y, z: S.pos.z, yaw: S.yaw, pitch: S.pitch }, to, t: 0, dur, then, lock: !!opts.lock };
    };
    // the nearest place a person could stand
    const snapTo = (lvl, x, z) => {
      if (walkable(lvl, x, z)) return [x, z];
      for (let rr = 0.15; rr < 3; rr += 0.15) for (let k = 0; k < 16; k++) { const a2 = (k / 16) * 6.2832; const nx = x + Math.cos(a2) * rr; const nz = z + Math.sin(a2) * rr; if (walkable(lvl, nx, nz)) return [nx, nz]; }
      return [x, z];
    };
    // after a glide was interrupted (or a browse view was left): back onto the floor of the level you are on
    const settle = () => {
      if (S.tween?.lock) return;
      const [x, z] = snapTo(S.level, S.pos.x, S.pos.z);
      const y = eyeOf(S.level);
      if (Math.abs(x - S.pos.x) + Math.abs(z - S.pos.z) > 0.01 || Math.abs(y - S.pos.y) > 0.03) glide({ x, y, z, yaw: S.yaw, pitch: S.pitch * 0.5 }, 0.5);
    };
    const exitBrowse = () => { if (S.browse) { S.browse = null; setBrowsing(false); settle(); } };
    /** Stop a glide because the person wants to move. False while the camera is on the ladder or stairs, where nobody may walk. */
    const cancelTween = () => {
      if (S.tween?.lock) return false;
      if (S.tween) { S.tween = null; settle(); }
      return true;
    };
    api.current.cancel = () => { if (cancelTween()) exitBrowse(); return !S.tween?.lock; };
    const standIn = (point, nrm, dist = 1.75) => {
      const lvl = S.level;
      let p = point.clone().addScaledVector(nrm, dist);
      p.y = eyeOf(lvl);
      for (const d of [dist, dist - 0.4, dist + 0.5, dist - 0.8]) {
        p = point.clone().addScaledVector(nrm, d); p.y = eyeOf(lvl);
        if (walkable(lvl, p.x, p.z)) break;
      }
      const look = lookAt(point, p);
      glide({ x: p.x, y: p.y, z: p.z, yaw: look.yaw, pitch: look.pitch * 0.9 }, 1.0);
    };
    const climb = (up) => {
      const to = up ? { x: -5.0, y: UP_EYE, z: -4.4, yaw: -Math.PI / 2, pitch: 0.05 } : { x: -2.4, y: EYE, z: -4.4, yaw: -Math.PI / 2, pitch: 0.05 };
      exitBrowse();
      glide(to, up ? 2.2 : 2.0, () => { S.level = up ? 'upper' : 'lower'; setLevel(up ? 'upper' : 'lower'); }, { lock: true, force: true });
    };

    // ───────── browsing the shelves: a straight-on view of one shelf, with arrows to step along, up and down ─────────
    const runCenter = (run) => run.p0.clone().addScaledVector(run.dir, run.len / 2).add(new THREE.Vector3(0, run.clear * 0.5, 0));
    const browseTo = (ri, dur = 1.1) => {
      const run = S.world.runs[ri];
      if (!run) return;
      const c = runCenter(run);
      const hf = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect);
      const d = Math.min(Math.max(0.82, 0.55 / Math.tan(hf / 2)), run.upper ? 1.12 : 2.2);
      const p = c.clone().addScaledVector(run.nrm, d);
      p.y = Math.max(1.15, c.y);
      const upper = !!run.upper;
      const crossing = (S.level === 'upper') !== upper;
      S.browse = { ri };
      setBrowsing(true);
      S.holdMove = false;
      glide({ x: p.x, y: p.y, z: p.z, yaw: Math.atan2(run.nrm.x, run.nrm.z), pitch: 0 }, crossing ? 2.2 : dur, crossing ? () => { S.level = upper ? 'upper' : 'lower'; setLevel(S.level); } : null, crossing ? { lock: true, force: true } : {});
    };
    const neighbour = (ri, dir) => {
      const runs = S.world.runs;
      const r = runs[ri];
      const cr = runCenter(r);
      let best = -1; let bestScore = 1e9;
      runs.forEach((o, i) => {
        if (i === ri || o.upper !== r.upper || o.nrm.distanceTo(r.nrm) > 0.01) return;
        const v = runCenter(o).sub(cr);
        if (Math.abs(v.dot(r.nrm)) > 0.35) return;
        const along = v.dot(r.dir);
        let score = 1e9;
        if (dir === 'right' && along > 0.05 && Math.abs(v.y) < 0.1) score = along;
        if (dir === 'left' && along < -0.05 && Math.abs(v.y) < 0.1) score = -along;
        if (dir === 'up' && v.y > 0.1 && Math.abs(along) < 0.7) score = v.y + Math.abs(along);
        if (dir === 'down' && v.y < -0.1 && Math.abs(along) < 0.7) score = -v.y + Math.abs(along);
        if (score < bestScore) { bestScore = score; best = i; }
      });
      return best;
    };
    const flash = (msg) => { setNote(msg); clearTimeout(flash.t); flash.t = setTimeout(() => setNote(''), 2200); };
    // arrange every book on the shelves by author, with each series together and in volume order
    api.current.organize = async () => {
      flash('Looking up your series…');
      try { await latest.current.onEnsureSeries?.(); } catch { /* arrange with what is known */ }
      await new Promise((r) => setTimeout(r, 150));
      const { ordered, seriesCount } = organizeOrder(latest.current.sorted);
      const places = S.booksLayer.arrange(ordered);
      if (places.length) latest.current.onPlaceMany?.(places);
      flash(seriesCount ? `Arranged by series, in release order (${seriesCount} ${seriesCount === 1 ? 'series' : 'series'}). The rest follow, by author.` : 'No series found in your books yet. Arranged by author instead.');
    };
    api.current.nav = (dir) => {
      if (!S.browse || S.tween?.lock) return;
      const n = neighbour(S.browse.ri, dir);
      if (n >= 0) browseTo(n, 0.6); else flash(dir === 'up' ? 'That is the top shelf.' : dir === 'down' ? 'That is the bottom shelf.' : 'That is the end of the case.');
    };
    api.current.exitBrowse = exitBrowse;

    api.current.go = (where) => {
      if (S.tween?.lock) return;
      if (where !== 'mine' && where !== 'upper') exitBrowse();
      if (S.level === 'upper' && ['entrance', 'desk', 'fire'].includes(where)) { S.level = 'lower'; setLevel('lower'); }
      if (where === 'entrance') glide({ x: 0, y: EYE, z: 3.6, yaw: 0, pitch: 0.2 }, 1.4);
      if (where === 'desk') glide({ x: -0.3, y: EYE, z: -0.9, yaw: 0, pitch: -0.2 }, 1.2);
      if (where === 'fire') glide({ x: 0, y: EYE, z: 1.3, yaw: Math.PI, pitch: 0.02 }, 1.5);
      if (where === 'mine') {
        const m = S.booksLayer.meshes().find((x) => x.userData.home);
        const ri = m ? m.userData.run : S.world.runs.findIndex((r) => !r.upper && r.tag === 'BR' && r.row === 4 && r.col === 0);
        browseTo(ri);
      }
      if (where === 'upper') browseTo(S.world.runs.findIndex((r) => r.tag === 'uBR' && r.row === 3 && r.col === 0));
      if (where === 'gallery') climb(S.level !== 'upper');
    };
    api.current.climb = climb;

    // ───────── picking ─────────
    const setRay = (e) => {
      const r = canvasRef.current.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
      ray.setFromCamera(ndc, camera);
    };
    const lampShades = () => {
      const out = [];
      S.world.root.traverse((o) => { if (o.userData?.kind === 'lamp') out.push(o); });
      return out;
    };
    const hits = (e, only) => {
      setRay(e);
      const list = only || [...S.booksLayer.meshes().filter((m) => m.visible), S.world.pick.globe.ball, ...lampShades(), ...S.world.pick.ladder, ...S.world.pick.cases, ...S.world.pick.chandelier, S.world.pick.fire, S.world.pick.floor, S.world.pick.rug].filter(Boolean);
      return ray.intersectObjects(list, true).filter((h) => h.object.visible);
    };
    const kindOf = (o) => { for (let n = o; n; n = n.parent) if (n.userData?.kind) return { kind: n.userData.kind, obj: n, nrm: n.userData.nrm }; return {}; };
    const screenRect = (mesh) => {
      const box = new THREE.Box3().setFromObject(mesh);
      const r = canvasRef.current.getBoundingClientRect();
      let x0 = 1e9; let y0 = 1e9; let x1 = -1e9; let y1 = -1e9;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const v = new THREE.Vector3(x, y, z).project(camera);
        const sx = r.left + ((v.x + 1) / 2) * r.width; const sy = r.top + ((1 - v.y) / 2) * r.height;
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      }
      return { left: x0, top: y0, width: x1 - x0, height: y1 - y0, right: x1, bottom: y1 };
    };

    // ───────── holding a book ─────────
    const HAND = new THREE.Vector3(0.17, -0.1, -0.5);
    const HAND_S = 0.8;
    const HAND_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, -Math.PI / 2 - 0.3, 0.06, 'YXZ'));
    const pickUp = (mesh) => {
      if (S.held) return;
      const u = mesh.userData;
      const book = u.book;
      const design = spineDesign(book);
      const front = new THREE.MeshStandardMaterial({ map: toTexture(coverCanvas(book, design)), roughness: 0.55 });
      const back = new THREE.MeshStandardMaterial({ color: new THREE.Color(design.bg).multiplyScalar(0.7), roughness: 0.6 });
      const pages = new THREE.MeshStandardMaterial({ color: 0xe6dbc2, roughness: 0.95 });
      const hd = Math.min(0.22, u.h * 0.68);
      const model = new THREE.Mesh(new THREE.BoxGeometry(Math.max(u.w * 1.3, 0.04), u.h, hd), [front, back, pages, pages, mesh.material[4], pages]);
      model.position.copy(mesh.position);
      model.quaternion.copy(mesh.quaternion);
      handScene.add(model);
      // the real cover, when the picture will load into the 3D view; otherwise the generated one stays
      if (book.coverUrl) new THREE.TextureLoader().setCrossOrigin('anonymous').load(book.coverUrl, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; front.map?.dispose(); front.map = t; front.needsUpdate = true; }, undefined, () => {});
      u.held = true;
      mesh.visible = false;
      S.held = { book, src: mesh, model, mode: 'in', t: 0, from: { pos: mesh.position.clone(), q: mesh.quaternion.clone(), s: 1 }, mats: [front, back, pages] };
      setHeld({ book });
      setHint(false);
      navigator.vibrate?.(10);
    };
    const finishHeld = () => {
      const H = S.held;
      if (!H) return;
      handScene.remove(H.model);
      H.model.geometry.dispose();
      H.mats.forEach((m) => { m.map?.dispose(); m.dispose(); });
      H.src.userData.held = false;
      if (H.slot) {
        S.booksLayer.commit(H.book.id, H.slot);
        H.src.position.copy(H.src.userData.home);
        H.src.rotation.y = H.src.userData.yaw;
        latest.current.onPlace?.(H.book.id, { run: H.slot.key, x: Math.round(H.slot.x * 1000) / 1000 });
      }
      H.src.visible = !!H.src.userData.home && !H.src.userData.hide;
      S.held = null;
      setHeld(null);
    };
    const releaseHeld = (slot) => {
      const H = S.held;
      if (!H || H.mode === 'out') return;
      const u = H.src.userData;
      const to = slot ? { pos: slot.pos, yaw: slot.yaw } : { pos: u.home, yaw: u.yaw };
      H.mode = 'out'; H.t = 0; H.slot = slot;
      H.from = { pos: H.model.position.clone(), q: H.model.quaternion.clone(), s: H.model.scale.x };
      H.to = { pos: to.pos.clone(), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, to.yaw, 0)), s: 1 };
    };
    api.current.putBack = () => releaseHeld(null);
    api.current.openHeld = () => {
      const H = S.held;
      if (H && H.mode === 'hold') latest.current.onOpen(H.book, screenRect(H.model), 'spine');
    };
    const tmpV = new THREE.Vector3();
    const tmpQ = new THREE.Quaternion();
    const updateHeld = (dt, t) => {
      const H = S.held;
      if (!H) return;
      const m = H.model;
      if (H.mode === 'out') {
        H.t += dt / 0.5;
        const k = ease(Math.min(1, H.t));
        m.position.lerpVectors(H.from.pos, H.to.pos, k);
        m.position.y += Math.sin(Math.PI * k) * 0.06;
        m.quaternion.slerpQuaternions(H.from.q, H.to.q, k);
        m.scale.setScalar(H.from.s + (1 - H.from.s) * k);
        if (H.t >= 1) finishHeld();
        return;
      }
      camera.updateMatrixWorld();
      // keep the book inside the picture on a narrow phone screen too
      const halfW = Math.abs(HAND.z) * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect;
      tmpV.set(Math.min(0.17, halfW * 0.3), camera.aspect < 0.9 ? 0.03 : HAND.y, HAND.z);
      tmpV.y += Math.sin(t * 7) * 0.006 * (S.moving || 0);
      tmpV.applyMatrix4(camera.matrixWorld);
      tmpQ.copy(camera.quaternion).multiply(HAND_Q);
      if (H.mode === 'in') {
        H.t += dt / 0.65;
        const k = ease(Math.min(1, H.t));
        m.position.lerpVectors(H.from.pos, tmpV, k);
        m.position.y += Math.sin(Math.PI * k) * 0.08;
        m.quaternion.slerpQuaternions(H.from.q, tmpQ, k);
        m.scale.setScalar(H.from.s + (HAND_S - H.from.s) * k);
        if (H.t >= 1) H.mode = 'hold';
      } else { m.position.copy(tmpV); m.quaternion.copy(tmpQ); m.scale.setScalar(HAND_S); }
    };
    const shelfHit = (hs) => hs.find((h) => ['case', 'book'].includes(kindOf(h.object).kind));
    const slotFromHit = (h) => {
      const H = S.held;
      return S.booksLayer.findSlot(h.point, H.src.userData.w, H.src.userData.h, H.book.id);
    };

    // ───────── plants and decor the reader has bought, standing wherever they chose ─────────
    const itemsGroup = new THREE.Group();
    scene.add(itemsGroup);
    const itemModels = new Map();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.visible = false; ring.renderOrder = 6; scene.add(ring);
    const applyPlaced = (m, pl) => { m.position.set(pl.x, pl.y, pl.z); m.rotation.y = pl.ry; m.scale.setScalar(pl.s); };
    const dropModel = (m) => { itemsGroup.remove(m); m.traverse((o) => { o.geometry?.dispose?.(); }); };
    const syncRing = () => {
      const E = S.edit; const m = E && itemModels.get(E.id);
      ring.visible = !!m;
      if (m) { const r = (m.userData.radius || 0.15) * E.placed.s + 0.07; ring.scale.set(r, r, r); ring.position.set(E.placed.x, E.placed.y + 0.012, E.placed.z); }
    };
    api.current.syncItems = () => {
      const list = latest.current.items || [];
      const live = new Set();
      for (const it of list) {
        const pl = S.edit && S.edit.id === it.id ? S.edit.placed : it.placed;
        if (!pl) continue;
        live.add(it.id);
        let m = itemModels.get(it.id);
        if (!m) { m = buildItem(it.kind); m.userData.itemId = it.id; itemsGroup.add(m); itemModels.set(it.id, m); }
        applyPlaced(m, pl);
      }
      for (const [id, m] of [...itemModels]) if (!live.has(id)) { dropModel(m); itemModels.delete(id); }
      syncRing();
    };
    // the first surface under the pointer that something can stand on: floors, rugs, desk tops, shelves, the mantel, the gallery
    const surfaceHit = (e) => {
      setRay(e);
      const n = new THREE.Vector3();
      for (const h of ray.intersectObject(S.world.root, true)) {
        const o = h.object;
        if (!o.visible || o.isSprite || o.isPoints || o.isLine || o.userData?.noPick || o.material?.depthWrite === false || !h.face) continue;
        n.copy(h.face.normal).transformDirection(o.matrixWorld);
        if (n.y < 0.6) { if (o.material?.transparent) continue; return null; } // something in the way that is not a surface
        const L = PLACE_LIMITS;
        if (Math.abs(h.point.x) > L.x || Math.abs(h.point.z) > L.z) return null;
        return h.point.clone();
      }
      return null;
    };
    const itemAt = (e) => {
      setRay(e);
      const h = ray.intersectObjects(itemsGroup.children, true).find((x) => !x.object.isSprite && !x.object.userData?.noPick);
      if (!h) return null;
      let m = h.object; while (m && m.userData.itemId === undefined) m = m.parent;
      return m ? { id: m.userData.itemId, distance: h.distance } : null;
    };
    const saveEdit = () => { const E = S.edit; if (E) latest.current.onItemSave?.(E.id, { ...E.placed }); };
    const startEdit = (id) => {
      const it = (latest.current.items || []).find((i) => i.id === id);
      if (!it) return;
      const def = SHOP_BY_KIND[it.kind];
      cancelTween(); exitBrowse(); setHint(false);
      let pl = it.placed;
      if (!pl) {
        // a new arrival is set down in front of you
        const f = new THREE.Vector3(-Math.sin(S.yaw), 0, -Math.cos(S.yaw));
        const aim = { clientX: canvasRef.current.getBoundingClientRect().left + canvasRef.current.clientWidth / 2, clientY: canvasRef.current.getBoundingClientRect().top + canvasRef.current.clientHeight * 0.72 };
        const p = surfaceHit(aim) || new THREE.Vector3(S.pos.x + f.x * 1.8, S.level === 'upper' ? ROOM.gallery : 0, S.pos.z + f.z * 1.8);
        pl = { x: p.x, y: p.y, z: p.z, ry: S.yaw, s: 1 };
      }
      S.edit = { id, placed: { ...pl } };
      setEditing({ id, name: def?.name || 'Item' });
      api.current.syncItems();
      if (!it.placed) saveEdit();
    };
    api.current.editItem = startEdit;
    const stopEdit = () => { S.edit = null; setEditing(null); syncRing(); latest.current.onEditDone?.(); };
    api.current.editRotate = (d) => { const E = S.edit; if (!E) return; E.placed.ry += d * (Math.PI / 8); api.current.syncItems(); saveEdit(); };
    api.current.editScale = (d) => { const E = S.edit; if (!E) return; E.placed.s = clamp(Math.round((E.placed.s + d * 0.15) * 100) / 100, PLACE_LIMITS.sLo, PLACE_LIMITS.sHi); api.current.syncItems(); saveEdit(); };
    api.current.editDone = stopEdit;
    api.current.editAway = () => { const E = S.edit; if (!E) return; const id = E.id; S.edit = null; setEditing(null); latest.current.onItemSave?.(id, null); latest.current.onEditDone?.(); };
    // a tap while placing moves the item there; a tap on another item switches to it
    const editTap = (e) => {
      const it = itemAt(e);
      if (it && it.id !== S.edit.id) { startEdit(it.id); return; }
      const p = surfaceHit(e);
      if (!p) return;
      Object.assign(S.edit.placed, { x: p.x, y: p.y, z: p.z });
      api.current.syncItems(); saveEdit();
    };

    const act = (e) => {
      if (S.edit) { editTap(e); return; }
      if (!S.held) {
        const it = itemAt(e);
        if (it) { const first = hits(e)[0]; if (!first || it.distance < first.distance) { startEdit(it.id); return; } }
      }
      // the book in your hand comes first: tap it to open it
      if (S.held && S.held.mode === 'hold') {
        setRay(e);
        if (ray.intersectObject(S.held.model, false).length) { api.current.openHeld(); return; }
      }
      const hs = hits(e);
      if (!hs.length) return;
      // holding a book: tapping a shelf puts it down there
      if (S.held) {
        const sh = shelfHit(hs);
        if (sh && S.held.mode !== 'out') {
          const slot = slotFromHit(sh);
          if (slot) releaseHeld(slot); else flash('There is no room for it there.');
          return;
        }
      }
      const h = hs[0];
      const { kind, obj } = kindOf(h.object);
      const dist = camera.position.distanceTo(h.point);
      if (kind === 'book') {
        if (dist > 2.7 && !S.held) { browseTo(obj.userData.run); return; }
        if (!S.held) pickUp(obj);
      } else if (kind === 'globe') { S.world.spinGlobe(); if (dist > 4) glide({ x: -0.3, y: EYE, z: -1.0, yaw: Math.atan2(0.0, 1), pitch: -0.25 }, 1.2); }
      else if (kind === 'lamp') { S.world.toggleLamp(obj.userData.lampIndex); setLampOn(S.world.pick.lamps.some((l) => l.on)); }
      else if (kind === 'ladder') climb(S.level !== 'upper');
      else if (kind === 'chandelier') S.world.toggleChandelier();
      else if (kind === 'fire') { if (dist > 5.5) glide({ x: 0, y: EYE, z: 1.2, yaw: Math.PI, pitch: -0.05 }, 1.3); else S.world.toggleFire(); }
      else if (kind === 'case') {
        const slot = S.booksLayer.findSlot(h.point, 0.03, 0.1, null);
        if (slot && !(S.browse && S.browse.ri === slot.ri)) browseTo(slot.ri); else if (!slot && dist > 2.6) standIn(h.point, obj.userData.nrm, 1.7);
      } else if (h.object === S.world.pick.floor || h.object === S.world.pick.rug) {
        if (S.tween?.lock) return;
        exitBrowse();
        if (S.level === 'lower' && walkable('lower', h.point.x, h.point.z)) {
          const d = new THREE.Vector3(h.point.x - S.pos.x, 0, h.point.z - S.pos.z);
          glide({ x: h.point.x, y: EYE, z: h.point.z, yaw: S.yaw, pitch: S.pitch }, clamp(d.length() / 3.2, 0.5, 2));
        }
      }
    };

    // ───────── pointer input ─────────
    let press = null;
    const el = canvasRef.current;
    const setHovered = (mesh) => {
      if (S.hovered === mesh) return;
      if (S.hovered?.material?.[4]) S.hovered.material[4].emissive.setHex(0x000000);
      S.hovered = mesh;
      if (mesh?.material?.[4]) mesh.material[4].emissive.setHex(0x5a3a14);
      setHover(mesh ? { book: mesh.userData.book } : null);
    };
    const onDown = (e) => {
      if (e.button > 0) return;
      try { el.setPointerCapture(e.pointerId); } catch { /* synthetic or ended pointer */ }
      setHint(false);
      const first = hits(e)[0];
      const bk = first && first.object.userData.kind === 'book' && !S.held ? first : null;
      press = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, mode: null, type: e.pointerType, book: bk ? bk.object : null, timer: null };
      if (press.book && e.pointerType !== 'mouse') {
        press.timer = setTimeout(() => { if (press && !press.mode) { startDrag(); dragTo({ clientX: press.x, clientY: press.y }, press.type); } }, 380);
      }
    };
    const TOUCH_LIFT = 70; // a finger covers the book it holds, so the book is carried above the fingertip
    const startDrag = () => {
      press.mode = 'drag';
      const mesh = press.book;
      S.dragId = mesh.userData.book.id;
      mesh.userData.pull = 0;
      S.drag = { slot: null, mesh };
      if (!S.ghost) {
        S.ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.38, depthWrite: false }));
        S.ghost.renderOrder = 5;
        scene.add(S.ghost);
      }
      S.ghost.scale.set(mesh.userData.w, mesh.userData.h, 0.24);
      S.ghost.visible = false;
      setDragging(true);
      navigator.vibrate?.(14);
    };
    const dragTo = (e, type) => {
      const mesh = press.book;
      const aim = { clientX: e.clientX, clientY: type === 'mouse' ? e.clientY : e.clientY - TOUCH_LIFT };
      const hs = hits(aim, [...S.booksLayer.meshes().filter((m) => m.visible && m !== mesh), ...S.world.pick.cases]);
      const h = hs[0];
      if (!h) { S.drag.slot = null; S.ghost.visible = false; return; }
      const k = kindOf(h.object);
      const n = k.nrm || (k.kind === 'book' ? k.obj.userData.nrm : h.object.userData.nrm) || new THREE.Vector3(0, 0, 1);
      const slot = S.booksLayer.findSlot(h.point, mesh.userData.w, mesh.userData.h, S.dragId);
      S.drag.slot = slot;
      if (slot) {
        S.ghost.visible = true;
        S.ghost.position.copy(slot.pos);
        S.ghost.rotation.y = slot.yaw;
      } else S.ghost.visible = false;
      const target = slot ? slot.pos.clone().addScaledVector(slot.nrm, 0.14).add(new THREE.Vector3(0, 0.03, 0)) : h.point.clone().addScaledVector(n, 0.3);
      mesh.position.lerp(target, 0.55);
      mesh.rotation.y += (Math.atan2(n.x, n.z) - mesh.rotation.y) * 0.4;
      // the edge of the view turns the head, so a book can be carried to a shelf that is out of sight
      const r = el.getBoundingClientRect();
      const edge = (e.clientX - r.left) / r.width;
      S.yaw -= edge < 0.1 ? -0.022 : edge > 0.9 ? 0.022 : 0;
    };
    const onMove = (e) => {
      if (!press) {
        if (e.pointerType === 'mouse') {
          const h = hits(e)[0];
          const k = h && kindOf(h.object);
          setHovered(k?.kind === 'book' ? k.obj : null);
          el.style.cursor = k && ['book', 'globe', 'lamp', 'ladder', 'chandelier', 'fire'].includes(k.kind) ? 'pointer' : k?.kind === 'case' || h?.object === S.world.pick.floor ? 'zoom-in' : 'grab';
        }
        return;
      }
      const dx = e.clientX - press.x; const dy = e.clientY - press.y;
      if (!press.mode) {
        const moved = Math.hypot(dx, dy);
        if (press.type === 'mouse' && press.book && moved > 9) startDrag();
        else if (moved > (press.type === 'mouse' ? 5 : 10)) { press.mode = 'look'; clearTimeout(press.timer); cancelTween(); }
      }
      if (press.mode === 'look') {
        S.yaw -= (e.clientX - press.lx) * 0.0042;
        S.pitch = clamp(S.pitch - (e.clientY - press.ly) * 0.0036, -1.2, 1.2);
      } else if (press.mode === 'drag') dragTo(e, press.type);
      press.lx = e.clientX; press.ly = e.clientY;
    };
    const onUp = (e) => {
      if (!press) return;
      clearTimeout(press.timer);
      const p = press;
      press = null;
      try { el.releasePointerCapture(e.pointerId); } catch { /* released */ }
      if (p.mode === 'drag') {
        const slot = S.drag?.slot;
        const id = S.dragId;
        S.dragId = null;
        S.drag = null;
        if (S.ghost) S.ghost.visible = false;
        setDragging(false);
        if (slot) {
          S.booksLayer.commit(id, slot);
          latest.current.onPlace?.(id, { run: slot.key, x: Math.round(slot.x * 1000) / 1000 });
        }
      } else if (!p.mode) act(e);
    };
    const onWheel = (e) => {
      e.preventDefault();
      if (!api.current.cancel()) return;
      const f = new THREE.Vector3(-Math.sin(S.yaw), 0, -Math.cos(S.yaw));
      const step = clamp(-e.deltaY * 0.0036, -0.7, 0.7);
      const nx = S.pos.x + f.x * step; const nz = S.pos.z + f.z * step;
      if (walkable(S.level, nx, nz)) { S.pos.x = nx; S.pos.z = nz; }
      setHint(false);
    };
    const onKey = (e, down) => {
      if (/input|textarea|select/i.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', 'q', 'e'].includes(k)) {
        // while looking along a shelf the arrows step between shelves; W A S D walk away
        if (down && S.browse && k.startsWith('arrow')) { if (!e.repeat) api.current.nav(k.slice(5)); e.preventDefault(); return; }
        if (down) { if (k !== 'shift' && !api.current.cancel()) return; S.keys.add(k); setHint(false); } else S.keys.delete(k);
        if (k.startsWith('arrow') && wrap.current.contains(document.activeElement)) e.preventDefault();
      }
    };
    const kd = (e) => onKey(e, true); const ku = (e) => onKey(e, false);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    const lost = (e) => { e.preventDefault(); setFailed(true); };
    el.addEventListener('webglcontextlost', lost);

    // ───────── the loop ─────────
    const clock = new THREE.Clock();
    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0.01 });
    io.observe(wrap.current);
    const fwd = new THREE.Vector3();
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) { clock.getDelta(); return; }
      const dt = Math.min(clock.getDelta(), 0.05);
      if (S.tween) {
        const tw = S.tween;
        tw.t += dt / tw.dur;
        const k = ease(Math.min(1, tw.t));
        S.pos.x = tw.from.x + (tw.to.x - tw.from.x) * k;
        S.pos.z = tw.from.z + (tw.to.z - tw.from.z) * k;
        S.pos.y = tw.from.y + (tw.to.y - tw.from.y) * k;
        S.yaw = tw.from.yaw + angDiff(tw.from.yaw, tw.to.yaw) * k;
        S.pitch = tw.from.pitch + (tw.to.pitch - tw.from.pitch) * k;
        if (tw.t >= 1) { const then = tw.then; S.tween = null; then?.(); }
      } else {
        const kx = (S.keys.has('d') || S.keys.has('arrowright') ? 1 : 0) - (S.keys.has('a') || S.keys.has('arrowleft') ? 1 : 0);
        const kz = (S.keys.has('w') || S.keys.has('arrowup') ? 1 : 0) - (S.keys.has('s') || S.keys.has('arrowdown') ? 1 : 0);
        const sx = kx + S.joy.x; const sz = kz - S.joy.y;
        S.moving = sx || sz ? 1 : 0;
        if (S.keys.has('q')) S.yaw += dt * 1.6;
        if (S.keys.has('e')) S.yaw -= dt * 1.6;
        if (sx || sz) {
          const sp = (S.keys.has('shift') ? 4.2 : 2.3) * dt;
          const m = Math.hypot(sx, sz) || 1;
          fwd.set(-Math.sin(S.yaw), 0, -Math.cos(S.yaw));
          const rx = new THREE.Vector3(-fwd.z * -1, 0, fwd.x * -1).set(Math.cos(S.yaw), 0, -Math.sin(S.yaw));
          const mx = ((fwd.x * sz + rx.x * sx) / m) * sp; const mz = ((fwd.z * sz + rx.z * sx) / m) * sp;
          if (walkable(S.level, S.pos.x + mx, S.pos.z + mz)) { S.pos.x += mx; S.pos.z += mz; }
          else if (walkable(S.level, S.pos.x + mx, S.pos.z)) S.pos.x += mx;
          else if (walkable(S.level, S.pos.x, S.pos.z + mz)) S.pos.z += mz;
        }
      }
      camera.position.copy(S.pos);
      camera.rotation.set(S.pitch, S.yaw, 0);
      S.world.update(dt);
      itemModels.forEach((m) => m.userData.update?.(clock.elapsedTime));
      S.booksLayer.update(dt, S.dragId);
      updateHeld(dt, performance.now() / 1000);
      renderer.toneMappingExposure = S.world.exposure();
      renderer.clear();
      S.world.outside.update(dt, camera.position);
      outCam.position.copy(camera.position); outCam.quaternion.copy(camera.quaternion);
      renderer.render(S.world.outside.scene, outCam);
      renderer.clearDepth();
      renderer.render(scene, camera);
      if (S.held) { renderer.clearDepth(); renderer.render(handScene, camera); }
    };
    frame();
    el.dataset.ready = '1';

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect();
      el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp); el.removeEventListener('pointercancel', onUp); el.removeEventListener('wheel', onWheel);
      el.removeEventListener('webglcontextlost', lost);
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
      if (S.held) { handScene.remove(S.held.model); S.held = null; }
      itemModels.forEach(dropModel); itemModels.clear();
      S.booksLayer?.dispose(); S.world?.dispose(); pm.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
    };
  }, []);

  // books, look and the open viewer change without rebuilding the room
  useEffect(() => { api.current.sync?.(); api.current.syncItems?.(); });
  useEffect(() => { if (placingId != null) api.current.editItem?.(placingId); }, [placingId]);

  if (failed) {
    return (
      <div className="room3d room-fail">
        <p>Your browser could not start the 3D room.</p>
        <button className="btn btn-primary" onClick={onClassic}>Use the classic shelf</button>
      </div>
    );
  }

  const stop = (k) => api.current.go?.(k);
  const joy = (e, on) => {
    const S = api.current.S;
    if (!S) return;
    if (!on) { S.joy.x = 0; S.joy.y = 0; e.currentTarget.style.setProperty('--jx', '0px'); e.currentTarget.style.setProperty('--jy', '0px'); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const dx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1);
    const dy = clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2), -1, 1);
    if (Math.hypot(dx, dy) > 0.2 && !api.current.cancel()) { S.joy.x = 0; S.joy.y = 0; return; }
    S.joy.x = dx; S.joy.y = dy;
    e.currentTarget.style.setProperty('--jx', `${dx * 26}px`);
    e.currentTarget.style.setProperty('--jy', `${dy * 26}px`);
  };

  return (
    <section className={`room3d ${dragging ? 'dragging' : ''}`} ref={wrap} aria-label="Your library, in 3D">
      <div className="r-canvas" ref={host} />
      {!immersive && (
        <div className="r-top">
          <button className="chip-toggle" onClick={() => api.current.organize()}>Organize</button>
          <button className="chip-toggle" onClick={() => api.current.S.world.toggleChandelier()}>Chandelier</button>
          <button className="chip-toggle customize" onClick={onCustomize}>Customize</button>
          <button className="chip-toggle" onClick={onClassic}>Classic view</button>
        </div>
      )}
      {immersive && menuOpen && (
        <>
          <div className="r-scrim" onClick={onMenuClose} />
          <aside className="r-drawer" aria-label="Library menu">
            <h4>The room</h4>
            <div className="rd-grid">
              <button onClick={() => { onMenuClose(); api.current.organize(); }}>Organize</button>
              <button onClick={() => { onMenuClose(); api.current.S.world.toggleChandelier(); }}>Chandelier</button>
              <button onClick={() => { onMenuClose(); onCustomize(); }}>Customize</button>
              <button onClick={() => { onMenuClose(); onClassic(); }}>Classic view</button>
            </div>
            <h4>Walk to</h4>
            <div className="rd-grid">
              {[['entrance', 'Entrance'], ['mine', 'My books'], ['upper', 'Top shelves'], ['desk', 'Desk'], ['fire', 'Fireplace'], ['gallery', level === 'upper' ? 'Climb down' : 'Gallery']].map(([k, label]) => (
                <button key={k} onClick={() => { onMenuClose(); stop(k); }}>{label}</button>
              ))}
            </div>
            {menuExtra}
          </aside>
        </>
      )}
      {editing && (
        <div className="r-edit" role="group" aria-label={`Placing ${editing.name}`}>
          <b>{editing.name}</b>
          <small>{touch ? 'Tap anywhere to move it' : 'Click anywhere to move it'}</small>
          <div className="re-btns">
            <button onClick={() => api.current.editRotate(-1)} aria-label="Turn left">⟲</button>
            <button onClick={() => api.current.editRotate(1)} aria-label="Turn right">⟳</button>
            <button onClick={() => api.current.editScale(-1)} aria-label="Smaller">−</button>
            <button onClick={() => api.current.editScale(1)} aria-label="Bigger">+</button>
            <button className="away" onClick={() => api.current.editAway()}>Put away</button>
            <button className="done" onClick={() => api.current.editDone()}>Done</button>
          </div>
        </div>
      )}
      {hint && !editing && (
        <div className="r-hint" role="note">
          <b>Step into the library.</b>
          <span>{touch ? 'Drag to look around · tap the floor to walk · tap a book to pick it up · tap it again to open · tap a shelf to put it down' : 'Drag to look · W A S D or arrows to walk · click a book to pick it up · tap it again to open it · tap a shelf to put it down · click the fire, globe, lamps and ladder'}</span>
        </div>
      )}
      {held && (
        <div className="r-held" role="status">
          <span>Holding <b>{held.book.title}</b><small>Tap it to open · tap a shelf to put it down</small></span>
          <button onClick={() => api.current.openHeld()}>Open</button>
          <button onClick={() => api.current.putBack()}>Put back</button>
        </div>
      )}
      {note && <div className="r-note" role="status">{note}</div>}
      {browsing && (
        <div className="r-dpad" role="group" aria-label="Move along the shelves">
          <button className="u" onClick={() => api.current.nav('up')} aria-label="Shelf above">▲</button>
          <button className="l" onClick={() => api.current.nav('left')} aria-label="Shelf to the left">◀</button>
          <button className="x" onClick={() => api.current.exitBrowse()} aria-label="Step back">✕</button>
          <button className="r" onClick={() => api.current.nav('right')} aria-label="Shelf to the right">▶</button>
          <button className="d" onClick={() => api.current.nav('down')} aria-label="Shelf below">▼</button>
        </div>
      )}
      {hover && !dragging && !held && <div className="r-tip">{hover.book.title}{hover.book.status === 'reading' && hover.book.pages ? ` · ${percentOf(hover.book)}%` : ''}</div>}
      {dragging && <div className="r-tip drag">Drop it on any shelf: the glow shows where it will stand.</div>}
      {books.filter((b) => b.status !== 'want').length === 0 && (
        <div className="r-empty"><h3>Your shelves are waiting</h3><p>Add a book you’re reading, or one you’ve finished, and it will appear on the shelf by the door.</p><button className="btn btn-primary" onClick={onFind}>Find a book</button></div>
      )}
      {!immersive && <div className="r-stops" role="group" aria-label="Go to">
        <button onClick={() => stop('entrance')}>Entrance</button>
        <button onClick={() => stop('mine')}>My books</button>
        <button onClick={() => stop('upper')}>Top shelves</button>
        <button onClick={() => stop('desk')}>Desk</button>
        <button onClick={() => stop('fire')}>Fireplace</button>
        <button onClick={() => stop('gallery')}>{level === 'upper' ? 'Climb down' : 'Gallery'}</button>
      </div>}
      {touch && (
        <div className="r-joy" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); joy(e, true); }} onPointerMove={(e) => e.buttons && joy(e, true)} onPointerUp={(e) => joy(e, false)} onPointerCancel={(e) => joy(e, false)} aria-hidden="true"><i /></div>
      )}
      <span className="sr-only">{lampOn ? 'Lamps on' : 'Lamps off'}</span>
    </section>
  );
}
