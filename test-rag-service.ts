import dotenv from 'dotenv';
dotenv.config();

import ragService from './src/services/ragService';

async function testRAG() {
  console.log('Testing RAG service...');
  
  try {
    // Add some sample documents
    await ragService.addDocument(
      'The protagonist, Alice, discovered a mysterious portal in her grandmother\'s attic.',
      { projectId: 'project-1', documentId: 'doc-1', type: 'chapter' }
    );
    
    await ragService.addDocument(
      'Alice stepped through the portal and found herself in a world where animals could talk.',
      { projectId: 'project-1', documentId: 'doc-1', type: 'chapter' }
    );
    
    await ragService.addDocument(
      'In the magical world, Alice met a wise owl who offered to help her find a way home.',
      { projectId: 'project-1', documentId: 'doc-1', type: 'chapter' }
    );
    
    console.log('Added sample documents to RAG system');
    
    // Search for relevant documents
    const results = await ragService.search('Alice and the portal', 3);
    
    console.log('\nSearch results:');
    results.forEach((doc, index) => {
      console.log(`${index + 1}. Content: ${doc.pageContent}`);
      console.log(`   Metadata: ${JSON.stringify(doc.metadata)}`);
    });
    
    console.log('\nRAG service test completed successfully!');
  } catch (error) {
    console.error('Error testing RAG service:', error);
  }
}

testRAG();