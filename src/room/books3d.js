// Books for the 3D room. The reader's own volumes are one mesh each, so they can be hovered, pulled out and picked up and
// put down anywhere on any shelf. Optional decorative sets (instanced: thousands of books for a handful of draws) fill the
// gaps, but only when the reader asks for a stocked library: by default the shelves are empty and theirs to fill.
import * as THREE from 'three';
import { runKey } from './world';
import { rng, spineBands, spineCanvas, toTexture } from './textures';

const PALS = [
  '#6b2118', '#2a4331', '#1f2f4a', '#4a2c1a', '#1b1613', '#8a5a2e', '#5a1f2c', '#40472a', '#7a3a22', '#2c3640', '#a07a44', '#8c2b1f', '#33241a', '#3d5a6c', '#704a2a', '#c9b48a',
];
const GAP = 0.004;
const DEPTH = 0.24;
const FRONT = 0.025 + DEPTH / 2 + 0.02; // a book's centre, measured from the shelf's back edge

/** The shelves books go on first: the rows within easy reach in the cases facing the door, then everything else. */
function runOrder(runs) {
  const idx = runs.map((r, i) => i);
  const easy = (i) => !runs[i].upper && runs[i].p0.y > 0.8 && runs[i].p0.y < 2.5;
  const tags = ['BR', 'BL', 'R', 'L', 'R2', 'L2', 'FR', 'FL'];
  const rank = (i) => (easy(i) ? 0 : !runs[i].upper ? 1 : 2);
  return idx.sort((a, b) => {
    const A = runs[a]; const B = runs[b];
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (A.tag !== B.tag) return tags.indexOf(A.tag) - tags.indexOf(B.tag);
    if (A.row !== B.row) return B.row - A.row;
    return A.col - B.col;
  });
}

