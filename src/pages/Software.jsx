import React, { Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import PageShell, { Rule } from '../components/PageShell';
import Clip from '../components/Clip';
import Boundary from '../components/Boundary';
import Icon from '../components/Icon';
import { COMPOSITOR, TOOLS } from '../data/tools';
import { COMPOSITOR_DOWNLOADS } from '../config/site';
import s from './software.module.css';

// The ascii card runs the real renderer, so three.js loads with it, on its own.
const AsciiEnginePreview = lazy(() => import('../tools/AsciiEnginePreview'));

function Preview({ tool }) {
    const p = tool.preview;
    if (p.clip) return <Clip name={p.clip} />;
    return (
        <Boundary>
            <Suspense fallback={null}>
                {p.engine === 'ascii' && <AsciiEnginePreview />}
            </Suspense>
        </Boundary>
    );
}

function Software() {
    return (
        <PageShell page="software" title="software">
            <p className={s.lead}>instruments i've made to do visuals. everything is open source.</p>

            <Rule />
            <section className={s.feature}>
                <div className={`${s.frame} ${s.featureClip}`}>
                    <Clip name={COMPOSITOR.clip} />
                </div>
                <div className={s.featureText}>
                    <h2 className={s.featureTitle}>{COMPOSITOR.label}</h2>
                    <p className={s.featureBlurb}>{COMPOSITOR.blurb}</p>
                    <div className={s.downloads}>
                        {COMPOSITOR_DOWNLOADS.map((d) => (d.url ? (
                            <a key={d.id} className={s.download} href={d.url} download>
                                <span className={s.dlName}><Icon name={d.id} className={s.dlIcon} />{d.label}</span>
                                <span className={s.dlState}>download</span>
                            </a>
                        ) : (
                            <button key={d.id} type="button" className={s.download} disabled>
                                <span className={s.dlName}><Icon name={d.id} className={s.dlIcon} />{d.label}</span>
                                <span className={s.dlState}>soon</span>
                            </button>
                        )))}
                    </div>
                </div>
            </section>

            <ul className={s.cards}>
                {TOOLS.map((t) => (
                    <li key={t.slug} className={s.card}>
                        <Link to={`/software/${t.slug}`} className={s.cardLink}>
                            <div className={`${s.frame} ${s.field}`}>
                                <Preview tool={t} />
                            </div>
                            <h3 className={s.cardTitle}>{t.label}</h3>
                            <p className={s.cardBlurb}>{t.blurb}</p>
                        </Link>
                    </li>
                ))}
            </ul>
        </PageShell>
    );
}

export default Software;
