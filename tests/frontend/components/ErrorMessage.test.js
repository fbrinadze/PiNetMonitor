/**
 * Unit tests for ErrorMessage component
 */

const React = require('react');
const { render, screen, fireEvent } = require('@testing-library/react');
const ErrorMessage = require('../../../client/src/components/ErrorMessage').default;

describe('ErrorMessage Component', () => {
  test('renders error message with error type', () => {
    render(
      React.createElement(ErrorMessage, {
        message: 'Test error message',
        type: 'error'
      })
    );
    
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  test('renders warning message with warning type', () => {
    render(
      React.createElement(ErrorMessage, {
        message: 'Test warning message',
        type: 'warning'
      })
    );
    
    expect(screen.getByText('Test warning message')).toBeInTheDocument();
  });

  test('renders info message with info type', () => {
    render(
      React.createElement(ErrorMessage, {
        message: 'Test info message',
        type: 'info'
      })
    );
    
    expect(screen.getByText('Test info message')).toBeInTheDocument();
  });

  test('does not render when message is null', () => {
    const { container } = render(
      React.createElement(ErrorMessage, {
        message: null,
        type: 'error'
      })
    );
    
    expect(container.firstChild).toBeNull();
  });

  test('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = jest.fn();
    
    render(
      React.createElement(ErrorMessage, {
        message: 'Test message',
        type: 'error',
        onDismiss
      })
    );
    
    const dismissButton = screen.getByLabelText('Dismiss');
    fireEvent.click(dismissButton);
    
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('does not render dismiss button when onDismiss is not provided', () => {
    render(
      React.createElement(ErrorMessage, {
        message: 'Test message',
        type: 'error'
      })
    );
    
    expect(screen.queryByLabelText('Dismiss')).not.toBeInTheDocument();
  });

  test('defaults to error type when type is not specified', () => {
    const { container } = render(
      React.createElement(ErrorMessage, {
        message: 'Test message'
      })
    );
    
    // Check for error styling (red colors)
    expect(container.querySelector('.bg-red-50')).toBeInTheDocument();
    expect(container.querySelector('.border-red-400')).toBeInTheDocument();
  });
});
