# Network Monitor

A network monitoring application for Raspberry Pi that provides real-time visibility into connected devices, network health, and traffic patterns.

## Project Structure

```
network-monitor/
├── server/                 # Backend Node.js application
│   ├── components/        # Core monitoring components
│   └── api/              # REST API and WebSocket handlers
├── client/                # Frontend React application
│   └── src/
│       └── components/   # React UI components
└── tests/                # Test suites
    ├── unit/            # Unit tests
    ├── property/        # Property-based tests
    └── integration/     # Integration tests
```

## Installation

### Backend
```bash
npm install
```

### Frontend
```bash
cd client
npm install
```

## Development

### Start Backend
```bash
npm run dev
```

### Start Frontend
```bash
cd client
npm run dev
```

## Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run property tests only
npm run test:property

# Run with coverage
npm run test:coverage
```

## Requirements

- Node.js 18 or newer
- Raspberry Pi 3 or newer (for deployment)
- Elevated privileges for network operations

## License

MIT
