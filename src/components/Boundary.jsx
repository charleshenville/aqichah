import React from 'react';

/** Keeps one failing piece (a preview, a tool) from taking the page down with it. */
class Boundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error) {
        console.error(error);
    }

    render() {
        if (this.state.error) return this.props.fallback ?? null;
        return this.props.children;
    }
}

export default Boundary;
