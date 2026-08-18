import { Router, Response, Request } from 'express';
import { query } from '../db';
import { asyncHandler, AppError } from '../middleware/error.middleware';

const router = Router();

// GET /api/public/books - list published books
router.get(
  '/books',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await query(
      "SELECT * FROM books WHERE status = 'published' ORDER BY year DESC"
    );
    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  })
);

// GET /api/public/book/:year - get published book by year, including public chapters
router.get(
  '/book/:year',
  asyncHandler(async (req: Request, res: Response) => {
    const year = parseInt(req.params.year);
    if (isNaN(year)) {
      throw new AppError('VALIDATION_ERROR', 'Invalid year');
    }

    const bookRes = await query(
      "SELECT * FROM books WHERE year = $1 AND status = 'published'",
      [year]
    );

    if (bookRes.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Book not found', 404);
    }

    const book = bookRes.rows[0];

    // Fetch published chapters
    const chaptersRes = await query(
      "SELECT * FROM chapters WHERE book_id = $1 AND status = 'published' ORDER BY sort_order ASC",
      [book.id]
    );

    return res.status(200).json({
      success: true,
      data: {
        ...book,
        chapters: chaptersRes.rows,
      },
    });
  })
);

// GET /api/public/book/:year/chapter/:id - get published chapter by ID, including content blocks
router.get(
  '/book/:year/chapter/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const year = parseInt(req.params.year);
    const chapterId = parseInt(req.params.id);

    if (isNaN(year) || isNaN(chapterId)) {
      throw new AppError('VALIDATION_ERROR', 'Invalid parameters');
    }

    // Verify book is published
    const bookRes = await query(
      "SELECT id FROM books WHERE year = $1 AND status = 'published'",
      [year]
    );
    if (bookRes.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Book not found', 404);
    }
    const bookId = bookRes.rows[0].id;

    // Fetch published chapter
    const chapterRes = await query(
      "SELECT * FROM chapters WHERE id = $1 AND book_id = $2 AND status = 'published'",
      [chapterId, bookId]
    );

    if (chapterRes.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Chapter not found', 404);
    }

    const chapter = chapterRes.rows[0];

    // Fetch content blocks
    const blocksRes = await query(
      "SELECT cb.*, m.filename as media_filename, m.width as media_width, m.height as media_height, m.optimized_path, m.thumbnail_path " +
      "FROM content_blocks cb " +
      "LEFT JOIN media m ON cb.media_id = m.id " +
      "WHERE cb.chapter_id = $1 " +
      "ORDER BY cb.sort_order ASC",
      [chapterId]
    );

    return res.status(200).json({
      success: true,
      data: {
        ...chapter,
        blocks: blocksRes.rows.map(row => {
          if (row.style && typeof row.style === 'string') {
            try {
              row.style = JSON.parse(row.style);
            } catch (e) {}
          }
          return row;
        }),
      },
    });
  })
);

export default router;
