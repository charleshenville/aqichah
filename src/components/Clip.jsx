import React, { useEffect, useRef } from 'react';
import { clipUrl } from '../data/tools';

/**
 * A muted looping clip that fills its (positioned) parent. Nothing streams
 * until it is near the viewport; it pauses off screen and in a hidden tab;
 * reduced motion only ever shows the poster.
 */
function Clip({ name, className = '' }) {
    const ref = useRef(null);

    useEffect(() => {
        const v = ref.current;
        v.muted = true;
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
        let near = false;
        const sync = () => {
            if (near && !document.hidden) v.play().catch(() => {});
            else v.pause();
        };
        const io = new IntersectionObserver(([e]) => { near = e.isIntersecting; sync(); }, { rootMargin: '120px' });
        io.observe(v);
        document.addEventListener('visibilitychange', sync);
        return () => {
            io.disconnect();
            document.removeEventListener('visibilitychange', sync);
        };
    }, []);

    return (
        <video
            ref={ref}
            className={className}
            src={clipUrl(name, 'mp4')}
            poster={clipUrl(name, 'jpg')}
            muted
            loop
            playsInline
            preload="none"
            tabIndex={-1}
            aria-hidden="true"
        />
    );
}

export default Clip;
