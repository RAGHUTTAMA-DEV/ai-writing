import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();
interface PersistedData {
  documents: Array<{
    pageContent: string;
    metadata: Record<string, any>;
  }>;
  timestamp: string;
  version: string;
}

interface ProjectContext {
  projectId: string;
  title: string;
  genre?: string;
  characters?: string[];
  themes?: string[];
  plotPoints?: string[];
  writingStyle?: string;
}

class RAGService {
  private vectorStore: MemoryVectorStore | null;
  private textSplitter: RecursiveCharacterTextSplitter | null;
  private embeddings: GoogleGenerativeAIEmbeddings | null;
  private persistencePath: string;
  private documents: Document[]; // Keep track of documents for persistence
  private projectContexts: Map<string, ProjectContext> = new Map();

  constructor() {
    // Initialize persistence path
    this.persistencePath = path.join(__dirname, '../../data/vector_store.json');
    
    // Initialize documents array
    this.documents = [];
    
    // Initialize with Google Generative AI embeddings
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn("No API key found for Google Generative AI. RAG features will not work.");
      this.embeddings = null;
      this.vectorStore = null;
      this.textSplitter = null;
      return;
    }
    
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: apiKey,
      modelName: "embedding-001"
    });
    
    // Initialize vector store with Google embeddings
    this.vectorStore = new MemoryVectorStore(this.embeddings);
    
    // Initialize text splitter with better chunking strategy
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 150,
      separators: ["\n\n", "\n", ". ", "! ", "? ", "; ", ", ", " ", ""],
    });
    
    // Load persisted data if it exists
    this.loadPersistedData();
  }

  // Set project context for better AI understanding
  setProjectContext(projectId: string, context: ProjectContext): void {
    this.projectContexts.set(projectId, context);
  }

  // Get project context
  getProjectContext(projectId: string): ProjectContext | null {
    return this.projectContexts.get(projectId) || null;
  }

  // Enhanced document addition with better metadata
  async addDocument(content: string, metadata: Record<string, any> = {}): Promise<void> {
    if (!this.embeddings || !this.vectorStore || !this.textSplitter) {
      console.warn("RAG features are not available due to missing API key configuration.");
      return;
    }
    
    try {
      // Enhanced metadata with semantic information
      const enhancedMetadata = {
        ...metadata,
        timestamp: new Date().toISOString(),
        contentLength: content.length,
        wordCount: content.split(/\s+/).length,
        // Extract potential character names (capitalized words)
        potentialCharacters: this.extractPotentialCharacters(content),
        // Extract themes and emotions
        themes: this.extractThemes(content),
        // Content type classification
        contentType: this.classifyContent(content),
      };

      // Split the document into chunks with better context preservation
      const docs = await this.textSplitter.createDocuments([content], [enhancedMetadata]);
      
      // Add contextual information to each chunk
      const enhancedDocs = docs.map((doc, index) => {
        return new Document({
          pageContent: doc.pageContent,
          metadata: {
            ...doc.metadata,
            chunkIndex: index,
            totalChunks: docs.length,
            // Add surrounding context for better retrieval
            previousChunk: index > 0 ? docs[index - 1].pageContent.slice(-100) : "",
            nextChunk: index < docs.length - 1 ? docs[index + 1].pageContent.slice(0, 100) : "",
          }
        });
      });
      
      // Add documents to vector store
      await this.vectorStore.addDocuments(enhancedDocs);
      
      // Keep track of documents for persistence
      this.documents.push(...enhancedDocs);
      
      console.log(`Added ${enhancedDocs.length} enhanced document chunks to vector store for project ${metadata.projectId || 'unknown'}`);
      
      // Persist the data
      await this.persistData();
    } catch (error) {
      console.error("Error adding document to vector store:", error);
      throw error;
    }
  }

  // Enhanced search with project-specific filtering and ranking
  async search(query: string, projectId?: string, limit: number = 4): Promise<Document[]> {
    if (!this.embeddings || !this.vectorStore) {
      console.warn("RAG features are not available due to missing API key configuration.");
      return [];
    }
    
    try {
      // Get more results initially for filtering
      const initialLimit = Math.max(limit * 3, 12);
      const results = await this.vectorStore.similaritySearch(query, initialLimit);
      
      // Filter and rank results based on project context
      let filteredResults = results;
      
      if (projectId) {
        // Prioritize results from the same project
        filteredResults = results.sort((a, b) => {
          const aIsFromProject = a.metadata.projectId === projectId;
          const bIsFromProject = b.metadata.projectId === projectId;
          
          if (aIsFromProject && !bIsFromProject) return -1;
          if (!aIsFromProject && bIsFromProject) return 1;
          
          // Secondary sorting by relevance (already sorted by similarity)
          return 0;
        });
      }
      
      // Apply semantic filtering based on content type and themes
      const contextualResults = this.applyContextualFiltering(filteredResults, query, projectId);
      
      return contextualResults.slice(0, limit);
    } catch (error) {
      console.error("Error searching vector store:", error);
      throw error;
    }
  }

  // Get project-specific statistics
  async getProjectStats(projectId: string): Promise<{
    totalDocuments: number;
    totalChunks: number;
    characters: string[];
    themes: string[];
    contentTypes: string[];
    lastUpdated: string;
  }> {
    const projectDocs = this.documents.filter(doc => doc.metadata.projectId === projectId);
    
    const characters = new Set<string>();
    const themes = new Set<string>();
    const contentTypes = new Set<string>();
    let lastUpdated = "";
    
    projectDocs.forEach(doc => {
      if (doc.metadata.potentialCharacters) {
        doc.metadata.potentialCharacters.forEach((char: string) => characters.add(char));
      }
      if (doc.metadata.themes) {
        doc.metadata.themes.forEach((theme: string) => themes.add(theme));
      }
      if (doc.metadata.contentType) {
        contentTypes.add(doc.metadata.contentType);
      }
      if (doc.metadata.timestamp && doc.metadata.timestamp > lastUpdated) {
        lastUpdated = doc.metadata.timestamp;
      }
    });
    
    return {
      totalDocuments: new Set(projectDocs.map(doc => doc.metadata.documentId || doc.metadata.projectId)).size,
      totalChunks: projectDocs.length,
      characters: Array.from(characters),
      themes: Array.from(themes),
      contentTypes: Array.from(contentTypes),
      lastUpdated
    };
  }

  // Get overall statistics
  async getStats(): Promise<{ 
    totalDocuments: number;
    totalProjects: number;
    totalChunks: number;
    lastUpdated: string;
  }> {
    const projects = new Set(this.documents.map(doc => doc.metadata.projectId).filter(Boolean));
    const documents = new Set(this.documents.map(doc => doc.metadata.documentId || doc.metadata.projectId).filter(Boolean));
    
    const lastUpdated = this.documents.reduce((latest, doc) => {
      return doc.metadata.timestamp > latest ? doc.metadata.timestamp : latest;
    }, "");
    
    return {
      totalDocuments: documents.size,
      totalProjects: projects.size,
      totalChunks: this.documents.length,
      lastUpdated
    };
  }

  // Delete documents by project ID
  async deleteProjectDocuments(projectId: string): Promise<void> {
    // Filter out documents from the specified project
    this.documents = this.documents.filter(doc => doc.metadata.projectId !== projectId);
    
    // Recreate vector store without the deleted documents
    if (this.vectorStore && this.embeddings && this.documents.length > 0) {
      this.vectorStore = new MemoryVectorStore(this.embeddings);
      await this.vectorStore.addDocuments(this.documents);
    }
    
    // Remove project context
    this.projectContexts.delete(projectId);
    
    // Persist the updated data
    await this.persistData();
    
    console.log(`Deleted all documents for project ${projectId}`);
  }

  // Helper method to extract potential character names
  private extractPotentialCharacters(content: string): string[] {
    const words = content.split(/\s+/);
    const capitalizedWords = words.filter(word => 
      /^[A-Z][a-z]+$/.test(word) && 
      word.length > 2 && 
      !['The', 'And', 'But', 'For', 'Nor', 'Or', 'So', 'Yet'].includes(word)
    );
    
    // Count frequency and return most common ones
    const frequency: Record<string, number> = {};
    capitalizedWords.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });
    
    return Object.entries(frequency)
      .filter(([_, count]) => count > 1)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 10)
      .map(([word, _]) => word);
  }

  // Helper method to extract themes
  private extractThemes(content: string): string[] {
    const themeKeywords = {
      'love': ['love', 'romance', 'heart', 'affection', 'passion'],
      'betrayal': ['betray', 'deceive', 'lie', 'cheat', 'backstab'],
      'revenge': ['revenge', 'vengeance', 'payback', 'retaliate'],
      'friendship': ['friend', 'companion', 'ally', 'bond', 'loyalty'],
      'family': ['family', 'mother', 'father', 'sibling', 'parent'],
      'power': ['power', 'control', 'authority', 'dominance', 'rule'],
      'sacrifice': ['sacrifice', 'give up', 'surrender', 'forfeit'],
      'redemption': ['redeem', 'forgive', 'atone', 'salvation'],
      'coming-of-age': ['grow', 'mature', 'learn', 'discover', 'realize'],
      'good-vs-evil': ['good', 'evil', 'right', 'wrong', 'moral']
    };
    
    const lowerContent = content.toLowerCase();
    const detectedThemes: string[] = [];
    
    Object.entries(themeKeywords).forEach(([theme, keywords]) => {
      const matches = keywords.filter(keyword => lowerContent.includes(keyword));
      if (matches.length > 0) {
        detectedThemes.push(theme);
      }
    });
    
    return detectedThemes;
  }

  // Helper method to classify content type
  private classifyContent(content: string): string {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('chapter') || lowerContent.includes('scene')) {
      return 'narrative';
    } else if (content.includes('"') && content.includes(':')) {
      return 'dialogue';
    } else if (lowerContent.includes('note:') || lowerContent.includes('todo:')) {
      return 'notes';
    } else if (content.length < 200) {
      return 'snippet';
    } else {
      return 'prose';
    }
  }

  // Apply contextual filtering to search results
  private applyContextualFiltering(results: Document[], query: string, projectId?: string): Document[] {
    const queryLower = query.toLowerCase();
    
    return results.map(doc => {
      let relevanceScore = 1.0;
      
      // Boost relevance for same project
      if (projectId && doc.metadata.projectId === projectId) {
        relevanceScore *= 1.5;
      }
      
      // Boost relevance for matching themes
      if (doc.metadata.themes) {
        const matchingThemes = doc.metadata.themes.filter((theme: string) => 
          queryLower.includes(theme.toLowerCase())
        );
        relevanceScore *= (1 + matchingThemes.length * 0.2);
      }
      
      // Boost relevance for matching characters
      if (doc.metadata.potentialCharacters) {
        const matchingCharacters = doc.metadata.potentialCharacters.filter((char: string) => 
          queryLower.includes(char.toLowerCase())
        );
        relevanceScore *= (1 + matchingCharacters.length * 0.3);
      }
      
      return { ...doc, relevanceScore };
    }).sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);
  }

  // Enhanced persistence with versioning
  private async persistData(): Promise<void> {
    try {
      const data: PersistedData = {
        documents: this.documents.map(doc => ({
          pageContent: doc.pageContent,
          metadata: doc.metadata
        })),
        timestamp: new Date().toISOString(),
        version: "2.0"
      };
      
      // Ensure data directory exists
      const dataDir = path.dirname(this.persistencePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      // Create backup of existing data
      if (fs.existsSync(this.persistencePath)) {
        const backupPath = this.persistencePath.replace('.json', `.backup.${Date.now()}.json`);
        fs.copyFileSync(this.persistencePath, backupPath);
      }
      
      // Write to file
      fs.writeFileSync(this.persistencePath, JSON.stringify(data, null, 2));
      console.log(`Enhanced RAG data persisted to ${this.persistencePath}`);
    } catch (error) {
      console.error("Error persisting enhanced RAG data:", error);
    }
  }

  // Enhanced data loading with migration support
  private async loadPersistedData(): Promise<void> {
    try {
      if (fs.existsSync(this.persistencePath) && this.vectorStore && this.embeddings) {
        const fileContent = fs.readFileSync(this.persistencePath, 'utf8');
        const data: PersistedData = JSON.parse(fileContent);
        
        // Convert persisted data back to Document objects
        this.documents = data.documents.map(doc => 
          new Document({
            pageContent: doc.pageContent,
            metadata: doc.metadata
          })
        );
        
        // Add documents to vector store
        if (this.documents.length > 0 && this.vectorStore) {
          await this.vectorStore.addDocuments(this.documents);
          console.log(`Loaded ${this.documents.length} enhanced documents from persisted data`);
        }
        
        // Load project contexts
        const projects = new Set(this.documents.map(doc => doc.metadata.projectId).filter(Boolean));
        projects.forEach(projectId => {
          const projectDocs = this.documents.filter(doc => doc.metadata.projectId === projectId);
          if (projectDocs.length > 0) {
            const firstDoc = projectDocs[0];
            this.setProjectContext(projectId as string, {
              projectId: projectId as string,
              title: firstDoc.metadata.projectTitle || 'Unknown Project',
              characters: firstDoc.metadata.potentialCharacters || [],
              themes: firstDoc.metadata.themes || [],
            });
          }
        });
        
        console.log(`Enhanced RAG system loaded from ${this.persistencePath} (version: ${data.version || '1.0'})`);
      }
    } catch (error) {
      console.error("Error loading persisted RAG data:", error);
    }
  }
}

// Create a singleton instance
const ragService = new RAGService();

export default ragService;
export { RAGService, ProjectContext };
