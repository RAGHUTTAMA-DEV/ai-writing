import { Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../prisma/index';
import { AuthenticatedRequest } from '../middleware/auth';
import passport from '../config/passport';

interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

const register = async (req: Request<{}, {}, RegisterRequest>, res: Response): Promise<void> => {
  try {
    const { email, username, password, firstName, lastName } = req.body;

    // Validation
    if (!email || !username || !password || !firstName || !lastName) {
      res.status(400).json({ message: 'All fields are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters' });
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email },
          { username: username }
        ]
      }
    });

    if (existingUser) {
      res.status(400).json({ message: 'User with this email or username already exists' });
      return;
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        firstName,
        lastName
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true
      }
    });

    // Generate JWT token
    const jwtOptions: SignOptions = {
      //@ts-ignore
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    };
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET as string,
      jwtOptions
    );

    res.status(201).json({
      message: 'User registered successfully',
      user,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

const login = async (req: Request<{}, {}, LoginRequest>, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    if (!user.password) {
      res.status(401).json({ message: 'Please use Google sign-in for this account' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    // Generate JWT token
    const jwtOptions: SignOptions = {
      //@ts-ignore
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    };
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET as string,
      jwtOptions
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { updatedAt: new Date() }
    });

    const userResponse = {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    };

    res.json({
      message: 'Login successful',
      user: userResponse,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
};

const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await prisma.user.findUnique({
      where: { id: authReq.user!.id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        bio: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error fetching profile' });
  }
};

const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { firstName, lastName, bio, avatar } = req.body;

    const user = await prisma.user.update({
      where: { id: authReq.user!.id },
      data: {
        firstName,
        lastName,
        bio,
        avatar
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        bio: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error updating profile' });
  }
};

// Google OAuth handlers
const googleAuth = passport.authenticate('google', {
  scope: ['profile', 'email'],
});

const googleCallback = (req: Request, res: Response): void => {
  passport.authenticate('google', { failureRedirect: '/login' })(req, res, async () => {
    try {
      const user = req.user as any;
      
      if (!user) {
        return res.redirect('/login?error=authentication_failed');
      }

      // Generate JWT token
      const jwtOptions: SignOptions = {
        //@ts-ignore
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      };
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET as string,
        jwtOptions
      );

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect('/login?error=server_error');
    }
  });
};

const googleAuthSuccess = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as any;
    
    if (!user) {
      res.status(401).json({ message: 'Authentication failed' });
      return;
    }

    // Generate JWT token
    const jwtOptions: SignOptions = {
      //@ts-ignore
            expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    };
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET as string,
      jwtOptions
    );

    const userResponse = {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatar: user.avatar
    };

    res.json({
      message: 'Google login successful',
      user: userResponse,
      token
    });
  } catch (error) {
    console.error('Google auth success error:', error);
    res.status(500).json({ message: 'Server error during Google authentication' });
  }
};

export {
  register,
  login,
  logout,
  getProfile,
  updateProfile,
  googleAuth,
  googleCallback,
  googleAuthSuccess
};