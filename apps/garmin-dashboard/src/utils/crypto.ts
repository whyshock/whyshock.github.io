/**
 * Token encryption/decryption utilities using Web Crypto API (AES-256-GCM).
 *
 * Tokens are never stored in plaintext. Each encryption uses a random IV
 * prepended to the ciphertext before base64 encoding.
 *
 * Key derivation uses PBKDF2 with a user-specific salt derived from the userId
 * combined with a constant application identifier.
 */

const APP_SALT_CONSTANT = 'garmin-fitness-dashboard-v1';
const PBKDF2_ITERATIONS = 100_000;
const IV_LENGTH = 12; // 96 bits for AES-GCM
const KEY_LENGTH = 256; // AES-256

/**
 * Derives a CryptoKey from a userId using PBKDF2.
 * The salt is derived from the userId + a constant to ensure
 * different users produce different keys.
 */
export async function deriveKey(userId: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();

  // Create a deterministic salt from userId + constant
  const salt = encoder.encode(`${userId}:${APP_SALT_CONSTANT}`);

  // Import the userId as key material for PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userId),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  // Derive an AES-256-GCM key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: KEY_LENGTH,
    },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypts a plaintext string using AES-256-GCM with a key derived from userId.
 * Returns a base64-encoded string containing the IV prepended to the ciphertext.
 *
 * @param plaintext - The string to encrypt
 * @param userId - The user identifier used for key derivation
 * @returns Base64-encoded string (IV + ciphertext)
 */
export async function encryptToken(plaintext: string, userId: string): Promise<string> {
  const key = await deriveKey(userId);
  const encoder = new TextEncoder();

  // Generate a random IV for each encryption
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Encrypt the plaintext
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext),
  );

  // Combine IV + ciphertext into a single buffer
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), IV_LENGTH);

  // Encode to base64
  return uint8ArrayToBase64(combined);
}

/**
 * Decrypts a base64-encoded ciphertext (IV + ciphertext) using AES-256-GCM
 * with a key derived from userId.
 *
 * @param ciphertext - Base64-encoded string (IV + ciphertext)
 * @param userId - The user identifier used for key derivation
 * @returns The original plaintext string
 * @throws Error if decryption fails (invalid ciphertext, wrong key, tampered data)
 */
export async function decryptToken(ciphertext: string, userId: string): Promise<string> {
  const key = await deriveKey(userId);

  // Decode the base64 input
  let combined: Uint8Array;
  try {
    combined = base64ToUint8Array(ciphertext);
  } catch {
    throw new Error('Invalid ciphertext: malformed base64 encoding');
  }

  // Validate minimum length (IV + at least some ciphertext with auth tag)
  if (combined.length <= IV_LENGTH) {
    throw new Error('Invalid ciphertext: data too short');
  }

  // Extract IV and encrypted data
  const iv = combined.slice(0, IV_LENGTH);
  const encryptedData = combined.slice(IV_LENGTH);

  // Decrypt
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData,
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error('Decryption failed: ciphertext may be tampered or key mismatch');
  }
}

/**
 * Converts a Uint8Array to a base64-encoded string.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * Converts a base64-encoded string to a Uint8Array.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
