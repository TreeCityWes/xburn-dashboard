# Contributing to XEN Burn Analytics Dashboard

Thank you for your interest in contributing to the XEN Burn Analytics Dashboard! This document provides guidelines and instructions for contributing to the project.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork to your local machine
3. Set up the development environment as described in the [README.md](README.md)

## Development Setup

1. Install dependencies:
```bash
cd backend
npm install
```

2. Create a `.env.development` file with your development settings

3. Run in development mode:
```bash
npm run dev
```

## Code Structure

- `src/indexer.ts` - Main indexer logic
- `src/analytics.ts` - Analytics aggregation
- `src/api.ts` - REST API endpoints
- `src/db.ts` - Database connection and queries
- `src/config.ts` - Configuration
- `src/contracts/` - Contract ABIs

## Branching Strategy

- `main` - Stable release branch
- `develop` - Development branch
- Feature branches should be named `feature/your-feature-name`
- Bug fixes should be named `fix/issue-description`

## Pull Request Process

1. Create a new branch from `develop`
2. Make your changes
3. Ensure code passes linting: `npm run lint`
4. Add tests for your changes if applicable
5. Update documentation as needed
6. Submit a pull request to the `develop` branch

## Code Style

- Follow the TypeScript style guide
- Use 2 spaces for indentation
- Use descriptive variable names
- Add comments for complex logic
- Follow existing patterns in the codebase

## Adding Features

When adding new features:

1. For blockchain events:
   - Add event signatures to `EVENT_SIGNATURES`
   - Create handler logic in the appropriate section
   - Update database schema if needed
   - Add analytics metrics if applicable

2. For API endpoints:
   - Add route in `api.ts`
   - Document endpoint in README
   - Add error handling

3. For analytics:
   - Add metric calculation in `analytics.ts`
   - Add SQL query for aggregation
   - Update analytics table schema if needed

## Testing

Please include tests for new functionality. We use the following testing approach:

1. Unit tests for core functions
2. Integration tests for database operations
3. End-to-end tests for API endpoints

Run tests with:
```bash
npm test
```

## Documentation

All new features should be documented:

1. Update README.md with user-facing changes
2. Add inline code comments for complex logic
3. Update API documentation for new endpoints
4. Update schema documentation for database changes

## Submitting Issues

When submitting issues, please:

1. Use a clear and descriptive title
2. Include steps to reproduce the issue
3. Provide environment details (OS, Node.js version, etc.)
4. Include logs or error messages
5. Suggest a fix if possible

## Community Guidelines

- Be respectful and inclusive
- Help others when you can
- Provide constructive feedback
- Follow the code of conduct

## License

By contributing to this project, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).

Thank you for your contributions! 