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
          <p style={{ color: '#a0aec0', marginBottom: '20px', maxWidth: '500px' }}>
            Ứng dụng đã tự động ngăn chặn sự cố trắng trang. Vui lòng ấn nút bên dưới để tải lại trang mượt mà.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 'bold',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #00f2fe, #ff007f)',
              color: '#fff',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0, 242, 254, 0.4)'
            }}
          >
            🔄 Tải Lại Trang
          </button>
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
