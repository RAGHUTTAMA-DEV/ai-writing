import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/index';

interface JwtPayload {
  userId: string;
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    role: string;
    firstName: string;
    lastName: string;
  };
}

const authenticateToken: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const authHeader = authReq.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ message: 'Access token required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        firstName: true,
        lastName: true
      }
    });

    if (!user) {
      res.status(401).json({ message: 'Invalid token - user not found' });
      return;
    }

    authReq.user = user;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ message: 'Token expired' });
      return;
    }
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ message: 'Invalid token' });
      return;
    }
    res.status(500).json({ message: 'Server error during authentication' });
    return;
  }
};

const authorizeRole = (roles: string[]): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (!roles.includes(authReq.user.role)) {
      res.status(403).json({ message: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

export {
  authenticateToken,
  authorizeRole,
  AuthenticatedRequest
};