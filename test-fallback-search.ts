import dotenv from 'dotenv';
import improvedRAGService from './src/services/improvedRAGService';

dotenv.config();

async function testFallbackSearch() {
  console.log('🔍 Testing Fallback Search Functionality...\n');
  
  try {
    // Test search for "THor" - should find existing documents with "thor"
    console.log('1. Testing search for "THor"...');
    const searchResult1 = await improvedRAGService.intelligentSearch('THor', {
      limit: 5
    });
    
    console.log(`\nFound ${searchResult1.results.length} results for "THor"`);
    searchResult1.results.forEach((result, index) => {
      console.log(`  ${index + 1}. Project: ${result.metadata?.projectTitle || 'Unknown'}`);
      console.log(`     Content: "${result.pageContent.slice(0, 100)}..."`);
      console.log(`     Score: ${(result as any).relevanceScore || 'N/A'}`);
      console.log(`     Characters: ${result.metadata?.characters?.join(', ') || 'None'}`);
    });
    
    // Test with project filter
    console.log('\n2. Testing search for "thor" with project filter...');
    const searchResult2 = await improvedRAGService.intelligentSearch('thor', {
      projectId: '317e0827-701b-40a0-a9cf-e866d7b60ccc',
      limit: 5
    });
    
    console.log(`\nFound ${searchResult2.results.length} results for "thor" in specific project`);
    searchResult2.results.forEach((result, index) => {
      console.log(`  ${index + 1}. Project: ${result.metadata?.projectTitle || 'Unknown'}`);
      console.log(`     Content: "${result.pageContent.slice(0, 100)}..."`);
    });
    
    // Test search for "mythology"
    console.log('\n3. Testing search for "mythology"...');
    const searchResult3 = await improvedRAGService.intelligentSearch('mythology', {
      limit: 3
    });
    
    console.log(`\nFound ${searchResult3.results.length} results for "mythology"`);
    searchResult3.results.forEach((result, index) => {
      console.log(`  ${index + 1}. Project: ${result.metadata?.projectTitle || 'Unknown'}`);
      console.log(`     Content: "${result.pageContent.slice(0, 100)}..."`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFallbackSearch();
