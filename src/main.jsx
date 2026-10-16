import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("React Error Boundary Caught An Error:", error, errorInfo);
  }

  handleClearDataAndReload = () => {
    localStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#050608',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h1 style={{ fontSize: '24px', marginBottom: '12px', color: '#ff007f' }}>
            ⚠️ Đã xảy ra sự cố khi tải bài hát!
          </h1>
          <p style={{ color: '#a0aec0', marginBottom: '16px', maxWidth: '500px', fontSize: '14px' }}>
            Ứng dụng đã tự động ngăn chặn sự cố trắng trang. 
          </p>
          
          {this.state.error && (
            <pre style={{
              background: 'rgba(255,0,0,0.15)',
              color: '#ff4d4d',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              marginBottom: '20px',
              maxWidth: '80%',
              overflowX: 'auto',
              border: '1px solid rgba(255,77,77,0.3)'
            }}>
              {this.state.error.toString()}
            </pre>
          )}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: 'bold',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #00f2fe, #ff007f)',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              🔄 Tải Lại Trang
            </button>

            <button
              onClick={this.handleClearDataAndReload}
              style={{
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: 'bold',
                borderRadius: '12px',
                border: '1px solid #ff4d4d',
                background: 'rgba(255, 77, 77, 0.2)',
                color: '#ff4d4d',
                cursor: 'pointer'
              }}
            >
              🧹 Xóa Cache Lỗi & Tải Lại
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
