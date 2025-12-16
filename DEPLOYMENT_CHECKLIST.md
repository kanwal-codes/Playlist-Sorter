# Vercel Deployment Checklist

## ✅ Pre-Deployment Verification

### Code Status
- ✅ All changes committed to GitHub
- ✅ Build passes successfully (`npm run build`)
- ✅ No TypeScript errors
- ✅ No sensitive files in repository (.env files properly ignored)
- ✅ `vercel.json` configured for cron job

### Security
- ✅ `.env` files excluded from git
- ✅ Sensitive env vars removed from `next.config.js`
- ✅ CORS/CSRF protection configured
- ✅ Cron job authentication implemented

## 📋 Vercel Deployment Steps

### 1. Import Project to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import from GitHub: `kanwal-codes/Playlist-Sorter`
4. Vercel will auto-detect Next.js

### 2. Configure Environment Variables

**Required Variables:**
```
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
DATABASE_URL=your_postgresql_connection_string
ENCRYPTION_KEY=your_32_character_hex_string
CRON_SECRET=your_random_secret_string
```

**Optional Variables:**
```
SPOTIFY_REDIRECT_URI=https://your-app.vercel.app/api/auth/callback
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
OPENAI_API_KEY=your_openai_key (if using AI features)
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=https://your-app.vercel.app
```

**Generate Secrets:**
```bash
# ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# CRON_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# NEXTAUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Update Spotify App Settings
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Edit your app settings
3. Add redirect URI: `https://your-app.vercel.app/api/auth/callback`
4. Save changes

### 4. Database Setup
- Ensure your database (Supabase/Neon/etc.) is accessible from Vercel
- Run Prisma migrations if needed:
  ```bash
  npx prisma generate
  npx prisma db push
  ```

### 5. Deploy
- Click "Deploy" in Vercel
- Wait for build to complete
- Check deployment logs for errors

## 🔍 Post-Deployment Verification

### Test Authentication
1. Visit your deployed app
2. Click "Login with Spotify"
3. Complete OAuth flow
4. Verify you're logged in

### Test Cron Job
1. Wait for first scheduled run (midnight UTC) OR
2. Manually trigger: `curl -X GET "https://your-app.vercel.app/api/cron/sort-playlists" -H "Authorization: Bearer YOUR_CRON_SECRET"`
3. Check Vercel logs for execution

### Monitor
- Check Vercel logs for any errors
- Verify cron job runs at scheduled time
- Test playlist sorting functionality
- Check database connections

## 🚨 Troubleshooting

**Build Fails:**
- Check environment variables are set
- Verify `DATABASE_URL` is correct
- Check build logs in Vercel

**Authentication Fails:**
- Verify `SPOTIFY_REDIRECT_URI` matches Spotify app settings
- Check redirect URI is added to Spotify dashboard
- Verify `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` are correct

**Cron Job Not Running:**
- Verify `CRON_SECRET` is set in Vercel
- Check `vercel.json` is in repository
- Verify cron schedule in Vercel dashboard
- Check Vercel logs for cron execution

**Database Connection Issues:**
- Verify `DATABASE_URL` is correct
- Check database allows connections from Vercel IPs
- Ensure connection pooling is configured (if using Supabase/Neon)

## 📝 Notes

- The app auto-detects production URL using `VERCEL_URL`
- Cron job runs daily at midnight UTC
- All sensitive data is encrypted using `ENCRYPTION_KEY`
- API routes are protected with CORS/CSRF validation

