const crypto = require("crypto");
const fs = require("fs");

const MAGIC = Buffer.from("SACK");
const VERSION = 1;
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

function deriveKey(password, salt) {
  return crypto.scryptSync(password, salt, KEY_LEN, {
    N: 16384,
    r: 8,
    p: 1
  });
}

function buildHeader(salt, iv) {
  return Buffer.concat([
    MAGIC,
    Buffer.from([VERSION, salt.length, iv.length, TAG_LEN]),
    salt,
    iv
  ]);
}

function parseHeader(buffer) {
  if (buffer.length < 8) {
    throw new Error("Invalid sack file: too short");
  }

  if (!buffer.slice(0, 4).equals(MAGIC)) {
    throw new Error("Invalid sack file: bad magic");
  }

  const version = buffer[4];
  if (version !== VERSION) {
    throw new Error("Unsupported sack file version: " + version);
  }

  const saltLen = buffer[5];
  const ivLen = buffer[6];
  const tagLen = buffer[7];
  const headerLen = 8 + saltLen + ivLen;

  if (buffer.length < headerLen + tagLen) {
    throw new Error("Invalid sack file: truncated");
  }

  return {
    headerLen,
    salt: buffer.slice(8, 8 + saltLen),
    iv: buffer.slice(8 + saltLen, headerLen),
    tagLen
  };
}

function encryptString(plaintext, password) {
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = deriveKey(password, salt);
  const header = buildHeader(salt, iv);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(header);

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([header, ciphertext, tag]);
}

function decryptBuffer(buffer, password) {
  const parsed = parseHeader(buffer);
  const header = buffer.slice(0, parsed.headerLen);
  const ciphertext = buffer.slice(parsed.headerLen, buffer.length - parsed.tagLen);
  const tag = buffer.slice(buffer.length - parsed.tagLen);

  const key = deriveKey(password, parsed.salt);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, parsed.iv);
  decipher.setAAD(header);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function readFileSync(filePath, password) {
  const data = fs.readFileSync(filePath);
  return decryptBuffer(data, password).toString("utf8");
}

function writeFileSync(filePath, plaintext, password) {
  const data = encryptString(plaintext, password);
  fs.writeFileSync(filePath, data);
}

module.exports = {
  readFileSync,
  writeFileSync
};
