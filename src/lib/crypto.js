// --------------------------
// Convert string ↔ ArrayBuffer
// --------------------------
function str2ab(str) {
  return new TextEncoder().encode(str);
}

function ab2str(buf) {
  return new TextDecoder().decode(buf);
}

// --------------------------
// Convert ArrayBuffer ↔ Base64
// --------------------------
export function ab2base64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export function base642ab(base64) {
  const binary = atob(base64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

// --------------------------
// Generate AES-GCM key from passphrase
// --------------------------
export async function generateKey(passphrase) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("love-lock-salt"),
      iterations: 250000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// --------------------------
// Encrypt string → base64
// --------------------------
export async function encryptMessage(key, msg) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = str2ab(msg);
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  return `${ab2base64(iv)}:${ab2base64(ciphertext)}`;
}

// --------------------------
// Decrypt base64 → string
// --------------------------
export async function decryptMessage(key, data) {
  const [ivB64, ctB64] = data.split(":");
  const iv = base642ab(ivB64);
  const ct = base642ab(ctB64);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    key,
    ct
  );
  return ab2str(decrypted);
}

// --------------------------
// Generate shared key per partner pair
// --------------------------
export async function getSharedKey(userId1, userId2) {
  const passphrase = userId1 < userId2 ? userId1 + userId2 : userId2 + userId1;
  return generateKey(passphrase);
}
