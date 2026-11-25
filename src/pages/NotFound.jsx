import React from 'react';
import { Link } from 'react-router-dom';
import { TopBar } from '../components/PageShell';
import s from './notfound.module.css';

function NotFound() {
    return (
        <main className={s.page}>
            <TopBar />
            <div className={s.body}>
                <h1 className={s.code}>404</h1>
                <p style={{marginTop: '1rem'}}>nothing here. <Link className="link" to="/" style={{ fontWeight: '500' }}>take me back!!!</Link></p>
            </div>
        </main>
    );
}

export default NotFound;
