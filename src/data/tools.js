// The software page and the tool router read this list. `preview` is a
// recorded loop from public/media/clips/ (`clip`) or the live ascii engine.

export const COMPOSITOR = {
    slug: 'compositor',
    label: 'compositor',
    blurb: 'takes, scans and video on one timeline, every parameter driven by the music.',
    clip: 'compositor',
};

export const TOOLS = [
    { slug: 'blob-tracker', label: 'blob tracker', blurb: 'tracks motion in video.', preview: { clip: 'blob-tracker' } },
    { slug: 'pixel-sorter', label: 'pixel sorter', blurb: 'threshold-masked sorting.', preview: { clip: 'pixel-sorter' } },
    { slug: 'procedural', label: 'procedural', blurb: 'noise and flow, as ascii or pixels.', preview: { clip: 'procedural' } },
    { slug: 'ascii', label: 'ascii', blurb: '3d models as live ascii.', preview: { engine: 'ascii' } },
    { slug: 'quad-trees', label: 'quad trees', blurb: 'subdivision by detail.', preview: { clip: 'quad-trees' } },
    { slug: 'manifolds', label: 'manifolds', blurb: 'swept splines, chrome and ink.', preview: { clip: 'manifolds' } },
];

export const clipUrl = (name, ext) => `${import.meta.env.BASE_URL}media/clips/${name}.${ext}`;
