# PulseWatch

PulseWatch is a web uptime-monitoring dashboard for tracking public websites and APIs. It runs HTTP health checks, records response times, and gives you a dashboard for monitor status and incidents.

## Features

- Create an account and sign in with cookie-based authentication.
- Add, edit, pause, and remove URL monitors.
- Configure check intervals, request timeouts, expected HTTP status codes, tags, and alert preferences.
- View monitor health, response times, check history, and incidents.
- Run a health check manually or let the server check active monitors on its schedule.

## Tech stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js, Express
- **Persistence:** Local JSON file (`server/data/store.json`)

## Getting started

### Requirements

- Node.js 20.19+ or 22.12+
- npm

### Install dependencies

Install dependencies in the root, frontend, and backend directories:

```bash
npm install
npm --prefix client install
npm --prefix server install
```

### Configure the server

Create a local environment file from the example:

```bash
cp server/.env.example server/.env
```

On Windows PowerShell, use:

```powershell
Copy-Item server/.env.example server/.env
```

Set a private `JWT_SECRET` in `server/.env`. `PORT` is optional and defaults to `4000`:

```dotenv
PORT=4000
JWT_SECRET=replace-this-with-a-long-random-secret
```

Do not commit `.env` or use the example secret outside local development.

### Start the app

From the repository root, run:

```bash
npm run dev
```

The Vite frontend is available at [http://localhost:5173](http://localhost:5173), and the API runs at [http://localhost:4000](http://localhost:4000). The API health endpoint is `http://localhost:4000/api/health`.

The frontend uses `http://localhost:4000/api` by default. To point it at another API, define `VITE_API_BASE_URL` in `client/.env.local`, for example:

```dotenv
VITE_API_BASE_URL=http://localhost:4000/api
```

## Available scripts

Run these from the repository root unless noted:

| Command | Description |
| --- | --- |
| `npm run dev` | Start the frontend and backend in development mode |
| `npm run client` | Start only the Vite frontend |
| `npm run server` | Start only the Express backend |
| `npm run build` | Type-check and build the frontend |
| `npm run lint --prefix client` | Lint the frontend |

## Data and configuration

The backend creates `server/data/store.json` on first run and stores users, monitors, checks, and incidents there. Back up this file if you need to preserve local data. This file-based storage is intended for local development and is not a substitute for a production database or backup strategy.

The server checks active monitors on a schedule and also supports manual checks. Monitor check intervals and timeouts are configured per monitor.

## Project structure

```text
client/       React and TypeScript frontend
server/       Express API and local JSON data store
package.json  Root development and build scripts
```

## Security note

Use a unique, strong `JWT_SECRET` for every deployed environment. Before exposing this app publicly, review and harden authentication, cookie settings, CORS, data persistence, and operational monitoring for your deployment.
