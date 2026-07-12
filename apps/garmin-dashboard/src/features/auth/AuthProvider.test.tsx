import { render, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AuthProvider } from './AuthProvider';
import { useAuthStore } from '@/stores/auth-store';

// Create a module-level mock for the refreshToken function
const mockRefreshToken = vi.fn();

vi.mock('@/services/oauth-proxy', () => ({
  getOAuthProxyClient: () => ({
    getRequestToken: vi.fn(),
    exchangeAccessToken: vi.fn(),
    refreshToken: mockRefreshToken,
  }),
}));

describe('AuthProvider', () => {
  beforeEach(() => {
    useAuthStore.setState({ session: null, isLoading: false, error: null });
    mockRefreshToken.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children without error', () => {
    const { getByText } = render(
      <AuthProvider>
        <div>Child Content</div>
      </AuthProvider>,
    );
    expect(getByText('Child Content')).toBeInTheDocument();
  });

  it('does not call refresh when there is no session', async () => {
    vi.useFakeTimers();

    render(
      <AuthProvider>
        <div>No session</div>
      </AuthProvider>,
    );

    // Advance time significantly — no refresh should be triggered
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120000);
    });

    expect(mockRefreshToken).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('calls refresh when session is near expiry', async () => {
    vi.useFakeTimers();

    mockRefreshToken.mockResolvedValue({
      accessToken: 'new-access',
      tokenSecret: 'new-secret',
      refreshToken: 'new-refresh',
      expiresAt: Date.now() + 7200000,
      userId: 'user-1',
      displayName: 'Test User',
    });

    // Set a session that expires in 6 minutes (refresh buffer is 5 min)
    // So refresh should happen in ~1 minute (min 30 seconds)
    useAuthStore.setState({
      session: {
        userId: 'user-1',
        displayName: 'Test User',
        accessToken: 'access-token',
        tokenSecret: 'token-secret',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 6 * 60 * 1000,
      },
      isLoading: false,
      error: null,
    });

    render(
      <AuthProvider>
        <div>With session</div>
      </AuthProvider>,
    );

    // Advance past the scheduled refresh time (60 sec + margin)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(62000);
    });

    expect(mockRefreshToken).toHaveBeenCalledWith({
      encryptedRefreshToken: 'refresh-token',
    });

    vi.useRealTimers();
  });

  it('logs out when token refresh fails', async () => {
    vi.useFakeTimers();

    mockRefreshToken.mockRejectedValue(new Error('Refresh failed'));

    // Set a session that is within the refresh buffer (triggers at min interval)
    useAuthStore.setState({
      session: {
        userId: 'user-1',
        displayName: 'Test User',
        accessToken: 'access-token',
        tokenSecret: 'token-secret',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 2 * 60 * 1000, // 2 min, well within buffer
      },
      isLoading: false,
      error: null,
    });

    render(
      <AuthProvider>
        <div>Will logout</div>
      </AuthProvider>,
    );

    // Advance past min refresh interval (30 seconds)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31000);
    });

    expect(mockRefreshToken).toHaveBeenCalled();

    // After refresh fails, session should be cleared
    expect(useAuthStore.getState().session).toBeNull();

    vi.useRealTimers();
  });
});
