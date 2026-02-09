# Network Monitor - Project Structure

## Overview

This document describes the complete project structure created for the Network Monitor application.

## Directory Structure

```
network-monitor/
├── .kiro/                      # Kiro specifications
│   └── specs/
│       └── network-monitor/
│           ├── requirements.md
│           ├── design.md
│           └── tasks.md
│
├── server/                     # Backend Node.js application
│   ├── components/            # Core monitoring components
│   │   └── .gitkeep
│   ├── api/                   # REST API and WebSocket handlers
│   │   └── .gitkeep
│   └── index.js               # Server entry point (placeholder)
│
├── client/                     # Frontend React application
│   ├── src/
│   │   ├── components/        # React UI components
│   │   │   └── .gitkeep
│   │   ├── index.css          # Tailwind CSS imports
│   │   ├── main.jsx           # React entry point
│   │   └── setupTests.js      # Jest setup for React
│   ├── index.html             # HTML template
│   ├── package.json           # Frontend dependencies
│   ├── vite.config.js         # Vite build configuration
│   ├── tailwind.config.js     # Tailwind CSS configuration
│   ├── postcss.config.js      # PostCSS configuration
│   ├── jest.config.js         # Jest configuration for frontend
│   ├── jsconfig.json          # TypeScript/JSDoc for frontend
│   └── .babelrc               # Babel configuration for Jest
│
├── tests/                      # Test suites
│   ├── unit/                  # Unit tests for backend
│   ├── property/              # Property-based tests for backend
│   ├── integration/           # Integration tests
│   └── frontend/              # Frontend tests
│       ├── components/        # Component tests
│       └── property/          # Frontend property tests
│
├── package.json                # Backend dependencies and scripts
├── jest.config.js              # Jest configuration for backend
├── jsconfig.json               # TypeScript/JSDoc configuration for backend
├── .gitignore                  # Git ignore rules
├── README.md                   # Project documentation
├── SETUP.md                    # Setup instructions
└── PROJECT_STRUCTURE.md        # This file
```

## Configuration Files

### Backend Configuration

**package.json**
- Main dependencies: Express, ws, node-arp, ping, systeminformation, lowdb
- Dev dependencies: Jest, fast-check, TypeScript type definitions
- Scripts: start, dev, test, test:unit, test:property, test:integration, test:coverage

**jest.config.js**
- Test environment: Node.js
- Test patterns: tests/**/*.test.js, tests/**/*.property.test.js
- Coverage collection from server/**/*.js
- Timeout: 10 seconds

**jsconfig.json**
- Enables type checking with checkJs: true
- Target: ES2020
- Module: CommonJS
- Path alias: @/* → server/*

### Frontend Configuration

**client/package.json**
- Main dependencies: React 18, Recharts, Socket.IO Client, Axios
- Dev dependencies: Vite, Tailwind CSS, Jest, Testing Library, fast-check
- Scripts: dev, build, preview, test

**client/vite.config.js**
- React plugin enabled
- Dev server on port 5173
- Proxy /api → http://localhost:3000
- Proxy /ws → ws://localhost:3000

**client/tailwind.config.js**
- Content: index.html, src/**/*.{js,jsx}
- Default theme with no custom extensions

**client/jest.config.js**
- Test environment: jsdom (browser simulation)
- Setup file: src/setupTests.js
- Module name mapper for CSS and path aliases
- Babel transform for JSX

**client/jsconfig.json**
- JSX: react-jsx
- Module: ESNext
- Target: ES2020
- Path alias: @/* → src/*

## Key Features

### Backend
- Node.js with Express for REST API
- WebSocket support via ws library
- Network scanning with node-arp and ping
- System monitoring with systeminformation
- Data persistence with lowdb
- Property-based testing with fast-check

### Frontend
- React 18 with modern JSX transform
- Vite for fast development and building
- Tailwind CSS for styling
- Recharts for data visualization
- Socket.IO Client for real-time updates
- Axios for HTTP requests
- Jest and Testing Library for testing

### Testing
- Dual testing approach: unit tests + property-based tests
- Separate test directories for organization
- Coverage reporting configured
- Frontend and backend test isolation

## Next Steps

1. Install Node.js (see SETUP.md)
2. Install dependencies: `npm install` and `cd client && npm install`
3. Begin implementing Task 2: Device Scanner component
4. Run tests as development progresses: `npm test`

## Notes

- All component directories have .gitkeep files to preserve structure
- Configuration supports both development and production builds
- Type checking enabled via JSDoc comments (no TypeScript compilation needed)
- Property-based testing configured with fast-check library
- Frontend uses Vite for fast HMR during development
