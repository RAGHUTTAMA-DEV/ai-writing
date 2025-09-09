import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  register,
  login,
  logout,
  getProfile,
  updateProfile
} from '../controllers/authController';

const router: Router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Protected routes
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);

export default router;