import { ContentBlock, ReaderSettings, VirtualPage } from '../../types';

// Map settings to CSS classes or style strings
export function getTypographyStyles(settings: ReaderSettings) {
  const fontClass = settings.fontFamily === 'serif' ? 'font-serif' : 'font-sans';
  
  let scale = 1.0;
  if (settings.fontSizeScale === 0.8) scale = 0.875;
  else if (settings.fontSizeScale === 1.2) scale = 1.25;
  else if (settings.fontSizeScale === 1.5) scale = 1.5;

  let lhValue = '1.6';
  if (settings.lineHeight === 'compact') lhValue = '1.35';
  else if (settings.lineHeight === 'relaxed') lhValue = '1.85';

  return {
    fontClass,
    fontFamily: settings.fontFamily === 'serif' ? "'Playfair Display', Georgia, serif" : "'Inter', 'Outfit', sans-serif",
    fontSize: `${scale * 16}px`,
    lineHeight: lhValue,
    scale,
  };
}

// Render HTML for measurement purposes
export function renderBlockHTML(block: ContentBlock, width: number, pageHeight: number): string {
  const align = block.style?.align || 'left';
  const italic = block.style?.italic ? 'font-style: italic;' : '';
  const bold = block.style?.bold ? 'font-weight: bold;' : '';
  const customSize = block.style?.fontSizeMultiplier ? `font-size: ${block.style.fontSizeMultiplier}em;` : '';
  
  const commonStyle = `text-align: ${align}; ${italic} ${bold} ${customSize}`;

  switch (block.type) {
    case 'heading':
      return `<h1 style="${commonStyle}; font-family: 'Playfair Display', Georgia, serif; font-size: 2.25em; margin: 0 0 1rem 0; line-height: 1.2; word-break: break-word;">${block.content}</h1>`;
    case 'subheading':
      return `<h2 style="${commonStyle}; font-family: 'Playfair Display', Georgia, serif; font-size: 1.5em; margin: 0 0 0.75rem 0; line-height: 1.3; color: #4b5563;">${block.content}</h2>`;
    case 'paragraph':
      return `<p style="${commonStyle}; margin: 0 0 1.25rem 0; text-indent: 1.5em; line-height: inherit;">${block.content}</p>`;
    case 'quote':
      return `<blockquote style="margin: 0 0 1.25rem 0; padding-left: 1.5rem; border-left: 4px solid #3b82f6; font-style: italic; color: #4b5563; line-height: 1.5;">
        <p style="margin: 0 0 0.5rem 0;">${block.content}</p>
        ${block.style?.textColor ? `<cite style="display: block; font-size: 0.875em; color: #6b7280; font-style: normal; text-align: right;">— ${block.style.textColor}</cite>` : ''}
      </blockquote>`;
    case 'date':
      return `<div style="font-size: 0.875em; text-transform: uppercase; letter-spacing: 0.05em; color: #3b82f6; margin-bottom: 0.5rem; font-weight: 600;">${block.content}</div>`;
    case 'separator':
      return `<div style="display: flex; justify-content: center; align-items: center; margin: 1.5rem 0; height: 1px; background: #e5e7eb;"></div>`;
    case 'spacer':
      return `<div style="height: ${block.style?.spacerHeight || 20}px;"></div>`;
    case 'sticker':
      return `<div style="text-align: center; margin: 1rem 0;"><span style="font-size: 2.5rem; display: inline-block;">${block.content}</span></div>`;
    case 'video':
      // Aspect ratio 16:9
      const vHeight = Math.round(width * (9 / 16));
      return `<div style="width: 100%; height: ${Math.min(vHeight, pageHeight * 0.5)}px; background: #1f2937; display: flex; align-items: center; justify-content: center; color: white; border-radius: 8px; margin-bottom: 1.25rem; font-size: 0.875em;">[Видео: ${block.content}]</div>`;
    case 'image': {
      const ratio = (block.media_width && block.media_height) ? (block.media_width / block.media_height) : 1.5;
      let imgHeight = width / ratio;
      // Cap height to 60% of page height to prevent single massive image breaking layouts
      imgHeight = Math.min(imgHeight, pageHeight * 0.6);
      return `<div style="width: 100%; height: ${imgHeight}px; border-radius: 8px; overflow: hidden; background: #f3f4f6; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: center;">
        <img src="${block.optimized_path || ''}" style="width: 100%; height: 100%; object-fit: contain;" />
      </div>`;
    }
    case 'image_with_caption': {
      const ratio = (block.media_width && block.media_height) ? (block.media_width / block.media_height) : 1.5;
      let imgHeight = width / ratio;
      imgHeight = Math.min(imgHeight, pageHeight * 0.55);
      return `<div style="margin-bottom: 1.25rem;">
        <div style="width: 100%; height: ${imgHeight}px; border-radius: 8px; overflow: hidden; background: #f3f4f6; display: flex; align-items: center; justify-content: center;">
          <img src="${block.optimized_path || ''}" style="width: 100%; height: 100%; object-fit: contain;" />
        </div>
        <div style="font-size: 0.875em; color: #4b5563; text-align: center; margin-top: 0.5rem; font-style: italic;">${block.content}</div>
      </div>`;
    }
    case 'gallery': {
      const cols = block.style?.columnsCount || 2;
      const imagesCount = 4; // Mock layout representation
      const colWidth = (width - (cols - 1) * 8) / cols;
      const rows = Math.ceil(imagesCount / cols);
      const galleryHeight = rows * colWidth + (rows - 1) * 8;
      return `<div style="display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 8px; margin-bottom: 1.25rem; height: ${galleryHeight}px; background: #f3f4f6; padding: 4px; border-radius: 8px;">
        <div style="background: #e5e7eb; height: 100%;"></div>
      </div>`;
    }
    default:
      return `<div>${block.content}</div>`;
  }
}

