// Frames out of the Stage: a PNG at any scale, or an MP4 rendered offline
// frame by frame (WebCodecs, lib/mp4Writer.js). Both draw at the export size
// and put the preview's size back after; line widths are in output
// pixels, so a 2x export is the preview's picture at twice the resolution.

import { Mp4Writer } from '../../../lib/mp4Writer';

const ASPECT = {
    '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5, '3:4': 3 / 4, '21:9': 21 / 9,
};

/** The frame's size in output pixels (even, for H.264). */
export function outputSize(p) {
    const a = ASPECT[p.aspect] || 1;
    const long = Math.max(16, Math.round(p.outLong));
    const w = a >= 1 ? long : long * a;
    const h = a >= 1 ? long / a : long;
    return { outW: Math.round(w / 2) * 2, outH: Math.round(h / 2) * 2 };
}

const download = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
};

function withSize(stage, w, h, fn) {
    const pw = stage.width;
    const ph = stage.height;
    stage.setSize(w, h);
    try {
        return fn();
    } finally {
        stage.setSize(pw, ph);
    }
}

export async function exportPng(stage, p, t, scale = 1, name = 'manifold') {
    const { outW, outH } = outputSize(p);
    const w = Math.round(outW * scale);
    const h = Math.round(outH * scale);
    const blob = await new Promise((resolve, reject) => {
        withSize(stage, w, h, () => {
            stage.render(p, t, { outW, overlay: false });
            // Read in the same task the frame was drawn in, before the buffer is cleared.
            stage.renderer.domElement.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png');
        });
    });
    download(blob, `${name}.png`);
}

/**
 * Render [t0, t1) at `fps` into an MP4. `onProgress(fraction)`; `cancelled()`
 * stops it. Resolves to true when written, false when cancelled.
 */
export async function exportMp4(stage, p, {
    scale = 1, fps = 30, t0 = 0, t1 = 8, quality = 0.3, name = 'manifold',
}, onProgress, cancelled) {
    const { outW, outH } = outputSize(p);
    const w = Math.round((outW * scale) / 2) * 2;
    const h = Math.round((outH * scale) / 2) * 2;
    const frames = Math.max(1, Math.round((t1 - t0) * fps));
    const bitrate = Math.round(w * h * fps * quality);
    const writer = await Mp4Writer.open({
        width: w, height: h, fps, bitrate, frames, name,
    });
    const pw = stage.width;
    const ph = stage.height;
    stage.setSize(w, h);
    try {
        for (let i = 0; i < frames; i++) {
            if (cancelled()) {
                await writer.abort();
                return false;
            }
            stage.render(p, t0 + i / fps, { outW, overlay: false });
            // eslint-disable-next-line no-await-in-loop
            await writer.add(stage.renderer.domElement);
            onProgress((i + 1) / frames);
        }
        const out = await writer.finish();
        if (out.blob) download(out.blob, `${name}.mp4`);
        return true;
    } catch (e) {
        await writer.abort();
        throw e;
    } finally {
        stage.setSize(pw, ph);
    }
}

export { withSize };
