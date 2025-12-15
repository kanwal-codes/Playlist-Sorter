# Spotify Playlist Auto-Sorter

AI-powered web application that automatically sorts Spotify playlists by date added every night at 12 AM, with AI recommendations for playlist improvements.

## Features

- 🔄 Automatic nightly sorting of playlists by date added (newest first)
- 🤖 AI-powered playlist recommendations
- 🎵 Manual playlist sorting on demand
- 📊 Playlist analytics and insights
- ⚙️ Per-playlist auto-sort settings
- 🔐 Secure Spotify OAuth authentication

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Spotify OAuth 2.0
- **Scheduled Jobs**: Vercel Cron Jobs
- **AI**: OpenAI API

## 📚 Documentation

All documentation has been organized in the [`docs/`](./docs/) folder:

- **[Setup Guides](./docs/setup/)** - Installation and setup instructions
- **[Troubleshooting](./docs/troubleshooting/)** - Common issues and solutions
- **[Development](./docs/development/)** - Development notes and improvements
- **[Architecture](./docs/architecture/)** - System design and architecture
- **[Recovery](./docs/recovery/)** - Data recovery guides
- **[Testing](./docs/testing/)** - Testing documentation
- **[API](./docs/api/)** - API documentation

See [`docs/README.md`](./docs/README.md) for a complete index.

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- PostgreSQL database (local or cloud like Supabase/Neon)
- Spotify Developer Account (create app at https://developer.spotify.com)
- OpenAI API key (optional, for AI recommendations)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd playlist-sorter
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:
- `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` from Spotify Developer Dashboard
- `SPOTIFY_REDIRECT_URI` (should be `http://127.0.0.1:3000/api/auth/callback` for local dev)
- `DATABASE_URL` (PostgreSQL connection string)
- `OPENAI_API_KEY` (optional, for AI features)
- `ENCRYPTION_KEY` (generate a random 32-character string)

4. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Spotify App Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add redirect URI: `http://127.0.0.1:3000/api/auth/callback` (for development)
4. Copy Client ID and Client Secret to `.env.local`
5. Request the following scopes:
   - `playlist-read-private`
   - `playlist-read-collaborative`
   - `playlist-modify-public`
   - `playlist-modify-private`
   - `user-read-email`
   - `user-read-private`

## Deployment

### Vercel

1. Push your code to GitHub
2. Import project in Vercel
3. Add all environment variables in Vercel dashboard
4. Update `SPOTIFY_REDIRECT_URI` to your production URL
5. Deploy!

The cron job will automatically be set up to run at midnight UTC.

## Project Structure

See [docs/architecture/SYSTEM_DESIGN.md](./docs/architecture/SYSTEM_DESIGN.md) for detailed architecture and file structure.

## License

MIT

