import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import * as path from 'path';
import dotenv from 'dotenv';
import { runMigrations } from './db/migrate';
import { errorHandler } from './middleware/error.middleware';
import { authMiddleware } from './middleware/auth.middleware';
import authRouter from './routes/auth.routes';
import publicRouter from './routes/public.routes';
import adminRouter from './routes/admin.routes';
import mediaRouter, { ensureUploadDirs } from './routes/media.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Ensure uploads directories exist on startup
ensureUploadDirs();

// Serve uploads statically in local development
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadDir));

// Routes
app.use('/api/public', publicRouter);
app.use('/api/admin/auth', authRouter);

// Protected Admin API Routes
app.use('/api/admin', authMiddleware, adminRouter);
app.use('/api/admin/media', authMiddleware, mediaRouter);

// Global Error Handler
app.use(errorHandler);

// Start server and run migrations
async function startServer() {
  try {
    await runMigrations();
    app.listen(PORT, () => {
      console.log(`Backend server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start backend server:', error);
    process.exit(1);
  }
}

startServer();
