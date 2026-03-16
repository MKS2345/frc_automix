import { Component } from 'react';

export class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null, info: null };
    }

    componentDidCatch(error, info) {
        console.error('[ErrorBoundary] caught:', error.message);
        console.error('[ErrorBoundary] stack:', error.stack);
        console.error('[ErrorBoundary] componentStack:', info.componentStack);
        this.setState({ error, info });
    }

    render() {
        if (this.state.error) {
            return (
                <div style={{
                    padding: 40, background: '#070b14', minHeight: '100vh',
                    color: '#e2e8f0', fontFamily: 'monospace',
                }}>
                    <h2 style={{ color: '#ef4444', marginBottom: 16 }}>
                        💥 {this.state.error.message}
                    </h2>
                    <pre style={{
                        background: '#0d1526', padding: 20, borderRadius: 8,
                        color: '#94a3b8', fontSize: 12, overflow: 'auto',
                        border: '1px solid #1a2e4a', whiteSpace: 'pre-wrap',
                    }}>
            {this.state.info?.componentStack}
          </pre>
                    <pre style={{
                        background: '#0d1526', padding: 20, borderRadius: 8,
                        color: '#f87171', fontSize: 11, overflow: 'auto',
                        border: '1px solid #7f1d1d', marginTop: 12, whiteSpace: 'pre-wrap',
                    }}>
            {this.state.error.stack}
          </pre>
                </div>
            );
        }
        return this.props.children;
    }
}