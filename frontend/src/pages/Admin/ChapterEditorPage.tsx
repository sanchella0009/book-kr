import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { ContentBlock, Chapter, Book, Media, Revision } from '../../types';
import {
  ArrowLeft,
  Copy,
  Trash2,
  Undo2,
  Redo2,
  Eye,
  Heading,
  AlignLeft,
  Image as ImageIcon,
  Quote,
  Calendar,
  Layout,
  History,
  X,
  Upload,
  AlignLeft as AlignLeftIcon,
  AlignCenter as AlignCenterIcon,
  AlignRight as AlignRightIcon,
  AlignJustify as AlignJustifyIcon,
  Smile
} from 'lucide-react';

export default function ChapterEditorPage() {
  const { bookId, chapterId } = useParams();

  const activeBookId = parseInt(bookId || '0');
  const activeChapterId = parseInt(chapterId || '0');

  // Book & Chapter States
  const [book, setBook] = useState<Book | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  
  // Editor States
  const [history, setHistory] = useState<ContentBlock[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [activeBlockId, setActiveBlockId] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('Сохранено только что');

  // Overlays / Panels
  const [showRevisions, setShowRevisions] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<Media[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Slash commands overlay
  const [slashMenu, setSlashMenu] = useState<{ visible: boolean; blockId: number; text: string } | null>(null);

  // Refs for autosave
  const saveTimeoutRef = useRef<any>(null);

  // Load Book, Chapter, Blocks
  useEffect(() => {
    if (!activeChapterId) return;

    api.books.get(activeBookId).then(setBook).catch(console.error);
    api.chapters.get(activeChapterId).then(setChapter).catch(console.error);

    setSaveStatus('saving');
    api.blocks.list(activeChapterId)
      .then(data => {
        setBlocks(data);
        setHistory([data]);
        setHistoryIndex(0);
        setSaveStatus('saved');
      })
      .catch(err => {
        console.error('Failed to load blocks:', err);
        setSaveStatus('dirty');
      });
  }, [activeBookId, activeChapterId]);

  // Autosave when blocks change, using a debounce
  const triggerAutosave = (newBlocks: ContentBlock[]) => {
    setSaveStatus('dirty');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        // Save current block items: update each block on the server or batch reorder
        for (const block of newBlocks) {
          // If block is temp or changed, update it. For safety and simplicity, we perform individual updates
          await api.blocks.update(block.id, {
            content: block.content,
            style: block.style,
            media_id: block.media_id,
            sort_order: block.sort_order,
          });
        }
        setSaveStatus('saved');
        setLastSavedTime(`Сохранено в ${new Date().toLocaleTimeString()}`);
      } catch (err) {
        console.error('Autosave failed:', err);
        setSaveStatus('dirty');
      }
    }, 1500);
  };

  // Push new state to undo/redo history stack
  const updateBlocksState = (newBlocks: ContentBlock[]) => {
    setBlocks(newBlocks);
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newBlocks);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    triggerAutosave(newBlocks);
  };

  // Undo / Redo Actions
  const handleUndo = () => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      setHistoryIndex(nextIdx);
      setBlocks(history[nextIdx]);
      triggerAutosave(history[nextIdx]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setBlocks(history[nextIdx]);
      triggerAutosave(history[nextIdx]);
    }
  };

  // Keyboard Event Handlers for Undo/Redo/Save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        // Force immediate save
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        setSaveStatus('saving');
        Promise.all(
          blocks.map(block =>
            api.blocks.update(block.id, {
              content: block.content,
              style: block.style,
              media_id: block.media_id,
            })
          )
        )
          .then(() => {
            setSaveStatus('saved');
            setLastSavedTime('Сохранено принудительно');
          })
          .catch(() => setSaveStatus('dirty'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [blocks, historyIndex, history]);

  // ==========================================
  // BLOCK LEVEL OPERATORS
  // ==========================================

  const addBlock = async (type: string) => {
    try {
      setSaveStatus('saving');
      const newBlock = await api.blocks.create(activeChapterId, {
        type,
        content: type === 'paragraph' ? 'Новый абзац...' : '',
        style: type === 'gallery' ? { columnsCount: 2 } : type === 'spacer' ? { spacerHeight: 30 } : null,
      });

      const nextBlocks = [...blocks, newBlock];
      updateBlocksState(nextBlocks);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const updateBlockContent = (id: number, content: string) => {
    // Check slash commands trigger
    const block = blocks.find(b => b.id === id);
    if (block && (block.type === 'paragraph' || block.type === 'heading')) {
      if (content === '/') {
        setSlashMenu({ visible: true, blockId: id, text: '' });
      } else if (content.startsWith('/') && !content.includes(' ')) {
        setSlashMenu({ visible: true, blockId: id, text: content });
      } else {
        setSlashMenu(null);
      }
    }

    const nextBlocks = blocks.map(b => (b.id === id ? { ...b, content } : b));
    setBlocks(nextBlocks);
    
    // Save with debounce
    triggerAutosave(nextBlocks);
  };

  // Convert block type (Slash commands helper)
  const changeBlockType = async (id: number, newType: any) => {
    try {
      const currentBlock = blocks.find(b => b.id === id);
      if (!currentBlock) return;

      setSaveStatus('saving');
      const updated = await api.blocks.update(id, {
        type: newType,
        content: currentBlock.content.startsWith('/') ? '' : currentBlock.content,
      });

      const nextBlocks = blocks.map(b => (b.id === id ? { ...b, type: newType, content: updated.content } : b));
      updateBlocksState(nextBlocks);
      setSlashMenu(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const deleteBlock = async (id: number) => {
    if (!confirm('Удалить этот блок?')) return;
    try {
      setSaveStatus('saving');
      await api.blocks.delete(id);
      const nextBlocks = blocks.filter(b => b.id !== id);
      updateBlocksState(nextBlocks);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const duplicateBlock = async (id: number) => {
    try {
      setSaveStatus('saving');
      const duplicated = await api.blocks.duplicate(id);
      
      // Find insert index
      const idx = blocks.findIndex(b => b.id === id);
      const nextBlocks = [...blocks];
      nextBlocks.splice(idx + 1, 0, duplicated);

      // Reorder sort_orders on server
      updateBlocksState(nextBlocks);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const updateBlockStyle = (id: number, stylePatch: any) => {
    const nextBlocks = blocks.map(b => {
      if (b.id === id) {
        return {
          ...b,
          style: { ...b.style, ...stylePatch },
        };
      }
      return b;
    });
    updateBlocksState(nextBlocks);
  };

  // ==========================================
  // DRAG & DROP REORDERING
  // ==========================================
  const dragItemIndex = useRef<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragItemIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragItemIndex.current === null || dragItemIndex.current === targetIndex) return;

    const reordered = [...blocks];
    const item = reordered.splice(dragItemIndex.current, 1)[0];
    reordered.splice(targetIndex, 0, item);
    
    setBlocks(reordered);
    dragItemIndex.current = null;

    try {
      setSaveStatus('saving');
      await api.blocks.reorder(activeChapterId, reordered.map(b => b.id));
      
      // Re-fetch blocks to ensure proper sorted orders from database
      const freshBlocks = await api.blocks.list(activeChapterId);
      updateBlocksState(freshBlocks);
    } catch (err: any) {
      alert(err.message);
      // Revert
      api.blocks.list(activeChapterId).then(setBlocks);
    }
  };

  // ==========================================
  // REVISIONS HISTORIES
  // ==========================================
  const loadRevisions = () => {
    api.revisions.list(activeChapterId)
      .then(setRevisions)
      .then(() => setShowRevisions(true))
      .catch(console.error);
  };

  const restoreRevision = async (revId: number) => {
    if (!confirm('Вы уверены, что хотите восстановить эту версию? Текущие изменения будут перезаписаны.')) return;
    try {
      setSaveStatus('saving');
      await api.revisions.restore(revId);
      const restored = await api.blocks.list(activeChapterId);
      
      updateBlocksState(restored);
      setShowRevisions(false);
      alert('Версия успешно восстановлена!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ==========================================
  // MEDIA LIBRARY PICKER
  // ==========================================
  const loadMedia = () => {
    api.media.list()
      .then(setMediaFiles)
      .then(() => setShowMediaPicker(true))
      .catch(console.error);
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    setUploading(true);
    try {
      await api.media.upload(formData);
      // reload media
      const refreshed = await api.media.list();
      setMediaFiles(refreshed);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const selectMediaForActiveBlock = async (media: Media) => {
    if (activeBlockId === null) return;
    try {
      setSaveStatus('saving');
      const block = blocks.find(b => b.id === activeBlockId);
      if (!block) return;

      // Automatically change type to image if it was paragraph/spacer
      let targetType = block.type;
      if (block.type !== 'image' && block.type !== 'image_with_caption') {
        targetType = 'image';
      }

      await api.blocks.update(activeBlockId, {
        media_id: media.id,
        type: targetType,
      });

      const nextBlocks = blocks.map(b =>
        b.id === activeBlockId
          ? {
              ...b,
              media_id: media.id,
              type: targetType,
              optimized_path: media.optimized_path,
              media_width: media.width,
              media_height: media.height,
            }
          : b
      );
      updateBlocksState(nextBlocks);
      setShowMediaPicker(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Slash commands selection list
  const slashOptions = [
    { label: 'Заголовок', type: 'heading', cmd: '/h', icon: <Heading size={16} /> },
    { label: 'Подзаголовок', type: 'subheading', cmd: '/sub', icon: <Heading size={14} /> },
    { label: 'Абзац текста', type: 'paragraph', cmd: '/p', icon: <AlignLeft size={16} /> },
    { label: 'Цитата', type: 'quote', cmd: '/quote', icon: <Quote size={16} /> },
    { label: 'Дата смены', type: 'date', cmd: '/date', icon: <Calendar size={16} /> },
    { label: 'Изображение', type: 'image', cmd: '/img', icon: <ImageIcon size={16} /> },
    { label: 'Стикер', type: 'sticker', cmd: '/sticker', icon: <Smile size={16} /> },
    { label: 'Разделитель', type: 'separator', cmd: '/sep', icon: <Layout size={16} /> },
  ];

  const filteredSlashOptions = slashMenu
    ? slashOptions.filter(o => o.cmd.startsWith(slashMenu.text) || o.label.toLowerCase().includes(slashMenu.text.substring(1)))
    : slashOptions;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: 'var(--bg-secondary)', overflow: 'hidden' }}>
      
      {/* Editor Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        
        {/* Editor Toolbar */}
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
            <Link to={`/admin`} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem' }}>
              <ArrowLeft size={18} /> В админку
            </Link>
            <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Летопись {book?.year}</span>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{chapter?.title}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Auto save indicator */}
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {saveStatus === 'saved' ? lastSavedTime : saveStatus === 'saving' ? 'Сохранение...' : 'Изменения не сохранены'}
            </span>

            {/* History stack triggers */}
            <div style={{ display: 'flex', gap: '4px', borderRight: '1px solid var(--border-color)', paddingRight: '1rem' }}>
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                style={{ background: 'none', color: 'var(--text-primary)', padding: '6px', opacity: historyIndex <= 0 ? 0.4 : 1 }}
              >
                <Undo2 size={18} />
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                style={{ background: 'none', color: 'var(--text-primary)', padding: '6px', opacity: historyIndex >= history.length - 1 ? 0.4 : 1 }}
              >
                <Redo2 size={18} />
              </button>
            </div>

            <button
              onClick={loadRevisions}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-color)',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                fontSize: '0.85rem'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <History size={16} /> История
            </button>

            <button
              onClick={() => setShowPreview(!showPreview)}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              <Eye size={16} /> {showPreview ? 'Скрыть предпросмотр' : 'Предпросмотр'}
            </button>
          </div>
        </header>

        {/* Content Block Editor Canvas */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          
          {/* Main vertical flow list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '3rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {blocks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', border: '2px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                  <h4>В главе пока нет блоков контента</h4>
                  <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Используйте кнопки снизу или нажмите в пустой области, чтобы добавить абзацы.</p>
                </div>
              ) : (
                blocks.map((block, idx) => {
                  const isActive = activeBlockId === block.id;
                  
                  return (
                    <div
                      key={block.id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, idx)}
                      onClick={() => setActiveBlockId(block.id)}
                      style={{
                        position: 'relative',
                        backgroundColor: isActive ? 'var(--bg-primary)' : 'transparent',
                        border: '1px solid',
                        borderColor: isActive ? 'var(--border-color)' : 'transparent',
                        borderRadius: '8px',
                        padding: '1rem',
                        transition: 'all 0.2s ease',
                        cursor: 'grab',
                      }}
                    >
                      {/* Drag handles & side options when focused */}
                      {isActive && (
                        <div style={{
                          position: 'absolute',
                          left: '-48px',
                          top: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          zIndex: 5
                        }}>
                          <button
                            onClick={() => duplicateBlock(block.id)}
                            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px', cursor: 'pointer' }}
                            title="Дублировать блок"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            onClick={() => deleteBlock(block.id)}
                            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px', color: '#ef4444', cursor: 'pointer' }}
                            title="Удалить блок"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}

                      {/* Content block content area depending on type */}
                      {block.type === 'image' || block.type === 'image_with_caption' ? (
                        <div style={{ textAlign: 'center' }}>
                          {block.optimized_path ? (
                            <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                              <img src={block.optimized_path} style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '6px' }} alt="" />
                              <button
                                onClick={loadMedia}
                                style={{ position: 'absolute', right: '10px', bottom: '10px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '4px', fontSize: '0.8rem' }}
                              >
                                Заменить
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={loadMedia}
                              style={{ width: '100%', height: '160px', border: '2px dashed var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: '8px' }}
                            >
                              <ImageIcon size={28} style={{ color: 'var(--text-muted)' }} />
                              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Выбрать изображение</span>
                            </div>
                          )}
                          {(block.type === 'image_with_caption') && (
                            <input
                              type="text"
                              placeholder="Введите подпись к изображению..."
                              value={block.content}
                              onChange={(e) => updateBlockContent(block.id, e.target.value)}
                              style={{ width: '100%', border: 'none', borderBottom: '1px solid transparent', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem', backgroundColor: 'transparent' }}
                              onFocus={e => e.currentTarget.style.borderBottomColor = 'var(--border-color)'}
                              onBlur={e => e.currentTarget.style.borderBottomColor = 'transparent'}
                            />
                          )}
                        </div>
                      ) : block.type === 'separator' ? (
                        <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '1rem 0' }} />
                      ) : block.type === 'spacer' ? (
                        <div style={{
                          height: `${block.style?.spacerHeight || 30}px`,
                          backgroundColor: 'rgba(59, 130, 246, 0.05)',
                          border: '1px dashed rgba(59, 130, 246, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          color: 'var(--accent-color)'
                        }}>
                          Пустой отступ: {block.style?.spacerHeight || 30}px
                        </div>
                      ) : (
                        /* Text block text editable container */
                        <div style={{ position: 'relative' }}>
                          <textarea
                            value={block.content}
                            onChange={(e) => updateBlockContent(block.id, e.target.value)}
                            placeholder={block.type === 'heading' ? 'Большой заголовок...' : block.type === 'subheading' ? 'Подзаголовок...' : 'Введите текст...'}
                            rows={Math.max(1, Math.ceil(block.content.length / 80))}
                            style={{
                              width: '100%',
                              resize: 'none',
                              border: 'none',
                              backgroundColor: 'transparent',
                              padding: '0',
                              fontSize: block.type === 'heading' ? '1.8rem' : block.type === 'subheading' ? '1.3rem' : '1rem',
                              fontFamily: block.type === 'heading' || block.type === 'subheading' ? 'var(--font-serif)' : 'var(--font-sans)',
                              fontWeight: block.type === 'heading' ? 700 : block.type === 'subheading' ? 600 : 400,
                              textAlign: (block.style?.align || 'left') as any,
                              color: 'var(--text-primary)',
                              outline: 'none',
                            }}
                          />
                          
                          {/* Slash options absolute trigger menu */}
                          {slashMenu && slashMenu.blockId === block.id && (
                            <div style={{
                              position: 'absolute',
                              left: '0',
                              top: '2.5rem',
                              width: '220px',
                              backgroundColor: 'var(--bg-primary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '8px',
                              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                              zIndex: 100,
                              maxHeight: '260px',
                              overflowY: 'auto',
                              padding: '6px'
                            }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '6px 8px', borderBottom: '1px solid var(--border-color)' }}>КОМАНДЫ</div>
                              {filteredSlashOptions.length === 0 ? (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px' }}>Ничего не найдено</div>
                              ) : (
                                filteredSlashOptions.map(opt => (
                                  <button
                                    key={opt.type}
                                    onClick={() => changeBlockType(block.id, opt.type)}
                                    style={{
                                      width: '100%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '6px 8px',
                                      borderRadius: '4px',
                                      backgroundColor: 'transparent',
                                      textAlign: 'left',
                                      fontSize: '0.85rem'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                  >
                                    {opt.icon}
                                    <div>
                                      <span style={{ fontWeight: 500 }}>{opt.label}</span>
                                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '6px' }}>{opt.cmd}</span>
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Format Toolbars when active */}
                      {isActive && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          borderTop: '1px solid var(--border-color)',
                          marginTop: '0.75rem',
                          paddingTop: '0.5rem',
                          fontSize: '0.8rem'
                        }}>
                          {/* Type indicator and converter options */}
                          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Тип: {block.type}</span>
                          
                          {/* Text aligning options */}
                          {['left', 'center', 'right', 'justify'].includes(block.style?.align || 'left') && (
                            <div style={{ display: 'flex', gap: '2px', marginLeft: 'auto', borderRight: '1px solid var(--border-color)', paddingRight: '12px' }}>
                              {(['left', 'center', 'right', 'justify'] as const).map(align => (
                                <button
                                  key={align}
                                  onClick={() => updateBlockStyle(block.id, { align })}
                                  style={{
                                    padding: '4px',
                                    borderRadius: '4px',
                                    backgroundColor: (block.style?.align || 'left') === align ? 'var(--bg-secondary)' : 'transparent',
                                  }}
                                >
                                  {align === 'left' ? <AlignLeftIcon size={14} /> : align === 'center' ? <AlignCenterIcon size={14} /> : align === 'right' ? <AlignRightIcon size={14} /> : <AlignJustifyIcon size={14} />}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Specific Style flags */}
                          <button
                            onClick={() => updateBlockStyle(block.id, { bold: !block.style?.bold })}
                            style={{ padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', backgroundColor: block.style?.bold ? 'var(--bg-secondary)' : 'transparent' }}
                          >
                            B
                          </button>
                          <button
                            onClick={() => updateBlockStyle(block.id, { italic: !block.style?.italic })}
                            style={{ padding: '2px 6px', borderRadius: '4px', fontStyle: 'italic', backgroundColor: block.style?.italic ? 'var(--bg-secondary)' : 'transparent' }}
                          >
                            I
                          </button>
                          
                          {/* Image specific type shift */}
                          {block.type === 'image' && (
                            <button
                              onClick={() => changeBlockType(block.id, 'image_with_caption')}
                              style={{ backgroundColor: 'var(--bg-secondary)', padding: '3px 8px', borderRadius: '4px' }}
                            >
                              Добавить подпись
                            </button>
                          )}
                          {block.type === 'image_with_caption' && (
                            <button
                              onClick={() => changeBlockType(block.id, 'image')}
                              style={{ backgroundColor: 'var(--bg-secondary)', padding: '3px 8px', borderRadius: '4px' }}
                            >
                              Убрать подпись
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Add Blocks Action Triggers */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                <button onClick={() => addBlock('paragraph')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                  <AlignLeft size={14} /> Текст
                </button>
                <button onClick={() => addBlock('heading')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                  <Heading size={14} /> Заголовок
                </button>
                <button onClick={() => addBlock('image')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                  <ImageIcon size={14} /> Изображение
                </button>
                <button onClick={() => addBlock('quote')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                  <Quote size={14} /> Цитата
                </button>
                <button onClick={() => addBlock('separator')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                  <Layout size={14} /> Линия
                </button>
                <button onClick={() => addBlock('spacer')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                  <Layout size={14} /> Отступ
                </button>
              </div>

            </div>
          </div>

          {/* ==========================================
              SIDE-BY-SIDE INTEGRATED READER PREVIEW
          ========================================== */}
          {showPreview && (
            <div style={{
              width: '45%',
              borderLeft: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}>
              {/* Dummy embed of the actual reader view in edit-preview mode */}
              <iframe
                src={`/book/${book?.year}/chapter/${chapter?.id}`}
                title="Preview"
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
              <button
                onClick={() => setShowPreview(false)}
                style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>
          )}

        </div>
      </div>

      {/* ==========================================
          REVISIONS HISTORY SIDE PANEL
      ========================================== */}
      {showRevisions && (
        <div
          onClick={() => setShowRevisions(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '360px', height: '100%', backgroundColor: 'var(--bg-primary)', boxShadow: '-4px 0 25px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', margin: 0 }}>История версий</h3>
              <button onClick={() => setShowRevisions(false)} style={{ background: 'none', color: 'var(--text-primary)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {revisions.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>История пуста.</div>
              ) : (
                revisions.map((rev) => (
                  <div
                    key={rev.id}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      backgroundColor: 'var(--bg-secondary)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{new Date(rev.created_at).toLocaleString()}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Автор: {rev.creator_name || 'Система'}</span>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Блоков контента: {rev.content?.length || 0}</span>
                    <button
                      onClick={() => restoreRevision(rev.id)}
                      className="btn-primary"
                      style={{ padding: '4px 8px', fontSize: '0.75rem', alignSelf: 'flex-end', borderRadius: '4px' }}
                    >
                      Восстановить версию
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MEDIA PICKER OVERLAY MODAL
      ========================================== */}
      {showMediaPicker && (
        <div
          onClick={() => { setShowMediaPicker(false); setActiveBlockId(null); }}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="scale-in"
            style={{ backgroundColor: 'var(--bg-primary)', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '800px', height: '80%', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', margin: 0 }}>Выберите изображение из медиатеки</h3>
              <button onClick={() => setShowMediaPicker(false)} style={{ background: 'none', color: 'var(--text-primary)' }}>
                <X size={20} />
              </button>
            </div>

            {/* Upload form inside picker */}
            <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <label className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                <Upload size={16} /> Загрузить новые фотографии
                <input type="file" multiple accept="image/*" onChange={handleMediaUpload} style={{ display: 'none' }} />
              </label>
              {uploading && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Загрузка файлов...</span>}
            </div>

            {/* Media list grid */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {mediaFiles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>Медиатека пуста. Загрузите файлы!</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
                  {mediaFiles.map(media => (
                    <div
                      key={media.id}
                      onClick={() => selectMediaForActiveBlock(media)}
                      style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        backgroundColor: 'var(--bg-secondary)',
                        position: 'relative'
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-color)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                    >
                      <img src={media.thumbnail_path} style={{ width: '100%', height: '100px', objectFit: 'cover', display: 'block' }} alt="" />
                      <div style={{ fontSize: '0.75rem', padding: '4px', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', textAlign: 'center' }}>
                        {media.title || media.original_name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
