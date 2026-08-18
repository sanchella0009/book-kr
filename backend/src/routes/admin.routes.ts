import { Router, Response } from 'express';
import { query } from '../db';
import { asyncHandler, AppError } from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { saveChapterRevision } from '../services/revision.service';

const router = Router();

// ==========================================
// ADMIN BOOKS API
// ==========================================

router.get(
  '/books',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await query('SELECT * FROM books ORDER BY year DESC');
    return res.status(200).json({ success: true, data: result.rows });
  })
);

router.post(
  '/books',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { year, title, description } = req.body;
    if (!year || !title) {
      throw new AppError('VALIDATION_ERROR', 'Year and title are required');
    }

    // Check if book with year already exists
    const checkRes = await query('SELECT id FROM books WHERE year = $1', [year]);
    if (checkRes.rows.length > 0) {
      throw new AppError('ALREADY_EXISTS', `A book for year ${year} already exists`);
    }

    const result = await query(
      'INSERT INTO books (year, title, description, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [year, title, description, 'draft']
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  })
);

router.get(
  '/books/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const result = await query('SELECT * FROM books WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Book not found', 404);
    }
    return res.status(200).json({ success: true, data: result.rows[0] });
  })
);

router.put(
  '/books/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const { year, title, description, status } = req.body;

    const result = await query(
      'UPDATE books SET year = $1, title = $2, description = $3, status = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
      [year, title, description, status, id]
    );

    if (result.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Book not found', 404);
    }
    return res.status(200).json({ success: true, data: result.rows[0] });
  })
);

router.delete(
  '/books/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const result = await query('DELETE FROM books WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Book not found', 404);
    }
    return res.status(200).json({ success: true, data: { id } });
  })
);

router.post(
  '/books/:id/publish',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const result = await query(
      "UPDATE books SET status = 'published', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Book not found', 404);
    }
    return res.status(200).json({ success: true, data: result.rows[0] });
  })
);

router.post(
  '/books/:id/unpublish',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const result = await query(
      "UPDATE books SET status = 'draft', published_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Book not found', 404);
    }
    return res.status(200).json({ success: true, data: result.rows[0] });
  })
);


// ==========================================
// ADMIN CHAPTERS API
// ==========================================

router.get(
  '/books/:bookId/chapters',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const bookId = parseInt(req.params.bookId);
    const result = await query(
      'SELECT c.*, m.optimized_path as cover_path ' +
      'FROM chapters c ' +
      'LEFT JOIN media m ON c.cover_media_id = m.id ' +
      'WHERE c.book_id = $1 ORDER BY c.sort_order ASC',
      [bookId]
    );
    return res.status(200).json({ success: true, data: result.rows });
  })
);

router.post(
  '/books/:bookId/chapters',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const bookId = parseInt(req.params.bookId);
    const { title, description, cover_media_id, status } = req.body;

    if (!title) {
      throw new AppError('VALIDATION_ERROR', 'Title is required');
    }

    // Get max sort_order
    const maxOrderRes = await query('SELECT COALESCE(MAX(sort_order), 0) as max_order FROM chapters WHERE book_id = $1', [bookId]);
    const sortOrder = maxOrderRes.rows[0].max_order + 1;

    const result = await query(
      'INSERT INTO chapters (book_id, title, description, cover_media_id, sort_order, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [bookId, title, description, cover_media_id || null, sortOrder, status || 'draft']
    );

    return res.status(201).json({ success: true, data: result.rows[0] });
  })
);

router.get(
  '/chapters/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const result = await query(
      'SELECT c.*, m.optimized_path as cover_path FROM chapters c LEFT JOIN media m ON c.cover_media_id = m.id WHERE c.id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Chapter not found', 404);
    }
    return res.status(200).json({ success: true, data: result.rows[0] });
  })
);

router.put(
  '/chapters/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const { title, description, cover_media_id, status, sort_order } = req.body;

    const result = await query(
      'UPDATE chapters SET title = $1, description = $2, cover_media_id = $3, status = $4, sort_order = COALESCE($5, sort_order), updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *',
      [title, description, cover_media_id || null, status, sort_order, id]
    );

    if (result.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Chapter not found', 404);
    }
    return res.status(200).json({ success: true, data: result.rows[0] });
  })
);

router.delete(
  '/chapters/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const result = await query('DELETE FROM chapters WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Chapter not found', 404);
    }
    return res.status(200).json({ success: true, data: { id } });
  })
);

