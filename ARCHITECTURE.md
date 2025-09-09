# AI Writing Platform Architecture

## Overview

The AI Writing Platform is a full-stack application with a React frontend and Node.js backend. It uses PostgreSQL for data storage and integrates with AI services for intelligent writing assistance.

## High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   React Frontend│    │   Node.js Backend│    │    AI Services   │
│   (Client)      │◄──►│   (Server)        │◄──►│  (Gemini API)    │
└─────────────────┘    └──────────────────┘    └──────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │   PostgreSQL     │
                        │   (Database)     │
                        └──────────────────┘
```

## Component Details

### Frontend (React)

- **Framework**: React with TypeScript
- **State Management**: Built-in React state and Context API
- **Routing**: React Router
- **Editor**: Slate.js for rich text editing
- **Styling**: Tailwind CSS
- **Build Tool**: Create React App

### Backend (Node.js)

- **Framework**: Express.js with TypeScript
- **Authentication**: JWT-based authentication
- **API**: RESTful API design
- **Database**: PostgreSQL with Prisma ORM
- **Real-time**: WebSocket for collaborative editing
- **AI Integration**: Gemini API for writing suggestions

### Database (PostgreSQL)

- **Schema**: User accounts, projects, permissions, versions
- **ORM**: Prisma for type-safe database access
- **Migrations**: Prisma migrations for schema changes

### AI Services

- **Primary Provider**: Google Gemini API
- **Features**: 
  - Context-aware suggestions
  - Theme consistency checks
  - Foreshadowing analysis
  - Character development insights
  - Motivation and stakes evaluation

## Data Flow

1. **User Authentication**
   - User registers/logs in via frontend
   - Frontend sends credentials to backend
   - Backend validates and returns JWT token
   - Frontend stores token for subsequent requests

2. **Project Management**
   - User creates/edits projects in frontend
   - Frontend sends project data to backend API
   - Backend validates and stores in PostgreSQL
   - Backend returns success/failure response

3. **AI Assistance**
   - User requests AI suggestions in editor
   - Frontend sends context to backend
   - Backend processes and calls Gemini API
   - Backend returns AI-generated suggestions
   - Frontend displays suggestions to user

4. **Collaborative Editing**
   - Multiple users edit same project
   - Changes are sent via WebSocket to backend
   - Backend broadcasts changes to all connected users
   - All users see real-time updates

## Security

- **Authentication**: JWT tokens with expiration
- **Authorization**: Role-based access control
- **Data Encryption**: HTTPS in transit, bcrypt for passwords
- **Rate Limiting**: API request throttling
- **Input Validation**: Sanitization and validation of all inputs

## Scalability

- **Horizontal Scaling**: Stateless backend services
- **Database**: Connection pooling and indexing
- **Caching**: Redis for frequently accessed data
- **Load Balancing**: Reverse proxy for distributing requests
- **Microservices**: Potential future separation of services

## Deployment

- **Containerization**: Docker for consistent environments
- **Orchestration**: Docker Compose for multi-container apps
- **Cloud**: Deployable to AWS, GCP, or Azure
- **CI/CD**: GitHub Actions for automated testing and deployment