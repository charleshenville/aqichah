// Quad Trees presets: downloaded as a file and opened from one. A preset is
// the tool's settings and nothing else (no seed image or video).

import { DEFAULTS } from './settings';

export const PRESET_FORMAT = 'quadtree-preset';

/** Only the keys the tool knows, so an old or foreign file can't add junk. */
export function cleanSettings(settings) {
    const out = {};
    Object.keys(DEFAULTS).forEach((k) => {
        if (settings && settings[k] !== undefined) out[k] = settings[k];
    });
    return out;
}

export function parsePreset(text) {
    const data = JSON.parse(text);
    if (!data || data.format !== PRESET_FORMAT || !data.settings) throw new Error('Not a Quad Trees preset.');
    return { name: data.name || 'preset', settings: { ...DEFAULTS, ...cleanSettings(data.settings) } };
}

const serialize = (name, settings) => JSON.stringify({
    format: PRESET_FORMAT, version: 1, name, settings: cleanSettings(settings),
}, null, 2);

export function downloadPreset(name, settings) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([serialize(name, settings)], { type: 'application/json' }));
    a.download = `${(name || 'preset').replace(/[^a-zA-Z0-9 _.-]+/g, '-')}.quadtree.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export async function readPresetFile(file) {
    return parsePreset(await file.text());
}
