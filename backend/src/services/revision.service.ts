import { query } from '../db';

export async function saveChapterRevision(chapterId: number, userId: number) {
  try {
    // Fetch all current content blocks for this chapter
    const blocksRes = await query(
      'SELECT id, type, sort_order, content, style, media_id FROM content_blocks WHERE chapter_id = $1 ORDER BY sort_order ASC',
      [chapterId]
    );

    const blocksData = blocksRes.rows.map(row => {
      if (row.style && typeof row.style === 'string') {
        try {
          row.style = JSON.parse(row.style);
        } catch (e) {}
      }
      return row;
    });

    // Save as a JSON snapshot
    await query(
      'INSERT INTO revisions (chapter_id, content, created_by) VALUES ($1, $2, $3)',
      [chapterId, JSON.stringify(blocksData), userId]
    );
    console.log(`Saved revision for chapter ${chapterId} by user ${userId}`);
  } catch (error) {
    console.error('Failed to save chapter revision:', error);
  }
}
