import CryptoJS from "crypto-js";
import forge from "node-forge";

const SECRET_KEY = process.env.ENCRYPTION_KEY!;

const decodedPrivateKey = forge.util.decode64(SECRET_KEY);
const privateKey = forge.pki.privateKeyFromPem(decodedPrivateKey);

export const decryptData = (encryptedData: string) => {
  const decodedData = forge.util.decode64(encryptedData); // Base64 decode the encrypted data
  const decrypted = privateKey.decrypt(decodedData, "RSA-OAEP"); // Decrypt with private key
  return JSON.parse(decrypted); // Parse and return the original data
};

