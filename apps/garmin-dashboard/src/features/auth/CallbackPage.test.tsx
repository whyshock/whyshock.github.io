import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CallbackPage from './CallbackPage';
import { useAuthStore } from '@/stores/auth-store';

// Mock the oauth-proxy module
const mockExchangeAccessToken = vi.fn();
vi.mock('@/services/oauth-proxy', () => ({
  getOAuthProxyClient: () => ({
    getRequestToken: vi.fn(),
    exchangeAccessToken: mockExchangeAccessToken,
    refreshToken: vi.fn(),
  }),
}));

function renderCallback(searchParams: string) {
  return render(
    <MemoryRouter initialEntries={[`/callback${searchParams}`]}>
      <Routes>
        <Route path="/callback" element={<CallbackPage />} />
        <Route path="/sign-in" element={<div>Sign In Page</div>} />
        <Route path="/" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CallbackPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ session: null, isLoading: false, error: null });
    mockExchangeAccessToken.mockReset();
  });

  it('shows loading state during token exchange', () => {
    // Never resolve so we stay in exchanging state
    mockExchangeAccessToken.mockReturnValue(new Promise(() => {}));

    renderCallback('?oauth_token=token123&oauth_verifier=verifier456');

    expect(screen.getByRole('status', { name: /exchanging tokens/i })).toBeInTheDocument();
    expect(screen.getByText('Connecting to Garmin Connect...')).toBeInTheDocument();
  });

  it('exchanges tokens and displays user profile name on success', async () => {
    mockExchangeAccessToken.mockResolvedValue({
      accessToken: 'enc-access',
      tokenSecret: 'enc-secret',
      refreshToken: 'enc-refresh',
      expiresAt: Date.now() + 3600000,
      userId: 'garmin-user-42',
      displayName: 'John Runner',
    });

    renderCallback('?oauth_token=token123&oauth_verifier=verifier456');

    await waitFor(() => {
      expect(screen.getByText(/welcome, john runner/i)).toBeInTheDocument();
    });

    // Verify the session was stored
    const state = useAuthStore.getState();
    expect(state.session).not.toBeNull();
    expect(state.session?.displayName).toBe('John Runner');
    expect(state.session?.userId).toBe('garmin-user-42');
  });

  it('shows error when token exchange fails', async () => {
    mockExchangeAccessToken.mockRejectedValue(new Error('Token exchange timeout'));

    renderCallback('?oauth_token=token123&oauth_verifier=verifier456');

    await waitFor(() => {
      expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      expect(screen.getByText('Token exchange timeout')).toBeInTheDocument();
    });
  });

  it('shows retry button on error', async () => {
    mockExchangeAccessToken.mockRejectedValue(new Error('Server error'));

    renderCallback('?oauth_token=token123&oauth_verifier=verifier456');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry sign in/i })).toBeInTheDocument();
    });
  });

  it('shows error when OAuth parameters are missing', async () => {
    renderCallback('');

    await waitFor(() => {
      expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      expect(
        screen.getByText(/missing oauth parameters/i),
      ).toBeInTheDocument();
    });
  });

  it('calls exchangeAccessToken with correct params', async () => {
    mockExchangeAccessToken.mockResolvedValue({
      accessToken: 'enc-access',
      tokenSecret: 'enc-secret',
      refreshToken: 'enc-refresh',
      expiresAt: Date.now() + 3600000,
      userId: 'user-1',
      displayName: 'User One',
    });

    renderCallback('?oauth_token=my-request-token&oauth_verifier=my-verifier');

    await waitFor(() => {
      expect(mockExchangeAccessToken).toHaveBeenCalledWith({
        requestToken: 'my-request-token',
        oauthVerifier: 'my-verifier',
      });
    });
  });
});
