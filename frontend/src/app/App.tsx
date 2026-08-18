import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { api } from '../services/api';
import Reader from '../pages/Reader/Reader';
import Login from '../pages/Login/Login';
import AdminDashboard from '../pages/Admin/AdminDashboard';
import ChapterEditorPage from '../pages/Admin/ChapterEditorPage';
import MediaLibraryPage from '../pages/Admin/MediaLibraryPage';

// Protected Route Wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    api.auth.me()
      .then(() => {
        setAuthenticated(true);
        setChecking(false);
      })
      .catch(() => {
        setAuthenticated(false);
        setChecking(false);
      });
  }, []);

  if (checking) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-secondary)' }}>
        <div style={{ width: '2rem', height: '2rem', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return authenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const [showCookies, setShowCookies] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setShowCookies(true);
    }
  }, []);

  return (
    <>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Navigate to="/book/2026" replace />} />
          <Route path="/book/:year" element={<Reader />} />
          <Route path="/book/:year/chapter/:chapterId" element={<Reader />} />
          
          {/* Admin Login */}
          <Route path="/login" element={<Login />} />

          {/* Protected Admin Routes */}
          <Route path="/admin" element={
            <ProtectedRoute>
              <Navigate to="/admin/books" replace />
            </ProtectedRoute>
          } />
          
          <Route path="/admin/books" element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/admin/books/:bookId" element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          <Route path="/admin/books/:bookId/chapters/:chapterId" element={
            <ProtectedRoute>
              <ChapterEditorPage />
            </ProtectedRoute>
          } />

          <Route path="/admin/media" element={
            <ProtectedRoute>
              <MediaLibraryPage />
            </ProtectedRoute>
          } />

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>

      {showCookies && (
        <div 
          className="fade-in"
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            right: '20px',
            maxWidth: '420px',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '1.25rem',
            boxShadow: '0 20px 25px -5px var(--shadow-color), 0 10px 10px -5px var(--shadow-color)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Мы используем файлы cookie для улучшения работы сайта и сбора статистики посещаемости через Яндекс.Метрику. Продолжая использовать сайт, вы соглашаетесь с этим.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                localStorage.setItem('cookie-consent', 'true');
                setShowCookies(false);
              }}
              style={{
                backgroundColor: 'var(--accent-color)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 16px',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background-color var(--transition-speed)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-color)'}
            >
              Хорошо
            </button>
          </div>
        </div>
      )}
    </>
  );
}
