import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Book as BookIcon, Calendar, ArrowRight, Sun, Layers } from 'lucide-react';
import { Book } from '../../types';

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.public.getBooks()
      .then(data => {
        setBooks(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch books:', err);
        setError('Не удалось загрузить летописи. Попробуйте обновить страницу.');
        setLoading(false);
      });
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      background: 'linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)',
      color: 'var(--text-primary)',
      padding: '2rem 1.5rem',
      overflowY: 'auto',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <header style={{
        maxWidth: '1200px',
        margin: '0 auto 4rem auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Sun size={32} style={{ color: 'var(--accent-color)' }} />
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
              Красная горка
            </h1>
            <p style={{ fontSize: '0.75rem', letterSpacing: '0.05rem', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>
              Цифровая Летопись Лагеря
            </p>
          </div>
        </div>
        <Link to="/login" style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          textDecoration: 'none',
          border: '1px solid var(--border-color)',
          padding: '0.5rem 1rem',
          borderRadius: '20px',
          transition: 'all var(--transition-speed)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
          e.currentTarget.style.borderColor = 'var(--text-muted)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.borderColor = 'var(--border-color)';
        }}
        >
          Панель управления
        </Link>
      </header>

      {/* Hero Section */}
      <main style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div className="fade-in" style={{ textAlign: 'center', marginBottom: '5rem' }}>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            lineHeight: 1.15,
            fontWeight: 800,
            maxWidth: '900px',
            margin: '0 auto 1.5rem auto'
          }}>
            Ожившие воспоминания летних смен
          </h2>
          <p style={{
            fontSize: 'clamp(1.1rem, 2vw, 1.4rem)',
            color: 'var(--text-secondary)',
            maxWidth: '650px',
            margin: '0 auto 2.5rem auto',
            lineHeight: 1.6
          }}>
            Интерактивная хроника событий, фотографий, отрядных историй и лагерной атмосферы. Выберите летопись, чтобы начать чтение.
          </p>
        </div>

        {/* Books List Grid */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
            <div style={{
              width: '2.5rem',
              height: '2.5rem',
              border: '3px solid var(--border-color)',
              borderTopColor: 'var(--accent-color)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <style>{`
              @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#ef4444' }}>{error}</div>
        ) : books.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            border: '2px dashed var(--border-color)',
            borderRadius: '12px',
            color: 'var(--text-secondary)',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            <Layers size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
            <h3>Нет опубликованных летописей</h3>
            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
              Администратор еще не опубликовал ни одной книги. Войдите в панель управления, чтобы создать первую летопись!
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '2.5rem',
            marginBottom: '4rem'
          }}>
            {books.map((book) => (
              <Link
                key={book.id}
                to={`/book/${book.year}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="scale-in" style={{
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '2rem',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 4px 6px -1px var(--shadow-color)',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-6px)';
                  e.currentTarget.style.borderColor = 'var(--text-muted)';
                  e.currentTarget.style.boxShadow = '0 20px 25px -5px var(--shadow-color)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px var(--shadow-color)';
                }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        color: 'var(--accent-color)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        padding: '0.35rem 0.75rem',
                        borderRadius: '20px'
                      }}>
                        <Calendar size={12} /> {book.year} ГОД
                      </span>
                      <BookIcon size={20} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 700, margin: '0 0 1rem 0' }}>
                      {book.title}
                    </h3>
                    
                    <p style={{
                      fontSize: '0.9rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                      margin: '0 0 2rem 0',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {book.description || 'Воспоминания, наполненные солнцем, детским смехом, песнями у костра и победами нашего лагеря.'}
                    </p>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: 'var(--accent-color)',
                    fontWeight: 600,
                    fontSize: '0.9rem'
                  }}>
                    Открыть летопись <ArrowRight size={16} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.8rem',
        marginTop: '6rem',
        paddingTop: '2rem',
        borderTop: '1px solid var(--border-color)'
      }}>
        © 2026 Лагерь «Красная горка». Все права защищены.
      </footer>
    </div>
  );
}
