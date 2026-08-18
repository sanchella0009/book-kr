import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Media } from '../../types';
import {
  ArrowLeft,
  Upload,
  Search,
  Trash2,
  Save,
  Tag,
  Calendar,
  Info,
  X,
  Sparkles,
  Camera
} from 'lucide-react';

export default function MediaLibraryPage() {
  const navigate = useNavigate();

  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [team, setTeam] = useState('');
  const [event, setEvent] = useState('');

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // Metadata Form State
  const [metaForm, setMetaForm] = useState({
    title: '',
    description: '',
    captured_at: '',
    team: '',
    event: '',
    author: ''
  });

  useEffect(() => {
    loadMedia();
  }, [search, team, event]);

  const loadMedia = () => {
    setLoading(true);
    api.media.list({ search, team, event })
      .then(data => {
        setMediaList(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load media:', err);
        setLoading(false);
        if (err.status === 401) {
          navigate('/login');
        }
      });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    setUploading(true);
    setUploadProgress('Идет обработка и сжатие изображений в WebP...');

    try {
      await api.media.upload(formData);
      loadMedia();
      alert('Файлы успешно загружены и оптимизированы!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const handleMediaSelect = (media: Media) => {
    setSelectedMedia(media);
    // Format date for html input (YYYY-MM-DD)
    let formattedDate = '';
    if (media.captured_at) {
      formattedDate = new Date(media.captured_at).toISOString().split('T')[0];
    }

    setMetaForm({
      title: media.title || '',
      description: media.description || '',
      captured_at: formattedDate,
      team: media.team || '',
      event: media.event || '',
      author: media.author || ''
    });
  };

  const deleteMedia = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту фотографию из медиатеки? Она перестанет отображаться во всех главах.')) return;
    try {
      await api.media.delete(id);
      setSelectedMedia(null);
      loadMedia();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const saveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedia) return;

    try {
      const updated = await api.media.update(selectedMedia.id, metaForm);
      setSelectedMedia(updated);
      loadMedia();
      alert('Метаданные сохранены!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: 'var(--bg-secondary)', overflow: 'hidden' }}>
      
      {/* Media Main Viewport */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        
        {/* Header toolbar */}
        <header style={{
          height: '64px',
          backgroundColor: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.5rem',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link to="/admin" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem' }}>
              <ArrowLeft size={18} /> В панель управления
            </Link>
            <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Медиа-библиотека лагеря</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* File upload triggers */}
            <label className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', padding: '0.5rem 1rem' }}>
              <Upload size={16} /> Загрузить фотографии
              <input type="file" multiple accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
            </label>
            {uploading && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{uploadProgress}</span>}
          </div>
        </header>

        {/* Filter bar */}
        <div style={{
          padding: '1rem 1.5rem',
          backgroundColor: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Поиск по названию, автору..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '2.25rem', width: '100%', fontSize: '0.85rem' }}
            />
          </div>

          <input
            type="text"
            placeholder="Фильтр по отряду (например, 1 отряд)"
            value={team}
            onChange={e => setTeam(e.target.value)}
            style={{ fontSize: '0.85rem', width: '200px' }}
          />

          <input
            type="text"
            placeholder="Фильтр по мероприятию"
            value={event}
            onChange={e => setEvent(e.target.value)}
            style={{ fontSize: '0.85rem', width: '200px' }}
          />
        </div>

        {/* Media grid list area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
              <div style={{ width: '2rem', height: '2rem', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : mediaList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              Фотографии не найдены. Загрузите новые фотографии в правом верхнем углу!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.5rem' }}>
              {mediaList.map(media => {
                const isSelected = selectedMedia?.id === media.id;
                
                return (
                  <div
                    key={media.id}
                    onClick={() => handleMediaSelect(media)}
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid',
                      borderColor: isSelected ? 'var(--accent-color)' : 'var(--border-color)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px var(--shadow-color)',
                      transition: 'all 0.2s ease',
                      transform: isSelected ? 'scale(1.02)' : 'none'
                    }}
                  >
                    <div style={{ width: '100%', height: '140px', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)', position: 'relative' }}>
                      <img src={media.thumbnail_path} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                      <div style={{ position: 'absolute', bottom: '4px', right: '4px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.65rem', padding: '2px 4px', borderRadius: '3px' }}>
                        {media.width}x{media.height}
                      </div>
                    </div>
                    <div style={{ padding: '0.75rem', fontSize: '0.8rem' }}>
                      <h4 style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', fontWeight: 600, margin: 0 }}>
                        {media.title || media.original_name}
                      </h4>
                      {media.team && <div style={{ fontSize: '0.7rem', color: 'var(--accent-color)', marginTop: '4px' }}>{media.team}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ==========================================
          MEDIA PROPERTIES / METADATA SIDE PANEL
      ========================================== */}
      {selectedMedia && (
        <div style={{
          width: '380px',
          backgroundColor: 'var(--bg-primary)',
          borderLeft: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          {/* Panel Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1.1rem', fontWeight: 700 }}>
              <Info size={16} /> Детали фотографии
            </h3>
            <button onClick={() => setSelectedMedia(null)} style={{ background: 'none', color: 'var(--text-primary)' }}>
              <X size={20} />
            </button>
          </div>

          {/* Properties body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Image Preview */}
            <div style={{ width: '100%', maxHeight: '200px', overflow: 'hidden', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
              <img src={selectedMedia.optimized_path} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} alt="" />
            </div>

            {/* Info details list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div>Файл: {selectedMedia.original_name}</div>
              <div>Разрешение: {selectedMedia.width} x {selectedMedia.height} пикселей</div>
              <div>Размер оригинала: {(selectedMedia.orig_size / 1024 / 1024).toFixed(2)} MB</div>
              <div>Сжатый WebP: {(selectedMedia.size / 1024).toFixed(1)} KB (Сжатие: {Math.round((1 - selectedMedia.size / selectedMedia.orig_size) * 100)}%)</div>
            </div>

            {/* Edit metadata form */}
            <form onSubmit={saveMetadata} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Название фотографии</label>
                <input
                  type="text"
                  value={metaForm.title}
                  onChange={e => setMetaForm(s => ({ ...s, title: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Описание / Подпись</label>
                <textarea
                  rows={2}
                  value={metaForm.description}
                  onChange={e => setMetaForm(s => ({ ...s, description: e.target.value }))}
                  style={{ fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={14} /> Дата съемки
                </label>
                <input
                  type="date"
                  value={metaForm.captured_at}
                  onChange={e => setMetaForm(s => ({ ...s, captured_at: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Tag size={14} /> Отряд
                </label>
                <input
                  type="text"
                  placeholder="Например, 1 отряд"
                  value={metaForm.team}
                  onChange={e => setMetaForm(s => ({ ...s, team: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={14} /> Мероприятие
                </label>
                <input
                  type="text"
                  placeholder="Например, Визитная карточка"
                  value={metaForm.event}
                  onChange={e => setMetaForm(s => ({ ...s, event: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Camera size={14} /> Автор фото
                </label>
                <input
                  type="text"
                  placeholder="Имя фотографа..."
                  value={metaForm.author}
                  onChange={e => setMetaForm(s => ({ ...s, author: e.target.value }))}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => deleteMedia(selectedMedia.id)}
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '6px',
                    padding: '0.5rem',
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    fontSize: '0.8rem'
                  }}
                >
                  <Trash2 size={16} /> Удалить
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{
                    flex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    fontSize: '0.8rem',
                    padding: '0.5rem'
                  }}
                >
                  <Save size={16} /> Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
