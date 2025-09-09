// This is an example of how you could persist the vector store to disk
// For production use, you would want to use a persistent vector database

import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import fs from "fs";
import path from "path";

async function persistRAGExample() {
  console.log('Setting up persistent RAG example...');
  
  try {
    // Initialize embeddings
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.log("No API key found for Google Generative AI. Cannot initialize embeddings.");
      return;
    }
    
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: apiKey,
      modelName: "embedding-001"
    });
    
    // Create documents
    const documents = [
      new Document({
        pageContent: "The protagonist, Alice, discovered a mysterious portal in her grandmother's attic.",
        metadata: { projectId: 'project-1', documentId: 'doc-1', type: 'chapter', chapter: 1 }
      }),
      new Document({
        pageContent: "Alice stepped through the portal and found herself in a world where animals could talk.",
        metadata: { projectId: 'project-1', documentId: 'doc-1', type: 'chapter', chapter: 2 }
      }),
      new Document({
        pageContent: "In the magical world, Alice met a wise owl who offered to help her find a way home.",
        metadata: { projectId: 'project-1', documentId: 'doc-1', type: 'chapter', chapter: 3 }
      })
    ];
    
    console.log('Documents created:');
    documents.forEach((doc, index) => {
      console.log(`${index + 1}. ${doc.pageContent}`);
      console.log(`   Metadata: ${JSON.stringify(doc.metadata)}`);
    });
    
    // For persistence, you would typically:
    // 1. Use a database like PostgreSQL, MongoDB, or a vector database like Pinecone
    // 2. Store the document content and metadata in the database
    // 3. Store the embeddings separately or use a vector database
    
    console.log('\nFor production persistence, consider:');
    console.log('1. Pinecone - Cloud-based vector database');
    console.log('2. Weaviate - Open-source vector database');
    console.log('3. FAISS - Facebook AI Similarity Search (requires additional setup)');
    console.log('4. Chroma - Open-source embedding database');
    console.log('5. PostgreSQL with vector extension (pgvector)');
    
    console.log('\nExample approach for PostgreSQL:');
    console.log('- Store documents in a "documents" table with metadata');
    console.log('- Store embeddings in a "embeddings" table with foreign key to documents');
    console.log('- Use pgvector extension for similarity search');
    
  } catch (error) {
    console.error('Error setting up persistent RAG:', error);
  }
}

persistRAGExample();