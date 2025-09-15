import * as dotenv from 'dotenv';
import { ImprovedRAGService } from './src/services/improvedRAGService';

dotenv.config();

const improvedRAGService = new ImprovedRAGService();

async function testUpdatedRAG() {
  console.log('🧪 Testing Updated RAG Service...\n');
  
  try {
    // Test 1: Add new content with better metadata
    console.log('1. Adding new content with metadata...');
    await improvedRAGService.addDocument(
      'Thor wielded Mjolnir against the frost giants, protecting Asgard from their invasion. His courage and strength were unmatched as he battled to save his realm.',
      {
        projectId: 'test-thor-project',
        userId: 'test-user',
        projectTitle: 'Thor: The Norse Hero',
        contentType: 'narrative',
        characters: ['Thor', 'Frost Giants'],
        themes: ['heroism', 'protection', 'courage']
      }
    );
    
    // Test 2: Try to add similar content (should be detected as duplicate)
    console.log('\n2. Adding similar content (should be detected as duplicate)...');
    await improvedRAGService.addDocument(
      'Thor wielded Mjolnir against the frost giants, protecting Asgard from invasion. His courage was legendary.',
      {
        projectId: 'test-thor-project',
        userId: 'test-user',
        projectTitle: 'Thor: The Norse Hero',
        contentType: 'narrative',
        characters: ['Thor'],
        themes: ['heroism', 'bravery']
      }
    );
    
    // Test 3: Search with summary
    console.log('\n3. Testing search with summary...');
    const searchResult = await improvedRAGService.intelligentSearch('Thor battles frost giants', {
      projectId: 'test-thor-project',
      userId: 'test-user',
      limit: 5
    });
    
    console.log('\n📊 Search Results:');
    console.log(`Found ${searchResult.results.length} results`);
    
    searchResult.results.forEach((result, index) => {
      console.log(`\n  ${index + 1}. "${result.pageContent.slice(0, 80)}..."`);
      console.log(`     Characters: ${result.metadata?.characters?.join(', ') || 'None'}`);
      console.log(`     Themes: ${result.metadata?.themes?.join(', ') || 'None'}`);
      console.log(`     Content Type: ${result.metadata?.contentType || 'Unknown'}`);
      console.log(`     Relevance: ${(result as any).relevanceScore || 'N/A'}`);
    });
    
    if (searchResult.searchSummary) {
      console.log('\n📋 Search Summary:');
      console.log(`  Total Results: ${searchResult.searchSummary.totalResults}`);
      console.log(`  Top Characters: ${searchResult.searchSummary.topCharacters.join(', ')}`);
      console.log(`  Top Themes: ${searchResult.searchSummary.topThemes.join(', ')}`);
      console.log(`  Content Types: ${searchResult.searchSummary.contentTypes.join(', ')}`);
      console.log(`  Strategy: ${searchResult.searchSummary.searchStrategy}`);
      console.log(`  Key Findings:`);
      searchResult.searchSummary.keyFindings.forEach((finding, index) => {
        console.log(`    ${index + 1}. ${finding}`);
      });
    }
    
    if (searchResult.projectInsights) {
      console.log('\n🔍 Project Insights:');
      console.log(`  Relevant Characters: ${searchResult.projectInsights.relevantCharacters.join(', ')}`);
      console.log(`  Relevant Themes: ${searchResult.projectInsights.relevantThemes.join(', ')}`);
      console.log(`  Contextual Hints: ${searchResult.projectInsights.contextualHints.join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testUpdatedRAG();
