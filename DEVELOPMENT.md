# AI Writing Platform Development Guide

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- Docker (optional, for containerized development)
- Git

### Initial Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd ai-writing-platform
   ```

2. Run the setup script:
   ```bash
   # On Unix/Linux/macOS
   ./setup.sh
   
   # On Windows
   setup.bat
   ```

3. Update the `.env` file with your configuration:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

### Database Setup

1. Start the database:
   ```bash
   docker-compose up -d db
   ```

2. Run database migrations:
   ```bash
   npm run prisma:migrate
   ```

### Running the Application

#### Backend Development

Start the backend in development mode:
```bash
npm run dev
```

This will start the server with hot reloading on port 5000.

#### Frontend Development

Start the frontend development server:
```bash
cd client
npm start
```

This will start the React development server on port 3000.

### Development Workflow

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Run tests:
   ```bash
   npm test
   ```

4. Commit your changes:
   ```bash
   git add .
   git commit -m "Add feature: your feature description"
   ```

5. Push to your branch:
   ```bash
   git push origin feature/your-feature-name
   ```

6. Create a pull request

## Project Structure

```
ai-writing-platform/
├── client/              # React frontend
├── controllers/          # Request handlers
├── middleware/           # Authentication and validation middleware
├── prisma/               # Database schema and client
├── routes/               # API route definitions
├── types/                # TypeScript type definitions
├── .env                  # Environment variables
├── .env.example          # Environment variables template
├── package.json          # Project dependencies and scripts
├── server.ts             # Main application entry point
└── tsconfig.json         # TypeScript configuration
```

## API Documentation

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

## Coding Standards

### Backend

1. Use TypeScript for all backend code
2. Follow REST API conventions
3. Use proper error handling with try/catch blocks
4. Use environment variables for configuration
5. Write unit tests for all new functionality

### Frontend

1. Use TypeScript for all frontend code
2. Follow React best practices
3. Use functional components with hooks
4. Use Tailwind CSS for styling
5. Write component tests for new components

## Testing

### Backend Testing

Run backend tests:
```bash
npm test
```

### Frontend Testing

Run frontend tests:
```bash
cd client
npm test
```

## Deployment

### Production Build

Build the application for production:
```bash
npm run build
```

### Docker Deployment

Build and run with Docker:
```bash
docker-compose up -d
```

## Troubleshooting

### Common Issues

1. **Port already in use**: Change the PORT in .env
2. **Database connection failed**: Check DATABASE_URL in .env
3. **Module not found**: Run npm install to install missing dependencies

### Getting Help

If you encounter issues:
1. Check the logs for error messages
2. Verify your environment variables
3. Ensure all dependencies are installed
4. Check the issue tracker for similar problems