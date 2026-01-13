const assert = require("assert");
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const santa = require("../santa.js");
const sackStore = require("../lib/sack-store");
const legacyStore = require("../lib/legacy-store");

function test(name, fn) {
  try {
    fn();
    console.log("ok - " + name);
  } catch (err) {
    console.error("not ok - " + name);
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  }
}

function runSanta(args, options) {
  const scriptPath = path.join(__dirname, "..", "santa.js");
  const env = Object.assign({}, process.env, options && options.env ? options.env : {});
  return childProcess.spawnSync(process.execPath, [scriptPath].concat(args || []), {
    cwd: options && options.cwd ? options.cwd : undefined,
    env: env,
    encoding: "utf8"
  });
}

function expectExit(name, fn, expectedCode) {
  const originalExit = process.exit;
  let exitCode;
  process.exit = function(code) {
    exitCode = code;
    throw new Error("process.exit");
  };

  try {
    fn();
  } catch (err) {
    if (!exitCode) {
      throw err;
    }
  } finally {
    process.exit = originalExit;
  }

  if (exitCode !== expectedCode) {
    throw new Error(name + " expected exit code " + expectedCode + ", got " + exitCode);
  }
}

function createPeople() {
  return [
    { first: "Alice", partner: "Bob", history: { "2024": "Carol" } },
    { first: "Bob", partner: "Alice", history: { "2024": "Dave" } },
    { first: "Carol", partner: null, history: { "2024": "Alice" } },
    { first: "Dave", partner: null, history: { "2024": "Bob" } }
  ];
}

test("loadEnvFile loads missing vars but does not override existing", function() {
  const tmpPath = path.join(__dirname, "tmp.env");
  const originalUser = process.env.SANTA_SMTP_USER;
  const originalPass = process.env.SANTA_SMTP_PASS;

  try {
    fs.writeFileSync(tmpPath, "SANTA_SMTP_USER=envuser\nSANTA_SMTP_PASS=envpass\n");
    process.env.SANTA_SMTP_USER = "existing";
    delete process.env.SANTA_SMTP_PASS;

    santa.loadEnvFile(tmpPath);

    assert.strictEqual(process.env.SANTA_SMTP_USER, "existing");
    assert.strictEqual(process.env.SANTA_SMTP_PASS, "envpass");
  } finally {
    if (originalUser === undefined) {
      delete process.env.SANTA_SMTP_USER;
    } else {
      process.env.SANTA_SMTP_USER = originalUser;
    }

    if (originalPass === undefined) {
      delete process.env.SANTA_SMTP_PASS;
    } else {
      process.env.SANTA_SMTP_PASS = originalPass;
    }

    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  }
});

test("badRecipients detects repeats from last year", function() {
  const people = createPeople();
  const recipients = [people[2], people[0], people[3], people[1]];
  const isBad = santa.badRecipients(people, recipients, 2025, 1);
  assert.strictEqual(isBad, true);
});

test("badRecipients detects partner's recipient from last year", function() {
  const people = createPeople();
  const recipients = [people[3], people[2], people[1], people[0]];
  const isBad = santa.badRecipients(people, recipients, 2025, 1);
  assert.strictEqual(isBad, true);
});

test("generateList updates history for the current year", function() {
  const people = [
    { first: "Alice", partner: "Bob", history: {} },
    { first: "Bob", partner: "Alice", history: {} },
    { first: "Carol", partner: null, history: {} },
    { first: "Dave", partner: null, history: {} }
  ];

  const list = santa.generateList(people);
  const year = new Date().getFullYear().toString();

  list.forEach(function(entry) {
    assert.strictEqual(entry.from.history[year], entry.to.first);
  });
});

test("sack-store roundtrips encrypted data", function() {
  const tmpPath = path.join(__dirname, "tmp.sack");
  const payload = JSON.stringify(createPeople());
  const pass = "test-pass";

  try {
    sackStore.writeFileSync(tmpPath, payload, pass);
    const decoded = sackStore.readFileSync(tmpPath, pass);
    assert.strictEqual(decoded, payload);
  } finally {
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  }
});

test("legacy-store reads legacy encrypted data", function() {
  const payload = JSON.stringify(createPeople());
  const tmpDir = fs.mkdtempSync(path.join(__dirname, "tmp-"));
  const legacyFile = "people.dat";

  try {
    legacyStore.writeFileSync(legacyFile, payload, tmpDir);
    const decoded = legacyStore.readFileSync(legacyFile, tmpDir);
    assert.strictEqual(decoded, payload);
  } finally {
    const encryptedPath = legacyStore.getEncryptedPath(legacyFile, tmpDir);
    if (fs.existsSync(encryptedPath)) {
      fs.unlinkSync(encryptedPath);
    }
    fs.rmdirSync(tmpDir);
  }
});

test("normalizePathArg rejects boolean flag without value", function() {
  expectExit("missing out value", function() {
    santa.normalizePathArg(true, "fallback", "out");
  }, 2);
});

test("normalizePathArg uses last string when repeated", function() {
  const value = santa.normalizePathArg(["first.sack", "second.sack"], "fallback", "out");
  assert.strictEqual(value, "second.sack");
});

test("normalizePathArg rejects non-string array values", function() {
  expectExit("array non-string", function() {
    santa.normalizePathArg(["first.sack", true], "fallback", "out");
  }, 2);
});

test("loadPeople rejects non-string input path", function() {
  expectExit("non-string input", function() {
    santa.loadPeople(true);
  }, 2);
});

test("loadPeople reads JSON files", function() {
  const tmpDir = fs.mkdtempSync(path.join(__dirname, "tmp-"));
  const filePath = path.join(tmpDir, "people.json");
  const people = createPeople();

  try {
    fs.writeFileSync(filePath, JSON.stringify(people));
    const loaded = santa.loadPeople(filePath);
    assert.deepStrictEqual(loaded, people);
  } finally {
    fs.unlinkSync(filePath);
    fs.rmdirSync(tmpDir);
  }
});

