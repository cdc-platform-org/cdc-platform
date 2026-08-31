import jwt from 'jsonwebtoken';

export function verifyJWT(token: string): boolean {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '');
    return !!decoded;
  } catch (error) {
    console.error('Invalid JWT:', error);
    return false;
  }
}
