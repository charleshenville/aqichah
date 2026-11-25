// Links and labels for the whole site. Edit freely; nothing else needs to change.

export const ARTIST = 'aqichah';

// The landing page's two lines of links, in order; `id` also picks the
// icon (components/Icon.jsx).
// TODO: the instagram, tiktok, youtube and apple music URLs are guesses at the
// handle; replace them with the real profiles.
export const SOCIAL_LINES = [
    [
        { id: 'instagram', label: 'instagram', url: 'https://www.instagram.com/aqichah' },
        { id: 'tiktok', label: 'tiktok', url: 'https://www.tiktok.com/@aqichah' },
        { id: 'youtube', label: 'youtube', url: 'https://www.youtube.com/channel/UCaWOQ1kcWKLOhTQg_ML0JcQ' },
    ],
    [
        { id: 'soundcloud', label: 'soundcloud', url: 'https://soundcloud.com/aqichah' },
        { id: 'spotify', label: 'spotify', url: 'https://open.spotify.com/artist/57sQY6nZJMyhgaQZBRreVF' },
        { id: 'apple-music', label: 'apple music', url: 'https://music.apple.com/search?term=aqichah' },
    ],
];

export const SOCIALS = SOCIAL_LINES.flat();

// Where the listening links on the discography page point.
export const LISTEN = ['soundcloud', 'spotify', 'apple-music', 'youtube'];

// The Compositor's desktop builds. A null url shows the button disabled
// ("soon"); set a url and it becomes a download link.
export const COMPOSITOR_DOWNLOADS = [
    { id: 'macos', label: 'macos', url: null },
    { id: 'linux', label: 'linux', url: null },
    { id: 'windows', label: 'windows', url: null },
];
