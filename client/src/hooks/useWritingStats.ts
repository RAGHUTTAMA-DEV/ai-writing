import { useMemo } from 'react';
import { useProjectStore } from '../store/useProjectStore';

export interface WritingStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  paragraphs: number;
  sentences: number;
  readingTime: number; // in minutes
  avgWordsPerSentence: number;
}

export const useWritingStats = () => {
  const { activeProject } = useProjectStore();

  const stats = useMemo((): WritingStats => {
    if (!activeProject?.content) {
      return {
        words: 0,
        characters: 0,
        charactersNoSpaces: 0,
        paragraphs: 0,
        sentences: 0,
        readingTime: 0,
        avgWordsPerSentence: 0
      };
    }

    const content = activeProject.content;

    // Calculate words
    const words = content.split(/\s+/).filter(word => word.length > 0).length;

    // Calculate characters
    const characters = content.length;
    const charactersNoSpaces = content.replace(/\s/g, '').length;

    // Calculate paragraphs
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;

    // Calculate sentences (rough estimation)
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0).length;

    // Calculate reading time (assuming 200 words per minute)
    const readingTime = Math.ceil(words / 200);

    // Calculate average words per sentence
    const avgWordsPerSentence = sentences > 0 ? Math.round(words / sentences) : 0;

    return {
      words,
      characters,
      charactersNoSpaces,
      paragraphs,
      sentences,
      readingTime,
      avgWordsPerSentence
    };
  }, [activeProject?.content]);

  return stats;
};
