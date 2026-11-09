import * as Crypto from 'expo-crypto';

/**
 * Order ID generation utility for LinkUp Send Orders in Mobile & Web.
 * Format: LSEND-XXXXXX-XXXX (e.g. LSEND-92A4B8-1934 or LSEND-123456-1234)
 */

export function generateSendOrderId(): string {
  // Uppercase alphanumeric characters excluding ambiguous letters (0, O, 1, I)
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

  const randomChunk = (length: number): string => {
    let result = '';
    try {
      const bytes = Crypto.getRandomBytes(length);
      for (let i = 0; i < length; i++) {
        result += alphabet[bytes[i] % alphabet.length];
      }
    } catch {
      for (let i = 0; i < length; i++) {
        result += alphabet[Math.floor(Math.random() * alphabet.length)];
      }
    }
    return result;
  };

  const mid = randomChunk(6);
  const tail = randomChunk(4);

  return `LSEND-${mid}-${tail}`;
}

export function isValidSendOrderId(id: string): boolean {
  return /^LSEND-[A-Z0-9]{6}-[A-Z0-9]{4}$/i.test(id.trim());
}
