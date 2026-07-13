/**
 * Cryptographic helpers for Sistem e-Tempahan PLTT-JTM
 * Implements password hashing (PBKDF2 via Web Crypto), random tokens, and
 * a simple AES-GCM encrypt/decrypt using the Web Crypto API.
 * PDPA-aligned: never store plaintext passwords; sensitive tokens are hashed.
 */
import { promisify } from 'util';
import { scrypt as _scrypt, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const scrypt = promisify(_scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'pltt-jtm-etempahan-dev-key-32bytes!!'; // must be 32 bytes for AES-256
const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32), 'utf8');

/**
 * Hash a password using scrypt + per-user salt.
 * Returns "salt:hash" (both hex).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}

/**
 * Verify a password against a stored "salt:hash" string.
 * Uses constant-time comparison to mitigate timing attacks.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const derived = await scrypt(password, salt, 64);
    const derivedHex = derived.toString('hex');
    if (derivedHex.length !== hash.length) return false;
    let diff = 0;
    for (let i = 0; i < derivedHex.length; i++) {
      diff |= derivedHex.charCodeAt(i) ^ hash.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

/**
 * AES-256-GCM encrypt a string. Returns "iv:ciphertext:tag" all hex.
 * Used for sensitive fields at rest (PDPA best practice).
 */
export function encryptString(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY_BUFFER, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${enc.toString('hex')}:${tag.toString('hex')}`;
}

export function decryptString(payload: string): string {
  const [ivHex, encHex, tagHex] = payload.split(':');
  if (!ivHex || !encHex || !tagHex) throw new Error('Invalid ciphertext payload');
  const decipher = createDecipheriv('aes-256-gcm', KEY_BUFFER, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
}

/**
 * Generate a secure random hex token (e.g. for sessions / CSRF).
 */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Generate a human-readable booking reference: TEMP-YYYY-NNNN
 */
export function generateBookingRef(sequence: number): string {
  const year = new Date().getFullYear();
  return `TEMP-${year}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Simple rate-limit key derived from IP + endpoint family.
 */
export function rateLimitKey(ip: string, endpoint: string): string {
  return `${ip}:${endpoint}`;
}
