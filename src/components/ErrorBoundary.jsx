import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    render() {
        if (this.state.hasError && this.state.error) {
            const { error, errorInfo } = this.state;
            return (
                <div style={{
                    padding: 24,
                    margin: 16,
                    background: '#1a1a1a',
                    border: '1px solid #ff4444',
                    borderRadius: 8,
                    color: '#fff',
                    fontFamily: 'monospace',
                    fontSize: 13,
                    overflow: 'auto',
                    maxHeight: '80vh'
                }}>
                    <h2 style={{ color: '#ff6666', marginTop: 0 }}>發生錯誤</h2>
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {error.toString()}
                    </pre>
                    {errorInfo?.componentStack && (
                        <>
                            <h3 style={{ color: '#ffaa66' }}>Component Stack:</h3>
                            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, opacity: 0.9 }}>
                                {errorInfo.componentStack}
                            </pre>
                        </>
                    )}
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
