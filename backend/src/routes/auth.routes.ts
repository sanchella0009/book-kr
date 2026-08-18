import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db';
import { asyncHandler, AppError } from '../middleware/error.middleware';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-12345';

router.post(
  '/login',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      throw new AppError('VALIDATION_ERROR', 'Username and password are required');
    }

    const userRes = await query('SELECT * FROM users WHERE username = $1', [username]);
    if (userRes.rows.length === 0) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid username or password', 401);
    }

    const user = userRes.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid username or password', 401);
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
      },
    });
  })
);

router.post(
  '/logout',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    return res.status(200).json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  })
);

router.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    return res.status(200).json({
      success: true,
      data: {
        id: req.user?.id,
        username: req.user?.username,
      },
    });
  })
);

router.post(
  '/change-password',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError('VALIDATION_ERROR', 'Текущий и новый пароли обязательны');
    }

    if (newPassword.length < 6) {
      throw new AppError('VALIDATION_ERROR', 'Новый пароль должен быть не менее 6 символов');
    }

    const userId = req.user?.id;
    const userRes = await query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Пользователь не найден', 404);
    }

    const user = userRes.rows[0];
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      throw new AppError('INVALID_CREDENTIALS', 'Неверный текущий пароль', 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);

    return res.status(200).json({
      success: true,
      data: { message: 'Пароль успешно изменен' },
    });
  })
);

export default router;
