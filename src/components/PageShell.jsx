import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import LedMark from './LedMark';
import DotText, { DESCENT } from './DotText';
import QuadField from './QuadField';
import Paper from './Paper';
import { BACKGROUNDS } from '../config/backgrounds';
import { LED } from '../config/landing';
import s from './page.module.css';

/** The bar pinned to the top of every page but the landing: home, then the two pages. */
export function TopBar({ night = false, sheetRef = null, children }) {
    const [lit, setLit] = useState(false);
    const homeRef = useRef(null);
    // Where the sheet begins, as a fraction down the mark: the resting dots
    // over the photo stay dark, the ones over the dark sheet read light.
    const [split, setSplit] = useState(null);
    useEffect(() => {
        const sheet = sheetRef?.current;
        if (!sheet) return undefined;
        let raf = 0;
        const measure = () => {
            raf = 0;
            const mark = homeRef.current?.querySelector('svg')?.getBoundingClientRect();
            if (!mark || !mark.height) return;
            const f = (sheet.getBoundingClientRect().top - mark.top) / mark.height;
            setSplit(Math.max(0, Math.min(1, f)));
        };
        const schedule = () => { if (!raf) raf = requestAnimationFrame(measure); };
        measure();
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
        };
    }, [sheetRef]);
    return (
        <header className={`${s.bar} ${s.fixed} ${night ? s.night : ''}`}>
            <Link
                ref={homeRef}
                to="/"
                className={s.home}
                aria-label="home"
                onPointerEnter={() => setLit(true)}
                onPointerLeave={() => setLit(false)}
                onFocus={() => setLit(true)}
                onBlur={() => setLit(false)}
            >
                <LedMark title="aq" lit={lit} split={split} />
            </Link>
            {children}
            <nav className={s.doors} aria-label="pages">
                <NavLink to="/software" className={({ isActive }) => `${s.door} ${isActive ? s.here : ''}`}>software</NavLink>
                <NavLink to="/discography" className={({ isActive }) => `${s.door} ${isActive ? s.here : ''}`}>discography</NavLink>
            </nav>
        </header>
    );
}

/**
 * A page: the quad field in a short head with the title in the dot matrix
 * standing on the edge of the sheet, then the sheet.
 */
function PageShell({ page, title, children }) {
    const bg = BACKGROUNDS[page];
    const sheetRef = useRef(null);
    return (
        <div className={s.page}>
            <TopBar sheetRef={sheetRef} />
            <div className={s.head}>
                <div className={s.hero}>
                    {bg && <QuadField src={bg.src} focus={bg.focus} field={bg.field} className="fixed" />}
                    <Paper variant="bg" fixed />
                </div>
                {/* outside the clip, so descenders hang onto the sheet */}
                <h1
                    className={s.title}
                    style={{ '--chars': title.length, bottom: `${-DESCENT}em` }}
                >
                    <DotText text={title} reveal revealDuration={LED.titles.duration} />
                </h1>
            </div>
            <main ref={sheetRef} className={s.sheet}>
                {children}
                <Paper variant="fg" />
            </main>
        </div>
    );
}

/** A section opener: a hairline, a title and a note on the right. */
export function Rule({ title, meta }) {
    return (
        <div className={s.rule}>
            {title && <h2 className={s.ruleTitle}>{title}</h2>}
            {meta && <span className={`meta ${s.ruleMeta}`}>{meta}</span>}
        </div>
    );
}

export default PageShell;
