import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';

createRoot(document.getElementById('root')).render(
    // No StrictMode: the tools manage WebGL contexts, workers and encoders
    // imperatively and were written against single-run effects.
    <BrowserRouter>
        <App />
    </BrowserRouter>,
);
