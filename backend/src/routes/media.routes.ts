import { Router, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db';
import { asyncHandler, AppError } from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();

// Configure multer memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB limit
  },
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const extension = path.extname(file.originalname).toLowerCase();
    
    if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(extension)) {
      cb(null, true);
    } else {
      cb(new AppError('INVALID_FILE_TYPE', 'Only JPEG, PNG, WEBP, and GIF images are allowed'));
    }
  },
});

const getUploadDirs = () => {
  const baseUploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
  return {
    original: path.join(baseUploadDir, 'original'),
    optimized: path.join(baseUploadDir, 'optimized'),
    thumbnails: path.join(baseUploadDir, 'thumbnails'),
  };
};

// Ensure directories exist
const ensureUploadDirs = () => {
  const dirs = getUploadDirs();
  Object.values(dirs).forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// POST /api/admin/media - upload single or multiple images
router.post(
  '/',
  upload.array('files', 10), // Support up to 10 files
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    ensureUploadDirs();
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'No files uploaded');
    }

    const uploadedMedia = [];
    const dirs = getUploadDirs();

    for (const file of files) {
      const fileId = uuidv4();
      const originalExtension = path.extname(file.originalname).toLowerCase();
      const uniqueOriginalName = `${fileId}${originalExtension}`;
      const optimizedName = `${fileId}.webp`;
      const thumbnailName = `${fileId}_thumb.webp`;

      // 1. Save original file
      const originalPath = path.join(dirs.original, uniqueOriginalName);
      fs.writeFileSync(originalPath, file.buffer);

      // 2. Get metadata / dimensions using sharp
      const imageInfo = sharp(file.buffer);
      const metadata = await imageInfo.metadata();

      if (!metadata.width || !metadata.height) {
        throw new AppError('INVALID_IMAGE', 'Could not read image dimensions');
      }

      // 3. Process & save optimized (WebP, max 1920 width)
      const optimizedPath = path.join(dirs.optimized, optimizedName);
      let optimizedImage = imageInfo;
      if (metadata.width > 1920) {
        optimizedImage = optimizedImage.resize(1920);
      }
      const optimizedBuffer = await optimizedImage.webp({ quality: 80 }).toBuffer();
      fs.writeFileSync(optimizedPath, optimizedBuffer);

      // 4. Process & save thumbnail (WebP, 300x200, contain/cover)
      const thumbnailPath = path.join(dirs.thumbnails, thumbnailName);
      const thumbnailBuffer = await imageInfo
        .resize(300, 200, { fit: 'cover' })
        .webp({ quality: 75 })
        .toBuffer();
      fs.writeFileSync(thumbnailPath, thumbnailBuffer);

      // Web paths to return and save in DB
      const webOriginalPath = `/uploads/original/${uniqueOriginalName}`;
      const webOptimizedPath = `/uploads/optimized/${optimizedName}`;
      const webThumbnailPath = `/uploads/thumbnails/${thumbnailName}`;

      // Insert media record into database
      const dbRes = await query(
        'INSERT INTO media (filename, original_name, mime_type, size, orig_size, width, height, title, description, optimized_path, original_path, thumbnail_path) ' +
        'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *',
        [
          optimizedName,
          file.originalname,
          'image/webp',
          optimizedBuffer.length,
          file.size,
          metadata.width,
          metadata.height,
          file.originalname.substring(0, file.originalname.lastIndexOf('.')) || file.originalname,
          '',
          webOptimizedPath,
          webOriginalPath,
          webThumbnailPath,
        ]
      );
      uploadedMedia.push(dbRes.rows[0]);
    }

    return res.status(201).json({
      success: true,
      data: uploadedMedia,
    });
  })
);

// GET /api/admin/media - list media library with filtering
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { search, team, event } = req.query;

    let queryText = 'SELECT * FROM media WHERE 1=1';
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      queryText += ` AND (title ILIKE $${params.length} OR description ILIKE $${params.length} OR author ILIKE $${params.length})`;
    }

    if (team) {
      params.push(team);
      queryText += ` AND team = $${params.length}`;
    }

    if (event) {
      params.push(event);
      queryText += ` AND event = $${params.length}`;
    }

    queryText += ' ORDER BY created_at DESC';

    const result = await query(queryText, params);
    return res.status(200).json({ success: true, data: result.rows });
  })
);

// GET /api/admin/media/:id - get single media file metadata
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const result = await query('SELECT * FROM media WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Media not found', 404);
    }
    return res.status(200).json({ success: true, data: result.rows[0] });
  })
);

// PUT /api/admin/media/:id - update media metadata
router.put(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const { title, description, captured_at, team, event, author } = req.body;

    const result = await query(
      'UPDATE media SET title = $1, description = $2, captured_at = $3, team = $4, event = $5, author = $6 WHERE id = $7 RETURNING *',
      [
        title,
        description,
        captured_at || null,
        team || null,
        event || null,
        author || null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Media not found', 404);
    }
    return res.status(200).json({ success: true, data: result.rows[0] });
  })
);

// DELETE /api/admin/media/:id - delete media file and from disk
router.delete(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);

    const mediaRes = await query('SELECT * FROM media WHERE id = $1', [id]);
    if (mediaRes.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Media not found', 404);
    }
    const media = mediaRes.rows[0];

    // Delete database record first
    await query('DELETE FROM media WHERE id = $1', [id]);

    // Construct local filepaths and delete from disk
    const baseUploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
    
    // Extracted original filename
    const originalFilename = path.basename(media.original_path);
    const originalLocalPath = path.join(baseUploadDir, 'original', originalFilename);
    const optimizedLocalPath = path.join(baseUploadDir, 'optimized', media.filename);
    const thumbnailLocalPath = path.join(baseUploadDir, 'thumbnails', path.basename(media.thumbnail_path));

    [originalLocalPath, optimizedLocalPath, thumbnailLocalPath].forEach(filePath => {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error(`Failed to delete file: ${filePath}`, e);
        }
      }
    });

    return res.status(200).json({ success: true, data: { id } });
  })
);

export default router;
export { ensureUploadDirs };
