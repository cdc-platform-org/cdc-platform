import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key';
const REFRESH_SECRET_KEY = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';

// Middleware to verify JWT and refresh if expired
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access token missing' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err && err.name === 'TokenExpiredError') {
      const refreshToken = req.headers['x-refresh-token'];
      if (!refreshToken) return res.status(401).json({ message: 'Refresh token missing' });

      jwt.verify(refreshToken, REFRESH_SECRET_KEY, (refreshErr, refreshUser) => {
        if (refreshErr) return res.status(403).json({ message: 'Invalid refresh token' });

        const newToken = jwt.sign({ id: refreshUser.id, role: refreshUser.role }, SECRET_KEY, { expiresIn: '15m' });
        res.setHeader('authorization', `Bearer ${newToken}`);
        req.user = refreshUser;
        next();
      });
    } else if (err) {
      return res.status(403).json({ message: 'Invalid access token' });
    } else {
      req.user = user;
      next();
    }
  });
};

// Middleware to protect admin-only routes
export const requireAdminRole = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied: Admins only' });
  }
  next();
};
