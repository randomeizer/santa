# Secret Santa Generator

Simple Node.js script to generate a Secret Santa list, optionally email each giver their recipient, and persist history.

## Requirements

- Node.js (tested with older Node versions; uses CommonJS)
- npm install

## Install

```
npm install
```

## Data files

- `people.dat` (default): encrypted JSON stored via `crypto-fs`
- `people.json`: plaintext JSON (useful for editing)

## Usage

Generate a new list and save it back to `people.dat`:

```
node santa.js --generate
```

Generate and send emails:

```
node santa.js --generate --send
```

Decrypt `people.dat` to a JSON file:

```
node santa.js --out=my-data.json
```

Encrypt a JSON file to `people.dat`:

```
node santa.js --in=my-data.json --out=people.dat
```

Print the people data:

```
node santa.js --print
```

## Email configuration

Set these environment variables (or create a local `.env` file):

```
SANTA_SMTP_USER=santa@petersonexpress.net
SANTA_SMTP_PASS=your_password_here
```

Notes:
- `.env` is loaded automatically if present.
- `.env` is ignored by git.
- `SANTA_SMTP_PASS` is required when using `--send`.

## Options

- `--in=<path>`: input file (`.dat` encrypted, `.json` plaintext)
- `--out=<path>`: output file
- `--generate`: generate a new list
- `--send`: send emails to each giver
- `--test-email=<address>`: send all emails to a single test address
- `--subject-prefix=<prefix>`: prefix the email subject
- `--print`: print loaded data

## Testing

```
npm test
```
