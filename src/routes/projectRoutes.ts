import express from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject
} from '../controllers/projectController';

const router = express.Router();

// All routes are protected
router.use(authenticateToken);

// Project routes
router.post('/', createProject);
router.get('/', getProjects);
router.get('/:id', getProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

export default router;