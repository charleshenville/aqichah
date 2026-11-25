// The panel's controls, and a group of parameters drawn from its
// definitions (params.js), so every parameter has its control without being
// written out by hand, the way the compositor's inspector draws its schema.

import React from 'react';
import { Shuffle } from 'lucide-react';
import VfxNumberField from '../VfxNumberField';
import ColorPicker from '../ui/ColorPicker';
import vfx from '../vfx.module.css';
import styles from './manifolds.module.css';

export function Slider({
    label, value, min, max, step, onChange, int, title, disabled, extra,
}) {
    const commit = (n) => onChange(int ? Math.round(n) : n);
    return (
        <div className={vfx.vfx_row} style={extra ? { gridTemplateColumns: '78px 1fr 52px 22px' } : undefined}>
            <span className={vfx.vfx_label} title={title || label}>{label}</span>
            <input
                type="range"
                className={vfx.vfx_slider}
                min={min}
                max={max}
                step={step}
                value={value}
                disabled={disabled}
                onChange={(e) => commit(parseFloat(e.target.value))}
            />
            <VfxNumberField value={value} min={min} max={max} step={step} disabled={disabled} onCommit={commit} />
            {extra}
        </div>
    );
}

export function Seg({
    options, value, onPick, columns,
}) {
    return (
        <div className={vfx.vfx_segRow} style={{ gridTemplateColumns: `repeat(${columns || options.length}, 1fr)` }}>
            {options.map(([id, name]) => (
                <button
                    type="button"
                    key={String(id)}
                    className={`${vfx.vfx_segBtn} ${value === id ? vfx.vfx_segBtnOn : ''}`}
                    onClick={() => onPick(id)}
                >
                    {name}
                </button>
            ))}
        </div>
    );
}

export function Switch({ label, value, onChange }) {
    return (
        <div
            className={vfx.vfx_checkRow}
            role="switch"
            aria-checked={!!value}
            tabIndex={0}
            onClick={() => onChange(!value)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(!value); } }}
        >
            <span>{label}</span>
            <span className={`${vfx.vfx_switch} ${value ? vfx.vfx_switchOn : ''}`}>
                <span className={vfx.vfx_knob} />
            </span>
        </div>
    );
}

export function ColorRow({ label, value, onChange }) {
    return (
        <div className={vfx.vfx_row}>
            <span className={vfx.vfx_label}>{label}</span>
            <ColorPicker value={value} onChange={onChange} title={label} style={{ gridColumn: '2 / 4' }} />
        </div>
    );
}

export function SelectRow({
    label, value, options, onChange,
}) {
    return (
        <div className={vfx.vfx_row} style={{ gridTemplateColumns: '78px 1fr' }}>
            <span className={vfx.vfx_label}>{label}</span>
            <select className={vfx.vfx_select} value={String(value)} onChange={(e) => onChange(options.find(([o]) => String(o) === e.target.value)?.[0])}>
                {options.map(([o, l]) => <option key={String(o)} value={String(o)}>{l}</option>)}
            </select>
        </div>
    );
}

export const Hint = ({ children, style }) => <div className={vfx.vfx_hint} style={{ marginTop: 8, ...style }}>{children}</div>;

// Sections are always open: every control is in view, nothing collapses.
export function Section({ title, children, extra }) {
    return (
        <div className={vfx.vfx_section}>
            <div className={styles.sectionHead}>
                <div className={vfx.vfx_sectionTitle}>{title}</div>
                {extra && <span className={styles.sectionExtra}>{extra}</span>}
            </div>
            {children}
        </div>
    );
}

const shortOptions = (opts) => opts.length <= 3 && opts.every(([, l]) => String(l).length <= 9);

/** One parameter's control, from its definition. */
export function ParamControl({ def, value, onChange }) {
    switch (def.type) {
        case 'bool':
            return <Switch label={def.label} value={value} onChange={onChange} />;
        case 'color':
            return <ColorRow label={def.label} value={value} onChange={onChange} />;
        case 'select':
            return shortOptions(def.options)
                ? (
                    <div className={styles.segLabelled}>
                        <span className={vfx.vfx_label}>{def.label}</span>
                        <Seg options={def.options} value={value} onPick={onChange} />
                    </div>
                )
                : <SelectRow label={def.label} value={value} options={def.options} onChange={onChange} />;
        case 'number': {
            const int = def.step >= 1 && Number.isInteger(def.step);
            const extra = def.key === 'seed'
                ? (
                    <button type="button" className={vfx.vfx_iconBtn} style={{ justifySelf: 'end' }} aria-label="Random seed" onClick={() => onChange(Math.floor(Math.random() * 10000))}>
                        <Shuffle size={12} />
                    </button>
                )
                : null;
            return (
                <Slider
                    label={def.label}
                    value={value ?? def.def}
                    min={def.min}
                    max={def.max}
                    step={def.step}
                    int={int}
                    onChange={onChange}
                    extra={extra}
                />
            );
        }
        default:
            return null;
    }
}

/** A group of parameters as a section. `children` go after the parameters. */
export function ParamGroup({
    group, p, set, open, onToggle, children,
}) {
    if (group.when && !group.when(p)) return null;
    return (
        <Section title={group.title}>
            {group.params.filter((d) => !d.when || d.when(p)).map((d) => (
                <ParamControl key={d.key} def={d} value={p[d.key]} onChange={(v) => set(d.key, v)} />
            ))}
            {children}
            {group.hint && <Hint>{group.hint}</Hint>}
        </Section>
    );
}
