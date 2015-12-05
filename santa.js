var nodemailer = require("nodemailer");

// create reusable transporter object using SMTP transport
var transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: 'santa@petersonexpress.net',
        pass: 'Rudolph2015'
    }
});

var people = [
  {first: "John", last: "Peterson", email: "john@petersonexpress.net", exclude: ["Glenda","David","Andrew"]},
  {first: "Glenda", last: "Peterson", email: "glenda@petersonexpress.net", exclude: ["John","David","Andrew"]},
  {first: "David", last: "Peterson", email: "david@randombits.org", exclude: ["Andrew","Monique"]},
  {first: "Andrew", last: "Peterson", email: "andrew@petersonexpress.net", exclude: ["David","Loch"]},
  {first: "Philip", last: "Peterson", email: "theprips@gmail.com", exclude: ["Monique","Glenda","Heidi"]},
  {first: "Monique", last: "Peterson", email: "missmrw@gmail.com", exclude: ["Philip","Glenda","Heidi"]},
  {first: "Heidi", last: "Oakley", email: "heidi@petersonexpress.net", exclude: ["Loch","John","Philip"]},
  {first: "Loch", last: "Oakley", email: "lochoakley@hotmail.com", exclude: ["Heidi","Philip","John"]}
]

var list = createList(people);
mailList(list);
console.log("Secret Santa List complete!");

function createList(people) {
  // Create the recipient list
  var recipients = createRecipients(people);
  
  var list = [];
  for (var i = 0; i < people.length; i++) {
    list[i] = {from: people[i], to: recipients[i]};
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
    var from = people[i]; var to = recipients[i];
    if (from.first === to.first)
      return true;
    if (from.exclude.indexOf(to.first) >= 0)
      return true;
  }
  return false;
}

function shuffle (array) {
  var i = 0
    , j = 0
    , temp = null

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
  transporter.sendMail(mailOptions, function(error, info){
      if(error){
          return console.log(error);
      }
      console.log('Message sent to '+giver.first+': ' + info.response);
  });
}