import { describe, it, expect } from 'vitest';
import {
  percentEncode,
  buildSignatureBaseString,
  hmacSha1Sign,
  buildSigningKey,
  buildAuthorizationHeader,
  generateNonce,
  getTimestamp,
} from '../src/oauth';

describe('OAuth 1.0a Utilities', () => {
  describe('percentEncode', () => {
    it('encodes special characters per RFC 3986', () => {
      expect(percentEncode('Ladies + Gentlemen')).toBe('Ladies%20%2B%20Gentlemen');
      expect(percentEncode('An encoded string!')).toBe('An%20encoded%20string%21');
      expect(percentEncode('Dogs, Cats & Mice')).toBe('Dogs%2C%20Cats%20%26%20Mice');
    });

    it('does not encode unreserved characters', () => {
      expect(percentEncode('abcABC123')).toBe('abcABC123');
      expect(percentEncode('-._~')).toBe('-._~');
    });

    it('encodes forward slash', () => {
      expect(percentEncode('https://example.com/path')).toBe('https%3A%2F%2Fexample.com%2Fpath');
    });
  });

  describe('buildSignatureBaseString', () => {
    it('concatenates method, URL, and sorted params', () => {
      const params = {
        oauth_consumer_key: 'dpf43f3p2l4k3l03',
        oauth_nonce: 'kllo9940pd9333jh',
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: '1191242096',
        oauth_version: '1.0',
      };

      const baseString = buildSignatureBaseString(
        'POST',
        'https://api.example.com/request_token',
        params,
      );

      // Should be: METHOD&encoded_URL&encoded_params
      expect(baseString).toContain('POST&');
      expect(baseString).toContain('https%3A%2F%2Fapi.example.com%2Frequest_token');
      // Parameters should be sorted
      expect(baseString).toContain('oauth_consumer_key');
    });

    it('sorts parameters alphabetically by key', () => {
      const params = {
        z_param: 'last',
        a_param: 'first',
        m_param: 'middle',
      };

      const baseString = buildSignatureBaseString('GET', 'https://example.com', params);
      const decodedParams = decodeURIComponent(baseString.split('&')[2]);

      const paramKeys = decodedParams.split('&').map((p) => p.split('=')[0]);
      expect(paramKeys).toEqual(['a_param', 'm_param', 'z_param']);
    });
  });

  describe('hmacSha1Sign', () => {
    it('produces a non-empty base64 signature', async () => {
      const signature = await hmacSha1Sign('key&', 'base string');
      expect(signature).toBeTruthy();
      expect(signature.length).toBeGreaterThan(0);
    });

    it('produces consistent results for same inputs', async () => {
      const sig1 = await hmacSha1Sign('secret&', 'test message');
      const sig2 = await hmacSha1Sign('secret&', 'test message');
      expect(sig1).toBe(sig2);
    });

    it('produces different results for different inputs', async () => {
      const sig1 = await hmacSha1Sign('secret&', 'message1');
      const sig2 = await hmacSha1Sign('secret&', 'message2');
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('buildSigningKey', () => {
    it('builds key with consumer secret only (for request token)', () => {
      const key = buildSigningKey('consumer_secret');
      expect(key).toBe('consumer_secret&');
    });

    it('builds key with consumer secret and token secret', () => {
      const key = buildSigningKey('consumer_secret', 'token_secret');
      expect(key).toBe('consumer_secret&token_secret');
    });

    it('percent-encodes special characters in secrets', () => {
      const key = buildSigningKey('secret&with&amps', 'token=special');
      expect(key).toBe('secret%26with%26amps&token%3Dspecial');
    });
  });

  describe('buildAuthorizationHeader', () => {
    it('produces properly formatted OAuth header', () => {
      const params = {
        oauth_consumer_key: 'key123',
        oauth_nonce: 'nonce456',
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: '1234567890',
        oauth_version: '1.0',
      };

      const header = buildAuthorizationHeader(params, 'sig789');
      expect(header.startsWith('OAuth ')).toBe(true);
      expect(header).toContain('oauth_consumer_key="key123"');
      expect(header).toContain('oauth_signature="sig789"');
      expect(header).toContain('oauth_nonce="nonce456"');
    });

    it('includes all params sorted alphabetically', () => {
      const params = {
        oauth_version: '1.0',
        oauth_consumer_key: 'key',
      };

      const header = buildAuthorizationHeader(params, 'sig');
      // oauth_consumer_key should come before oauth_signature which should come before oauth_version
      const consumerKeyPos = header.indexOf('oauth_consumer_key');
      const signaturePos = header.indexOf('oauth_signature');
      const versionPos = header.indexOf('oauth_version');
      expect(consumerKeyPos).toBeLessThan(signaturePos);
      expect(signaturePos).toBeLessThan(versionPos);
    });
  });

  describe('generateNonce', () => {
    it('returns a 32-character hex string', () => {
      const nonce = generateNonce();
      expect(nonce).toMatch(/^[0-9a-f]{32}$/);
    });

    it('generates unique values on each call', () => {
      const nonces = new Set(Array.from({ length: 10 }, () => generateNonce()));
      expect(nonces.size).toBe(10);
    });
  });

  describe('getTimestamp', () => {
    it('returns a numeric string', () => {
      const timestamp = getTimestamp();
      expect(timestamp).toMatch(/^\d+$/);
    });

    it('returns a reasonable Unix timestamp', () => {
      const timestamp = parseInt(getTimestamp(), 10);
      const now = Math.floor(Date.now() / 1000);
      expect(timestamp).toBeGreaterThanOrEqual(now - 2);
      expect(timestamp).toBeLessThanOrEqual(now + 2);
    });
  });
});
