/**
 * AES-256-GCM encryption utilities for token protection.
 * Uses the Web Crypto API available in Cloudflare Workers.
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96-bit IV recommended for AES-GCM
const TAG_LENGTH = 128; // 128-bit auth tag

/**
 * Derive a CryptoKey from a string key using SHA-256.
 * The key is hashed to ensure it's exactly 32 bytes (256 bits).
 */
async function deriveKey(rawKey: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(rawKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);

  return crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns a base64-encoded string containing: IV (12 bytes) + ciphertext + auth tag.
 */
export async function encrypt(plaintext: string, encryptionKey: string): Promise<string> {
  const key = await deriveKey(encryptionKey);
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    data,
  );

  // Prepend IV to ciphertext
  const combined = new Uint8Array(IV_LENGTH + cipherBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuffer), IV_LENGTH);

  return uint8ArrayToBase64(combined);
}

/**
 * Decrypt an AES-256-GCM encrypted base64 string.
 * Expects the format: IV (12 bytes) + ciphertext + auth tag.
 */
export async function decrypt(encryptedBase64: string, encryptionKey: string): Promise<string> {
  const key = await deriveKey(encryptionKey);
  const combined = base64ToUint8Array(encryptedBase64);

  // Extract IV and ciphertext
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    ciphertext,
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/** Convert Uint8Array to base64 string */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Convert base64 string to Uint8Array */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