export function createBooks(world) {
  const group = new THREE.Group();
  const runs = world.runs;
  const order = runOrder(runs);
  const keyIndex = new Map(runs.map((r, i) => [runKey(r), i]));
  const totalLen = runs.reduce((s, r) => s + r.len, 0);
  const capacity = Math.ceil(totalLen / 0.03) + 64;
  let occ = runs.map(() => []); // per shelf: the books standing on it, { id, x0, x1 }
  let stocked = false;

  // instanced fillers, four spine styles
  const fillers = [0, 1, 2, 3].map((v) => {
    const plain = new THREE.MeshStandardMaterial({ roughness: 0.72 });
    const spine = new THREE.MeshStandardMaterial({ map: spineBands(v), roughness: 0.5 });
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), [plain, plain, plain, plain, spine, plain], capacity);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.count = 0;
    m.frustumCulled = false;
    group.add(m);
    return m;
  });

  function itemsFor(run, seed, need) {
    const r = rng(seed * 7919 + 13);
    const out = [];
    let got = 0;
    let guard = 0;
    while (got < need && guard++ < 400) {
      const tall = Math.min(run.clear - 0.02, 0.2 + r() * 0.18);
      const color = PALS[Math.floor(r() * PALS.length)];
      const band = Math.floor(r() * 4);
      if (r() < 0.36) {
        const n = 3 + Math.floor(r() * 7);
        const w = 0.034 + r() * 0.025;
        for (let i = 0; i < n; i++) { out.push({ w, h: tall, color, band, d: DEPTH }); got += w + GAP; }
      } else {
        const w = 0.026 + r() * 0.045;
        out.push({ w, h: Math.min(run.clear - 0.02, 0.2 + r() * 0.17), color, band, d: DEPTH - r() * 0.03 });
        got += w + GAP;
      }
    }
    return out;
  }

  const tmp = new THREE.Object3D();
  const col = new THREE.Color();
  const user = new Map(); // book id -> mesh

  /** Free gaps on a shelf (optionally ignoring one book), as [start, end] pairs. */
  const gapsOf = (ri, skipId) => {
    const list = occ[ri].filter((o) => o.id !== skipId).sort((a, b) => a.x0 - b.x0);
    const gaps = [];
    let cur = 0;
    for (const o of list) { if (o.x0 - cur > 0.02) gaps.push([cur, o.x0]); cur = Math.max(cur, o.x1); }
    if (runs[ri].len - cur > 0.02) gaps.push([cur, runs[ri].len]);
    return gaps;
  };
  const fits = (ri, x, w, skipId) => x >= -1e-6 && x + w <= runs[ri].len + 1e-6 && occ[ri].every((o) => o.id === skipId || x + w <= o.x0 + 1e-6 || x >= o.x1 - 1e-6);

  function placeFillers() {
    fillers.forEach((m) => (m.count = 0));
    if (stocked) {
      runs.forEach((run, ri) => {
        const items = itemsFor(run, ri + 1, run.len * 1.2);
        let k = 0;
        for (const [g0, g1] of gapsOf(ri)) {
          let cur = g0 + 0.01;
          while (k < items.length) {
            const it = items[k];
            if (cur + it.w > g1 - 0.005) break;
            k += 1;
            const c = run.p0.clone().addScaledVector(run.dir, cur + it.w / 2).addScaledVector(run.nrm, FRONT - (DEPTH - it.d) / 2);
            c.y += it.h / 2;
            tmp.position.copy(c);
            tmp.rotation.set(0, run.yaw, 0);
            tmp.scale.set(it.w, it.h, it.d);
            tmp.updateMatrix();
            const m = fillers[it.band];
            if (m.count >= capacity - 1) continue;
            m.setMatrixAt(m.count, tmp.matrix);
            col.set(it.color).multiplyScalar(0.85 + ((ri * 31 + m.count * 17) % 30) / 100);
            m.setColorAt(m.count, col);
            m.count += 1;
            cur += it.w + GAP;
          }
        }
      });
    }
    fillers.forEach((m) => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  }

  const homeOf = (ri, x, w, h) => {
    const run = runs[ri];
    const c = run.p0.clone().addScaledVector(run.dir, x + w / 2).addScaledVector(run.nrm, FRONT);
    c.y += h / 2;
    return c;
  };
  const settle = (mesh, ri, x) => {
    const u = mesh.userData;
    const run = runs[ri];
    u.run = ri; u.x = x; u.home = homeOf(ri, x, u.w, u.h); u.yaw = run.yaw; u.nrm = run.nrm;
    if (!u.placed) { mesh.position.copy(u.home); mesh.rotation.y = run.yaw; u.placed = true; }
  };

  /**
   * entries: [{ book, design, pct }]. Builds or updates the meshes and stands each one where it was put.
   * Books with no saved place are put on the first free spot; those are returned so they can be saved.
   */
  function setBooks(entries) {
    const ids = new Set(entries.map((e) => e.book.id));
    for (const [id, mesh] of user) if (!ids.has(id)) { group.remove(mesh); mesh.geometry.dispose(); user.delete(id); }
    entries.forEach((e) => {
      const d = e.design;
      const w = Math.max(0.03, Math.min(0.085, d.width * 0.0013));
      const h = Math.min(0.33, d.height * 0.00165);
      const sig = `${d.bg}|${d.fg}|${d.accent}|${d.style}|${d.font}|${e.pct}|${d.photo || ''}`;
      let mesh = user.get(e.book.id);
      if (!mesh) {
        const cover = new THREE.Color(d.bg).multiplyScalar(0.8);
        const side = new THREE.MeshStandardMaterial({ color: cover, roughness: 0.7 });
        const pages = new THREE.MeshStandardMaterial({ color: 0xe6dbc2, roughness: 0.95 });
        const spine = new THREE.MeshStandardMaterial({ roughness: 0.55 });
        mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, DEPTH), [side, side, pages, side, spine, side]);
        mesh.userData = { kind: 'book', book: e.book, w, h, pull: 0 };
        group.add(mesh);
        user.set(e.book.id, mesh);
      }
      mesh.userData.book = e.book;
      mesh.userData.w = w;
      mesh.userData.h = h;
      if (mesh.userData.sig !== sig) {
        mesh.userData.sig = sig;
        mesh.geometry.dispose();
        mesh.geometry = new THREE.BoxGeometry(w, h, DEPTH);
        mesh.material[0].color.set(d.bg).multiplyScalar(0.8);
        const mat = mesh.material[4];
        mat.map?.dispose();
        const canvas = spineCanvas(e.book, d, e.pct);
        mat.map = toTexture(canvas);
        mat.needsUpdate = true;
        if (d.photo) {
          const img = new Image();
          img.onload = () => { canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height); mat.map.needsUpdate = true; };
          img.src = d.photo;
        }
      }
      const reading = e.book.status === 'reading';
      if (reading && !mesh.userData.ribbon) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.07, 0.004), new THREE.MeshStandardMaterial({ color: 0xb83a25, roughness: 0.6 }));
        rib.position.set(0, -h / 2 - 0.03, DEPTH / 2 + 0.002);
        mesh.add(rib);
        mesh.userData.ribbon = rib;
      } else if (!reading && mesh.userData.ribbon) {
        mesh.remove(mesh.userData.ribbon);
        mesh.userData.ribbon = null;
      }
    });

    // saved places first, then everything else onto the first gap that is big enough
    occ = runs.map(() => []);
    const loose = [];
    entries.forEach((e) => {
      const mesh = user.get(e.book.id);
      const pl = e.book.place;
      const ri = pl ? keyIndex.get(pl.run) : undefined;
      const { w, h } = mesh.userData;
      if (ri !== undefined && h <= runs[ri].clear && fits(ri, Math.min(pl.x, runs[ri].len - w), w)) {
        const x = Math.max(0, Math.min(pl.x, runs[ri].len - w));
        occ[ri].push({ id: e.book.id, x0: x, x1: x + w + GAP });
        settle(mesh, ri, x);
        mesh.userData.hasPlace = true;
      } else loose.push(e);
    });
    const auto = [];
    const done0 = new Set(entries.filter((e) => !loose.includes(e)).map((e) => e.book.id));
    for (const e of loose) {
      const mesh = user.get(e.book.id);
      const { w, h } = mesh.userData;
      let done = false;
      // a book from a series goes next to its series-mates, in volume order, when there is room beside them
      if (e.book.series) {
        const mates = entries.filter((o) => o.book.id !== e.book.id && o.book.series === e.book.series && done0.has(o.book.id)).map((o) => user.get(o.book.id));
        mates.sort((a, b) => (a.userData.book.seriesNo ?? 0) - (b.userData.book.seriesNo ?? 0));
        const mine = e.book.seriesNo ?? Infinity;
        const before = mates.filter((m) => (m.userData.book.seriesNo ?? 0) <= mine);
        const anchor = before.length ? before[before.length - 1] : null;
        const tries = [];
        if (anchor) tries.push([anchor.userData.run, anchor.userData.x + anchor.userData.w + GAP]);
        if (mates.length) tries.push([mates[0].userData.run, mates[0].userData.x - w - GAP]);
        for (const [ri, x] of tries) {
          if (ri != null && h <= runs[ri].clear && fits(ri, x, w)) {
            occ[ri].push({ id: e.book.id, x0: x, x1: x + w + GAP });
            settle(mesh, ri, x);
            auto.push({ id: e.book.id, run: runKey(runs[ri]), x: Math.round(x * 1000) / 1000 });
            done = true;
            break;
          }
        }
      }
      if (done) { done0.add(e.book.id); continue; }
      for (const ri of done ? [] : order) {
        if (h > runs[ri].clear) continue;
        const g = gapsOf(ri).find(([a, b]) => b - a >= w + GAP);
        if (!g) continue;
        occ[ri].push({ id: e.book.id, x0: g[0], x1: g[0] + w + GAP });
        settle(mesh, ri, g[0]);
        auto.push({ id: e.book.id, run: runKey(runs[ri]), x: Math.round(g[0] * 1000) / 1000 });
        done = true;
        done0.add(e.book.id);
        break;
      }
      if (!done) mesh.userData.home = null;
    }
    placeFillers();
    return { auto };
  }

  /**
   * Lays the given books out from the first shelf on, in the order given, one after another. A group (a series) starts on
   * a fresh shelf when it would otherwise be split across two. Returns where every book now stands.
   */
  function arrange(ordered) {
    const out = [];
    let k = 0;
    let cur = 0;
    const groupWidth = (gid) => ordered.filter((o) => o.group === gid).reduce((n, o) => n + user.get(o.book.id).userData.w + GAP, 0);
    let lastGroup = null;
    for (const e of ordered) {
      const m = user.get(e.book.id);
      const { w, h } = m.userData;
      if (e.group !== lastGroup) {
        lastGroup = e.group;
        if (cur > 0) cur += 0.05;
        const need = e.series ? groupWidth(e.group) : w;
        if (k < order.length && cur + need > runs[order[k]].len && need <= runs[order[k]].len) { k += 1; cur = 0; }
      }
      while (k < order.length && (cur + w > runs[order[k]].len || h > runs[order[k]].clear)) { k += 1; cur = 0; }
      if (k >= order.length) break;
      out.push({ id: e.book.id, run: runKey(runs[order[k]]), x: Math.round(cur * 1000) / 1000 });
      cur += w + GAP;
    }
    return out;
  }

  /** Where would a book of this size go if dropped where `point` touches the shelves? Null when nothing fits there. */
  function findSlot(point, w, h, skipId) {
    let best = null;
    runs.forEach((run, ri) => {
      if (h > run.clear) return;
      const rel = point.clone().sub(run.p0);
      const t = rel.dot(run.dir);
      const dn = rel.dot(run.nrm);
      const dy = rel.y;
      if (dn < -0.7 || dn > 1.0 || dy < -0.08 || dy > run.clear + 0.12 || t < -0.2 || t > run.len + 0.2) return;
      const score = Math.abs(dy - run.clear * 0.45) + Math.abs(dn - 0.3) * 0.4 + (t < 0 ? -t : t > run.len ? t - run.len : 0);
      if (!best || score < best.score) best = { ri, t, score };
    });
    if (!best) return null;
    const { ri, t } = best;
    const run = runs[ri];
    const want = Math.max(0, Math.min(run.len - w, t - w / 2));
    const cands = [want];
    for (const o of occ[ri]) { if (o.id === skipId) continue; cands.push(o.x1, o.x0 - w - GAP); }
    const ok = cands.filter((c) => fits(ri, c, w, skipId)).sort((a, b) => Math.abs(a - want) - Math.abs(b - want))[0];
    if (ok === undefined) return null;
    return { ri, x: ok, key: runKey(run), pos: homeOf(ri, ok, w, h), yaw: run.yaw, nrm: run.nrm };
  }

  /** Puts a book down in a slot straight away (the saved place follows through the caller). */
  function commit(id, slot) {
    const mesh = user.get(id);
    if (!mesh || !slot) return;
    occ.forEach((list, i) => { occ[i] = list.filter((o) => o.id !== id); });
    occ[slot.ri].push({ id, x0: slot.x, x1: slot.x + mesh.userData.w + GAP });
    settle(mesh, slot.ri, slot.x);
    placeFillers();
  }

  const pos = new THREE.Vector3();
  function update(dt, dragId) {
    const kk = 1 - Math.exp(-14 * dt);
    for (const mesh of user.values()) {
      const u = mesh.userData;
      if (!u.home || u.book.id === dragId) continue;
      pos.copy(u.home).addScaledVector(u.nrm, u.pull);
      mesh.position.lerp(pos, kk);
      mesh.rotation.y += (u.yaw - mesh.rotation.y) * kk;
    }
  }

  return {
    group,
    setBooks,
    findSlot,
    commit,
    arrange,
    setStocked(v) { if (v !== stocked) { stocked = v; placeFillers(); } },
    update,
    meshes: () => [...user.values()],
    meshOf: (id) => user.get(id),
    dispose() {
      group.traverse((o) => { if (o.isMesh) { o.geometry?.dispose(); [].concat(o.material).forEach((m) => { m.map?.dispose?.(); m.dispose?.(); }); } });
      fillers.forEach((m) => m.dispose());
    },
  };
}