router.post(
  '/chapters/:id/duplicate',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    
    // Fetch chapter to duplicate
    const chapRes = await query('SELECT * FROM chapters WHERE id = $1', [id]);
    if (chapRes.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Chapter not found', 404);
    }
    const origChap = chapRes.rows[0];

    // Get max sort_order
    const maxOrderRes = await query('SELECT COALESCE(MAX(sort_order), 0) as max_order FROM chapters WHERE book_id = $1', [origChap.book_id]);
    const sortOrder = maxOrderRes.rows[0].max_order + 1;

    // Create duplicated chapter
    const newChapRes = await query(
      'INSERT INTO chapters (book_id, title, description, cover_media_id, sort_order, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [origChap.book_id, `${origChap.title} (Copy)`, origChap.description, origChap.cover_media_id, sortOrder, 'draft']
    );
    const newChap = newChapRes.rows[0];

    // Duplicate content blocks
    const blocksRes = await query('SELECT * FROM content_blocks WHERE chapter_id = $1 ORDER BY sort_order ASC', [id]);
    for (const block of blocksRes.rows) {
      await query(
        'INSERT INTO content_blocks (chapter_id, type, sort_order, content, style, media_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [newChap.id, block.type, block.sort_order, block.content, block.style, block.media_id]
      );
    }

    // Save initial revision for the new chapter
    if (req.user) {
      await saveChapterRevision(newChap.id, req.user.id);
    }

    return res.status(201).json({ success: true, data: newChap });
  })
);

router.post(
  '/chapters/reorder',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { chapterIds } = req.body;
    if (!Array.isArray(chapterIds)) {
      throw new AppError('VALIDATION_ERROR', 'chapterIds must be an array');
    }

    for (let i = 0; i < chapterIds.length; i++) {
      await query('UPDATE chapters SET sort_order = $1 WHERE id = $2', [i + 1, chapterIds[i]]);
    }

    return res.status(200).json({ success: true, data: { message: 'Chapters reordered successfully' } });
  })
);

router.post(
  '/chapters/:id/publish',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const result = await query(
      "UPDATE chapters SET status = 'published', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Chapter not found', 404);
    }
    return res.status(200).json({ success: true, data: result.rows[0] });
  })
);

router.post(
  '/chapters/:id/unpublish',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const result = await query(
      "UPDATE chapters SET status = 'draft', published_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Chapter not found', 404);
    }
    return res.status(200).json({ success: true, data: result.rows[0] });
  })
);


// ==========================================
// ADMIN CONTENT BLOCKS API
// ==========================================

router.get(
  '/chapters/:chapterId/blocks',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const chapterId = parseInt(req.params.chapterId);
    const result = await query(
      'SELECT cb.*, m.filename as media_filename, m.width as media_width, m.height as media_height, m.optimized_path, m.thumbnail_path ' +
      'FROM content_blocks cb ' +
      'LEFT JOIN media m ON cb.media_id = m.id ' +
      'WHERE cb.chapter_id = $1 ORDER BY cb.sort_order ASC',
      [chapterId]
    );
    return res.status(200).json({
      success: true,
      data: result.rows.map(row => {
        if (row.style && typeof row.style === 'string') {
          try {
            row.style = JSON.parse(row.style);
          } catch (e) {}
        }
        return row;
      }),
    });
  })
);

router.post(
  '/chapters/:chapterId/blocks',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const chapterId = parseInt(req.params.chapterId);
    const { type, content, style, media_id } = req.body;

    if (!type) {
      throw new AppError('VALIDATION_ERROR', 'Block type is required');
    }

    // Get max sort_order
    const maxOrderRes = await query('SELECT COALESCE(MAX(sort_order), 0.0) as max_order FROM content_blocks WHERE chapter_id = $1', [chapterId]);
    const sortOrder = maxOrderRes.rows[0].max_order + 10.0;

    const result = await query(
      'INSERT INTO content_blocks (chapter_id, type, sort_order, content, style, media_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [chapterId, type, sortOrder, content || '', style ? JSON.stringify(style) : null, media_id || null]
    );

    if (req.user) {
      await saveChapterRevision(chapterId, req.user.id);
    }

    return res.status(201).json({ success: true, data: result.rows[0] });
  })
);

