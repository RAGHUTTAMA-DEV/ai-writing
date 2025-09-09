# AI Writing Platform Backend

A simplified backend for an AI-powered writing platform with RAG (Retrieval-Augmented Generation) capabilities.

## Features

- **User Authentication**: JWT-based authentication with role-based access control
- **Project Management**: Create, read, update, and delete writing projects
- **AI Integration**: Gemini API integration for intelligent writing suggestions
- **RAG System**: Retrieval-Augmented Generation for context-aware suggestions
- **Local JSON Storage**: Easy migration path to database/S3

## Tech Stack

- **Node.js** with TypeScript
- **Express.js** for REST API
- **PostgreSQL** with Prisma ORM
- **JWT** for authentication
- **Google Gemini API** for AI features

## Project Structure

```
src/
├── controllers/          # Request handlers
├── middleware/           # Authentication and validation middleware
├── prisma/               # Database schema and client
├── routes/               # API route definitions
├── services/             # Business logic (AI, RAG)
├── types/                # TypeScript type definitions
├── data/                 # Local JSON storage
├── .env                  # Environment variables
├── server.ts             # Main application entry point
└── tsconfig.json         # TypeScript configuration
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- Google Gemini API key

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Set up the database:
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

### Available Scripts

- `npm run dev` - Start development server with hot reloading
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio for database management

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login with email and password
- `POST /api/auth/logout` - Logout
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Projects
- `POST /api/projects` - Create a new project
- `GET /api/projects` - Get all projects for the user
- `GET /api/projects/:id` - Get a specific project
- `PUT /api/projects/:id` - Update a project
- `DELETE /api/projects/:id` - Delete a project

### AI Features
- `POST /api/ai/suggestions` - Generate writing suggestions
- `POST /api/ai/theme-consistency` - Analyze theme consistency
- `POST /api/ai/foreshadowing` - Check for foreshadowing opportunities
- `POST /api/ai/motivation-stakes` - Evaluate character motivation and stakes
- `GET /api/ai/stats` - Get RAG system statistics

## Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/ai_writing_platform?schema=public"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN=7d

# Security
BCRYPT_SALT_ROUNDS=12

# AI Configuration
GEMINI_API_KEY="your-gemini-api-key"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# CORS
CORS_ORIGIN="http://localhost:3000"
```

## Development

### Code Structure

- **Controllers**: Handle business logic for each feature
- **Middleware**: Authentication and validation functions
- **Routes**: API endpoint definitions
- **Services**: AI and RAG business logic
- **Prisma**: Database schema and client

### Testing

Run tests with:
```bash
npm test
```

## Deployment

### Production Build

```bash
npm run build
npm start
```

### Docker (Optional)

A Dockerfile is included for containerized deployment.

## License

This project is licensed under the MIT License.