// Main Pagination Engine Function
export function paginateContent(
  contentBlocks: ContentBlock[],
  pageWidth: number,
  pageHeight: number,
  settings: ReaderSettings
): VirtualPage[] {
  if (pageWidth <= 0 || pageHeight <= 0) return [];

  // Setup offscreen measurer
  let measurer = document.getElementById('pagination-measurer');
  if (!measurer) {
    measurer = document.createElement('div');
    measurer.id = 'pagination-measurer';
    measurer.style.position = 'absolute';
    measurer.style.visibility = 'hidden';
    measurer.style.left = '-9999px';
    measurer.style.top = '-9999px';
    document.body.appendChild(measurer);
  }

  const styles = getTypographyStyles(settings);
  measurer.style.width = `${pageWidth}px`;
  measurer.style.fontFamily = styles.fontFamily;
  measurer.style.fontSize = styles.fontSize;
  measurer.style.lineHeight = styles.lineHeight;
  measurer.style.boxSizing = 'border-box';
  measurer.style.padding = '0';
  measurer.style.margin = '0';

  const pages: VirtualPage[] = [];
  let currentPageBlocks: ContentBlock[] = [];
  let currentPageHeight = 0;
  
  // Clone blocks for consumption
  const blocksQueue = [...contentBlocks];

  // Helper to measure dynamic html block height
  const getBlockHeight = (htmlContent: string): number => {
    if (!measurer) return 0;
    measurer.innerHTML = htmlContent;
    return measurer.offsetHeight;
  };

  while (blocksQueue.length > 0) {
    const block = blocksQueue.shift()!;
    const blockHTML = renderBlockHTML(block, pageWidth, pageHeight);
    const blockHeight = getBlockHeight(blockHTML);

    const isFirstBlockOnPage = currentPageBlocks.length === 0;

    // If block fits or page is empty (to prevent infinite loops)
    if (isFirstBlockOnPage || (currentPageHeight + blockHeight <= pageHeight)) {
      currentPageBlocks.push(block);
      currentPageHeight += blockHeight;
    } else {
      // It doesn't fit on this page.
      // If it's a paragraph, we can split it.
      if (block.type === 'paragraph' && block.content.length > 50) {
        const words = block.content.split(' ');
        const remainingHeight = pageHeight - currentPageHeight;
        
        // Only split if we have a decent amount of vertical space left, otherwise move to next page
        const minSplitHeight = parseFloat(styles.fontSize) * parseFloat(styles.lineHeight) * 2; // at least 2 lines
        if (remainingHeight > minSplitHeight) {
          let low = 0;
          let high = words.length;
          let bestMid = 0;

          while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const partText = words.slice(0, mid).join(' ');
            const testBlock: ContentBlock = { ...block, content: partText };
            const testHTML = renderBlockHTML(testBlock, pageWidth, pageHeight);
            const testHeight = getBlockHeight(testHTML);

            if (testHeight <= remainingHeight) {
              bestMid = mid;
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          }

          // Split only if we can place at least a couple of words
          if (bestMid > 5) {
            const firstPart = words.slice(0, bestMid).join(' ');
            const secondPart = words.slice(bestMid).join(' ');

            // Add first part to current page
            const firstBlock: ContentBlock = { ...block, content: firstPart };
            currentPageBlocks.push(firstBlock);

            // Re-enqueue second part for the next page
            const secondBlock: ContentBlock = { ...block, content: secondPart };
            blocksQueue.unshift(secondBlock);

            // Finish current page and create next
            pages.push({ index: pages.length, blocks: currentPageBlocks });
            currentPageBlocks = [];
            currentPageHeight = 0;
            continue;
          }
        }
      }

      // If we don't split, put back in queue and start a new page
      blocksQueue.unshift(block);
      
      // Before finishing the page, check for orphan headings!
      // If the last block is a heading or subheading, move it to the next page
      if (currentPageBlocks.length > 0) {
        const lastBlock = currentPageBlocks[currentPageBlocks.length - 1];
        if ((lastBlock.type === 'heading' || lastBlock.type === 'subheading' || lastBlock.type === 'date') && currentPageBlocks.length > 1) {
          currentPageBlocks.pop();
          blocksQueue.unshift(lastBlock);
        }
      }

      pages.push({ index: pages.length, blocks: currentPageBlocks });
      currentPageBlocks = [];
      currentPageHeight = 0;
    }
  }

  // Push final page if not empty
  if (currentPageBlocks.length > 0) {
    pages.push({ index: pages.length, blocks: currentPageBlocks });
  }

  // Clear measurer content
  measurer.innerHTML = '';

  return pages;
}
