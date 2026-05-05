import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64) as Buffer).toString('hex');
  return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(':');

  if (!salt || !hash) {
    return false;
  }

  const passwordBuffer = await scryptAsync(password, salt, 64) as Buffer;
  const hashBuffer = Buffer.from(hash, 'hex');

  if (passwordBuffer.length !== hashBuffer.length) {
    return false;
  }

  return timingSafeEqual(passwordBuffer, hashBuffer);
}
