import React, { Suspense, lazy, useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { TopBar } from '../components/PageShell';
import Boundary from '../components/Boundary';
import '@fontsource/dm-mono/400.css';
import { TOOLS, COMPOSITOR } from '../data/tools';
import bar from '../components/page.module.css';
import s from './tool.module.css';

// Each tool is its own chunk; only the one opened is downloaded.
const TOOL_COMPONENTS = {
    'quad-trees': lazy(() => import('../tools/quadtree')),
    manifolds: lazy(() => import('../tools/manifolds')),
    'blob-tracker': lazy(() => import('../tools/BlobTracker')),
    'pixel-sorter': lazy(() => import('../tools/PixelSorter')),
    procedural: lazy(() => import('../tools/ProceduralAscii')),
    ascii: lazy(() => import('../tools/AsciiTool')),
};

const Message = ({ children }) => <div className={s.message}><span>{children}</span></div>;

function Tool() {
    const { slug } = useParams();
    const tool = TOOLS.find((t) => t.slug === slug);
    const Component = TOOL_COMPONENTS[slug];

    useEffect(() => {
        if (tool) document.title = `aqichah / ${tool.label}`;
    }, [tool]);

    // the compositor is desktop only: it lives on the software page
    // if (slug === COMPOSITOR.slug || !tool || !Component) return <Navigate to="/software" replace />;

    return (
        <div className={s.shell}>
            <TopBar night>
                <span className={bar.crumb}>
                    <Link to="/software">software</Link>
                    <span aria-hidden="true">/</span>
                    <h1>{tool.label}</h1>
                </span>
            </TopBar>
            <Boundary key={slug} fallback={<Message>something broke. reload?</Message>}>
                <Suspense fallback={<Message>loading</Message>}>
                    <Component />
                </Suspense>
            </Boundary>
        </div>
    );
}

export default Tool;
