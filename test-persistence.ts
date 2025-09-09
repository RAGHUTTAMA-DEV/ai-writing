import dotenv from 'dotenv';
dotenv.config();

import ragService from './src/services/ragService';

async function testPersistence() {
  console.log('Testing RAG persistence...');
  
  try {
    // Search for documents to see if they were loaded from persistence
    const results = await ragService.search('Alice', 10);
    
    console.log(`\nFound ${results.length} documents in the vector store:`);
    results.forEach((doc, index) => {
      console.log(`\n${index + 1}. Content: ${doc.pageContent}`);
      console.log(`   Metadata: ${JSON.stringify(doc.metadata, null, 2)}`);
    });
    
    console.log('\nPersistence test completed successfully!');
  } catch (error) {
    console.error('Error testing persistence:', error);
  }
}

testPersistence();