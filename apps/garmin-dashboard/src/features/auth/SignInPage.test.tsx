import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SignInPage from './SignInPage';
import { useAuthStore } from '@/stores/auth-store';

// Mock the oauth-proxy module
const mockGetRequestToken = vi.fn();
vi.mock('@/services/oauth-proxy', () => ({
  getOAuthProxyClient: () => ({
    getRequestToken: mockGetRequestToken,
    exchangeAccessToken: vi.fn(),
    refreshToken: vi.fn(),
  }),
}));

// Mock window.location.href assignment
const originalLocation = window.location;

beforeEach(() => {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...originalLocation, href: '' },
  });
});

describe('SignInPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ session: null, isLoading: false, error: null });
    mockGetRequestToken.mockReset();
  });

  it('renders the sign-in page with Garmin connect button', () => {
    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Garmin Fitness Dashboard')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign in with garmin connect/i }),
    ).toBeInTheDocument();
  });

  it('initiates OAuth flow on button click and redirects', async () => {
    mockGetRequestToken.mockResolvedValue({
      redirectUrl: 'https://connect.garmin.com/oauth/authorize?token=abc',
      requestToken: 'req-token-123',
    });

    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: /sign in with garmin connect/i });
    fireEvent.click(button);

    // Should show loading state
    expect(await screen.findByText('Connecting to Garmin...')).toBeInTheDocument();

    await waitFor(() => {
      expect(window.location.href).toBe(
        'https://connect.garmin.com/oauth/authorize?token=abc',
      );
    });
  });

  it('shows error message when OAuth request fails', async () => {
    mockGetRequestToken.mockRejectedValue(new Error('Network timeout'));

    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: /sign in with garmin connect/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Authentication failed')).toBeInTheDocument();
      expect(screen.getByText('Network timeout')).toBeInTheDocument();
    });
  });

  it('shows retry button when error occurs', async () => {
    mockGetRequestToken.mockRejectedValue(new Error('Connection failed'));

    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /sign in with garmin connect/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry sign in/i })).toBeInTheDocument();
    });
  });

  it('redirects authenticated users away from sign-in', () => {
    useAuthStore.setState({
      session: {
        userId: 'user-1',
        displayName: 'Test User',
        accessToken: 'access',
        tokenSecret: 'secret',
        refreshToken: 'refresh',
        expiresAt: Date.now() + 3600000,
      },
      isLoading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/sign-in']}>
        <SignInPage />
      </MemoryRouter>,
    );

    // Sign in page content should not be visible
    expect(screen.queryByText('Garmin Fitness Dashboard')).not.toBeInTheDocument();
  });
});
