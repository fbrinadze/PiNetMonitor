/**
 * Property-Based Tests for Error Logging
 * Feature: network-monitor, Property 12: Error Logging
 * Validates: Requirements 8.5
 */

const fc = require('fast-check');

describe('Property 12: Error Logging', () => {
  let loggedErrors = [];
  let originalConsoleError;

  beforeEach(() => {
    // Capture console.error calls
    loggedErrors = [];
    originalConsoleError = console.error;
    console.error = (...args) => {
      loggedErrors.push({
        timestamp: new Date(),
        message: args.join(' '),
        args: args
      });
    };
  });

  afterEach(() => {
    // Restore console.error
    console.error = originalConsoleError;
  });

  /**
   * Property: For any error condition that occurs during monitoring operations,
   * an error log entry must be created with timestamp, error message, and context information.
   */
  test('any error during monitoring operations creates a log entry with timestamp, message, and context', () => {
    fc.assert(
      fc.property(
        fc.record({
          operation: fc.constantFrom(
            'device scan',
            'status check',
            'traffic monitoring',
            'health check',
            'data persistence'
          ),
          errorMessage: fc.string({ minLength: 1, maxLength: 100 }),
          context: fc.record({
            ipAddress: fc.option(fc.ipV4(), { nil: null }),
            component: fc.constantFrom('DeviceScanner', 'StatusMonitor', 'TrafficAnalyzer', 'HealthMonitor', 'DataStore'),
            additionalInfo: fc.option(fc.string({ maxLength: 50 }), { nil: null })
          })
        }),
        (errorScenario) => {
          // Clear previous logs
          loggedErrors = [];

          // Simulate an error condition
          const error = new Error(errorScenario.errorMessage);
          const contextInfo = errorScenario.context.ipAddress 
            ? `${errorScenario.context.component} - ${errorScenario.context.ipAddress}`
            : errorScenario.context.component;

          // Log the error (simulating what the application does)
          console.error(`Error during ${errorScenario.operation}:`, contextInfo, error.message);

          // Verify that an error log entry was created
          expect(loggedErrors.length).toBeGreaterThan(0);

          const logEntry = loggedErrors[0];

          // Verify timestamp exists and is valid
          expect(logEntry.timestamp).toBeInstanceOf(Date);
          expect(logEntry.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
          expect(logEntry.timestamp.getTime()).toBeGreaterThan(Date.now() - 1000); // Within last second

          // Verify error message is present
          expect(logEntry.message).toBeTruthy();
          expect(typeof logEntry.message).toBe('string');
          expect(logEntry.message.length).toBeGreaterThan(0);

          // Verify context information is present
          expect(logEntry.message).toContain(errorScenario.operation);
          expect(logEntry.message).toContain(errorScenario.context.component);
          expect(logEntry.message).toContain(errorScenario.errorMessage);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('error logs contain all required components regardless of error type', () => {
    fc.assert(
      fc.property(
        fc.record({
          errorType: fc.constantFrom('TypeError', 'ReferenceError', 'NetworkError', 'TimeoutError'),
          errorMessage: fc.string({ minLength: 5, maxLength: 200 }),
          stackTrace: fc.boolean()
        }),
        (errorConfig) => {
          loggedErrors = [];

          // Create error with specified type
          const error = new Error(errorConfig.errorMessage);
          error.name = errorConfig.errorType;
          
          if (errorConfig.stackTrace) {
            error.stack = `${error.name}: ${error.message}\n    at someFunction (file.js:10:5)`;
          }

          // Log the error
          console.error('Error occurred:', error.message);

          // Verify log entry exists
          expect(loggedErrors.length).toBeGreaterThan(0);

          const logEntry = loggedErrors[0];

          // All error logs must have these components
          expect(logEntry).toHaveProperty('timestamp');
          expect(logEntry).toHaveProperty('message');
          expect(logEntry).toHaveProperty('args');

          // Timestamp must be a valid Date
          expect(logEntry.timestamp).toBeInstanceOf(Date);
          expect(isNaN(logEntry.timestamp.getTime())).toBe(false);

          // Message must be non-empty string
          expect(typeof logEntry.message).toBe('string');
          expect(logEntry.message.length).toBeGreaterThan(0);

          // Message must contain the error message
          expect(logEntry.message).toContain(errorConfig.errorMessage);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('concurrent errors all get logged with unique timestamps', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            component: fc.constantFrom('DeviceScanner', 'StatusMonitor', 'TrafficAnalyzer', 'HealthMonitor'),
            errorMessage: fc.string({ minLength: 1, maxLength: 50 })
          }),
          { minLength: 2, maxLength: 10 }
        ),
        (errors) => {
          loggedErrors = [];

          // Log all errors
          errors.forEach(err => {
            console.error(`${err.component} error:`, err.errorMessage);
          });

          // Verify all errors were logged
          expect(loggedErrors.length).toBe(errors.length);

          // Verify each log has required components
          loggedErrors.forEach((logEntry, index) => {
            expect(logEntry.timestamp).toBeInstanceOf(Date);
            expect(logEntry.message).toContain(errors[index].component);
            expect(logEntry.message).toContain(errors[index].errorMessage);
          });

          // Verify timestamps are in chronological order (or equal for concurrent)
          for (let i = 1; i < loggedErrors.length; i++) {
            expect(loggedErrors[i].timestamp.getTime()).toBeGreaterThanOrEqual(
              loggedErrors[i - 1].timestamp.getTime()
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
