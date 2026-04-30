import { randomBytes } from "crypto";

/**
 * Generates a secure random password
 * @returns A random password string (16 characters) with mixed case, numbers, and special characters
 */
export function generateRandomPassword(): string {
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const special = "!@#$%&*";
  const allChars = lowercase + uppercase + numbers + special;

  // Generate random bytes
  const randomBytesBuffer = randomBytes(16);
  const passwordLength = 16;
  let password = "";

  // Ensure at least one character from each category
  password += lowercase[randomBytesBuffer[0] % lowercase.length];
  password += uppercase[randomBytesBuffer[1] % uppercase.length];
  password += numbers[randomBytesBuffer[2] % numbers.length];
  password += special[randomBytesBuffer[3] % special.length];

  // Fill the rest with random characters
  for (let i = password.length; i < passwordLength; i++) {
    const randomIndex =
      randomBytesBuffer[i % randomBytesBuffer.length] % allChars.length;
    password += allChars[randomIndex];
  }

  // Shuffle the password to avoid predictable pattern
  const passwordArray = password.split("");
  for (let i = passwordArray.length - 1; i > 0; i--) {
    const j = randomBytesBuffer[i % randomBytesBuffer.length] % (i + 1);
    [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
  }

  return passwordArray.join("");
}