test("loadPeople rejects .sack without password", function() {
  const tmpDir = fs.mkdtempSync(path.join(__dirname, "tmp-"));
  const filePath = path.join(tmpDir, "people.sack");
  const payload = JSON.stringify(createPeople());
  const originalPass = process.env.SANTA_SACK_PASS;

  try {
    process.env.SANTA_SACK_PASS = "test-pass";
    sackStore.writeFileSync(filePath, payload, process.env.SANTA_SACK_PASS);
    delete process.env.SANTA_SACK_PASS;

    expectExit("missing sack pass", function() {
      santa.loadPeople(filePath);
    }, 2);
  } finally {
    if (originalPass === undefined) {
      delete process.env.SANTA_SACK_PASS;
    } else {
      process.env.SANTA_SACK_PASS = originalPass;
    }
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    fs.rmdirSync(tmpDir);
  }
});

test("loadPeople rejects unknown extensions", function() {
  expectExit("unknown extension", function() {
    santa.loadPeople("people.txt");
  }, 1);
});

test("savePeople rejects non-string output path", function() {
  expectExit("non-string output", function() {
    santa.savePeople([], true);
  }, 2);
});

test("savePeople writes JSON files", function() {
  const tmpDir = fs.mkdtempSync(path.join(__dirname, "tmp-"));
  const filePath = path.join(tmpDir, "people.json");
  const people = createPeople();

  try {
    santa.savePeople(people, filePath);
    const loaded = JSON.parse(fs.readFileSync(filePath, "utf8"));
    assert.deepStrictEqual(loaded, people);
  } finally {
    fs.unlinkSync(filePath);
    fs.rmdirSync(tmpDir);
  }
});

test("savePeople writes .sack files", function() {
  const tmpDir = fs.mkdtempSync(path.join(__dirname, "tmp-"));
  const filePath = path.join(tmpDir, "people.sack");
  const people = createPeople();
  const payload = JSON.stringify(people, null, 2);
  const originalPass = process.env.SANTA_SACK_PASS;

  try {
    process.env.SANTA_SACK_PASS = "test-pass";
    santa.savePeople(people, filePath);
    const decoded = sackStore.readFileSync(filePath, process.env.SANTA_SACK_PASS);
    assert.strictEqual(decoded, payload);
  } finally {
    if (originalPass === undefined) {
      delete process.env.SANTA_SACK_PASS;
    } else {
      process.env.SANTA_SACK_PASS = originalPass;
    }
    fs.unlinkSync(filePath);
    fs.rmdirSync(tmpDir);
  }
});

test("savePeople rejects unknown extensions", function() {
  expectExit("unknown output", function() {
    santa.savePeople([], "people.txt");
  }, 2);
});

test("migrateLegacy rejects non-.dat input", function() {
  const tmpDir = fs.mkdtempSync(path.join(__dirname, "tmp-"));
  try {
    const result = runSanta(["--migrate", "--in=people.json", "--out=people.sack"], { cwd: tmpDir });
    assert.strictEqual(result.status, 2);
  } finally {
    fs.rmdirSync(tmpDir);
  }
});

test("migrateLegacy rejects non-.sack output", function() {
  const tmpDir = fs.mkdtempSync(path.join(__dirname, "tmp-"));
  try {
    const result = runSanta(["--migrate", "--in=people.dat", "--out=people.json"], { cwd: tmpDir });
    assert.strictEqual(result.status, 2);
  } finally {
    fs.rmdirSync(tmpDir);
  }
});

test("migrateLegacy rejects existing output files", function() {
  const tmpDir = fs.mkdtempSync(path.join(__dirname, "tmp-"));
  const outPath = path.join(tmpDir, "people.sack");

  try {
    fs.writeFileSync(outPath, "existing");
    const result = runSanta(["--migrate", "--in=people.dat", "--out=people.sack"], { cwd: tmpDir });
    assert.strictEqual(result.status, 2);
  } finally {
    fs.unlinkSync(outPath);
    fs.rmdirSync(tmpDir);
  }
});

test("migrateLegacy rejects missing legacy files", function() {
  const tmpDir = fs.mkdtempSync(path.join(__dirname, "tmp-"));
  try {
    const result = runSanta(["--migrate", "--in=people.dat", "--out=people.sack"], { cwd: tmpDir });
    assert.strictEqual(result.status, 10);
  } finally {
    fs.rmdirSync(tmpDir);
  }
});

test("migrateLegacy converts legacy data", function() {
  const tmpDir = fs.mkdtempSync(path.join(__dirname, "tmp-"));
  const payload = JSON.stringify(createPeople());

  try {
    legacyStore.writeFileSync("people.dat", payload, tmpDir);
    const result = runSanta(
      ["--migrate", "--in=people.dat", "--out=people.sack"],
      { cwd: tmpDir, env: { SANTA_SACK_PASS: "test-pass" } }
    );
    assert.strictEqual(result.status, 0);

    const outPath = path.join(tmpDir, "people.sack");
    const decoded = sackStore.readFileSync(outPath, "test-pass");
    assert.strictEqual(decoded, payload);
  } finally {
    const legacyPath = legacyStore.getEncryptedPath("people.dat", tmpDir);
    const outPath = path.join(tmpDir, "people.sack");
    if (fs.existsSync(legacyPath)) {
      fs.unlinkSync(legacyPath);
    }
    if (fs.existsSync(outPath)) {
      fs.unlinkSync(outPath);
    }
    fs.rmdirSync(tmpDir);
  }
});
