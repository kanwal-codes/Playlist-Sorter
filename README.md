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

The application is optimized for Vercel serverless deployment. Follow these steps:

1. **Push your code to GitHub**
   ```bash
   git push origin main
   ```

2. **Import project in Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js

3. **Configure Environment Variables in Vercel**
   
   Add these **required** environment variables in Vercel dashboard:
   - `SPOTIFY_CLIENT_ID` - Your Spotify app client ID
   - `SPOTIFY_CLIENT_SECRET` - Your Spotify app client secret
   - `DATABASE_URL` - PostgreSQL connection string (Supabase/Neon recommended)
   - `ENCRYPTION_KEY` - Random 32-character hex string (generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `CRON_SECRET` - Random secret for cron job authentication
   
   **Optional** environment variables:
   - `SPOTIFY_REDIRECT_URI` - Auto-detected from `VERCEL_URL`, but can be set explicitly (e.g., `https://your-app.vercel.app/api/auth/callback`)
   - `NEXT_PUBLIC_APP_URL` - Your production URL (e.g., `https://your-app.vercel.app`) - auto-detected if not set
   - `OPENAI_API_KEY` - For AI recommendations feature
   - `NEXTAUTH_SECRET` - For session management (if using NextAuth)
   - `NEXTAUTH_URL` - Auto-detected from `VERCEL_URL`

4. **Update Spotify App Redirect URI**
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Edit your app settings
   - Add redirect URI: `https://your-app.vercel.app/api/auth/callback`
   - Save changes

5. **Deploy!**
   - Vercel will automatically deploy on every push to `main`
   - The cron job is configured in `vercel.json` to run at midnight UTC

**Note:** The application automatically detects the production URL using Vercel's `VERCEL_URL` environment variable, so you don't need to manually set `SPOTIFY_REDIRECT_URI` unless you want to override it.

**Cron Job:** The cron job at `/api/cron/sort-playlists` is automatically configured via `vercel.json` and will run daily at midnight UTC. Make sure `CRON_SECRET` is set in your Vercel environment variables.

## Project Structure

See [docs/architecture/SYSTEM_DESIGN.md](./docs/architecture/SYSTEM_DESIGN.md) for detailed architecture and file structure.

## License

MIT

