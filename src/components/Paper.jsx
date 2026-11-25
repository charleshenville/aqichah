import React from 'react';
import paperBg from '../assets/images/paper-bg.webp';
import paperFg from '../assets/images/paper-fg.webp';

const IMAGES = { bg: paperBg, fg: paperFg };

/** The paper scan over its container: 'bg' over photos, 'fg' over the violet. */
function Paper({ variant = 'fg', fixed = false }) {
    return <div className={`paper paper-${variant} ${fixed ? 'fixed' : ''}`} style={{ backgroundImage: `url(${IMAGES[variant]})` }} aria-hidden="true" />;
}

export default Paper;
