import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageFlip } from 'page-flip';
import { api } from '../../services/api';
import { paginateContent, getTypographyStyles, renderBlockHTML } from '../../features/pagination/pagination';
import { Book, Chapter, ContentBlock, ReaderSettings, VirtualPage } from '../../types';
import {
  Settings,
  Maximize2,
  Minimize2,
  BookOpen,
  HelpCircle,
  X,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';

const DEFAULT_SETTINGS: ReaderSettings = {
  fontSizeScale: 1.0,
  fontFamily: 'serif',
  lineHeight: 'normal',
  textWidth: 'normal',
  theme: 'system',
};

export default function Reader() {
  const { year } = useParams();

  // Book & Chapter State
  const [book, setBook] = useState<Book | null>(null);
  const [chaptersData, setChaptersData] = useState<{ chapter: Chapter; blocks: ContentBlock[] }[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  // App UI States
  const [loading, setLoading] = useState(true);
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSpread, setIsSpread] = useState(true); // 2 pages on desktop

  // Reader Customization Settings
  const [settings, setSettings] = useState<ReaderSettings>(() => {
    try {
      const stored = localStorage.getItem('krasnaya-gorka-reader-settings');
      return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Pagination & Layout State
  const [virtualPages, setVirtualPages] = useState<VirtualPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });


  // Derived state variables
  const totalPages = virtualPages.length;
  const currentLeftPage = virtualPages[currentPageIndex];
  const currentChapter = currentLeftPage ? chapters.find(c => c.id === currentLeftPage.chapterId) : null;
  const showNext = currentPageIndex + (isSpread ? 2 : 1) < totalPages;
  const showPrev = currentPageIndex > 0;

  const jumpToPage = useCallback((targetPageIdx: number) => {
    if (targetPageIdx === currentPageIndex || targetPageIdx < 0 || targetPageIdx >= totalPages) return;
    if (pageFlipRef.current) {
      pageFlipRef.current.turnToPage(targetPageIdx);
    } else {
      const adjustedIdx = isSpread ? targetPageIdx - (targetPageIdx % 2) : targetPageIdx;
      setCurrentPageIndex(Math.max(0, Math.min(adjustedIdx, totalPages - 1)));
    }
  }, [currentPageIndex, isSpread, totalPages]);
  // Compute page sizes
  const getPageDimensions = useCallback(() => {
    const marginHorizontal = isSpread ? 48 : 8; // padding left/right
    const marginVertical = isSpread ? 64 : 24; // padding top/bottom
    
    let totalWidth = viewportSize.width;
    let totalHeight = viewportSize.height;

    if (totalWidth <= 0 || totalHeight <= 0) return { width: 0, height: 0 };

    let maxWidth = 800;
    if (settings.textWidth === 'narrow') maxWidth = 600;
    else if (settings.textWidth === 'wide') maxWidth = 1100;

    if (isSpread) {
      const doublePageWidth = Math.min(totalWidth - marginHorizontal * 2, maxWidth * 1.5);
      const singlePageWidth = (doublePageWidth - 48) / 2; // subtract middle gutter
      const pageHeight = totalHeight - marginVertical * 2;
      return { width: singlePageWidth, height: pageHeight };
    } else {
      const pageHeight = totalHeight - marginVertical * 2;
      const pageWidth = Math.min(totalWidth - marginHorizontal * 2, maxWidth);
      return { width: pageWidth, height: pageHeight };
    }
  }, [viewportSize, isSpread, settings.textWidth]);

  const { width: pageWidth, height: pageHeight } = getPageDimensions();

  // DOM Refs
  const pageFlipRef = useRef<any | null>(null);
  const sourceContainerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  // Parse IDs
  const bookYear = parseInt(year || '2026');

  // Save Settings to LocalStorage and Apply Theme
  useEffect(() => {
    localStorage.setItem('krasnaya-gorka-reader-settings', JSON.stringify(settings));
    
    // Apply theme
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else if (settings.theme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      // System theme
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    }
  }, [settings]);

  // Load Book, Chapters, and all their Blocks
  useEffect(() => {
    setLoading(true);
    api.public.getBookByYear(bookYear)
      .then(async (bookData: any) => {
        setBook(bookData);
        const chaptersList = bookData.chapters || [];
        
        // Fetch blocks for all chapters concurrently
        const chaptersWithBlocks = await Promise.all(
          chaptersList.map(async (ch: any) => {
            try {
              const res = await api.public.getChapter(bookYear, ch.id);
              return { chapter: ch, blocks: res.blocks || [] };
            } catch (err) {
              console.error(`Failed to load chapter ${ch.id}:`, err);
              return { chapter: ch, blocks: [] };
            }
          })
        );
        
        setChaptersData(chaptersWithBlocks);
        setChapters(chaptersList);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load book:', err);
        setLoading(false);
      });
  }, [bookYear]);

  // Set document title dynamically
  useEffect(() => {
    if (book) {
      if (currentChapter) {
        document.title = `${book.title} — ${currentChapter.title}`;
      } else {
        document.title = `${book.title}`;
      }
    }
  }, [book, currentChapter]);

  // Measure Viewport Size
  useEffect(() => {
    const handleResize = () => {
      if (viewportRef.current) {
        const { clientWidth, clientHeight } = viewportRef.current;
        setViewportSize({ width: clientWidth, height: clientHeight });
        
        // Spread Mode: Only active on screens wider than 1024px
        setIsSpread(clientWidth >= 1024);
      }
    };

    handleResize();

    // Use ResizeObserver for accurate dynamic resize triggering
    const observer = new ResizeObserver(() => {
      handleResize();
    });

    if (viewportRef.current) {
      observer.observe(viewportRef.current);
    }

    return () => observer.disconnect();
  }, []);


  // Re-initialize PageFlip synchronously when virtualPages, size, or viewport changes
  useLayoutEffect(() => {
    if (!viewportRef.current || !sourceContainerRef.current || virtualPages.length === 0) return;

    // Create a brand-new flipbook wrapper DOM node
    const bookWrapper = document.createElement('div');
    bookWrapper.className = 'flipbook-wrapper';
    bookWrapper.style.width = `${isSpread ? pageWidth * 2 : pageWidth}px`;
    bookWrapper.style.height = `${pageHeight}px`;
    bookWrapper.style.position = 'relative';
    
    // Append it to the viewport
    viewportRef.current.appendChild(bookWrapper);

    // Query and clone source page elements
    const domSources = sourceContainerRef.current.querySelectorAll('.book-page-element-source');
    const clonedElements: HTMLDivElement[] = [];

    domSources.forEach((el, index) => {
      const clone = el.cloneNode(true) as HTMLDivElement;
      clone.className = 'book-page-element';
      
      const pageData = virtualPages[index];
      if (pageData) {
        clone.innerHTML = getPageHTML(pageData, index, chapters, styles, pageWidth, pageHeight);
      }
      
      bookWrapper.appendChild(clone);
      clonedElements.push(clone);
    });

    const flipBook = new PageFlip(bookWrapper, {
      width: Math.round(pageWidth),
      height: Math.round(pageHeight),
      size: 'stretch',
      minWidth: 200,
      maxWidth: 1000,
      minHeight: 260,
      maxHeight: 1300,
      drawShadow: true,
      maxShadowOpacity: 0.35,
      showCover: false,
      usePortrait: !isSpread,
      mobileScrollSupport: false,
      clickEventForward: true, // Allow clicking buttons inside pages
    });

    try {
      if (clonedElements.length > 0) {
        flipBook.loadFromHTML(clonedElements);
        pageFlipRef.current = flipBook;

        flipBook.on('flip', (e: any) => {
          setCurrentPageIndex(e.data);
        });

        // Clamp target page index to ensure we don't open an out-of-bounds page
        const targetPage = Math.max(0, Math.min(currentPageIndex, clonedElements.length - 1));
        flipBook.turnToPage(targetPage);
        if (currentPageIndex !== targetPage) {
          setCurrentPageIndex(targetPage);
        }
      }
    } catch (error) {
      console.error('Failed to init pageflip:', error);
    }

    return () => {
      try {
        flipBook.destroy();
      } catch (e) {}
      try {
        if (viewportRef.current && viewportRef.current.contains(bookWrapper)) {
          viewportRef.current.removeChild(bookWrapper);
        }
      } catch (e) {}
    };
  }, [virtualPages, isSpread, pageWidth, pageHeight]);

  // Click delegation handler for cloned Table of Contents links
  useEffect(() => {
    const wrapper = viewportRef.current;
    if (!wrapper) return;

    const handleWrapperClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('[data-target-page]');
      if (link) {
        const pageIdx = parseInt(link.getAttribute('data-target-page') || '');
        if (!isNaN(pageIdx)) {
          jumpToPage(pageIdx);
        }
      }
    };

    wrapper.addEventListener('click', handleWrapperClick);
    return () => wrapper.removeEventListener('click', handleWrapperClick);
  }, [virtualPages, jumpToPage]);
  // Recalculate Paginated Virtual Pages for the entire book
  useEffect(() => {
    if (chaptersData.length === 0 || viewportSize.width === 0) return;

    const { width: pageWidth, height: pageHeight } = getPageDimensions();
    if (pageWidth <= 0 || pageHeight <= 0) return;

    const globalPages: VirtualPage[] = [];

    // Prepend Welcome Page (left) and Table of Contents (right)
    const welcomePage: VirtualPage = {
      index: 0,
      blocks: [{ id: -1, type: 'paragraph', content: 'welcome_left', sort_order: 0, chapter_id: -1, style: null, media_id: null }]
    };
    const tocPage: VirtualPage = {
      index: 1,
      blocks: [{ id: -2, type: 'paragraph', content: 'welcome_right', sort_order: 0, chapter_id: -1, style: null, media_id: null }]
    };
    
    globalPages.push(welcomePage, tocPage);

    const updatedChapters = chaptersData.map(d => ({ ...d.chapter }));
    let currentGlobalIdx = 2; // Chapters start at page index 2 (Page 3)

    chaptersData.forEach((chData, idx) => {
      const { chapter, blocks } = chData;
      
      // Paginate blocks for this chapter
      const chPages = paginateContent(blocks, pageWidth - 96, pageHeight - 96, settings);
      
      // Assign page bounds to chapter
      updatedChapters[idx].startPageIdx = currentGlobalIdx;
      updatedChapters[idx].startPageNumber = currentGlobalIdx + 1;

      chPages.forEach((p, pIdx) => {
        globalPages.push({
          ...p,
          index: currentGlobalIdx + pIdx,
          chapterId: chapter.id,
          chapterTitle: chapter.title
        });
      });

      currentGlobalIdx += chPages.length;

      // In spread mode, align next chapter to start on a fresh left page (even index)
      if (isSpread && chPages.length % 2 !== 0) {
        globalPages.push({
          index: currentGlobalIdx,
          blocks: [], // empty blank page
          chapterId: chapter.id,
          chapterTitle: chapter.title
        });
        currentGlobalIdx += 1;
      }
    });

    setVirtualPages(globalPages);
    setChapters(updatedChapters);

    // Position Restoration logic
    let targetPageIdx = 0;
    const hash = window.location.hash;
    if (hash && hash.startsWith('#page-')) {
      const pageNum = parseInt(hash.replace('#page-', ''));
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= globalPages.length) {
        targetPageIdx = pageNum - 1;
      }
    } else {
      try {
        const storedPos = localStorage.getItem(`krasnaya-gorka-position-${bookYear}`);
        if (storedPos) {
          const pos = JSON.parse(storedPos);
          if (typeof pos.pageIdx === 'number' && pos.pageIdx >= 0 && pos.pageIdx < globalPages.length) {
            targetPageIdx = pos.pageIdx;
          }
        }
      } catch {}
    }

    // Align to left page in spread mode
    const adjustedIdx = isSpread ? targetPageIdx - (targetPageIdx % 2) : targetPageIdx;
    setCurrentPageIndex(Math.max(0, Math.min(adjustedIdx, globalPages.length - 1)));

  }, [chaptersData, viewportSize, settings, getPageDimensions, isSpread, bookYear]);

  // Save current position on page index change
  useEffect(() => {
    if (virtualPages.length === 0) return;

    // Update localStorage
    localStorage.setItem(
      `krasnaya-gorka-position-${bookYear}`,
      JSON.stringify({ pageIdx: currentPageIndex })
    );

    // Update URL hash without causing page reload
    window.history.replaceState(null, '', `#page-${currentPageIndex + 1}`);
  }, [currentPageIndex, virtualPages, bookYear]);

  // Navigation commands
  const nextPage = useCallback(() => {
    if (pageFlipRef.current) {
      pageFlipRef.current.flipNext();
    } else {
      const step = isSpread ? 2 : 1;
      if (currentPageIndex + step < totalPages) {
        setCurrentPageIndex(prev => prev + step);
      }
    }
  }, [currentPageIndex, totalPages, isSpread]);

  const prevPage = useCallback(() => {
    if (pageFlipRef.current) {
      pageFlipRef.current.flipPrev();
    } else {
      const step = isSpread ? 2 : 1;
      if (currentPageIndex - step >= 0) {
        setCurrentPageIndex(prev => prev - step);
      }
    }
  }, [currentPageIndex, isSpread]);

  // Keyboard Hotkeys handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in forms/dialogs
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          prevPage();
          break;
        case 'ArrowRight':
        case ' ': // Spacebar
          if (e.shiftKey) {
            prevPage();
          } else {
            nextPage();
          }
          break;
        case 'PageUp':
          prevPage();
          break;
        case 'PageDown':
          nextPage();
          break;
        case 'Home':
          setCurrentPageIndex(0);
          break;
        case 'End':
          if (virtualPages.length > 0) {
            const lastIdx = virtualPages.length - 1;
            setCurrentPageIndex(isSpread ? lastIdx - (lastIdx % 2) : lastIdx);
          }
          break;
        case 't':
        case 'T':
          setShowToc(prev => !prev);
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case '+':
        case '=':
          adjustFontSize(0.1);
          break;
        case '-':
          adjustFontSize(-0.1);
          break;
        case '0':
          setSettings(s => ({ ...s, fontSizeScale: 1.0 }));
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextPage, prevPage, virtualPages.length, isSpread]);

  // Screen Fullscreen helper
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const adjustFontSize = (diff: number) => {
    setSettings(s => {
      const nextScale = parseFloat((s.fontSizeScale + diff).toFixed(1));
      if (nextScale >= 0.8 && nextScale <= 1.5) {
        return { ...s, fontSizeScale: nextScale };
      }
      return s;
    });
  };

  // Swipe controls
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diffX = touchStartX.current - e.changedTouches[0].clientX;
    const threshold = 50;

    if (Math.abs(diffX) > threshold) {
      if (diffX > 0) {
        nextPage();
      } else {
        prevPage();
      }
    }
    touchStartX.current = null;
  };



  const getWelcomeLeftHTML = () => `
    <div style="display: flex; flex-direction: column; height: 100%; padding: 0 10px; box-sizing: border-box;">
      <div style="font-family: var(--font-serif); font-size: 2.5rem; color: #1c1a17; line-height: 1.1; margin-top: 2rem; margin-bottom: 0.5rem;">Добро</div>
      <div style="font-family: var(--font-serif); font-size: 2.5rem; font-weight: 900; color: #1c1a17; line-height: 1.1; margin-bottom: 2rem;">пожаловать!</div>
      <p style="font-family: var(--font-serif); font-size: 1.05rem; line-height: 1.85; color: #1c1a17; text-align: justify; text-indent: 1.5em; margin: 0;">
        Лето 2026 года в Красной горке пролетело как одно мгновение, но оставило след в наших сердцах на всю жизнь. Эта книга — летопись дружбы, побед, творческого полета и искренних улыбок. Листайте страницы, вспоминайте лучшие моменты и согревайтесь воспоминаниями холодными зимними вечерами. С любовью, ваша Красная горка!
      </p>
    </div>
  `;

  const getTocRightHTML = (chaptersList: Chapter[]) => {
    const chaptersHTML = chaptersList.map((ch, idx) => `
      <div class="toc-row" data-target-page="${ch.startPageIdx || 2}" style="display: flex; align-items: baseline; justify-content: space-between; cursor: pointer;">
        <span style="font-weight: 600; font-size: 1.05rem;">Глава ${idx + 1}. ${ch.title}</span>
        <span style="flex: 1; border-bottom: 2px dotted #8c8375; margin: 0 8px; align-self: stretch; transform: translateY(-4px);"></span>
        <span style="font-size: 0.95rem; font-style: italic; font-weight: 600;">стр. ${ch.startPageNumber || 3}</span>
      </div>
    `).join('');

    return `
      <div style="display: flex; flex-direction: column; height: 100%; padding: 0 10px; box-sizing: border-box;">
        <div style="text-align: center; margin-top: 1.5rem; margin-bottom: 2.5rem;">
          <div style="font-family: var(--font-serif); font-size: 2.25rem; color: #1c1a17; line-height: 1.1; margin-bottom: 0.25rem;">Содержание</div>
          <div style="font-family: var(--font-serif); font-size: 2.25rem; font-weight: 900; color: #1c1a17; line-height: 1.1;">летописи</div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 1.5rem; width: 100%; font-family: var(--font-serif);">
          ${chaptersHTML}
        </div>
      </div>
    `;
  };

  const getPageHTML = (page: VirtualPage, index: number, chaptersList: Chapter[], typStyles: any, width: number, height: number) => {
    const isBackCover = index === virtualPages.length - 1;
    const isLeft = index % 2 === 0;

    const spineFoldHTML = `
      <div style="position: absolute; top: 0; bottom: 0; width: 32px; left: ${isLeft ? 'auto' : '0'}; right: ${isLeft ? '0' : 'auto'}; background: ${isLeft ? 'linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.08) 100%)' : 'linear-gradient(270deg, transparent 0%, rgba(0, 0, 0, 0.08) 100%)'}; pointer-events: none; z-index: 10;"></div>
    `;

    const pageNumHTML = !isBackCover ? `
      <div style="position: absolute; bottom: 16px; left: ${isLeft ? '24px' : 'auto'}; right: ${isLeft ? 'auto' : '24px'}; font-size: 0.85rem; color: #8c8375; font-family: monospace; z-index: 15;">${index + 1}</div>
    ` : '';

    let bodyHTML = '';
    if (page.blocks[0]?.id === -1) {
      bodyHTML = getWelcomeLeftHTML();
    } else if (page.blocks[0]?.id === -2) {
      bodyHTML = getTocRightHTML(chaptersList);
    } else {
      bodyHTML = page.blocks.map(block => renderBlockHTML(block, width - 96, height - 96)).join('');
    }

    return `
      <div style="width: 100%; height: 100%; box-sizing: border-box; background-color: #f5eedc; background-image: radial-gradient(circle at center, #fbf7ed 0%, #ede6d0 100%); box-shadow: ${isLeft ? 'inset -15px 0 20px rgba(0,0,0,0.06), inset 10px 0 10px rgba(0,0,0,0.02)' : 'inset 15px 0 20px rgba(0,0,0,0.06), inset -10px 0 10px rgba(0,0,0,0.02)'}; padding: 40px 48px 56px 48px; overflow: hidden; position: relative; color: #1c1a17; display: flex; flex-direction: column;">
        ${spineFoldHTML}
        <div style="flex: 1; width: 100%; height: 100%; font-family: ${typStyles.fontFamily}; font-size: ${typStyles.fontSize}; line-height: ${typStyles.lineHeight}; box-sizing: border-box; overflow: hidden; position: relative;">
          ${bodyHTML}
        </div>
        ${pageNumHTML}
      </div>
    `;
  };




  const topBarTop = isSpread ? '20px' : '44px';
  const topBarRight = isSpread ? '20px' : '10px';
  const buttonPadding = isSpread ? '8px' : '6px';
  const closePadding = isSpread ? '8px 16px' : '6px 12px';
  const iconSize = isSpread ? 18 : 16;
  const topBarGap = isSpread ? '10px' : '6px';

  const bottomBarPadding = isSpread ? '12px 32px' : '6px 12px';
  const bottomBarGap = isSpread ? '24px' : '8px';
  const bottomBarBottom = isSpread ? '24px' : '20px';
  const bottomBarBtnFontSize = isSpread ? '0.85rem' : '0.75rem';

  const styles = getTypographyStyles(settings);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        width: '100vw',
        backgroundColor: '#161210',
        backgroundImage: 'repeating-linear-gradient(90deg, #130f0e, #130f0e 3px, #1a1513 3px, #1a1513 6px)',
        color: 'var(--text-primary)',
        overflow: 'hidden',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Floating Control Buttons in top-right corner */}
      <div style={{
        position: 'absolute',
        top: topBarTop,
        right: topBarRight,
        display: 'flex',
        alignItems: 'center',
        gap: topBarGap,
        zIndex: 50
      }}>
        <button
          onClick={() => setShowSettings(true)}
          style={{
            background: 'rgba(15,13,12,0.6)',
            color: '#dfd2bc',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: buttonPadding,
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)'
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(15,13,12,0.9)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(15,13,12,0.6)'}
        >
          <Settings size={iconSize} />
        </button>

        <button
          onClick={() => setShowHelp(true)}
          style={{
            background: 'rgba(15,13,12,0.6)',
            color: '#dfd2bc',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: buttonPadding,
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)'
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(15,13,12,0.9)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(15,13,12,0.6)'}
        >
          <HelpCircle size={iconSize} />
        </button>

        <button
          onClick={toggleFullscreen}
          style={{
            background: 'rgba(15,13,12,0.6)',
            color: '#dfd2bc',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: buttonPadding,
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)'
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(15,13,12,0.9)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(15,13,12,0.6)'}
        >
          {isFullscreen ? <Minimize2 size={iconSize} /> : <Maximize2 size={iconSize} />}
        </button>

        <Link
          to="/"
          style={{
            background: 'rgba(15,13,12,0.6)',
            color: '#dfd2bc',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: closePadding,
            borderRadius: '20px',
            textDecoration: 'none',
            fontSize: isSpread ? '0.85rem' : '0.75rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backdropFilter: 'blur(4px)'
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(15,13,12,0.9)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(15,13,12,0.6)'}
        >
          Закрыть
        </Link>
      </div>

      {/* Main Reading Viewport */}
      <div
        ref={viewportRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          padding: isSpread ? '2rem 1.5rem' : '0.5rem',
          boxSizing: 'border-box',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        {loading ? (
          <div style={{
            width: '2.5rem',
            height: '2.5rem',
            border: '3px solid var(--border-color)',
            borderTopColor: 'var(--accent-color)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
        ) : virtualPages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Глава пуста</div>
        ) : (
          <>
            {/* Hidden React-managed container for page content */}
            <div ref={sourceContainerRef} style={{ display: 'none' }}>
              {virtualPages.map((_, index) => (
                <div 
                  key={index} 
                  className="book-page-element-source" 
                  data-density={index === 0 || index === virtualPages.length - 1 ? 'hard' : 'soft'}
                  style={{
                    width: `${pageWidth}px`,
                    height: `${pageHeight}px`,
                  }}
                />
              ))}
            </div>


          </>
        )}
      </div>

      {/* Floating Bottom Control Bar Pill */}
      <div
        style={{
          position: 'absolute',
          bottom: bottomBarBottom,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: bottomBarGap,
          padding: bottomBarPadding,
          borderRadius: '30px',
          backgroundColor: '#0f0d0c',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.7)',
          zIndex: 20,
          whiteSpace: 'nowrap',
        }}
      >
        <button
          onClick={() => jumpToPage(0)}
          disabled={currentPageIndex === 0}
          style={{
            background: 'none',
            border: 'none',
            color: currentPageIndex === 0 ? '#5a5449' : '#dfd2bc',
            cursor: currentPageIndex === 0 ? 'default' : 'pointer',
            fontSize: bottomBarBtnFontSize,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          {isSpread ? '« В начало' : '«'}
        </button>

        <button
          onClick={prevPage}
          disabled={!showPrev}
          style={{
            background: 'none',
            border: 'none',
            color: !showPrev ? '#5a5449' : '#dfd2bc',
            cursor: !showPrev ? 'default' : 'pointer',
            fontSize: bottomBarBtnFontSize,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          {isSpread ? '← Назад' : '←'}
        </button>

        <div style={{ color: '#ffffff', fontSize: bottomBarBtnFontSize, fontWeight: 500, minWidth: isSpread ? '120px' : '70px', textAlign: 'center' }}>
          {virtualPages.length > 0 ? (
            isSpread ? (
              `Стр. ${currentPageIndex + 1} из ${virtualPages.length}`
            ) : (
              `Стр. ${currentPageIndex + 1} из ${virtualPages.length}`
            )
          ) : (
            '--'
          )}
        </div>

        <button
          onClick={() => setShowToc(true)}
          style={{
            background: 'none',
            border: 'none',
            color: '#dfd2bc',
            cursor: 'pointer',
            fontSize: bottomBarBtnFontSize,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: isSpread ? '6px' : '4px'
          }}
        >
          <BookOpen size={isSpread ? 14 : 12} /> {isSpread ? 'Содержание' : 'Оглавление'}
        </button>

        <button
          onClick={nextPage}
          disabled={!showNext && (!currentChapter || chapters.findIndex(c => c.id === currentChapter.id) === chapters.length - 1)}
          style={{
            background: 'none',
            border: 'none',
            color: (!showNext && (!currentChapter || chapters.findIndex(c => c.id === currentChapter.id) === chapters.length - 1)) ? '#5a5449' : '#dfd2bc',
            cursor: (!showNext && (!currentChapter || chapters.findIndex(c => c.id === currentChapter.id) === chapters.length - 1)) ? 'default' : 'pointer',
            fontSize: bottomBarBtnFontSize,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          {isSpread ? 'Вперед →' : '→'}
        </button>

        <button
          onClick={() => {
            if (virtualPages.length > 0) {
              const lastIdx = virtualPages.length - 1;
              jumpToPage(isSpread ? lastIdx - (lastIdx % 2) : lastIdx);
            }
          }}
          disabled={currentPageIndex >= virtualPages.length - (isSpread ? 2 : 1)}
          style={{
            background: 'none',
            border: 'none',
            color: currentPageIndex >= virtualPages.length - (isSpread ? 2 : 1) ? '#5a5449' : '#dfd2bc',
            cursor: currentPageIndex >= virtualPages.length - (isSpread ? 2 : 1) ? 'default' : 'pointer',
            fontSize: bottomBarBtnFontSize,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          {isSpread ? 'В конец »' : '»'}
        </button>
      </div>

      {/* ==========================================
          TABLE OF CONTENTS DRAWER
      ========================================== */}
      {showToc && (
        <div
          onClick={() => setShowToc(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            zIndex: 100,
            display: 'flex',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="slide-in-left"
            style={{
              width: '100%',
              maxWidth: '320px',
              height: '100%',
              backgroundColor: 'var(--bg-primary)',
              boxShadow: '4px 0 25px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            <style>{`
              @keyframes slideInLeft {
                from { transform: translateX(-100%); }
                to { transform: translateX(0); }
              }
            `}</style>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', margin: 0 }}>Оглавление</h3>
              <button onClick={() => setShowToc(false)} style={{ background: 'none', color: 'var(--text-primary)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {chapters.map((chap, idx) => {
                  const isActive = chap.id === currentChapter?.id;
                  return (
                    <button
                      key={chap.id}
                      onClick={() => {
                        setShowToc(false);
                        jumpToPage(chap.startPageIdx || 2);
                      }}
                      style={{
                        textAlign: 'left',
                        padding: '0.85rem 1rem',
                        borderRadius: '8px',
                        backgroundColor: isActive ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                        color: isActive ? 'var(--accent-color)' : 'var(--text-primary)',
                        fontWeight: isActive ? 600 : 400,
                        border: '1px solid',
                        borderColor: isActive ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                      }}
                      onMouseEnter={e => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                      }}
                      onMouseLeave={e => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: isActive ? 'var(--accent-color)' : 'var(--text-muted)', marginBottom: '0.2rem' }}>
                        ГЛАВА {String(idx + 1).padStart(2, '0')}
                      </div>
                      <div style={{ fontSize: '0.95rem' }}>{chap.title}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          READER SETTINGS DRAWER
      ========================================== */}
      {showSettings && (
        <div
          onClick={() => setShowSettings(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            zIndex: 100,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '320px',
              height: '100%',
              backgroundColor: 'var(--bg-primary)',
              boxShadow: '-4px 0 25px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', margin: 0 }}>Настройки</h3>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', color: 'var(--text-primary)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Font Size Settings */}
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 600 }}>РАЗМЕР ТЕКСТА</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => adjustFontSize(-0.1)}
                    disabled={settings.fontSizeScale <= 0.8}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 'bold' }}
                  >
                    A−
                  </button>
                  <button
                    onClick={() => setSettings(s => ({ ...s, fontSizeScale: 1.0 }))}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '0.875rem' }}
                  >
                    Сбросить
                  </button>
                  <button
                    onClick={() => adjustFontSize(0.1)}
                    disabled={settings.fontSizeScale >= 1.5}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 'bold' }}
                  >
                    A+
                  </button>
                </div>
                <div style={{ fontSize: '0.75rem', textAlign: 'center', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Текущий масштаб: {Math.round(settings.fontSizeScale * 100)}%
                </div>
              </div>

              {/* Font Family Selector */}
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 600 }}>ШРИФТ</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setSettings(s => ({ ...s, fontFamily: 'serif' }))}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      borderRadius: '6px',
                      fontFamily: 'var(--font-serif)',
                      border: '1px solid',
                      borderColor: settings.fontFamily === 'serif' ? 'var(--accent-color)' : 'var(--border-color)',
                      backgroundColor: settings.fontFamily === 'serif' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-secondary)',
                      color: settings.fontFamily === 'serif' ? 'var(--accent-color)' : 'var(--text-primary)',
                      fontWeight: 600,
                    }}
                  >
                    Serif (С засечками)
                  </button>
                  <button
                    onClick={() => setSettings(s => ({ ...s, fontFamily: 'sans' }))}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      borderRadius: '6px',
                      fontFamily: 'var(--font-sans)',
                      border: '1px solid',
                      borderColor: settings.fontFamily === 'sans' ? 'var(--accent-color)' : 'var(--border-color)',
                      backgroundColor: settings.fontFamily === 'sans' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-secondary)',
                      color: settings.fontFamily === 'sans' ? 'var(--accent-color)' : 'var(--text-primary)',
                      fontWeight: 600,
                    }}
                  >
                    Sans-Serif
                  </button>
                </div>
              </div>

              {/* Line Height Selector */}
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 600 }}>МЕЖСТРОЧНЫЙ ИНТЕРВАЛ</div>
                <div style={{ display: 'flex', gap: '8px', fontSize: '0.8rem' }}>
                  {['compact', 'normal', 'relaxed'].map(lh => (
                    <button
                      key={lh}
                      onClick={() => setSettings(s => ({ ...s, lineHeight: lh as any }))}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: settings.lineHeight === lh ? 'var(--accent-color)' : 'var(--border-color)',
                        backgroundColor: settings.lineHeight === lh ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-secondary)',
                        color: settings.lineHeight === lh ? 'var(--accent-color)' : 'var(--text-primary)',
                        textTransform: 'capitalize',
                      }}
                    >
                      {lh === 'compact' ? 'Компактный' : lh === 'normal' ? 'Обычный' : 'Широкий'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Width Settings */}
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 600 }}>ШИРИНА ТЕКСТОВОЙ ОБЛАСТИ</div>
                <div style={{ display: 'flex', gap: '8px', fontSize: '0.8rem' }}>
                  {['narrow', 'normal', 'wide'].map(w => (
                    <button
                      key={w}
                      onClick={() => setSettings(s => ({ ...s, textWidth: w as any }))}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: settings.textWidth === w ? 'var(--accent-color)' : 'var(--border-color)',
                        backgroundColor: settings.textWidth === w ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-secondary)',
                        color: settings.textWidth === w ? 'var(--accent-color)' : 'var(--text-primary)',
                        textTransform: 'capitalize',
                      }}
                    >
                      {w === 'narrow' ? 'Узкая' : w === 'normal' ? 'Обычная' : 'Широкая'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme Settings */}
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 600 }}>ТЕМА</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setSettings(s => ({ ...s, theme: 'light' }))}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: settings.theme === 'light' ? 'var(--accent-color)' : 'var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: settings.theme === 'light' ? 'var(--accent-color)' : 'var(--text-primary)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                    }}
                  >
                    <Sun size={16} />
                    Светлая
                  </button>
                  <button
                    onClick={() => setSettings(s => ({ ...s, theme: 'dark' }))}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: settings.theme === 'dark' ? 'var(--accent-color)' : 'var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: settings.theme === 'dark' ? 'var(--accent-color)' : 'var(--text-primary)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                    }}
                  >
                    <Moon size={16} />
                    Тёмная
                  </button>
                  <button
                    onClick={() => setSettings(s => ({ ...s, theme: 'system' }))}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: settings.theme === 'system' ? 'var(--accent-color)' : 'var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: settings.theme === 'system' ? 'var(--accent-color)' : 'var(--text-primary)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                    }}
                  >
                    <Monitor size={16} />
                    Системная
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          HOTKEY HELP OVERLAY DIALOG
      ========================================== */}
      {showHelp && (
        <div
          onClick={() => setShowHelp(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="scale-in"
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              padding: '2rem',
              boxShadow: '0 20px 25px -5px var(--shadow-color)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', margin: 0 }}>⌨ Горячие клавиши</h3>
              <button onClick={() => setShowHelp(false)} style={{ background: 'none', color: 'var(--text-primary)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
              {[
                { keys: ['←', 'PageUp'], desc: 'Предыдущая страница' },
                { keys: ['→', 'Space', 'PageDown'], desc: 'Следующая страница' },
                { keys: ['Shift + Space'], desc: 'Предыдущая страница' },
                { keys: ['Home'], desc: 'Начало главы' },
                { keys: ['End'], desc: 'Конец главы' },
                { keys: ['T'], desc: 'Открыть оглавление' },
                { keys: ['F'], desc: 'Полноэкранный режим' },
                { keys: ['+', '='], desc: 'Увеличить текст' },
                { keys: ['-'], desc: 'Уменьшить текст' },
                { keys: ['0'], desc: 'Сбросить размер текста' },
              ].map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{item.desc}</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {item.keys.map((k, kIdx) => (
                      <kbd
                        key={kIdx}
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.75rem',
                          fontFamily: 'monospace',
                          boxShadow: '0 1px 1px var(--shadow-color)',
                        }}
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
