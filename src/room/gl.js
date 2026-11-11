let ok;
/** Can this browser draw the 3D room? Checked once. */
export function webglAvailable() {
  if (ok !== undefined) return ok;
  try {
    const c = document.createElement('canvas');
    ok = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { ok = false; }
  return ok;
}
