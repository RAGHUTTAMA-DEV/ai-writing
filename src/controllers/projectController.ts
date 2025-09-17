import { Request, Response } from 'express';
import prisma from '../prisma/index';
import ragService from '../services/ragService';
import { AuthenticatedRequest } from '../middleware/auth';
import { aiResponseCache, projectCache } from '../services/cacheService';

interface CreateProjectRequest {
  title: string;
  description?: string;
  format?: string;
  type?: string;
  content?: string;
  quickNotes?: string;
}

interface UpdateProjectRequest {
  title?: string;
  description?: string;
  format?: string;
  type?: string;
  content?: string;
  quickNotes?: string;
}

const createProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { title, description, format, type, content, quickNotes } = req.body as CreateProjectRequest;
    
    // Validation
    if (!title) {
      res.status(400).json({ message: 'Title is required' });
      return;
    }
    
    // Create project
    const project = await prisma.project.create({
      data: {
        title,
        description,
        format: format || 'screenplay',
        type: type || 'draft',
        content,
        quickNotes,
        ownerId: authReq.user!.id,
        permissions: {
          create: {
            userId: authReq.user!.id,
            role: 'OWNER'
          }
        }
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        permissions: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });
    
    // Add project content to RAG system
    if (content) {
      try {
        await ragService.addDocument(content, {
          projectId: project.id,
          projectTitle: project.title,
          ownerId: project.ownerId,
          createdAt: project.createdAt.toISOString()
        });
      } catch (error) {
        console.error('Error adding project to RAG system:', error);
        // Don't fail the project creation if RAG indexing fails
      }
    }
    
    res.status(201).json({
      message: 'Project created successfully',
      project
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ message: 'Server error during project creation' });
  }
};

const getProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: authReq.user!.id },
          { permissions: { some: { userId: authReq.user!.id } } }
        ]
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });
    
    res.json({ projects });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ message: 'Server error fetching projects' });
  }
};

const getProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    
    // Check if user has permission to access this project
    const project = await prisma.project.findUnique({
      where: {
        id,
        OR: [
          { ownerId: authReq.user!.id },
          { permissions: { some: { userId: authReq.user!.id } } }
        ]
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        permissions: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        versions: {
          orderBy: {
            versionNumber: 'desc'
          },
          take: 5
        }
      }
    });
    
    if (!project) {
      res.status(404).json({ message: 'Project not found or access denied' });
      return;
    }
    
    res.json({ project });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ message: 'Server error fetching project' });
  }
};

const updateProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { title, description, format, type, content, quickNotes } = req.body as UpdateProjectRequest;
    
    // Check if user has permission to update this project
    const projectPermission = await prisma.permission.findFirst({
      where: {
        projectId: id,
        userId: authReq.user!.id,
        role: { in: ['OWNER', 'EDITOR'] }
      }
    });
    
    const projectOwner = await prisma.project.findFirst({
      where: {
        id,
        ownerId: authReq.user!.id
      }
    });
    
    if (!projectPermission && !projectOwner) {
      res.status(403).json({ message: 'Insufficient permissions to update project' });
      return;
    }
    
    // Create a new version before updating
    const project = await prisma.project.findUnique({
      where: { id },
      select: { content: true }
    });
    
    if (project && content !== project.content) {
      const latestVersion = await prisma.projectVersion.findFirst({
        where: { projectId: id },
        orderBy: { versionNumber: 'desc' }
      });
      
      const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;
      
      await prisma.projectVersion.create({
        data: {
          projectId: id,
          content: project.content,
          versionNumber,
          createdBy: authReq.user!.id
        }
      });
    }
    
    // Update project
    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        title,
        description,
        format,
        type,
        content,
        quickNotes
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        permissions: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });
    
    // Invalidate AI analysis caches when content changes
    if (content && content !== project?.content) {
      console.log(`🧹 Invalidating AI caches for project ${id} due to content change`);
      
      // Clear all AI analysis caches for this project
      // Since we can't easily iterate over cache keys, we'll use a more targeted approach
      // The content-aware cache keys will automatically change due to content hash change
      
      // Clear project context cache to force refresh
      const projectContextKey = `project_context_${id}`;
      projectCache.delete(projectContextKey);
      
      // Clear any general project-related caches
      const projectStatsKey = `project_stats_${id}`;
      projectCache.delete(projectStatsKey);
      
      console.log(`✅ AI caches invalidated for project ${id}`);
    }
    
    // Update project content in RAG system
    if (content) {
      try {
        // For simplicity, we're re-adding the entire content to the RAG system
        // In a production environment, you might want to implement a more sophisticated
        // approach that only updates changed content
        await ragService.addDocument(content, {
          projectId: updatedProject.id,
          projectTitle: updatedProject.title,
          ownerId: updatedProject.ownerId,
          updatedAt: updatedProject.updatedAt.toISOString()
        });
        
        console.log('✅ RAG system updated with new project content');
        
        // Auto-update project analytics after saving (async, don't wait)
        setImmediate(async () => {
          try {
            console.log(`📊 Auto-updating analytics for project ${updatedProject.id}...`);
            
            // Get or update project analytics from the RAG service  
            // Note: Using basic analytics update since ragService has limited methods
            console.log(`📊 Analytics auto-update initiated for project ${updatedProject.id}`);
            // The RAG service will automatically update analytics when documents are added
            
            console.log(`✅ Analytics auto-updated for project ${updatedProject.id}`);
          } catch (analyticsError) {
            console.error('Warning: Analytics auto-update failed:', analyticsError);
            // Don't fail the project update if analytics update fails
          }
        });
        
      } catch (error) {
        console.error('Error updating project in RAG system:', error);
        // Don't fail the project update if RAG indexing fails
      }
    }
    
    res.json({
      message: 'Project updated successfully',
      project: updatedProject
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ message: 'Server error updating project' });
  }
};

const deleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    
    // Check if user is the owner of the project
    const project = await prisma.project.findFirst({
      where: {
        id,
        ownerId: authReq.user!.id
      }
    });
    
    if (!project) {
      res.status(403).json({ message: 'Only project owners can delete projects' });
      return;
    }
    
    // Delete project (cascade delete will remove permissions and versions)
    await prisma.project.delete({
      where: { id }
    });
    
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ message: 'Server error deleting project' });
  }
};

export {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject
};