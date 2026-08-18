import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Book, Chapter } from '../../types';
import {
  BookOpen,
  Plus,
  FolderOpen,
  Image as ImageIcon,
  LogOut,
  Edit2,
  Trash2,
  Calendar,
  Globe,
  Lock,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Copy,
  ChevronLeft
} from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  
  // Dashboard modes: 'books' or 'chapters' (viewing a specific book)
  const [view, setView] = useState<'books' | 'chapters'>('books');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showBookModal, setShowBookModal] = useState(false);
  const [showChapterModal, setShowChapterModal] = useState(false);
  
  // Book Form State
  const [bookForm, setBookForm] = useState({ id: 0, year: 2026, title: '', description: '' });
  const [isEditingBook, setIsEditingBook] = useState(false);
  
  // Chapter Form State
  const [chapForm, setChapForm] = useState({ id: 0, title: '', description: '', cover_media_id: null as number | null });
  const [isEditingChap, setIsEditingChap] = useState(false);

  // Password Change State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Load books on mount
  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = () => {
    setLoading(true);
    api.books.list()
      .then(data => {
        setBooks(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load books:', err);
        setLoading(false);
        if (err.status === 401) {
          navigate('/login');
        }
      });
  };

  const handleBookClick = (book: Book) => {
    setSelectedBook(book);
    setLoading(true);
    api.chapters.list(book.id)
      .then(chaps => {
        setChapters(chaps);
        setView('chapters');
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load chapters:', err);
        setLoading(false);
      });
  };

  const handleLogout = async () => {
    try {
      await api.auth.logout();
      navigate('/login');
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // BOOK CRUD OPERATIONS
  // ==========================================

  const openNewBookModal = () => {
    setIsEditingBook(false);
    setBookForm({ id: 0, year: new Date().getFullYear(), title: '', description: '' });
    setShowBookModal(true);
  };

  const openEditBookModal = (book: Book, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingBook(true);
    setBookForm({ id: book.id, year: book.year, title: book.title, description: book.description || '' });
    setShowBookModal(true);
  };

  const saveBook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditingBook) {
        await api.books.update(bookForm.id, bookForm);
      } else {
        await api.books.create(bookForm);
      }
      setShowBookModal(false);
      loadBooks();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const deleteBook = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Вы уверены, что хотите удалить эту книгу? Все главы и их контент будут стёрты.')) return;
    try {
      await api.books.delete(id);
      loadBooks();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleBookPublish = async (book: Book, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (book.status === 'published') {
        await api.books.unpublish(book.id);
      } else {
        await api.books.publish(book.id);
      }
      loadBooks();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ==========================================
  // CHAPTER CRUD OPERATIONS
  // ==========================================

  const loadChapters = (bookId: number) => {
    api.chapters.list(bookId)
      .then(setChapters)
      .catch(console.error);
  };

  const openNewChapModal = () => {
    setIsEditingChap(false);
    setChapForm({ id: 0, title: '', description: '', cover_media_id: null });
    setShowChapterModal(true);
  };

  const openEditChapModal = (chap: Chapter, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingChap(true);
    setChapForm({ id: chap.id, title: chap.title, description: chap.description || '', cover_media_id: chap.cover_media_id });
    setShowChapterModal(true);
  };

  const saveChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook) return;
    try {
      if (isEditingChap) {
        await api.chapters.update(chapForm.id, {
          title: chapForm.title,
          description: chapForm.description,
          cover_media_id: chapForm.cover_media_id
        });
      } else {
        await api.chapters.create(selectedBook.id, {
          title: chapForm.title,
          description: chapForm.description,
          cover_media_id: chapForm.cover_media_id
        });
      }
      setShowChapterModal(false);
      loadChapters(selectedBook.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const deleteChapter = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Вы уверены, что хотите удалить эту главу?')) return;
    try {
      await api.chapters.delete(id);
      if (selectedBook) loadChapters(selectedBook.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleChapterPublish = async (chap: Chapter, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (chap.status === 'published') {
        await api.chapters.unpublish(chap.id);
      } else {
        await api.chapters.publish(chap.id);
      }
      if (selectedBook) loadChapters(selectedBook.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const duplicateChapter = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.chapters.duplicate(id);
      if (selectedBook) loadChapters(selectedBook.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const moveChapter = async (index: number, direction: 'up' | 'down') => {
    if (!selectedBook) return;
    const newChaps = [...chapters];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIdx < 0 || targetIdx >= newChaps.length) return;
    
    // Swap
    const temp = newChaps[index];
    newChaps[index] = newChaps[targetIdx];
    newChaps[targetIdx] = temp;

    setChapters(newChaps);
    
    try {
      await api.chapters.reorder(newChaps.map(c => c.id));
    } catch (err: any) {
      alert(err.message);
      loadChapters(selectedBook.id);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      alert('Новый пароль должен быть не менее 6 символов');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('Новые пароли не совпадают');
      return;
    }
    try {
      await api.auth.changePassword({ currentPassword, newPassword });
      alert('Пароль успешно изменен!');
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      alert(err.message || 'Не удалось изменить пароль');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: 'var(--bg-secondary)', overflow: 'hidden' }}>
      {/* Admin Panel Sidebar */}
      <aside style={{
        width: '260px',
        backgroundColor: 'var(--bg-primary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '1.5rem 1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2.5rem', padding: '0 0.5rem' }}>
            <BookOpen size={24} style={{ color: 'var(--accent-color)' }} />
            <div>
              <span style={{ fontWeight: 700, fontSize: '1rem', display: 'block' }}>Красная горка</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Панель управления</span>
            </div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              onClick={() => { setView('books'); setSelectedBook(null); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                textAlign: 'left',
                fontWeight: view === 'books' ? 600 : 400,
                backgroundColor: view === 'books' ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                color: view === 'books' ? 'var(--accent-color)' : 'var(--text-primary)',
              }}
            >
              <FolderOpen size={18} /> Книги
            </button>
            <Link
              to="/admin/media"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                textDecoration: 'none',
                color: 'var(--text-primary)',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <ImageIcon size={18} style={{ color: 'var(--text-secondary)' }} /> Медиатека
            </Link>
          </nav>
        </div>

        <button
          onClick={() => setShowPasswordModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            backgroundColor: 'transparent',
            textAlign: 'left',
            fontWeight: 500,
            marginBottom: '0.5rem',
            width: '100%',
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Lock size={18} style={{ color: 'var(--text-secondary)' }} /> Сменить пароль
        </button>

        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            color: '#ef4444',
            backgroundColor: 'transparent',
            textAlign: 'left',
            fontWeight: 500,
            width: '100%',
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.05)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <LogOut size={18} /> Выйти
        </button>
      </aside>

      {/* Main Admin Workspace */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Header */}
        <header style={{
          height: '64px',
          backgroundColor: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 2rem'
        }}>
          <div>
            {view === 'chapters' && selectedBook ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => { setView('books'); setSelectedBook(null); }}
                  style={{ background: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem' }}
                >
                  <ChevronLeft size={16} /> Книги
                </button>
                <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontWeight: 600 }}>Главы летописи {selectedBook.year}</span>
              </div>
            ) : (
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Все летописи</h2>
            )}
          </div>

          <div>
            {view === 'books' ? (
              <button onClick={openNewBookModal} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                <Plus size={16} /> Создать летопись
              </button>
            ) : (
              <button onClick={openNewChapModal} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                <Plus size={16} /> Добавить главу
              </button>
            )}
          </div>
        </header>

        {/* Workspace Content */}
        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
              <div style={{ width: '2rem', height: '2rem', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : view === 'books' ? (
            /* ==========================================
               BOOKS VIEW
            ========================================== */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {books.map(book => (
                <div
                  key={book.id}
                  onClick={() => handleBookClick(book)}
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 3px var(--shadow-color)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 10px 15px -3px var(--shadow-color)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 3px var(--shadow-color)';
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={14} /> {book.year} ГОД
                      </span>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '12px',
                        backgroundColor: book.status === 'published' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                        color: book.status === 'published' ? '#22c55e' : 'var(--text-muted)',
                      }}>
                        {book.status === 'published' ? 'Опубликован' : 'Черновик'}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>{book.title}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: '0 0 1.5rem 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {book.description || 'Описание отсутствует.'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: 'auto' }}>
                    <button
                      onClick={(e) => toggleBookPublish(book, e)}
                      style={{ background: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                    >
                      {book.status === 'published' ? <Lock size={14} /> : <Globe size={14} />}
                      {book.status === 'published' ? 'В черновик' : 'Опубликовать'}
                    </button>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={(e) => openEditBookModal(book, e)}
                        style={{ background: 'none', color: 'var(--accent-color)', padding: '4px' }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => deleteBook(book.id, e)}
                        style={{ background: 'none', color: '#ef4444', padding: '4px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ==========================================
               CHAPTERS VIEW
            ========================================== */
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              {chapters.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: 'var(--bg-primary)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                  <h3>В книге еще нет глав</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Создайте первую главу, чтобы наполнить летопись контентом.</p>
                  <button onClick={openNewChapModal} className="btn-primary" style={{ marginTop: '1rem', fontSize: '0.875rem' }}>Создать главу</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {chapters.map((chap, index) => (
                    <div
                      key={chap.id}
                      style={{
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        padding: '1rem 1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '0 1px 2px var(--shadow-color)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {/* Order Controls */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <button
                            onClick={() => moveChapter(index, 'up')}
                            disabled={index === 0}
                            style={{ background: 'none', padding: '2px', opacity: index === 0 ? 0.3 : 1, cursor: index === 0 ? 'default' : 'pointer' }}
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            onClick={() => moveChapter(index, 'down')}
                            disabled={index === chapters.length - 1}
                            style={{ background: 'none', padding: '2px', opacity: index === chapters.length - 1 ? 0.3 : 1, cursor: index === chapters.length - 1 ? 'default' : 'pointer' }}
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                              Глава {String(index + 1).padStart(2, '0')}
                            </span>
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 500,
                              padding: '0.1rem 0.4rem',
                              borderRadius: '10px',
                              backgroundColor: chap.status === 'published' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                              color: chap.status === 'published' ? '#22c55e' : 'var(--text-muted)',
                            }}>
                              {chap.status === 'published' ? 'Публичный' : 'Черновик'}
                            </span>
                          </div>
                          
                          <Link
                            to={`/admin/books/${selectedBook?.id}/chapters/${chap.id}`}
                            style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-color)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-primary)'}
                          >
                            {chap.title}
                          </Link>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <button
                          onClick={(e) => toggleChapterPublish(chap, e)}
                          style={{ background: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                        >
                          {chap.status === 'published' ? <Lock size={14} /> : <Globe size={14} />}
                          {chap.status === 'published' ? 'В черновик' : 'Опубликовать'}
                        </button>
                        
                        <button
                          onClick={(e) => duplicateChapter(chap.id, e)}
                          style={{ background: 'none', color: 'var(--text-secondary)' }}
                          title="Дублировать главу"
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          onClick={(e) => openEditChapModal(chap, e)}
                          style={{ background: 'none', color: 'var(--accent-color)' }}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => deleteChapter(chap.id, e)}
                          style={{ background: 'none', color: '#ef4444' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ==========================================
          BOOK DIALOG MODAL
      ========================================== */}
      {showBookModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <form onSubmit={saveBook} className="scale-in" style={{ backgroundColor: 'var(--bg-primary)', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '460px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', fontFamily: 'var(--font-serif)' }}>
              {isEditingBook ? 'Редактировать летопись' : 'Создать новую летопись'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Год смены</label>
                <input
                  type="number"
                  value={bookForm.year}
                  onChange={e => setBookForm(s => ({ ...s, year: parseInt(e.target.value) || 2026 }))}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Название летописи</label>
                <input
                  type="text"
                  placeholder="Летопись 2026 года..."
                  value={bookForm.title}
                  onChange={e => setBookForm(s => ({ ...s, title: e.target.value }))}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Краткое описание</label>
                <textarea
                  rows={3}
                  placeholder="Опишите летопись..."
                  value={bookForm.description}
                  onChange={e => setBookForm(s => ({ ...s, description: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setShowBookModal(false)} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>Отмена</button>
              <button type="submit" className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>Сохранить</button>
            </div>
          </form>
        </div>
      )}

      {/* ==========================================
          CHAPTER DIALOG MODAL
      ========================================== */}
      {showChapterModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <form onSubmit={saveChapter} className="scale-in" style={{ backgroundColor: 'var(--bg-primary)', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '460px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', fontFamily: 'var(--font-serif)' }}>
              {isEditingChap ? 'Редактировать главу' : 'Добавить главу'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Название главы</label>
                <input
                  type="text"
                  placeholder="Открытие смены..."
                  value={chapForm.title}
                  onChange={e => setChapForm(s => ({ ...s, title: e.target.value }))}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Описание главы</label>
                <textarea
                  rows={3}
                  placeholder="Опишите кратко события в этой главе..."
                  value={chapForm.description}
                  onChange={e => setChapForm(s => ({ ...s, description: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setShowChapterModal(false)} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>Отмена</button>
              <button type="submit" className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>Сохранить</button>
            </div>
          </form>
        </div>
      )}

      {/* ==========================================
          PASSWORD CHANGE DIALOG MODAL
      ========================================== */}
      {showPasswordModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <form onSubmit={handlePasswordChange} className="scale-in" style={{ backgroundColor: 'var(--bg-primary)', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '460px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', fontFamily: 'var(--font-serif)' }}>
              Сменить пароль администратора
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Текущий пароль</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Новый пароль</label>
                <input
                  type="password"
                  placeholder="Минимум 6 символов"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Подтвердите новый пароль</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => {
                setShowPasswordModal(false);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
              }} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>Отмена</button>
              <button type="submit" className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>Сохранить</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
