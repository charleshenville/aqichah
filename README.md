# aqichah

The site for aqichah: a landing page, the software (VFX tools that run in the
browser, and the desktop Compositor), and the discography.

```
npm install
npm run dev       # http://localhost:5173
npm run build     # static site in dist/ (index.html copied to 404.html for deep links)
npm run preview
```

React 18 + Vite, plain CSS modules, three.js for the manifold and the 3D tools.

## Where to change things

| what | file |
| --- | --- |
| social links, listening links, Compositor download URLs | `src/config/site.js` |
| LED start-up timing, marquee speed, the landing manifold | `src/config/landing.js` |
| the quad field behind the pages: threshold, ramp, colours | `src/config/backgrounds.js` |
| tool list, blurbs and previews | `src/data/tools.js` |
| releases and tracks | `src/data/discography.js` |
| colours, type, link colours, paper strength | `src/styles/global.css` (`:root`) |

Turning on a Compositor download: give its entry in `COMPOSITOR_DOWNLOADS` a
`url` and the disabled "soon" button becomes a download link.

The quad field's `ramp` takes any number of steps, darkest first, from
`outline`, `dots`, `grid` (`n`) and `fill`; the brightness above `threshold`
is split evenly between them. Its sizes are in pixels of the photo, so it is
fixed to the image and browser zoom never changes it.

The site is fully static. Tool presets are downloaded as files and opened
from files; nothing is saved anywhere else.

## Layout

```
src/
  App.jsx, main.jsx       routes; the paper overlay
  pages/                  Landing, Software, Discography, Tool (one route per tool), NotFound
  components/             LedMark (the "aq" of individual LEDs), ManifoldView, QuadField,
                          Paper, Icon, Oscilloscope, PageShell, Clip, Boundary
  config/                 everything meant to be tweaked (above)
  data/                   tools and releases
  lib/                    aq glyph grid, encoders, noise, pixel sort workers ...
  tools/                  the browser tools (from webprofile), re-skinned:
    quadtree/ manifolds/ BlobTracker PixelSorter ProceduralAscii AsciiTool
    vfx.module.css        the shared tool panel and stage
  styles/global.css       design tokens
  assets/                 bundled, hashed: fonts/ (Bus Stop, subset woff2),
                          images/ (webp: photos, paper, art/ for covers)
public/
  media/clips/            tool preview loops (mp4 + jpg poster), streamed on demand
  media/audio/            tracks (AAC .m4a, 112 kbps)
  models/                 the ascii renderer's default glTF
```

Images and the font go through the bundler (hashed, cacheable forever); video
and audio sit in `public/` so they stream with range requests and only load
when played or scrolled to.
