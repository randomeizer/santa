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

- `santa.sack` (default): encrypted JSON stored via the built-in `.sack` format
- `people.dat` (legacy): encrypted JSON from the old `crypto-fs` format (migrate with `--migrate`)
- `people.json`: plaintext JSON (useful for editing)

## Usage

Generate a new list and save it back to `santa.sack`:

```
node santa.js --generate
```

Generate and send emails:

```
node santa.js --generate --send
```

Decrypt `santa.sack` to a JSON file:

```
node santa.js --out=my-data.json
```

Encrypt a JSON file to `santa.sack`:

```
node santa.js --in=my-data.json --out=santa.sack
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
SANTA_SACK_PASS=your_data_password
```

Notes:
- `.env` is loaded automatically if present.
- `.env` is ignored by git.
- `SANTA_SMTP_PASS` is required when using `--send`.
- `SANTA_SACK_PASS` is required when using `.sack` files.

## Options

- `--in=<path>`: input file (`.sack` encrypted, `.json` plaintext)
- `--out=<path>`: output file (`.sack` encrypted, `.json` plaintext)
- `--migrate`: migrate legacy `.dat` to `.sack` (supports `--in`/`--out`)
- `--generate`: generate a new list
- `--send`: send emails to each giver
- `--test-email=<address>`: send all emails to a single test address
- `--subject-prefix=<prefix>`: prefix the email subject
- `--print`: print loaded data

## Migration

If you still have the legacy `people.dat`, migrate it to the new `.sack` format:

```
node santa.js --migrate
```

You can override the defaults:

```
node santa.js --migrate --in=old.dat --out=new.sack
```

## Testing

```
npm test
```
