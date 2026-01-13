require('string.prototype.endswith');
var nodemailer = require("nodemailer");
const fs = require('fs');
const sackStore = require("./lib/sack-store");
const legacyStore = require("./lib/legacy-store");

const DEFAULT_DATA_FILE = "santa.sack";
const LEGACY_DATA_FILE = "people.dat";
const ENV_FILE = ".env";
const SACK_EXT = ".sack";
const LEGACY_EXT = ".dat";

function loadEnvFile(path) {
  if (!fs.existsSync(path)) {
    return;
  }

  var lines = fs.readFileSync(path, "utf8").split(/\r?\n/);
  lines.forEach(function(line) {
    var trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }
    var idx = trimmed.indexOf("=");
    if (idx === -1) {
      return;
    }
    var key = trimmed.slice(0, idx).trim();
    var value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

loadEnvFile(ENV_FILE);

const SMTP_USER = process.env.SANTA_SMTP_USER || 'santa@petersonexpress.net';
const SMTP_PASS = process.env.SANTA_SMTP_PASS;
const MAIL_FROM = 'Secret Santa <' + SMTP_USER + '>';

var argv = require('minimist')(process.argv.slice(2), {
  "boolean": true
});

// Create transport only when sending, so printing/generating doesn't need creds.
var transporter;
function getTransporter() {
  if (transporter) {
    return transporter;
  }

  if (!SMTP_PASS) {
    console.error("Missing SANTA_SMTP_PASS. Set it before using --send.");
    process.exit(2);
  }

  transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  return transporter;
}

/********* Start Application **********/
function main() {
  if (argv.help) {
    help();
    process.exit(0);
  }

  if (argv.migrate) {
    migrateLegacy();
    return;
  }

  var inFile = normalizePathArg(argv.in, DEFAULT_DATA_FILE, "in");
  var outFile = normalizePathArg(argv.out, inFile, "out");

  if (!argv.in && !fs.existsSync(inFile) && legacyStore.existsSync(LEGACY_DATA_FILE)) {
    console.error("Missing '" + inFile + "'. Legacy '" + LEGACY_DATA_FILE + "' detected.");
    console.error("Run `node santa.js --migrate` to create a new .sack file.");
    process.exit(10);
  }

  // Load people
  var people = loadPeople(inFile);

  if (argv.generate) {
    var list = generateList(people);
    mailList(list, argv.send);
  }

  if (argv.print) {
    printPeople(people);
  }

  savePeople(people, outFile);

  console.log("Secret Santa List complete!");
}
/*********  End Application  **********/

function loadPeople(inFile) {
  var peopleText;

  if (typeof inFile !== "string") {
    console.error("Input path must be a string.");
    process.exit(2);
  }

  if (inFile.endsWith(LEGACY_EXT)) {
    console.error("Legacy data file detected. Run `node santa.js --migrate` first.");
    process.exit(10);
  } else if (inFile.endsWith(SACK_EXT)) {
    if (!fs.existsSync(inFile)) {
      console.log("Unable to find '" + inFile + "'.");
      console.log("You can specify an alternate file to load by adding '--in=<path>'.");
      process.exit(10);
    }
    console.log("Decrypting '" + inFile + "'...");
    peopleText = sackStore.readFileSync(inFile, requireSackPass());
    console.log("Decrypted.")
  } else if (inFile.endsWith(".json")) {
    if (!fs.existsSync(inFile)) {
      console.log("Unable to find '" + inFile + "'.");
      console.log("You can specify an alternate file to load by adding '--in=<path>'.");
      process.exit(10);
    }

    console.log("Loading '" + inFile + "'...");
    peopleText = fs.readFileSync(inFile, 'utf8');
    console.log("Loaded.");
  } else {
    console.log("Unrecognised input file format: " + inFile);
    process.exit(1);
  }

  return JSON.parse(peopleText);
}

// Generates an array of entries with 'from' and 'to' pointing at people. 
// The people.history record for the current year will be updated.
function generateList(people) {
  var thisYear = new Date().getFullYear();
  // Create the recipient list
  var recipients = generateRecipients(people, thisYear);

  var list = [];
  for (var i = 0; i < people.length; i++) {
    list[i] = {
      from: people[i],
      to: recipients[i]
    };
    people[i].history[thisYear.toString()] = recipients[i].first;
  }
  return list;
}

function generateRecipients(people, year) {
  // Create the recipient list
  var shuffles = 0;
  var recipients = [];
  for (var i = 0; i < people.length; i++) {
    recipients[i] = people[i];
  }

  do {
    shuffles++;
    shuffle(recipients);
  } while (badRecipients(people, recipients, year));

  console.log("Created Recipient List after " + shuffles + " shuffles.");
  return recipients;
}

function badRecipients(people, recipients, thisYear, historyLimit) {
  // Check how many years to check for repeats. Defaults to 1.
  var history = historyLimit !== undefined ? historyLimit : (argv.history ? parseInt(argv.history) : 1);
  var partners = 0;

  for (var i = 0; i < people.length; i++) {
    var from = people[i];
    var to = recipients[i];

    // console.log("Checking the recipient for " + from.first);

    // If sending to ourself, it's bad
    if (from.first === to.first)
      return true;

    // If sending to our partner, it's bad
    if (from.partner === to.first && ++partners > 1)
      return true;

    // If my recipient is also sending to me this year, it's bad
    for (var j = 0; j < i; j++) {
      if (isEqual(people[i].first, to.first) && isEqual(recipients[j], from.first))
        return true;
    }
    
    // If sending to someone we gave to in the last few years, it's bad
    // console.log("Checking history of up to " + history + " years for " + from.first + ".");
    for (var j = 1; j <= history; j++) {
      if (checkYear(from.history, thisYear - j, to.first))
        return true;
    }

    // If sending to my partner's recipient from last year, it's bad
    var partner = findPerson(people, from.partner);
    if (partner && checkYear(partner.history, thisYear - 1, to.first))
      return true;
  }
  return false;
}

function isEqual(left, right) {
  return left.indexOf(right) >= 0;
}

function findPerson(people, first) {
  if (first) {
    for (var i = 0; i < people.length; i++) {
      var person = people[i];
      if (isEqual(person.first, first))
        return person;
    }
  }
  return null;
}

function checkYear(history, year, value) {
  var hValue = history[year.toString()];
  return hValue && isEqual(hValue, value);
}

function shuffle(array) {
  var i = 0,
    j = 0,
    temp = null

  for (i = array.length - 1; i > 0; i -= 1) {
    j = Math.floor(Math.random() * (i + 1))
    temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }
}

function mailList(list, send) {
  console.log((send ? "Secretly sending" : "Printing") + " the list...");
  for (var i = 0; i < list.length; i++) {
    var from = list[i].from;
    var to = list[i].to;

    if (send) {
      sendEmail(from, to);
      //      console.log(list[i].from.first + " emailed.");
    } else {
      console.log(list[i].from.first + " => " + list[i].to.first);
    }
  }
}

function sendEmail(giver, receiver) {
  // setup e-mail data with unicode symbols
  var mailOptions = {
    from: MAIL_FROM, // sender address
    to: giver.first + " " + giver.last + " <" + giver.email + ">", // list of receivers
    subject: 'Your Secret Santa is....', // Subject line
    text: 'Hi ' + giver.first + ",\n\nYour Secret Santa this year is " + receiver.first + ".\n\nMerry Christmas!\n\nP.S. Don't tell them! It's a secret!!!", // plaintext body
  };

  if (argv["test-email"]) {
    // It's a test, so hijack the email and prefix 'TEST: ' to the subject.
    var email = argv["test-email"];
    console.log("Using TEST email address " + email);
    mailOptions.to = email;
    mailOptions.subject = "TEST: " + mailOptions.subject;
  }
  
  if (argv['subject-prefix'])
    mailOptions.subject = argv['subject-prefix'].trim() + " " + mailOptions.subject;

  // send mail with defined transport object
  getTransporter().sendMail(mailOptions, function(error, info) {
    if (error) {
      return console.log(error);
    }
    console.log('Message sent to ' + giver.first + ': ' + info.response);
  });
}

function printPeople(people) {
  console.log("Printing people data:");
  console.log(JSON.stringify(people, null, 2));
}

function savePeople(people, outFile) {
  console.log("Saving people to '" + outFile + "'");
  var peopleText = JSON.stringify(people, null, 2);

  if (typeof outFile !== "string") {
    console.error("Output path must be a string.");
    process.exit(2);
  }

  if (outFile.endsWith(LEGACY_EXT)) {
    console.error("Refusing to write legacy data file. Use `node santa.js --migrate` instead.");
    process.exit(2);
  } else if (outFile.endsWith(SACK_EXT)) {
    sackStore.writeFileSync(outFile, peopleText, requireSackPass());
  } else if (outFile.endsWith(".json")) {
    fs.writeFileSync(outFile, peopleText);
  } else {
    console.log("Unrecognised output file format: " + outFile);
    process.exit(2);
  }
}

function migrateLegacy() {
  var inFile = normalizePathArg(argv.in, LEGACY_DATA_FILE, "in");
  var outFile = normalizePathArg(argv.out, DEFAULT_DATA_FILE, "out");

  if (!inFile.endsWith(LEGACY_EXT)) {
    console.error("Migration input must be a .dat file.");
    process.exit(2);
  }

  if (!outFile.endsWith(SACK_EXT)) {
    console.error("Migration output must be a .sack file.");
    process.exit(2);
  }

  if (fs.existsSync(outFile)) {
    console.error("Refusing to overwrite existing '" + outFile + "'.");
    process.exit(2);
  }

  if (!legacyStore.existsSync(inFile)) {
    console.error("Unable to find legacy file '" + inFile + "'.");
    console.error("You can specify an alternate file to load by adding '--in=<path>'.");
    process.exit(10);
  }

  console.log("Migrating legacy '" + inFile + "' to '" + outFile + "'...");
  var peopleText = legacyStore.readFileSync(inFile);

  try {
    JSON.parse(peopleText);
  } catch (err) {
    console.error("Legacy file could not be parsed as JSON.");
    process.exit(2);
  }

  sackStore.writeFileSync(outFile, peopleText, requireSackPass());
  console.log("Migration complete.");
}

function requireSackPass() {
  if (!process.env.SANTA_SACK_PASS) {
    console.error("Missing SANTA_SACK_PASS. Set it before using .sack files.");
    process.exit(2);
  }
  return process.env.SANTA_SACK_PASS;
}

function normalizePathArg(value, fallback, flagName) {
  if (value === undefined) {
    return fallback;
  }
  if (value === true) {
    console.error("Missing value for --" + flagName + ".");
    process.exit(2);
  }
  if (Array.isArray(value)) {
    value = value[value.length - 1];
  }
  if (typeof value !== "string") {
    console.error("Invalid value for --" + flagName + ".");
    process.exit(2);
  }
  return value;
}

function help() {
  console.log("This script generates a Secret Santa list for the Peterson family.");
  console.log("By default, this will load 'santa.sack' and then save it again.");
  console.log("");
  console.log("Options:");
  console.log("\t--in=<path> - (default 'santa.sack') Specify the input path. '*.sack' files are encrypted, '*.json' are plain text.");
  console.log("\t--out=<path> - (default to the 'in' path) Specify the output path. '*.sack' files are encrypted, '*.json' are plain text.");
  console.log("\t--generate - will generate a new list of gift givers for the current year.");
  console.log("\t--send - if specified, each giver will be sent their secret recipient in an email.");
  console.log("\t--test-email=<email address> - if an email address is provided, it will be used instead of the giver's email address.");
  console.log("\t--subject-prefix=<prefix> - the provided text will be prefixed to the standard subject line.")
  console.log("\t--print - If specified, the people data loaded will be printed.");
  console.log("\t--migrate - migrate legacy .dat data to .sack format (supports --in/--out).");
  console.log("");
  console.log("Email settings:");
  console.log("\tSANTA_SMTP_USER - SMTP username (defaults to santa@petersonexpress.net)");
  console.log("\tSANTA_SMTP_PASS - SMTP password (required when using --send)");
  console.log("\tSANTA_SACK_PASS - password for encrypting/decrypting .sack files");
  console.log("\t.env - if present, will be loaded for these variables");
  console.log("");
  console.log("To generate, send out and save a new set of Secret Santa emails, do this:");
  console.log("\tnode santa.js --generate --send");
  console.log("To decrypt the current data file, do this:")
  console.log("\tnode santa.js --out=my-data.json");
  console.log("To encrypt a JSON file to 'santa.sack', do this:");
  console.log("\tnode santa.js --in=my-data.json --out=santa.sack")
  console.log("To print the contents of 'santa.sack', do this:");
  console.log("\tnode santa.js --print")
  console.log("To migrate from legacy data, do this:");
  console.log("\tnode santa.js --migrate")
}

if (require.main === module) {
  main();
}

module.exports = {
  loadEnvFile,
  loadPeople,
  savePeople,
  generateList,
  generateRecipients,
  badRecipients,
  isEqual,
  findPerson,
  checkYear,
  shuffle,
  normalizePathArg
};
