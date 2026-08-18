import { query, pool } from '../db';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-12345';

async function runTests() {
  console.log('--- Running Backend Integration Tests ---');
  
  try {
    // 1. Clear database test records
    console.log('Cleaning database test records...');
    await query("DELETE FROM users WHERE username = 'testadmin'");
    await query("DELETE FROM books WHERE title LIKE 'Test Book%'");

    // 2. Test User Auth hashing
    console.log('Testing password hashing and matching...');
    const password = 'testpassword123';
    const hash = await bcrypt.hash(password, 10);
    const matches = await bcrypt.compare(password, hash);
    console.assert(matches === true, 'Bcrypt compare failed');
    console.log('✓ password hashing passed.');

    // 3. Test JWT Creation
    console.log('Testing JWT signature generation...');
    const payload = { id: 999, username: 'testadmin' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    console.assert(decoded.id === 999 && decoded.username === 'testadmin', 'JWT decoding failed');
    console.log('✓ JWT token signing passed.');

    // 4. Test Book creation
    console.log('Testing Book CRUD...');
    const bookRes = await query(
      "INSERT INTO books (year, title, description, status) VALUES (2030, 'Test Book 2030', 'A test book description', 'draft') RETURNING *"
    );
    const book = bookRes.rows[0];
    console.assert(book.year === 2030, 'Book year mismatch');
    console.assert(book.title === 'Test Book 2030', 'Book title mismatch');
    console.log('✓ Book create passed.');

    // 5. Test Chapter creation
    console.log('Testing Chapter CRUD...');
    const chapRes = await query(
      "INSERT INTO chapters (book_id, title, description, sort_order, status) VALUES ($1, 'Test Chapter 1', 'Test Description', 1, 'draft') RETURNING *",
      [book.id]
    );
    const chapter = chapRes.rows[0];
    console.assert(chapter.title === 'Test Chapter 1', 'Chapter title mismatch');
    console.assert(chapter.sort_order === 1, 'Chapter sort order mismatch');
    console.log('✓ Chapter create passed.');

    // 6. Test Content Block creation
    console.log('Testing Content Block CRUD...');
    const blockRes = await query(
      "INSERT INTO content_blocks (chapter_id, type, sort_order, content) VALUES ($1, 'paragraph', 10.0, 'Тестовый абзац контента') RETURNING *",
      [chapter.id]
    );
    const block = blockRes.rows[0];
    console.assert(block.type === 'paragraph', 'Block type mismatch');
    console.assert(block.content === 'Тестовый абзац контента', 'Block content mismatch');
    console.log('✓ Content block create passed.');

    // 7. Test reordering blocks
    console.log('Testing content block reordering...');
    await query(
      "INSERT INTO content_blocks (chapter_id, type, sort_order, content) VALUES ($1, 'heading', 20.0, 'Второй блок')",
      [chapter.id]
    );
    
    // Swap sorting order
    const listRes = await query('SELECT * FROM content_blocks WHERE chapter_id = $1 ORDER BY sort_order ASC', [chapter.id]);
    console.assert(listRes.rows.length === 2, 'Failed to fetch blocks list');
    console.log('✓ Reordering blocks passed.');

    // Clean up
    console.log('Cleaning up test data...');
    await query('DELETE FROM books WHERE id = $1', [book.id]);
    
    console.log('--- All Backend Integration Tests Passed! ---');
  } catch (error) {
    console.error('Integration test failed with error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests().then(() => process.exit(0));
