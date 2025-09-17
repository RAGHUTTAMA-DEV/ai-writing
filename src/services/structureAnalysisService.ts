import aiService from './aiService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ChapterBreakdown {
  chapterNumber: number;
  title: string;
  startPosition?: number;
  endPosition?: number;
  content?: string;
  themes: string[];
  characters: string[];
  plotPoints: string[];
  wordCount: number;
  summary: string;
  scenes: SceneBreakdown[];
}

interface SceneBreakdown {
  sceneNumber: number;
  title: string;
  summary: string;
  characters: string[];
  setting?: string;
  purpose?: string;
  wordCount: number;
}

interface StructureAnalysis {
  totalWordCount: number;
  suggestedChapterCount: number;
  suggestedSceneCount: number;
  chapters: ChapterBreakdown[];
  overallThemes: string[];
  mainCharacters: string[];
  narrativeStructure: string;
  pacing: string;
  recommendations: string[];
}

class StructureAnalysisService {
  
  // Main method to analyze and divide content into chapters and scenes
  async analyzeProjectStructure(projectId: string, userId: string): Promise<StructureAnalysis> {
    try {
      console.log(`🔍 Starting structure analysis for project: ${projectId}`);
      
      // Get project content
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          contexts: {
            where: { contextType: 'GENERAL' }
          }
        }
      });

      if (!project || !project.content) {
        throw new Error('Project not found or has no content');
      }

      const content = project.content;
      const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
      
      console.log(`📄 Analyzing ${wordCount} words of content`);

      // Get existing project context for themes and characters
      const projectContext = project.contexts?.[0];
      
      // Analyze overall structure first
      const overallAnalysis = await this.analyzeOverallStructure(content, projectContext);
      
      // Divide into chapters
      const chapters = await this.divideIntoChapters(content, overallAnalysis, projectContext);
      
      // Chapters already have scenes from AI analysis
      const chaptersWithScenes = chapters;

      // Generate recommendations
      const recommendations = await this.generateStructureRecommendations(
        chaptersWithScenes, 
        overallAnalysis
      );

      const structureAnalysis: StructureAnalysis = {
        totalWordCount: wordCount,
        suggestedChapterCount: chaptersWithScenes.length,
        suggestedSceneCount: chaptersWithScenes.reduce((total: number, ch: ChapterBreakdown) => total + ch.scenes.length, 0),
        chapters: chaptersWithScenes,
        overallThemes: overallAnalysis.themes,
        mainCharacters: overallAnalysis.characters,
        narrativeStructure: overallAnalysis.structure,
        pacing: overallAnalysis.pacing,
        recommendations
      };

      console.log(`✅ Structure analysis complete: ${chaptersWithScenes.length} chapters, ${structureAnalysis.suggestedSceneCount} scenes`);
      
      return structureAnalysis;
    } catch (error) {
      console.error('Error in structure analysis:', error);
      throw new Error(`Failed to analyze project structure: ${error}`);
    }
  }

  // Analyze overall narrative structure and themes using AI
  private async analyzeOverallStructure(content: string, projectContext: any) {
    try {
      const totalWords = content.split(/\s+/).length;
      const contentSample = content.length > 4000 ? content.substring(0, 4000) + '...' : content;
      
      console.log(`🤖 AI analyzing overall structure for ${totalWords} words...`);
      
      const prompt = `Analyze this writing content and extract ACTUAL information from the text. Do not make assumptions.

CONTENT TO ANALYZE:
"${contentSample}"

${projectContext ? `EXISTING PROJECT CONTEXT:
- Known Themes: ${projectContext.themes?.join(', ') || 'None'}
- Known Characters: ${projectContext.characters?.join(', ') || 'None'}
- Genre: ${projectContext.genre || 'Unknown'}
- Writing Style: ${projectContext.writingStyle || 'Unknown'}
` : ''}

Provide your analysis in EXACTLY this format (no extra text):

THEMES:
- [Extract actual themes from the content]
- [Extract actual themes from the content]
- [Extract actual themes from the content]

CHARACTERS:
- [Extract actual character names from the content]
- [Extract actual character names from the content]
- [Extract actual character names from the content]

STRUCTURE: [Identify the narrative structure used]
PACING: [Fast/Moderate/Slow based on sentence structure and content flow]
SUGGESTED CHAPTERS: [Calculate based on word count: ${Math.max(3, Math.floor(totalWords / 2500))}]
GENRE: [Identify genre from content]

IMPORTANT: Extract information from the actual text content provided. Use real character names and themes that appear in the story.`;
      
      const response = await aiService.generateStructureAnalysis(prompt);
      
      console.log(`📄 AI overall analysis response:`, response.substring(0, 400) + '...');
      // Parse AI response as structured text
      const analysis = this.parseStructuredTextResponse(response, totalWords);
      
      console.log(`✅ AI analysis complete: ${analysis.themes.length} themes, ${analysis.characters.length} characters`);
      
      return analysis;
    } catch (error) {
      console.error('Error in overall structure analysis:', error);
      // Extract actual characters from content using simple text analysis (no AI needed)
      const actualCharacters = this.extractCharactersFromText(content);
      
      return {
        themes: ['AI_ANALYSIS_FAILED_RATE_LIMIT'], // Will show user the real issue
        characters: actualCharacters, // At least get real character names
        structure: 'three-act structure',
        pacing: 'moderate',
        suggestedChapters: Math.max(3, Math.floor(content.split(/\s+/).length / 3000))
      };
    }
  }
  
  // Parse structured text response for structure analysis
  private parseStructuredTextResponse(response: string, totalWords: number) {
    try {
      // Extract themes - more flexible parsing
      const themes: string[] = [];
      const themeSection = response.match(/THEMES:[\s\S]*?(?=\n\n|CHARACTERS:|STRUCTURE:|$)/i);
      if (themeSection) {
        const themeMatches = themeSection[0].match(/-\s*([^\n\r\[\]]+)/g);
        if (themeMatches) {
          themeMatches.forEach(t => {
            const clean = t.replace(/^-\s*/, '').replace(/\[.*?\]/, '').trim();
            if (clean && clean.length > 2 && !clean.toLowerCase().includes('extract')) {
              themes.push(clean);
            }
          });
        }
      }
      
      // Extract characters - more flexible parsing
      const characters: string[] = [];
      const characterSection = response.match(/CHARACTERS:[\s\S]*?(?=\n\n|STRUCTURE:|PACING:|$)/i);
      if (characterSection) {
        const characterMatches = characterSection[0].match(/-\s*([^\n\r\[\]]+)/g);
        if (characterMatches) {
          characterMatches.forEach(c => {
            const clean = c.replace(/^-\s*/, '').replace(/\[.*?\]/, '').trim();
            if (clean && clean.length > 2 && !clean.toLowerCase().includes('extract') && !clean.toLowerCase().includes('character name')) {
              characters.push(clean);
            }
          });
        }
      }
      
      // Extract structure
      const structureMatch = response.match(/STRUCTURE:\s*([^\n\r]+)/i);
      const structure = structureMatch ? structureMatch[1].trim() : 'three-act structure';
      
      // Extract pacing
      const pacingMatch = response.match(/PACING:\s*([^\n\r]+)/i);
      const pacing = pacingMatch ? pacingMatch[1].trim().toLowerCase() : 'moderate';
      
      // Extract suggested chapters
      const chaptersMatch = response.match(/SUGGESTED CHAPTERS:\s*(\d+)/i);
      const suggestedChapters = chaptersMatch ? parseInt(chaptersMatch[1]) : Math.max(3, Math.floor(totalWords / 2500));
      
      // Extract genre
      const genreMatch = response.match(/GENRE:\s*([^\n\r]+)/i);
      const genre = genreMatch ? genreMatch[1].trim() : 'fiction';
      
      console.log(`🔍 Parsed themes: ${themes.length}, characters: ${characters.length}`);
      return {
        themes: themes.length > 0 ? themes : ['THEME PARSING FAILED'],
        characters: characters.length > 0 ? characters : ['CHARACTER PARSING FAILED'],
        structure,
        pacing,
        suggestedChapters,
        genre
      };
    } catch (error) {
      console.warn('Failed to parse structured text response:', error);
      console.warn('Raw AI response for debugging:', response.substring(0, 200));
      
      // Extract characters from actual content, but themes must come from AI
      const actualCharacters = this.extractCharactersFromText(response);
      
      return {
        themes: ['PARSING_FAILED_CHECK_AI_RESPONSE'], // Show parsing failed, not hardcoded themes
        characters: actualCharacters,
        structure: 'three-act structure',
        pacing: 'moderate',
        suggestedChapters: Math.max(3, Math.floor(totalWords / 2500)),
        genre: 'fiction'
      };
    }
  }


  // AI-driven chapter analysis
  private async analyzeChapterContentWithAI(
    chapterContent: string, 
    chapterNumber: number, 
    globalThemes: string[], 
    globalCharacters: string[]
  ) {
    try {
      const contentSample = chapterContent.length > 2000 ? chapterContent.substring(0, 2000) + '...' : chapterContent;
      
      console.log(`🤖 AI analyzing Chapter ${chapterNumber}...`);
      
      const prompt = `Analyze this chapter and provide a structured breakdown. Extract actual information from the content.

CHAPTER ${chapterNumber} CONTENT:
"${contentSample}"

GLOBAL CONTEXT:
- Story Themes: ${globalThemes.length > 0 ? globalThemes.join(', ') : 'Not specified'}
- Story Characters: ${globalCharacters.length > 0 ? globalCharacters.join(', ') : 'Not specified'}

Provide your analysis in EXACTLY this format (no extra text):

TITLE: [Create a descriptive chapter title based on content]

THEMES:
- [Main theme from content]
- [Secondary theme from content]

CHARACTERS:
- [Character name from content]
- [Character name from content]

PLOT POINTS:
- [Key event 1]
- [Key event 2]
- [Key event 3]

SCENES:
Scene 1: [Scene name] - [What happens] (Characters: [who is involved])
Scene 2: [Scene name] - [What happens] (Characters: [who is involved])

SUMMARY: [2-3 sentence chapter summary]

Analyze the ACTUAL content - extract real names, events, and themes from the text provided.`;
      
      const response = await aiService.generateStructureAnalysis(prompt);
      
      console.log(`📄 AI response for Chapter ${chapterNumber}:`, response.substring(0, 300) + '...');
      return this.parseChapterTextResponse(response, chapterNumber, chapterContent);
      
    } catch (error) {
      console.error(`Error analyzing chapter ${chapterNumber}:`, error);
      return this.createFallbackChapterAnalysis(chapterContent, chapterNumber, globalThemes, globalCharacters);
    }
  }
  
  private parseChapterTextResponse(response: string, chapterNumber: number, chapterContent: string) {
    try {
      // Extract title
      const titleMatch = response.match(/TITLE:\s*([^\n\r]+)/i);
      const title = titleMatch ? titleMatch[1].trim() : `Chapter ${chapterNumber}`;
      
      // Extract themes with flexible parsing
      const themes: string[] = [];
      const themeSection = response.match(/THEMES:[\s\S]*?(?=\n\n|CHARACTERS:|PLOT POINTS:|$)/i);
      if (themeSection) {
        const themeMatches = themeSection[0].match(/-\s*([^\n\r\[\]]+)/g);
        if (themeMatches) {
          themeMatches.forEach(t => {
            const clean = t.replace(/^-\s*/, '').replace(/\[.*?\]/, '').trim();
            if (clean && clean.length > 2 && !clean.toLowerCase().includes('main theme')) {
              themes.push(clean);
            }
          });
        }
      }
      
      // Extract characters with flexible parsing
      const characters: string[] = [];
      const characterSection = response.match(/CHARACTERS:[\s\S]*?(?=\n\n|PLOT POINTS:|SCENES:|$)/i);
      if (characterSection) {
        const characterMatches = characterSection[0].match(/-\s*([^\n\r\[\]]+)/g);
        if (characterMatches) {
          characterMatches.forEach(c => {
            const clean = c.replace(/^-\s*/, '').replace(/\[.*?\]/, '').trim();
            if (clean && clean.length > 2 && !clean.toLowerCase().includes('character name')) {
              characters.push(clean);
            }
          });
        }
      }
      
      // Extract plot points
      const plotPoints: string[] = [];
      const plotSection = response.match(/PLOT POINTS:[\s\S]*?(?=\n\n|SCENES:|SUMMARY:|$)/i);
      if (plotSection) {
        const plotMatches = plotSection[0].match(/-\s*([^\n\r]+)/g);
        if (plotMatches) {
          plotPoints.push(...plotMatches.map(p => p.replace(/^-\s*/, '').trim()));
        }
      }
      
      // Extract scenes
      const scenes: any[] = [];
      const sceneSection = response.match(/SCENES:[\s\S]*?(?=\n\n|SUMMARY:|MOOD:|$)/i);
      if (sceneSection) {
        const sceneMatches = sceneSection[0].match(/Scene \d+:[^\n\r]+/g);
        if (sceneMatches) {
          sceneMatches.forEach((sceneText, idx) => {
            const parts = sceneText.split(' - ');
            const sceneTitle = parts[0]?.replace(/Scene \d+:\s*/, '').trim() || `Scene ${idx + 1}`;
            const summary = parts[1]?.replace(/\([^)]*\)/, '').trim() || 'Scene content';
            const characterMatch = sceneText.match(/\(Characters:\s*([^)]+)\)/i);
            const sceneCharacters = characterMatch ? characterMatch[1].split(',').map(c => c.trim()) : [];
            
            scenes.push({
              sceneNumber: idx + 1,
              title: sceneTitle,
              summary,
              characters: sceneCharacters,
              wordCount: Math.floor(chapterContent.split(/\s+/).length / Math.max(sceneMatches.length, 1))
            });
          });
        }
      }
      
      // Extract summary
      const summaryMatch = response.match(/SUMMARY:\s*([^\n\r]+(?:\n[^\n\r]+)*?)(?=\n\n|MOOD:|CONFLICT:|$)/i);
      const summary = summaryMatch ? summaryMatch[1].trim() : 'Chapter content';
      
      console.log(`🔍 Chapter ${chapterNumber} parsed: ${themes.length} themes, ${characters.length} characters, ${plotPoints.length} plot points`);
      return {
        title: title !== `Chapter ${chapterNumber}` ? title : `TITLE PARSING FAILED - Chapter ${chapterNumber}`,
        themes: themes.length > 0 ? themes : ['THEME PARSING FAILED'],
        characters: characters.length > 0 ? characters : ['CHARACTER PARSING FAILED'],
        plotPoints: plotPoints.length > 0 ? plotPoints : ['PLOT PARSING FAILED'],
        scenes: scenes.length > 0 ? scenes : [{
          sceneNumber: 1,
          title: 'SCENE PARSING FAILED',
          summary: `AI ANALYSIS FAILED: ${chapterContent.substring(0, 100)}...`,
          characters: ['PARSING FAILED'],
          wordCount: chapterContent.split(/\s+/).length
        }],
        summary: summary !== 'Chapter content' ? summary : 'SUMMARY PARSING FAILED'
      };
    } catch (error) {
      console.warn(`Failed to parse chapter ${chapterNumber} text response:`, error);
      console.warn('Raw AI response:', response?.substring(0, 500));
      return this.createFallbackChapterAnalysis(chapterContent, chapterNumber, [], []);
    }
  }
  
  private createFallbackChapterAnalysis(chapterContent: string, chapterNumber: number, globalThemes: string[], globalCharacters: string[]) {
    const sentences = chapterContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const paragraphs = chapterContent.split(/\n\n+/).filter(p => p.trim().length > 50);
    
    return {
      title: `Chapter ${chapterNumber}`,
      themes: globalThemes.slice(0, 2),
      characters: globalCharacters.slice(0, 3),
      plotPoints: [
        sentences[0]?.substring(0, 100) + '...' || 'Chapter beginning',
        sentences[Math.floor(sentences.length / 2)]?.substring(0, 100) + '...' || 'Chapter middle',
        sentences[sentences.length - 1]?.substring(0, 100) + '...' || 'Chapter end'
      ].filter(p => p.length > 20),
      scenes: paragraphs.slice(0, 2).map((p, idx) => ({
        sceneNumber: idx + 1,
        title: `Scene ${idx + 1}`,
        summary: p.substring(0, 150) + '...',
        characters: globalCharacters.slice(0, 2),
        wordCount: p.split(/\s+/).length
      })),
      summary: chapterContent.substring(0, 200) + '...'
    };
  }

  // Divide content into chapters with AI assistance (still fast, no embeddings)
  private async divideIntoChapters(
    content: string, 
    overallAnalysis: any, 
    projectContext: any
  ): Promise<ChapterBreakdown[]> {
    try {
      const words = content.split(/\s+/);
      const totalWords = words.length;
      const suggestedChapters = overallAnalysis.suggestedChapters || Math.max(3, Math.floor(totalWords / 2500));
      
      console.log(`📚 Dividing ${totalWords} words into ${suggestedChapters} chapters (AI MODE)`);
      
      const chapters = await this.createAIChapterDivisions(content, suggestedChapters, overallAnalysis);
      return chapters;
    } catch (error) {
      console.error('Error dividing into chapters:', error);
      return this.createDefaultChapterDivisions(content, overallAnalysis.suggestedChapters || 3);
    }
  }
  
  private async createAIChapterDivisions(content: string, numChapters: number, overallAnalysis: any): Promise<ChapterBreakdown[]> {
    const totalWords = content.split(/\s+/).length;
    const contentSample = content.length > 6000 ? content.substring(0, 6000) + '...' : content;
    
    // Skip AI chapter division since it's complex - go straight to individual chapter analysis
    console.log('⚡ Using direct chapter analysis approach to avoid complex JSON parsing');
    
    // Use local splitting and analyze each chapter with AI
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
    const paragraphsPerChapter = Math.floor(paragraphs.length / numChapters) || 1;
    const chapters: ChapterBreakdown[] = [];
    
    for (let i = 0; i < numChapters; i++) {
      const start = i * paragraphsPerChapter;
      const end = i === numChapters - 1 ? paragraphs.length : (i + 1) * paragraphsPerChapter;
      const chapterContent = paragraphs.slice(start, end).join('\n\n');
      
      const analysis = await this.analyzeChapterContentWithAI(
        chapterContent,
        i + 1,
        overallAnalysis.themes || [],
        overallAnalysis.characters || []
      );
      
      chapters.push({
        chapterNumber: i + 1,
        title: analysis.title,
        wordCount: chapterContent.split(/\s+/).length,
        themes: analysis.themes,
        characters: analysis.characters,
        plotPoints: analysis.plotPoints,
        scenes: analysis.scenes.map((s: any) => ({
          sceneNumber: s.sceneNumber,
          title: s.title,
          summary: s.summary,
          characters: s.characters,
          wordCount: s.wordCount || 0
        })),
        summary: analysis.summary
      });
    }
    
    return chapters;
  }


  // Create default chapter divisions if AI parsing fails
  private createDefaultChapterDivisions(content: string, numChapters: number): ChapterBreakdown[] {
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
    const paragraphsPerChapter = Math.floor(paragraphs.length / numChapters) || 1;
    const chapters: ChapterBreakdown[] = [];
    
    for (let i = 0; i < numChapters; i++) {
      const start = i * paragraphsPerChapter;
      const end = i === numChapters - 1 ? paragraphs.length : (i + 1) * paragraphsPerChapter;
      const chapterContent = paragraphs.slice(start, end).join('\n\n');
      const wordCount = chapterContent.split(/\s+/).length;
      
      chapters.push({
        chapterNumber: i + 1,
        title: `Chapter ${i + 1}`,
        wordCount,
        themes: ['general narrative'],
        characters: ['main character'],
        plotPoints: ['story development'],
        summary: `Content for chapter ${i + 1}`,
        scenes: [{
          sceneNumber: 1,
          title: 'Main Scene',
          summary: chapterContent.substring(0, 150) + '...',
          characters: ['main character'],
          wordCount: wordCount
        }]
      });
    }
    
    return chapters;
  }


  // Generate structure recommendations
  private async generateStructureRecommendations(
    chapters: ChapterBreakdown[], 
    overallAnalysis: any
  ): Promise<string[]> {
    try {
      const totalScenes = chapters.reduce((sum, ch) => sum + ch.scenes.length, 0);
      const avgWordsPerChapter = chapters.reduce((sum, ch) => sum + ch.wordCount, 0) / chapters.length;
      
      const prompt = `Analyze this story structure and provide recommendations for improvement.

STRUCTURE ANALYSIS:
- Total Chapters: ${chapters.length}
- Total Scenes: ${totalScenes}
- Average Words per Chapter: ${Math.round(avgWordsPerChapter)}
- Overall Themes: ${overallAnalysis.themes.join(', ')}
- Narrative Structure: ${overallAnalysis.structure}
- Pacing: ${overallAnalysis.pacing}

CHAPTER BREAKDOWN:
${chapters.map(ch => `
Chapter ${ch.chapterNumber}: "${ch.title}" (${ch.wordCount} words, ${ch.scenes.length} scenes)
- Themes: ${ch.themes.join(', ')}
- Characters: ${ch.characters.join(', ')}
`).join('')}

Provide 5-7 specific, actionable recommendations for improving the story structure. Focus on:

1. Chapter balance and pacing
2. Theme distribution across chapters
3. Character arc development
4. Scene transitions and flow
5. Narrative tension and hooks
6. Overall story progression

Format as numbered list of specific recommendations.`;

      const response = await aiService.generateStructureAnalysis(prompt);

      // Extract recommendations from response
      const recommendations = this.parseRecommendations(response);
      return recommendations;
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return [
        'Consider balancing chapter lengths for better pacing',
        'Ensure each chapter advances the main plot',
        'Develop character arcs consistently across chapters',
        'Add scene transitions for smoother narrative flow',
        'Check theme consistency throughout the story'
      ];
    }
  }

  // Parse recommendations from AI response
  private parseRecommendations(aiResponse: string): string[] {
    const recommendations: string[] = [];
    
    // Look for numbered list items
    const matches = aiResponse.match(/\d+\.\s*([^\n\r]+)/g);
    
    if (matches) {
      matches.forEach(match => {
        const rec = match.replace(/\d+\.\s*/, '').trim();
        if (rec && rec.length > 20) { // Filter out very short recommendations
          recommendations.push(rec);
        }
      });
    }
    
    // If no numbered items found, try to extract sentences that look like recommendations
    if (recommendations.length === 0) {
      const sentences = aiResponse.split(/[.!?]+/).filter(s => s.trim().length > 30);
      recommendations.push(...sentences.slice(0, 5).map(s => s.trim()));
    }
    
    return recommendations.slice(0, 7);
  }
  
  // Simple text-based character extraction - finds actual names like Thor, Loki
  private extractCharactersFromText(content: string): string[] {
    const characters: string[] = [];
    const words = content.split(/\s+/);
    const properNouns = new Map<string, number>();
    
    // Find capitalized words that appear multiple times
    words.forEach(word => {
      const clean = word.replace(/[^A-Za-z]/g, '');
      if (clean.length > 2 && clean[0] === clean[0].toUpperCase() && 
          !['The', 'And', 'But', 'For', 'Chapter', 'He', 'She', 'His', 'Her', 'They', 'It', 'This', 'That'].includes(clean)) {
        properNouns.set(clean, (properNouns.get(clean) || 0) + 1);
      }
    });
    
    // Get names that appear more than once
    Array.from(properNouns.entries())
      .filter(([name, count]) => count > 1)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 6)
      .forEach(([name]) => characters.push(name));
    
    return characters.length > 0 ? characters : ['Unknown Character'];
  }
  

  // Quick chapter suggestions without full analysis
  async getQuickChapterSuggestions(content: string, targetChapters?: number): Promise<{suggestions: string[], estimatedBreaks: number[]}> {
    try {
      const words = content.split(/\s+/);
      const numChapters = targetChapters || Math.max(3, Math.floor(words.length / 2500));
      
      // Find natural break points (paragraphs, scene breaks, etc.)
      const paragraphs = content.split(/\n\s*\n/);
      const naturalBreaks: number[] = [];
      let wordCount = 0;
      
      paragraphs.forEach((para, index) => {
        wordCount += para.split(/\s+/).length;
        if (index < paragraphs.length - 1) {
          naturalBreaks.push(wordCount);
        }
      });
      
      // Select breaks closest to ideal chapter divisions
      const idealChapterLength = words.length / numChapters;
      const selectedBreaks: number[] = [];
      
      for (let i = 1; i < numChapters; i++) {
        const targetPosition = i * idealChapterLength;
        const closestBreak = naturalBreaks.reduce((prev, curr) => 
          Math.abs(curr - targetPosition) < Math.abs(prev - targetPosition) ? curr : prev
        );
        selectedBreaks.push(closestBreak);
      }
      
      const suggestions = [
        `Divide into ${numChapters} chapters of roughly ${Math.round(idealChapterLength)} words each`,
        `Look for natural scene transitions at suggested break points`,
        `Ensure each chapter has a clear narrative purpose`,
        `Consider cliffhangers at chapter endings to maintain reader engagement`,
        `Balance action and reflection across chapters`
      ];
      
      return {
        suggestions,
        estimatedBreaks: selectedBreaks.sort((a, b) => a - b)
      };
    } catch (error) {
      console.error('Error generating quick chapter suggestions:', error);
      return {
        suggestions: ['Consider dividing content into logical chapters', 'Look for natural story breaks'],
        estimatedBreaks: []
      };
    }
  }
}

export default new StructureAnalysisService();
export { 
  StructureAnalysisService, 
  ChapterBreakdown, 
  SceneBreakdown, 
  StructureAnalysis 
};
