import dotenv from 'dotenv';
import improvedRAGService from './src/services/improvedRAGService';

dotenv.config();

async function testRAGSearch() {
  console.log('🧪 Testing RAG Search Functionality...\n');
  
  try {
    // First, add some test content
    console.log('1. Adding test document...');
    await improvedRAGService.addDocument(
      'Thor is a brave and powerful god from Norse mythology. He wields Mjolnir, his mighty hammer, and is known for his strength and courage. Thor protects Asgard and Midgard from various threats.',
      {
        projectId: 'test-project-123',
        userId: 'test-user-456',
        projectTitle: 'Norse Mythology Story',
        contentType: 'character'
      }
    );
    console.log('✅ Document added successfully');
    
    // Test search with "THor" (case variations)
    console.log('\n2. Testing search for "THor"...');
    const searchResult1 = await improvedRAGService.intelligentSearch('THor', {
      projectId: 'test-project-123',
      userId: 'test-user-456',
      limit: 5
    });
    
    console.log(`Results for "THor": ${searchResult1.results.length} found`);
    searchResult1.results.forEach((result, index) => {
      console.log(`  ${index + 1}. Content: "${result.pageContent.slice(0, 100)}..."`);
      console.log(`     Relevance: ${result.relevanceScore || 'N/A'}`);
    });
    
    // Test search with "thor" (lowercase)
    console.log('\n3. Testing search for "thor"...');
    const searchResult2 = await improvedRAGService.intelligentSearch('thor', {
      projectId: 'test-project-123', 
      userId: 'test-user-456',
      limit: 5
    });
    
    console.log(`Results for "thor": ${searchResult2.results.length} found`);
    searchResult2.results.forEach((result, index) => {
      console.log(`  ${index + 1}. Content: "${result.pageContent.slice(0, 100)}..."`);
      console.log(`     Relevance: ${result.relevanceScore || 'N/A'}`);
    });
    
    // Test search with "mythology"
    console.log('\n4. Testing search for "mythology"...');
    const searchResult3 = await improvedRAGService.intelligentSearch('mythology', {
      projectId: 'test-project-123',
      userId: 'test-user-456', 
      limit: 5
    });
    
    console.log(`Results for "mythology": ${searchResult3.results.length} found`);
    searchResult3.results.forEach((result, index) => {
      console.log(`  ${index + 1}. Content: "${result.pageContent.slice(0, 100)}..."`);
      console.log(`     Relevance: ${result.relevanceScore || 'N/A'}`);
    });
    
    // Test search with no project filter 
    console.log('\n5. Testing search without project filter...');
    const searchResult4 = await improvedRAGService.intelligentSearch('Thor', {
      limit: 5
    });
    
    console.log(`Results without project filter: ${searchResult4.results.length} found`);
    searchResult4.results.forEach((result, index) => {
      console.log(`  ${index + 1}. Content: "${result.pageContent.slice(0, 100)}..."`);
      console.log(`     Project ID: ${result.metadata?.projectId || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRAGSearch();
