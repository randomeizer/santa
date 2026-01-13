# Secret Santa Generator

Simple Node.js script to generate a Secret Santa list, optionally email each giver their recipient, and persist history.

## Requirements

- Node.js (tested with older Node versions; uses CommonJS)
- npm install

## Install

```sh
npm install
```

## Data files

- `santa.sack` (default): encrypted JSON stored via the built-in `.sack` format
- `people.dat` (legacy): encrypted JSON from the old `crypto-fs` format (migrate with `--migrate`)
- `people.json`: plaintext JSON (useful for editing)

## Usage

For most cases, you can run `./santa` directly instead of `node santa.js`.

Generate a new list and save it back to `santa.sack`:

```sh
./santa --generate
```

Generate and send emails:

```sh
./santa --generate --send
```

Decrypt `santa.sack` to a JSON file:

```sh
./santa --out=my-data.json
```

Encrypt a JSON file to `santa.sack`:

```sh
./santa --in=my-data.json --out=santa.sack
```

Print the people data:

```sh
./santa --print
```

## Email configuration

Set these environment variables (or create a local `.env` file):

```sh
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

```sh
./santa --migrate
```

You can override the defaults:

```sh
./santa --migrate --in=old.dat --out=new.sack
```

## Testing

```sh
npm test
```
