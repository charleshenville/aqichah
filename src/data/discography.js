// Releases, newest first by year. `art` is the cover (an import from
// src/assets/images/art/). `audio` paths are under public/.
//
// To add a release: encode the audio to public/media/audio/<name>.m4a
//   ffmpeg -i in.wav -c:a aac -b:a 112k -movflags +faststart <name>.m4a
// and add an entry here.

import demosArt from '../assets/images/art/demos.webp';

const audio = (name) => `${import.meta.env.BASE_URL}media/audio/${name}.m4a`;

export const RELEASES = [
    {
        id: 'demos',
        title: 'demos',
        type: 'unreleased',
        year: 2026,
        art: demosArt,
        tracks: [
            { title: 'maestro', audio: audio('maestro') },
            { title: 'sleepy cat', audio: audio('sleepycat') },
            { title: 'euro', audio: audio('euro') },
            { title: 'happy clanker army', audio: audio('happyclankerarmy') },
            { title: 'chemong', audio: audio('chemong') },
            { title: 'co2', audio: audio('co2') },
            { title: 'sd', audio: audio('sd') },
        ],
        links: [],
    },
];
