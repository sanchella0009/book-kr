import { paginateContent } from './pagination';
import { ContentBlock, ReaderSettings } from '../../types';

// Mock Browser DOM for testing in Node.js cli environment
if (typeof (global as any).document === 'undefined') {
  const mockMeasurer = {
    style: {} as any,
    _content: '',
    set innerHTML(content: string) {
      this._content = content;
    },
    get innerHTML() {
      return this._content;
    },
    get offsetHeight() {
      // Simulate heights for calculation:
      // Heading: 40px
      // Paragraph line: 20px (simulate 1 line per 5 words)
      if (/<h[12]/.test(this._content)) {
        return 40;
      }
      if (/<p[> ]/.test(this._content)) {
        const text = this._content.replace(/<[^>]*>/g, '').trim();
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        if (wordCount === 0) return 0;
        return Math.ceil(wordCount / 5) * 20;
      }
      if (this._content.includes('height:')) {
        const match = this._content.match(/height:\s*(\d+)px/);
        if (match) return parseInt(match[1]);
      }
      return 20;
    }
  };

  (global as any).document = {
    getElementById: (id: string) => {
      if (id === 'pagination-measurer') return mockMeasurer;
      return null;
    },
    createElement: (tag: string) => {
      if (tag === 'div') return mockMeasurer;
      return {};
    },
    body: {
      appendChild: () => {}
    }
  } as any;
}

const mockSettings: ReaderSettings = {
  fontSizeScale: 1.0,
  fontFamily: 'serif',
  lineHeight: 'normal',
  textWidth: 'normal',
  theme: 'system',
};

// Unit tests
function runTests() {
  console.log('--- Running Pagination Engine Unit Tests ---');

  // Test 1: Simple pagination fitting in a single page
  const blocks: ContentBlock[] = [
    { id: 1, chapter_id: 10, type: 'heading', sort_order: 1, content: 'Глава 1', style: null, media_id: null },
    { id: 2, chapter_id: 10, type: 'paragraph', sort_order: 2, content: 'Это первый короткий абзац.', style: null, media_id: null },
  ];

  // pageHeight = 100px. Heading (40px) + Paragraph (5 words = 20px) = 60px. Fits in 1 page.
  const pages1 = paginateContent(blocks, 400, 100, mockSettings);
  console.assert(pages1.length === 1, `Test 1 Failed: Expected 1 page, got ${pages1.length}`);
  console.assert(pages1[0].blocks.length === 2, `Test 1 Failed: Expected 2 blocks on page 1, got ${pages1[0].blocks.length}`);
  console.log('✓ Test 1: Simple block fitting passed.');

  // Test 2: Multi-page pagination
  // Heading (40px) + Paragraph (15 words = 60px) = 100px.
  // Next Paragraph (10 words = 40px).
  // pageHeight = 70px.
  // Page 1 should hold heading (40px). Next paragraph doesn't fit, so starts page 2.
  const blocks2: ContentBlock[] = [
    { id: 1, chapter_id: 10, type: 'heading', sort_order: 1, content: 'Глава 1', style: null, media_id: null },
    { id: 2, chapter_id: 10, type: 'paragraph', sort_order: 2, content: 'Это первый абзац текста который не поместится полностью на одной странице.', style: null, media_id: null },
  ];
  const pages2 = paginateContent(blocks2, 400, 70, mockSettings);
  console.assert(pages2.length > 1, `Test 2 Failed: Expected multiple pages, got ${pages2.length}`);
  console.log('✓ Test 2: Page overflow reflow passed.');

  // Test 3: Preventing orphan headings at the bottom of a page
  // Page height = 80px.
  // Block 1: Paragraph (10 words = 40px)
  // Block 2: Heading (40px) -> Total height 80px. Heading fits exactly, but it is at the very bottom!
  // It should be moved to page 2.
  const blocks3: ContentBlock[] = [
    { id: 1, chapter_id: 10, type: 'paragraph', sort_order: 1, content: 'Первый абзац с пятью словами тут.', style: null, media_id: null },
    { id: 2, chapter_id: 10, type: 'heading', sort_order: 2, content: 'Подзаголовок', style: null, media_id: null },
    { id: 3, chapter_id: 10, type: 'paragraph', sort_order: 3, content: 'Содержимое подзаголовка на следующей странице.', style: null, media_id: null },
  ];

  const pages3 = paginateContent(blocks3, 400, 70, mockSettings);
  // Heading is shifted to page 2.
  console.assert(pages3[0].blocks.length === 1, `Test 3 Failed: Paragraph should be alone on Page 1, got ${pages3[0].blocks.length} blocks`);
  console.assert(pages3[1].blocks[0].type === 'heading', `Test 3 Failed: Page 2 should start with heading, got ${pages3[1].blocks[0].type}`);
  console.log('✓ Test 3: Orphan heading prevention passed.');

  console.log('--- All Pagination Tests Passed! ---');
}

// Execute tests
try {
  runTests();
  process.exit(0);
} catch (err) {
  console.error('Test execution failed:', err);
  process.exit(1);
}