router.put(
  '/blocks/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const { content, style, media_id, sort_order } = req.body;

    const currentBlockRes = await query('SELECT chapter_id FROM content_blocks WHERE id = $1', [id]);
    if (currentBlockRes.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Block not found', 404);
    }
    const chapterId = currentBlockRes.rows[0].chapter_id;

    const result = await query(
      'UPDATE content_blocks SET content = $1, style = $2, media_id = $3, sort_order = COALESCE($4, sort_order), updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
      [content, style ? JSON.stringify(style) : null, media_id || null, sort_order, id]
    );

    if (req.user) {
      await saveChapterRevision(chapterId, req.user.id);
    }

    return res.status(200).json({ success: true, data: result.rows[0] });
  })
);

router.delete(
  '/blocks/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    
    const currentBlockRes = await query('SELECT chapter_id FROM content_blocks WHERE id = $1', [id]);
    if (currentBlockRes.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Block not found', 404);
    }
    const chapterId = currentBlockRes.rows[0].chapter_id;

    await query('DELETE FROM content_blocks WHERE id = $1', [id]);

    if (req.user) {
      await saveChapterRevision(chapterId, req.user.id);
    }

    return res.status(200).json({ success: true, data: { id } });
  })
);

router.post(
  '/blocks/:id/duplicate',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);

    const blockRes = await query('SELECT * FROM content_blocks WHERE id = $1', [id]);
    if (blockRes.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Block not found', 404);
    }
    const block = blockRes.rows[0];

    const sortOrder = block.sort_order + 0.001;

    const result = await query(
      'INSERT INTO content_blocks (chapter_id, type, sort_order, content, style, media_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [block.chapter_id, block.type, sortOrder, block.content, block.style, block.media_id]
    );

    if (req.user) {
      await saveChapterRevision(block.chapter_id, req.user.id);
    }

    return res.status(201).json({ success: true, data: result.rows[0] });
  })
);

router.post(
  '/blocks/reorder',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { blockIds, chapterId } = req.body;
    if (!Array.isArray(blockIds) || !chapterId) {
      throw new AppError('VALIDATION_ERROR', 'blockIds (array) and chapterId (number) are required');
    }

    for (let i = 0; i < blockIds.length; i++) {
      await query('UPDATE content_blocks SET sort_order = $1 WHERE id = $2 AND chapter_id = $3', [
        (i + 1) * 10.0,
        blockIds[i],
        chapterId,
      ]);
    }

    if (req.user) {
      await saveChapterRevision(chapterId, req.user.id);
    }

    return res.status(200).json({ success: true, data: { message: 'Blocks reordered successfully' } });
  })
);


// ==========================================
// ADMIN REVISIONS API
// ==========================================

router.get(
  '/chapters/:chapterId/revisions',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const chapterId = parseInt(req.params.chapterId);
    const result = await query(
      'SELECT r.*, u.username as creator_name ' +
      'FROM revisions r ' +
      'LEFT JOIN users u ON r.created_by = u.id ' +
      'WHERE r.chapter_id = $1 ORDER BY r.created_at DESC',
      [chapterId]
    );
    return res.status(200).json({
      success: true,
      data: result.rows.map(row => {
        if (row.content && typeof row.content === 'string') {
          try {
            row.content = JSON.parse(row.content);
          } catch (e) {}
        }
        return row;
      }),
    });
  })
);

router.post(
  '/revisions/:id/restore',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const revisionId = parseInt(req.params.id);

    // Fetch revision
    const revRes = await query('SELECT * FROM revisions WHERE id = $1', [revisionId]);
    if (revRes.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Revision not found', 404);
    }
    const revision = revRes.rows[0];
    const chapterId = revision.chapter_id;
    const blocks = typeof revision.content === 'string' ? JSON.parse(revision.content) : revision.content;

    if (!Array.isArray(blocks)) {
      throw new AppError('INTERNAL_ERROR', 'Revision content is corrupted');
    }

    // Replace current content blocks with revision blocks
    await query('DELETE FROM content_blocks WHERE chapter_id = $1', [chapterId]);

    for (const block of blocks) {
      await query(
        'INSERT INTO content_blocks (chapter_id, type, sort_order, content, style, media_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [chapterId, block.type, block.sort_order, block.content, block.style ? JSON.stringify(block.style) : null, block.media_id]
      );
    }

    if (req.user) {
      await saveChapterRevision(chapterId, req.user.id);
    }

    return res.status(200).json({ success: true, data: { message: 'Revision restored successfully' } });
  })
);

export default router;
