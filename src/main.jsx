import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Lỗi React được bắt tự động:", error, errorInfo);
  }

  handleReset = () => {
    localStorage.clear();
    this.setState({ hasError: false });
    window.location.href = '/';
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
          <h2 style={{ fontSize: '22px', marginBottom: '12px', color: '#ff007f' }}>
            ⚠️ Đã khôi phục ứng dụng từ sự cố!
          </h2>
          <p style={{ color: '#a0aec0', marginBottom: '20px', maxWidth: '450px', fontSize: '13px' }}>
            Phát hiện dữ liệu cache hoặc liên kết bị lỗi. Nhấn nút bên dưới để dọn dẹp và khôi phục mượt mà.
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '10px 24px',
              fontSize: '13px',
              fontWeight: 'bold',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #00f2fe, #ff007f)',
              color: '#fff',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0, 242, 254, 0.4)'
            }}
          >
            🔄 Tải Lại & Khôi Phục Giao Diện
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
