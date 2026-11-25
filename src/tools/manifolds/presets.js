// Manifolds presets: downloaded as a file and opened from one. A preset is
// every parameter (edits and hand-drawn strands included) and the camera.

import { cleanParams } from './params';

export const PRESET_FORMAT = 'manifolds-preset';

const cleanCamera = (c) => {
    const ok = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
    return c && ok(c.position) && ok(c.target) ? { position: c.position, target: c.target } : null;
};

export function parsePreset(text) {
    const data = JSON.parse(text);
    if (!data || data.format !== PRESET_FORMAT || !data.params) throw new Error('Not a Manifolds preset.');
    return { name: data.name || 'preset', params: cleanParams(data.params), camera: cleanCamera(data.camera) };
}

const serialize = (name, params, camera) => JSON.stringify({
    format: PRESET_FORMAT, version: 1, name, params: cleanParams(params), camera: cleanCamera(camera),
}, null, 1);

export function downloadPreset(name, params, camera) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([serialize(name, params, camera)], { type: 'application/json' }));
    a.download = `${(name || 'preset').replace(/[^a-zA-Z0-9 _.-]+/g, '-')}.manifolds.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export async function readPresetFile(file) {
    return parsePreset(await file.text());
}
