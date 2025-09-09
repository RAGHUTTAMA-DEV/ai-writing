import dotenv from 'dotenv';
dotenv.config();

import ragService from './src/services/ragService';
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

async function viewVectorStore() {
  console.log('Viewing vector store contents...');
  
  try {
    // Add some sample documents to demonstrate
    console.log('Adding sample documents...');
    
    await ragService.addDocument(
      'The protagonist, Alice, discovered a mysterious portal in her grandmother\'s attic.',
      { projectId: 'project-1', documentId: 'doc-1', type: 'chapter', chapter: 1 }
    );
    
    await ragService.addDocument(
      'Alice stepped through the portal and found herself in a world where animals could talk.',
      { projectId: 'project-1', documentId: 'doc-1', type: 'chapter', chapter: 2 }
    );
    
    await ragService.addDocument(
      'In the magical world, Alice met a wise owl who offered to help her find a way home.',
      { projectId: 'project-1', documentId: 'doc-1', type: 'chapter', chapter: 3 }
    );
    
    // Search for all documents
    console.log('\nSearching for all documents...');
    const results = await ragService.search('Alice', 10);
    
    console.log(`\nFound ${results.length} documents in the vector store:`);
    results.forEach((doc, index) => {
      console.log(`\n${index + 1}. Content: ${doc.pageContent}`);
      console.log(`   Metadata: ${JSON.stringify(doc.metadata, null, 2)}`);
    });
    
    console.log('\nVector store contents displayed successfully!');
  } catch (error) {
    console.error('Error viewing vector store:', error);
  }
}

viewVectorStore();