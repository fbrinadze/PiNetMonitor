/**
 * Unit tests for ConnectionStatus component
 */

const React = require('react');
const { render, screen } = require('@testing-library/react');
const ConnectionStatus = require('../../../client/src/components/ConnectionStatus').default;

describe('ConnectionStatus Component', () => {
  test('renders connected status when isConnected is true', () => {
    render(
      React.createElement(ConnectionStatus, {
        isConnected: true,
        isPolling: false
      })
    );
    
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  test('renders disconnected status when isConnected is false', () => {
    render(
      React.createElement(ConnectionStatus, {
        isConnected: false,
        isPolling: false
      })
    );
    
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  test('renders polling status when isPolling is true', () => {
    render(
      React.createElement(ConnectionStatus, {
        isConnected: false,
        isPolling: true
      })
    );
    
    expect(screen.getByText('Polling')).toBeInTheDocument();
  });

  test('displays green indicator when connected', () => {
    const { container } = render(
      React.createElement(ConnectionStatus, {
        isConnected: true,
        isPolling: false
      })
    );
    
    expect(container.querySelector('.bg-green-500')).toBeInTheDocument();
  });

  test('displays red indicator when disconnected', () => {
    const { container } = render(
      React.createElement(ConnectionStatus, {
        isConnected: false,
        isPolling: false
      })
    );
    
    expect(container.querySelector('.bg-red-500')).toBeInTheDocument();
  });

  test('displays yellow indicator when polling', () => {
    const { container } = render(
      React.createElement(ConnectionStatus, {
        isConnected: false,
        isPolling: true
      })
    );
    
    expect(container.querySelector('.bg-yellow-500')).toBeInTheDocument();
  });

  test('does not display error tooltip when no error', () => {
    const { container } = render(
      React.createElement(ConnectionStatus, {
        isConnected: true,
        isPolling: false,
        error: null
      })
    );
    
    // Check that error tooltip icon is not present
    const tooltipIcons = container.querySelectorAll('svg');
    // Should have status icon but not error tooltip icon
    expect(tooltipIcons.length).toBeLessThan(3);
  });

  test('displays error tooltip when error is provided', () => {
    render(
      React.createElement(ConnectionStatus, {
        isConnected: false,
        isPolling: false,
        error: 'Connection failed'
      })
    );
    
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  test('prioritizes connected status over polling', () => {
    render(
      React.createElement(ConnectionStatus, {
        isConnected: true,
        isPolling: true
      })
    );
    
    // Should show connected, not polling
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.queryByText('Polling')).not.toBeInTheDocument();
  });
});
