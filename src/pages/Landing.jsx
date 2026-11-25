import React, { Suspense, lazy, useRef } from 'react';
import { Link } from 'react-router-dom';
import LedMark from '../components/LedMark';
import Boundary from '../components/Boundary';
import QuadField from '../components/QuadField';
import Paper from '../components/Paper';
import Icon from '../components/Icon';
import { SOCIAL_LINES, ARTIST } from '../config/site';
import { MARQUEE, MANIFOLD } from '../config/landing';
import { BACKGROUNDS } from '../config/backgrounds';
import marqueeTile from '../assets/images/aq-marquee.webp';
import s from './landing.module.css';

// three.js and the manifold engine arrive after the page has painted.
const ManifoldView = lazy(() => import('../components/ManifoldView'));

// The manifold's frame as CSS variables, landscape and portrait.
const frameVars = (b, p = b) => ({
    '--l': `${b.left}%`, '--t': `${b.top}%`, '--w': `${b.width}%`, '--h': `${b.height}%`,
    '--pl': `${p.left}%`, '--pt': `${p.top}%`, '--pw': `${p.width}%`, '--ph': `${p.height}%`,
});

function Landing() {
    const bg = BACKGROUNDS.landing;
    const panelRef = useRef(null);
    return (
        <main className={s.landing}>
            <div className={s.photo}>
                <QuadField src={bg.src} focus={bg.focus} field={bg.field} />
            </div>

            {MANIFOLD.enabled && (
                <Boundary>
                    <Suspense fallback={null}>
                        <ManifoldView config={MANIFOLD} floorRef={panelRef} className={s.manifold} style={frameVars(MANIFOLD.box, MANIFOLD.boxPortrait)} />
                    </Suspense>
                </Boundary>
            )}
            <Paper variant="bg" />

            <section ref={panelRef} className={s.panel}>
                <div className={s.marqueeClip} aria-hidden="true">
                    <div
                        className={`${s.marquee} ${MARQUEE.reverse ? s.marqueeReverse : ''}`}
                        style={{
                            backgroundImage: `url(${marqueeTile})`,
                            opacity: MARQUEE.opacity,
                            animationDuration: `${MARQUEE.secondsPerTile}s`,
                        }}
                    />
                </div>

                <nav className={s.doors} aria-label="pages">
                    <Link to="/software" className={`${s.door} ${s.software}`}>software</Link>
                    <Link to="/discography" className={`${s.door} ${s.discography}`}>discography</Link>
                </nav>

                <h1 className={s.mark}>
                    <LedMark reveal title={ARTIST} />
                </h1>

                <ul className={s.socials} aria-label="elsewhere">
                    {SOCIAL_LINES.map((line, i) => (
                        <li key={i} className={s[`line${i + 1}`]}>
                            {line.map((l) => (
                                <a key={l.id} className={`link ${s.social}`} href={l.url} target="_blank" rel="noreferrer">
                                    <Icon name={l.id} className={s.icon} />
                                    <span>{l.label}</span>
                                </a>
                            ))}
                        </li>
                    ))}
                </ul>

                <Paper variant="fg" />
            </section>
        </main>
    );
}

export default Landing;
