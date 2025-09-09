# AI Features Documentation

This document explains the AI-powered features of the writing platform and how to use them.

## Overview

The AI writing platform leverages Google's Gemini API through Langchain to provide intelligent writing assistance. The system uses a Retrieval-Augmented Generation (RAG) approach to provide context-aware suggestions.

## Features

### 1. Writing Suggestions

Generate context-aware suggestions for your writing based on your project's content and previous work.

**Endpoint**: `POST /api/ai/suggestions`

**Request Body**:
```json
{
  "projectId": "project-123",
  "context": "The protagonist discovers a mysterious portal in her grandmother's attic."
}
```

**Response**:
```json
{
  "message": "Suggestions generated successfully",
  "suggestions": "Consider exploring the history of the portal and how it connects to the grandmother's past..."
}
```

### 2. Theme Consistency Analysis

Analyze your text for consistency with a specific theme.

**Endpoint**: `POST /api/ai/theme-consistency`

**Request Body**:
```json
{
  "text": "The dark forest represented the unknown future that lay ahead.",
  "theme": "journey"
}
```

### 3. Foreshadowing Analysis

Identify opportunities for foreshadowing in your text.

**Endpoint**: `POST /api/ai/foreshadowing`

**Request Body**:
```json
{
  "text": "The old clock tower had been silent for decades.",
  "context": "The protagonist is exploring a mysterious town."
}
```

### 4. Character Motivation Evaluation

Evaluate character motivations and stakes.

**Endpoint**: `POST /api/ai/motivation-stakes`

**Request Body**:
```json
{
  "text": "Sarah decided to confront the villain despite knowing the risks.",
  "character": "Sarah"
}
```

### 5. RAG System

The Retrieval-Augmented Generation system stores and retrieves relevant information from your writing projects.

**Add Document**: `POST /api/ai/rag/add`
**Search**: `POST /api/ai/rag/search`

## Setup

1. Obtain a Google Gemini API key
2. Add the key to your `.env` file:
   ```
   GEMINI_API_KEY=your-api-key-here
   ```

## Usage Examples

### Adding Content to RAG System

```javascript
// Add a document to the RAG system
const response = await fetch('/api/ai/rag/add', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-token'
  },
  body: JSON.stringify({
    content: 'Your document content here...',
    metadata: {
      projectId: 'project-123',
      documentType: 'chapter',
      chapterNumber: 1
    }
  })
});
```

### Generating Writing Suggestions

```javascript
// Generate suggestions based on context
const response = await fetch('/api/ai/suggestions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-token'
  },
  body: JSON.stringify({
    projectId: 'project-123',
    context: 'The protagonist discovers a mysterious portal...'
  })
});
```

## Technical Implementation

The AI features are implemented using:

1. **Langchain**: For managing the AI workflow and RAG system
2. **Google Generative AI**: For the underlying language model (Gemini)
3. **MemoryVectorStore**: For storing and retrieving document embeddings

### RAG Pipeline

1. Documents are split into chunks using `RecursiveCharacterTextSplitter`
2. Chunks are embedded using OpenAI embeddings
3. Embedded chunks are stored in a `MemoryVectorStore`
4. When generating suggestions, relevant chunks are retrieved using similarity search
5. The retrieved context is used to generate contextualized responses

## Future Enhancements

1. Integration with persistent vector databases (Pinecone, Weaviate)
2. Support for additional language models
3. Advanced analytics on writing patterns
4. Personalized writing style adaptation