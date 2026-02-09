# Network Monitor - Setup Instructions

## Prerequisites

This project requires Node.js 18 or newer to be installed.

### Installing Node.js

**macOS (using Homebrew):**
```bash
brew install node
```

**macOS (using official installer):**
Download from https://nodejs.org/

**Raspberry Pi (Debian/Raspbian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## Installation Steps

### 1. Install Backend Dependencies
```bash
npm install
```

### 2. Install Frontend Dependencies
```bash
cd client
npm install
cd ..
```

### 3. Verify Installation
```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Run tests (should show no tests found initially)
npm test
```

## Project Structure Verification

After setup, your project should have the following structure:

```
network-monitor/
├── server/                 # Backend Node.js application
│   ├── components/        # Core monitoring components (empty initially)
│   ├── api/              # REST API handlers (empty initially)
│   └── index.js          # Server entry point
├── client/                # Frontend React application
│   ├── src/
│   │   ├── components/   # React UI components (empty initially)
│   │   ├── index.css     # Tailwind CSS imports
│   │   ├── main.jsx      # React entry point
│   │   └── setupTests.js # Jest setup
│   ├── index.html        # HTML template
│   ├── package.json      # Frontend dependencies
│   ├── vite.config.js    # Vite configuration
│   ├── tailwind.config.js # Tailwind configuration
│   └── jest.config.js    # Jest configuration
├── tests/                # Test suites
│   ├── unit/            # Unit tests (empty initially)
│   ├── property/        # Property-based tests (empty initially)
│   ├── integration/     # Integration tests (empty initially)
│   └── frontend/        # Frontend tests (empty initially)
├── package.json          # Backend dependencies
├── jest.config.js        # Backend Jest configuration
├── jsconfig.json         # TypeScript/JSDoc configuration
└── README.md            # Project documentation
```

## Next Steps

Once Node.js is installed and dependencies are installed:

1. Start implementing backend components (Task 2+)
2. Run tests as you develop: `npm test`
3. Start development servers when ready:
   - Backend: `npm run dev`
   - Frontend: `cd client && npm run dev`

## Troubleshooting

### Permission Issues on Raspberry Pi

The application requires elevated privileges for network operations:

```bash
# Option 1: Run with sudo
sudo npm start

# Option 2: Set capabilities (recommended)
sudo setcap cap_net_raw+ep $(which node)
```

### Port Already in Use

If port 3000 is already in use, you can change it in `server/index.js` when implemented.
