import { PrismaClient } from '@prisma/client';
import { projectCache } from './cacheService';

// Optimized Prisma client with connection pooling
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
});

// Connection pool configuration
prisma.$connect().then(() => {
  console.log('✅ Database connected with optimized connection pool');
}).catch((error) => {
  console.error('❌ Database connection failed:', error);
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  console.log('📊 Database disconnected gracefully');
});

export class DatabaseService {
  private static instance: DatabaseService;
  private client: PrismaClient;

  private constructor() {
    this.client = prisma;
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  // Optimized project queries with caching
  async getProjectById(projectId: string, userId?: string) {
    const cacheKey = `project:${projectId}:${userId || 'any'}`;
    
    return await projectCache.getOrSet(
      cacheKey,
      async () => {
        const whereClause = userId 
          ? { id: projectId, ownerId: userId }
          : { id: projectId };

        return await this.client.project.findUnique({
          where: whereClause,
          select: {
            id: true,
            title: true,
            description: true,
            content: true,
            format: true,
            type: true,
            createdAt: true,
            updatedAt: true,
            owner: {
              select: {
                id: true,
                username: true
              }
            }
          }
        });
      },
      900 // 15 minutes cache
    );
  }

  // Optimized project list query
  async getProjectsByUser(userId: string, limit: number = 20, offset: number = 0) {
    const cacheKey = `projects:user:${userId}:${limit}:${offset}`;
    
    return await projectCache.getOrSet(
      cacheKey,
      async () => {
        return await this.client.project.findMany({
          where: { ownerId: userId },
          select: {
            id: true,
            title: true,
            description: true,
            format: true,
            type: true,
            createdAt: true,
            updatedAt: true,
            // Don't select content for list view to improve performance
          },
          orderBy: { updatedAt: 'desc' },
          take: limit,
          skip: offset
        });
      },
      300 // 5 minutes cache for lists
    );
  }

  // Optimized project update with cache invalidation
  async updateProject(projectId: string, userId: string, data: any) {
    try {
      const result = await this.client.project.update({
        where: {
          id: projectId,
          ownerId: userId // Ensure ownership
        },
        data: {
          ...data,
          updatedAt: new Date()
        },
        select: {
          id: true,
          title: true,
          description: true,
          content: true,
          format: true,
          type: true,
          createdAt: true,
          updatedAt: true
        }
      });

      // Invalidate related caches
      this.invalidateProjectCaches(projectId, userId);

      return result;
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  }

  // Create project with optimized initial data
  async createProject(userId: string, projectData: any) {
    try {
      const result = await this.client.project.create({
        data: {
          ...projectData,
          ownerId: userId,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        select: {
          id: true,
          title: true,
          description: true,
          content: true,
          format: true,
          type: true,
          createdAt: true,
          updatedAt: true
        }
      });

      // Invalidate user's project list cache
      this.invalidateUserProjectListCache(userId);

      return result;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }

  // Delete project with cache cleanup
  async deleteProject(projectId: string, userId: string) {
    try {
      const result = await this.client.project.delete({
        where: {
          id: projectId,
          ownerId: userId
        }
      });

      // Clean up all related caches
      this.invalidateProjectCaches(projectId, userId);

      return result;
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }

  // Get user with minimal data for authentication
  async getUserForAuth(email: string) {
    return await this.client.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        password: true, // Only needed for auth
        createdAt: true
      }
    });
  }

  // Get user profile (cached)
  async getUserProfile(userId: string) {
    const cacheKey = `user:profile:${userId}`;
    
    return await projectCache.getOrSet(
      cacheKey,
      async () => {
        return await this.client.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            username: true,
            createdAt: true,
            updatedAt: true,
            // Don't include password in profile
            _count: {
              select: {
                projects: true
              }
            }
          }
        });
      },
      1800 // 30 minutes cache for user profiles
    );
  }

  // Batch operations for better performance
  async batchUpdateProjects(updates: Array<{ id: string; userId: string; data: any }>) {
    const results = await this.client.$transaction(
      updates.map(update => 
        this.client.project.update({
          where: {
            id: update.id,
            ownerId: update.userId
          },
          data: {
            ...update.data,
            updatedAt: new Date()
          }
        })
      )
    );

    // Invalidate caches for all updated projects
    updates.forEach(update => {
      this.invalidateProjectCaches(update.id, update.userId);
    });

    return results;
  }

  // Database health check
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number; error?: string }> {
    const start = Date.now();
    
    try {
      // Simple query to test connection
      await this.client.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown database error'
      };
    }
  }

  // Performance: Get database statistics
  async getDatabaseStats() {
    try {
      const [userCount, projectCount] = await Promise.all([
        this.client.user.count(),
        this.client.project.count()
      ]);

      return {
        users: userCount,
        projects: projectCount,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      return null;
    }
  }

  // Cache invalidation helpers
  private invalidateProjectCaches(projectId: string, userId: string) {
    projectCache.deletePattern(projectId);
    projectCache.deletePattern(`project:${projectId}`);
    this.invalidateUserProjectListCache(userId);
  }

  private invalidateUserProjectListCache(userId: string) {
    projectCache.deletePattern(`projects:user:${userId}`);
  }

  // Get the raw client for advanced queries
  get rawClient() {
    return this.client;
  }
}

// Export singleton instance
export const databaseService = DatabaseService.getInstance();
export default databaseService;
