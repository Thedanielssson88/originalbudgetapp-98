import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Configure Google OAuth strategy
const getCallbackURL = () => {
  // Use environment variable if set (highest priority)
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  
  // Check if running in production environment
  const isProduction = process.env.NODE_ENV === 'production';
  const hasReplitDomain = process.env.REPLIT_DOMAINS && process.env.REPLIT_DOMAINS.includes('originalbudgetapp-98-andreasadaniels.replit.app');
  
  if (isProduction || hasReplitDomain) {
    // Production: use Replit app domain
    return "https://originalbudgetapp-98-andreasadaniels.replit.app/auth/google/callback";
  } else {
    // Development: use localhost callback
    const port = process.env.PORT || '5000';
    return `http://localhost:${port}/auth/google/callback`;
  }
};

const callbackURL = getCallbackURL();
console.log('🔧 Google OAuth callback URL:', callbackURL);
console.log('🔍 Environment debug:', {
  NODE_ENV: process.env.NODE_ENV,
  REPLIT_DOMAINS: process.env.REPLIT_DOMAINS,
  PORT: process.env.PORT,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI ? 'SET' : 'NOT SET'
});

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || "33688457598-p9tkuk8kfnqqpr2502tglbd6agsk2jrg.apps.googleusercontent.com",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "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",
  callbackURL: callbackURL
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists with this Google ID
    const existingUser = await db.select().from(users).where(eq(users.googleId, profile.id)).limit(1);
    
    if (existingUser.length > 0) {
      // User exists, return the user
      return done(null, existingUser[0]);
    }

    // Check if user exists with same email
    const emailUser = await db.select().from(users).where(eq(users.email, profile.emails?.[0]?.value || '')).limit(1);
    
    if (emailUser.length > 0) {
      // Link Google account to existing email user
      await db.update(users)
        .set({ googleId: profile.id })
        .where(eq(users.id, emailUser[0].id));
      
      const updatedUser = await db.select().from(users).where(eq(users.id, emailUser[0].id)).limit(1);
      return done(null, updatedUser[0]);
    }

    // Create new user
    const newUser = await db.insert(users).values({
      id: `google-${profile.id}`, // Use Google ID as primary key with prefix
      googleId: profile.id,
      email: profile.emails?.[0]?.value || null,
      firstName: profile.name?.givenName || null,
      lastName: profile.name?.familyName || null,
      profileImageUrl: profile.photos?.[0]?.value || null,
    }).returning();

    return done(null, newUser[0]);
  } catch (error) {
    console.error('Google OAuth error:', error);
    return done(error, null);
  }
}));

// Serialize user for session storage
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await db.select().from(users).where(eq(users.id, id)).limit(1);
    done(null, user[0] || null);
  } catch (error) {
    done(error, null);
  }
});

export default passport;