var nodemailer = require("nodemailer");
var jsonfile = require("jsonfile");

var argv = require('minimist')(process.argv.slice(2));

// create reusable transporter object using SMTP transport
var transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: 'santa@petersonexpress.net',
    pass: 'Rudolph2015'
  }
});

var people = jsonfile.readFileSync("people.json");

/********* Start Application **********/
var list = createList(people);
mailList(list);
console.log("Secret Santa List complete!");
/*********  End Application  **********/

function createList(people) {
  // Create the recipient list
  var recipients = createRecipients(people);

  var list = [];
  for (var i = 0; i < people.length; i++) {
    list[i] = {
      from: people[i],
      to: recipients[i]
    };
  }
  return list;
}

function createRecipients(people) {
  // Create the recipient list
  var shuffles = 0;
  var recipients = [];
  for (var i = 0; i < people.length; i++) {
    recipients[i] = people[i];
  }

  do {
    shuffles++;
    shuffle(recipients);
  } while (badRecipients(people, recipients));

  console.log("Created Recipient List after " + shuffles + " shuffles.");
  return recipients;
}

function badRecipients(people, recipients) {
  for (var i = 0; i < people.length; i++) {
    var from = people[i];
    var to = recipients[i];
    // If sending to ourself or our partner, it's bad
    if (from.first === to.first || from.partner === to.first)
      return true;
    // If sending to someone we gave to in the last two years, it's bad
    if (from.history.slice(-2).indexOf(to.first) >= 0)
      return true;
  }
  return false;
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

function mailList(list) {
  console.log("Sending the list...");
  for (var i = 0; i < list.length; i++) {
    var from = list[i].from;
    var to = list[i].to;
    // TODO: Comment this out to prevent seeing the real list.
    console.log(list[i].from.first + " => " + list[i].to.first);
    // TODO: Uncomment this to actually send the email.
    //sendEmail(from, to);
  }
}

function sendEmail(giver, receiver) {
  // setup e-mail data with unicode symbols
  var mailOptions = {
    from: 'Secret Santa <santa@petersonexpress.net>', // sender address
    //    to: "David Peterson <david@randombits.org>",
    to: giver.first + " " + giver.last + " <" + giver.email + ">", // list of receivers
    subject: 'Your Secret Santa is....', // Subject line
    text: 'Hi ' + giver.first + ",\n\nYour Secret Santa this year is " + receiver.first + ".\n\nMerry Christmas!", // plaintext body
  };

  // send mail with defined transport object
  transporter.sendMail(mailOptions, function(error, info) {
    if (error) {
      return console.log(error);
    }
    console.log('Message sent to ' + giver.first + ': ' + info.response);
  });
}
