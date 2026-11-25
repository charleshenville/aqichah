import React, { useEffect, useRef, useState } from 'react';
import PageShell, { Rule } from '../components/PageShell';
import Oscilloscope from '../components/Oscilloscope';
import { RELEASES } from '../data/discography';
import { SOCIALS, LISTEN } from '../config/site';
import s from './discography.module.css';

const PROFILES = LISTEN.map((id) => SOCIALS.find((p) => p.id === id)).filter(Boolean);

const pad = (n) => String(n).padStart(2, '0');
const fmt = (t) => (Number.isFinite(t) ? `${Math.floor(t / 60)}:${pad(Math.floor(t % 60))}` : '0:00');
const clamp01 = (n) => Math.max(0, Math.min(1, n));

// Arrow keys nudge by a few seconds; page keys and shift jump further.
const STEP = 5;
const BIG_STEP = 15;

function Discography() {
    const sorted = [...RELEASES].sort((a, b) => b.year - a.year);
    const audioRef = useRef(null);
    const ctxRef = useRef(null);
    const [analyser, setAnalyser] = useState(null);
    // the playing track, as `${release.id}#${track index}`
    const [current, setCurrent] = useState(null);
    const [playing, setPlaying] = useState(false);
    const [time, setTime] = useState({ t: 0, d: 0 });
    // position being dragged on the bar, 0-1, or null
    const [scrub, setScrub] = useState(null);

    useEffect(() => () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
        }
        if (ctxRef.current) ctxRef.current.close().catch(() => {});
    }, []);

    const play = (release, index) => {
        const track = release.tracks[index];
        if (!track?.audio) return;
        const key = `${release.id}#${index}`;
        let audio = audioRef.current;
        if (!audio) {
            audio = new Audio();
            audio.preload = 'none';
            audio.addEventListener('timeupdate', () => setTime({ t: audio.currentTime, d: audio.duration }));
            audio.addEventListener('loadedmetadata', () => setTime({ t: audio.currentTime, d: audio.duration }));
            audio.addEventListener('play', () => setPlaying(true));
            audio.addEventListener('pause', () => setPlaying(false));
            audio.addEventListener('ended', () => {
                setPlaying(false);
                // run on to the next track of the release
                const [id, k] = (audio.dataset.key || '').split('#');
                const r = RELEASES.find((x) => x.id === id);
                if (r && r.tracks[Number(k) + 1]) play(r, Number(k) + 1);
            });
            audioRef.current = audio;
        }
        // the graph is built on the first click so the AudioContext starts in a gesture
        if (!ctxRef.current && (window.AudioContext || window.webkitAudioContext)) {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const node = ctx.createAnalyser();
            node.fftSize = 2048;
            node.smoothingTimeConstant = 0.6;
            ctx.createMediaElementSource(audio).connect(node);
            node.connect(ctx.destination);
            ctxRef.current = ctx;
            setAnalyser(node);
        }
        if (ctxRef.current?.state === 'suspended') ctxRef.current.resume().catch(() => {});
        if (audio.dataset.key === key) {
            if (audio.paused) audio.play().catch(() => {}); else audio.pause();
            return;
        }
        audio.src = track.audio;
        audio.dataset.key = key;
        setCurrent(key);
        setTime({ t: 0, d: 0 });
        setScrub(null);
        audio.play().catch(() => {});
    };

    const seekable = () => {
        const a = audioRef.current;
        return a && Number.isFinite(a.duration) && a.duration > 0 ? a : null;
    };
    const seekTo = (sec) => {
        const a = seekable();
        if (!a) return;
        const t = Math.max(0, Math.min(a.duration, sec));
        a.currentTime = t;
        setTime({ t, d: a.duration });
    };
    const seekBy = (d) => { const a = seekable(); if (a) seekTo(a.currentTime + d); };
    const fractionAt = (e) => {
        const box = e.currentTarget.getBoundingClientRect();
        return box.width ? clamp01((e.clientX - box.left) / box.width) : 0;
    };
    const onScrubDown = (e) => {
        const a = seekable();
        if (!a || e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const f = fractionAt(e);
        setScrub(f);
        seekTo(f * a.duration);
    };
    const onScrubMove = (e) => { if (scrub !== null) setScrub(fractionAt(e)); };
    const onScrubUp = (e) => {
        if (scrub === null) return;
        const a = seekable();
        if (a) seekTo(fractionAt(e) * a.duration);
        setScrub(null);
    };
    const onScrubKey = (e) => {
        const a = seekable();
        if (!a) return;
        const big = e.shiftKey;
        switch (e.key) {
            case 'ArrowLeft': seekBy(big ? -BIG_STEP : -STEP); break;
            case 'ArrowRight': seekBy(big ? BIG_STEP : STEP); break;
            case 'ArrowDown': seekBy(-STEP); break;
            case 'ArrowUp': seekBy(STEP); break;
            case 'PageDown': seekBy(-BIG_STEP); break;
            case 'PageUp': seekBy(BIG_STEP); break;
            case 'Home': seekTo(0); break;
            case 'End': seekTo(a.duration); break;
            default: return;
        }
        e.preventDefault();
    };


    return (
        <PageShell page="discography" title="discography">
            <div className={s.intro}>
                <p className={s.lead}>releases and works in progress.</p>
                <p className={s.listen}>
                    {PROFILES.map((p) => (
                        <a key={p.id} className="link" href={p.url} target="_blank" rel="noreferrer">{p.label}</a>
                    ))}
                </p>
            </div>

            <Rule title="" />

            <ol className={s.list}>
                {sorted.map((r) => {
                    const playingIndex = current?.startsWith(`${r.id}#`) ? Number(current.split('#')[1]) : -1;
                    const isCurrent = playingIndex >= 0;
                    const isPlaying = isCurrent && playing;
                    const dragging = isCurrent && scrub !== null;
                    const at = dragging ? scrub * time.d : time.t;
                    const progress = isCurrent && time.d ? clamp01(at / time.d) : 0;
                    const head = isCurrent ? playingIndex : 0;
                    return (
                        <li key={r.id} className={`${s.release} ${isCurrent ? s.current : ''}`}>
                            <div className={s.cover}>
                                {r.art && <img className={s.art} src={r.art} alt={`${r.title} cover`} loading="lazy" decoding="async" />}
                            </div>

                            <div className={s.info}>
                                <div className={`meta ${s.infoTop}`}>
                                    <span>{r.type}</span>
                                    <span>{r.year}</span>
                                </div>
                                <div className={s.titleRow}>
                                    <h2 className={s.title}>{r.title}</h2>
                                    <Oscilloscope analyser={isCurrent ? analyser : null} active={isPlaying} className={s.scope} />
                                </div>

                                <ol className={s.tracks}>
                                    {r.tracks.map((t, k) => {
                                        const on = playingIndex === k;
                                        return (
                                            <li key={t.title} className={on ? s.trackOn : ''}>
                                                <button
                                                    type="button"
                                                    className={s.track}
                                                    onClick={() => play(r, k)}
                                                    disabled={!t.audio}
                                                    aria-label={`${on && playing ? 'Pause' : 'Play'} ${t.title}`}
                                                >
                                                    <span className={s.n}>{pad(k + 1)}</span>
                                                    <span className={s.trackTitle}>{t.title}</span>
                                                    <span className={s.clock}>{on ? `${fmt(at)} / ${fmt(time.d)}` : ''}</span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ol>

                                <div className={s.actions}>
                                    {r.tracks.some((t) => t.audio) && (
                                        <button
                                            type="button"
                                            className={`${s.play} ${isPlaying ? s.playOn : ''}`}
                                            onClick={() => play(r, head)}
                                            aria-label={`${isPlaying ? 'Pause' : 'Play'} ${r.tracks[head].title}`}
                                        >
                                            <span className={isPlaying ? s.iconPause : s.iconPlay} aria-hidden="true" />
                                            <span>{isPlaying ? 'pause' : 'play'}</span>
                                        </button>
                                    )}
                                    {r.links.map((l) => (
                                        <a key={l.url} className="link" href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a>
                                    ))}
                                </div>

                                <div
                                    className={`${s.scrub} ${isCurrent ? s.scrubLive : ''} ${dragging ? s.scrubbing : ''}`}
                                    role="slider"
                                    tabIndex={isCurrent ? 0 : -1}
                                    aria-label={`Seek ${r.tracks[head].title}`}
                                    aria-disabled={!isCurrent || !time.d}
                                    aria-valuemin={0}
                                    aria-valuemax={Math.round(time.d) || 0}
                                    aria-valuenow={isCurrent ? Math.round(at) || 0 : 0}
                                    aria-valuetext={isCurrent ? `${fmt(at)} of ${fmt(time.d)}` : 'Not playing'}
                                    onPointerDown={isCurrent ? onScrubDown : undefined}
                                    onPointerMove={isCurrent ? onScrubMove : undefined}
                                    onPointerUp={isCurrent ? onScrubUp : undefined}
                                    onPointerCancel={isCurrent ? onScrubUp : undefined}
                                    onKeyDown={isCurrent ? onScrubKey : undefined}
                                >
                                    <div className={s.progress}>
                                        <span style={{ transform: `scaleX(${progress})` }} />
                                        <i className={s.knob} style={{ left: `${progress * 100}%` }} />
                                    </div>
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ol>
        </PageShell>
    );
}

export default Discography;
