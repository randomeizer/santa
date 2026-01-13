const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const LEGACY_PASSWORD = "SecretSanta";
const ALGORITHM = "aes-256-ctr";
const KEY_LEN = 32;
const IV_LEN = 16;

function sha1Hex(value) {
  const shasum = crypto.createHash("sha1");
  shasum.update(value);
  return shasum.digest("hex");
}

function evpBytesToKey(password, keyLen, ivLen) {
  const data = Buffer.isBuffer(password) ? password : Buffer.from(String(password), "utf8");
  let derived = Buffer.alloc(0);
  let prev = Buffer.alloc(0);

  while (derived.length < keyLen + ivLen) {
    const hash = crypto.createHash("md5");
    hash.update(prev);
    hash.update(data);
    prev = hash.digest();
    derived = Buffer.concat([derived, prev]);
  }

  return {
    key: derived.slice(0, keyLen),
    iv: derived.slice(keyLen, keyLen + ivLen)
  };
}

function createCipher(password, isEncrypt) {
  const parts = evpBytesToKey(password, KEY_LEN, IV_LEN);
  return isEncrypt
    ? crypto.createCipheriv(ALGORITHM, parts.key, parts.iv)
    : crypto.createDecipheriv(ALGORITHM, parts.key, parts.iv);
}

function legacyPassword(key) {
  return sha1Hex(LEGACY_PASSWORD + ":" + key);
}

function processBuffer(data, key, isEncrypt, inputEncoding) {
  const password = legacyPassword(key);
  const cipher = createCipher(password, isEncrypt);
  const chunks = [];

  chunks.push(cipher.update(data, inputEncoding));
  chunks.push(cipher.final());

  return Buffer.concat(chunks);
}

function encryptBuffer(data, key, inputEncoding) {
  return processBuffer(data, key, true, inputEncoding);
}

function decryptBuffer(data, key) {
  return processBuffer(data, key, false);
}

function processSegment(pathArray, parent, processFn) {
  const key = parent.join(":");
  const name = pathArray.shift();
  const res = processFn(name, key);
  let procName = [res.processed];
  if (pathArray.length) {
    parent.push(res.key);
    procName = procName.concat(processSegment(pathArray, parent, processFn));
  }
  return procName;
}

function encryptPath(filePath) {
  const pathArray = filePath.split(/\\|\//g);
  const encName = processSegment(pathArray, [], function(name, key) {
    const enc = encryptBuffer(name, key).toString("hex");
    return {
      processed: enc,
      key: name
    };
  });
  return path.join.apply(path, encName);
}

function getEncryptedPath(filePath, rootDir) {
  const root = rootDir || process.cwd();
  return path.join(root, encryptPath(filePath));
}

function existsSync(filePath, rootDir) {
  return fs.existsSync(getEncryptedPath(filePath, rootDir));
}

function readFileSync(filePath, rootDir) {
  const encryptedPath = getEncryptedPath(filePath, rootDir);
  const data = fs.readFileSync(encryptedPath);
  return decryptBuffer(data, filePath).toString("utf8");
}

function writeFileSync(filePath, plaintext, rootDir) {
  const encryptedPath = getEncryptedPath(filePath, rootDir);
  const data = encryptBuffer(plaintext, filePath, "utf8");
  fs.writeFileSync(encryptedPath, data);
}

module.exports = {
  existsSync,
  readFileSync,
  writeFileSync,
  getEncryptedPath
};
