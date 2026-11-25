import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Landing from './pages/Landing';

// Every page but the landing is its own chunk; a tool's code (and three.js)
// only downloads when it is opened.
const Software = lazy(() => import('./pages/Software'));
const Discography = lazy(() => import('./pages/Discography'));
const Tool = lazy(() => import('./pages/Tool'));
const NotFound = lazy(() => import('./pages/NotFound'));

const TITLES = { '/': 'aqichah', '/software': 'aqichah / software', '/discography': 'aqichah / discography' };

function App() {
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo(0, 0);
        if (TITLES[pathname]) document.title = TITLES[pathname];
    }, [pathname]);

    return (
        <>
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
        </>
    );
}

export default App;
