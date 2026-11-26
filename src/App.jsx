import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Landing from './pages/Landing';
import Loader, { loadFont, loadImage } from './components/Loader';
import { BACKGROUNDS } from './config/backgrounds';
import paperBg from './assets/images/paper-bg.webp';
import paperFg from './assets/images/paper-fg.webp';
import marqueeTile from './assets/images/aq-marquee.webp';

// Every page but the landing is its own chunk; a tool's code (and three.js)
// only downloads when it is opened.
const PAGES = {
    software: () => import('./pages/Software'),
    discography: () => import('./pages/Discography'),
    tool: () => import('./pages/Tool'),
    notFound: () => import('./pages/NotFound'),
};
const Software = lazy(PAGES.software);
const Discography = lazy(PAGES.discography);
const Tool = lazy(PAGES.tool);
const NotFound = lazy(PAGES.notFound);

const TITLES = { '/': 'aqichah', '/software': 'aqichah / software', '/discography': 'aqichah / discography' };

/** What the first page needs before the loader lifts: its chunk, photo and paper. */
function bootTasks(pathname) {
    const path = pathname.replace(/\/+$/, '') || '/';
    const tasks = [loadFont, loadImage(paperBg), loadImage(paperFg)];
    if (path === '/') {
        tasks.push(loadImage(BACKGROUNDS.landing.src), loadImage(marqueeTile));
    } else if (path === '/software' || path === '/discography') {
        const page = path.slice(1);
        tasks.push(PAGES[page], loadImage(BACKGROUNDS[page].src));
    } else if (path.startsWith('/software/')) {
        tasks.push(PAGES.tool);
    } else if (path !== '/music' && !path.startsWith('/vfx')) {
        tasks.push(PAGES.notFound);
    }
    return tasks;
}

function App() {
    const { pathname } = useLocation();
    // The first page mounts as the loader lifts, so its LEDs come on in view.
    const [booted, setBooted] = useState(false);
    const [tasks] = useState(() => bootTasks(pathname));

    useEffect(() => {
        window.scrollTo(0, 0);
        if (TITLES[pathname]) document.title = TITLES[pathname];
    }, [pathname]);

    return (
        <>
            {booted && (
                <Suspense fallback={null}>
                    <Routes>
                        <Route path="/" element={<Landing />} />
                        <Route path="/software" element={<Software />} />
                        <Route path="/software/:slug" element={<Tool />} />
                        <Route path="/discography" element={<Discography />} />
                        <Route path="/vfx/*" element={<Navigate to="/software" replace />} />
                        <Route path="/music" element={<Navigate to="/discography" replace />} />
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </Suspense>
            )}
            <Loader tasks={tasks} onReady={() => setBooted(true)} />
        </>
    );
}

export default App;
