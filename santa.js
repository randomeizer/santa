require('string.prototype.endswith');
var nodemailer = require("nodemailer");
const fs = require('fs');
var cfs = require('crypto-fs');

const DEFAULT_DATA_FILE = "people.dat";

var argv = require('minimist')(process.argv.slice(2), {
  "boolean": true
});

// create reusable transporter object using SMTP transport
var transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: 'santa@petersonexpress.net',
    pass: 'Rudolph2015'
  }
});

// Initialise crypto
// Note: We're really just encrypting so that the person running it doesn't accidentally see the list...
cfs.init({
  password: "SecretSanta",
  root: process.cwd()
});

/********* Start Application **********/
if (argv.help) {
  help();
  process.exit(0);
}

var inFile = argv.in ? argv.in : DEFAULT_DATA_FILE;
var outFile = argv.out ? argv.out : inFile;

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
/*********  End Application  **********/

function loadPeople(inFile) {
  var peopleText;

  if (inFile.endsWith(".dat")) {
    if (!cfs.existsSync(inFile)) {
      console.log("Unable to find '" + inFile + "'.");
      console.log("You can specify an alternate file to load by adding '--in=<path>'.");
      process.exit(10);
    }
    console.log("Decrypting '" + inFile + "'...");
    peopleText = cfs.readFileSync(inFile);
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

function badRecipients(people, recipients, thisYear) {
  // Check how many years to check for repeats. Defaults to 1.
  var history = argv.history ? parseInt(argv.history) : 1;
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
    from: 'Secret Santa <santa@petersonexpress.net>', // sender address
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
  transporter.sendMail(mailOptions, function(error, info) {
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

  if (outFile.endsWith(".dat")) {
    cfs.writeFileSync(outFile, peopleText);
  } else if (outFile.endsWith(".json")) {
    fs.writeFileSync(outFile, peopleText);
  } else {
    console.log("Unrecognised output file format: " + outFile);
    process.exit(2);
  }
}

function help() {
  console.log("This script generates a Secret Santa list for the Peterson family.");
  console.log("By default, this will simply load the 'people.dat' file and then save it again.");
  console.log("");
  console.log("Options:");
  console.log("\t--in=<path> - (default 'people.dat') Specify the input path. '*.dat' files will be encrypted, '*.json' will be plain text.");
  console.log("\t--out=<path> - (default to the 'in' path) Specify the output path. '*.dat' will be encrypted, '*.json' will be plain text.");
  console.log("\t--generate - will generate a new list of gift givers for the current year.");
  console.log("\t--send - if specified, each giver will be sent their secret recipient in an email.");
  console.log("\t--test-email=<email address> - if an email address is provided, it will be used instead of the giver's email address.");
  console.log("\t--subject-prefix=<prefix> - the provided text will be prefixed to the standard subject line.")
  console.log("\t--print - If specified, the people data loaded will be printed.");
  console.log("");
  console.log("To generate, send out and save a new set of Secret Santa emails, do this:");
  console.log("\tnode santa.js --generate --send");
  console.log("To decrypt the current data file, do this:")
  console.log("\tnode santa.js --out=my-data.json");
  console.log("To encrypt a JSON file to 'people.dat', do this:");
  console.log("\tnode santa.js --in=my-data.json --out=people.dat")
  console.log("To print the contents of 'people.dat', do this:");
  console.log("\tnode santa.js --print")
}
