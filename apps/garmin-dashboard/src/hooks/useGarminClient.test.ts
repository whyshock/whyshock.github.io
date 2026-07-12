/**
 * Unit tests for useGarminClient hook.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGarminClient } from './useGarminClient';
import { useAuthStore } from '@/stores/auth-store';
import type { AuthSession } from '@/types/garmin';

const mockSession: AuthSession = {
  userId: 'test-user-123',
  displayName: 'Test User',
  accessToken: 'encrypted-access-token',
  tokenSecret: 'encrypted-token-secret',
  refreshToken: 'encrypted-refresh-token',
  expiresAt: Date.now() + 3600000, // 1 hour from now
};

describe('useGarminClient', () => {
  beforeEach(() => {
    // Reset auth store to logged-out state
    useAuthStore.setState({ session: null, isLoading: false, error: null });
  });

  it('returns null client and isAuthenticated=false when not logged in', () => {
    const { result } = renderHook(() => useGarminClient());

    expect(result.current.client).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('returns a client and isAuthenticated=true when session exists', () => {
    useAuthStore.setState({ session: mockSession });

    const { result } = renderHook(() => useGarminClient());

    expect(result.current.client).not.toBeNull();
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('returns a client with expected API methods', () => {
    useAuthStore.setState({ session: mockSession });

    const { result } = renderHook(() => useGarminClient());
    const client = result.current.client;

    expect(client).not.toBeNull();
    expect(typeof client!.getActivities).toBe('function');
    expect(typeof client!.getActivityDetail).toBe('function');
    expect(typeof client!.getDailySummary).toBe('function');
    expect(typeof client!.getPersonalRecords).toBe('function');
    expect(typeof client!.getTrainingStatus).toBe('function');
    expect(typeof client!.getUserProfile).toBe('function');
  });

  it('returns null client after logout', () => {
    useAuthStore.setState({ session: mockSession });

    const { result, rerender } = renderHook(() => useGarminClient());

    expect(result.current.client).not.toBeNull();

    // Simulate logout
    useAuthStore.setState({ session: null });
    rerender();

    expect(result.current.client).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('memoizes client when session reference is stable', () => {
    useAuthStore.setState({ session: mockSession });

    const { result, rerender } = renderHook(() => useGarminClient());
    const firstClient = result.current.client;

    rerender();
    const secondClient = result.current.client;

    expect(firstClient).toBe(secondClient);
  });
});
