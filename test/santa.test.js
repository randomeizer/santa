const assert = require("assert");
const fs = require("fs");
const path = require("path");

const santa = require("../santa");

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
