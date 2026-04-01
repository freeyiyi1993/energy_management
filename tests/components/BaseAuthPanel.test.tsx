import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock firebase/auth — must come before importing BaseAuthPanel
const mockOnAuthStateChanged = vi.fn();
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  signOut: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
}));

vi.mock('../../shared/firebase', () => ({
  auth: { currentUser: null },
  googleProvider: {},
  db: {},
}));

import BaseAuthPanel from '../../shared/components/BaseAuthPanel';

const defaultProps = {
  onSynced: vi.fn(),
  onGoogleLogin: vi.fn(async () => {}),
  onLogout: vi.fn(async () => {}),
  syncFn: vi.fn(async () => 'synced' as const),
  syncToCloudFn: vi.fn(async () => {}),
  resetAllDataFn: vi.fn(async () => {}),
};

describe('BaseAuthPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate no user logged in by default
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: null) => void) => {
      callback(null);
      return () => {};
    });
  });

  it('shows Google and email login buttons when not logged in', () => {
    render(<BaseAuthPanel {...defaultProps} />);
    expect(screen.getByText('Google')).toBeTruthy();
    expect(screen.getByText('邮箱')).toBeTruthy();
  });

  it('shows email form when email button clicked', () => {
    render(<BaseAuthPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('邮箱'));

    expect(screen.getByPlaceholderText('邮箱')).toBeTruthy();
    expect(screen.getByPlaceholderText('密码')).toBeTruthy();
    expect(screen.getByText('登录')).toBeTruthy();
  });

  it('shows sync and logout when logged in', () => {
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: { uid: string; email: string }) => void) => {
      callback({ uid: 'test-uid', email: 'test@example.com' });
      return () => {};
    });

    render(<BaseAuthPanel {...defaultProps} />);

    expect(screen.getByText('test@example.com')).toBeTruthy();
    expect(screen.getByText('同步')).toBeTruthy();
  });

  it('calls syncFn when sync button clicked', async () => {
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: { uid: string; email: string }) => void) => {
      callback({ uid: 'test-uid', email: 'test@example.com' });
      return () => {};
    });

    render(<BaseAuthPanel {...defaultProps} />);

    fireEvent.click(screen.getByText('同步'));

    await waitFor(() => {
      expect(defaultProps.syncFn).toHaveBeenCalledWith('test-uid');
    });
  });
});
