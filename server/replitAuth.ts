import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { DatabaseStorage } from "./dbStorage";

// Use the same storage instance as routes
const storage = new DatabaseStorage();

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  const isProduction = process.env.NODE_ENV === 'production';
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction, // Only secure in production (HTTPS)
      maxAge: sessionTtl,
      sameSite: 'lax', // Use lax for OAuth compatibility
      // Remove domain restriction for production to avoid cookie issues
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  try {
    console.log('🔄 Creating/updating user with claims:', {
      id: claims["sub"],
      email: claims["email"],
      firstName: claims["first_name"],
      lastName: claims["last_name"]
    });
    
    const user = await storage.upsertUser({
      id: claims["sub"],
      email: claims["email"],
      firstName: claims["first_name"],
      lastName: claims["last_name"],
      profileImageUrl: claims["profile_image_url"],
    });
    
    console.log('✅ User created/updated successfully:', user.id);
    return user;
  } catch (error) {
    console.error('❌ Failed to create/update user:', error);
    throw error;
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    try {
      console.log('🔄 OAuth verify function called');
      const claims = tokens.claims();
      console.log('🔄 OAuth claims received:', {
        sub: claims.sub,
        email: claims.email,
        firstName: claims.first_name,
        lastName: claims.last_name
      });
      
      const user = {};
      updateUserSession(user, tokens);
      
      console.log('🔄 Creating/updating user in database...');
      await upsertUser(claims);
      
      console.log('✅ OAuth verification successful');
      verified(null, user);
    } catch (error) {
      console.error('❌ OAuth verification failed:', error);
      verified(error, null);
    }
  };

  console.log('🔍 REPLIT_DOMAINS env var:', process.env.REPLIT_DOMAINS);
  console.log('🔍 REPL_ID env var:', process.env.REPL_ID);
  console.log('🔍 SESSION_SECRET env var:', process.env.SESSION_SECRET ? 'Set' : 'Missing');
  console.log('🔍 ISSUER_URL env var:', process.env.ISSUER_URL);
  console.log('🔍 DATABASE_URL env var:', process.env.DATABASE_URL ? 'Set' : 'Missing');
  console.log('🔍 NODE_ENV env var:', process.env.NODE_ENV);
  
  let domains = process.env.REPLIT_DOMAINS!.split(",");
  
  // Fix truncated production domain (.replit.ap → .replit.app)
  domains = domains.map(domain => {
    if (domain.endsWith('.replit.ap')) {
      const fixedDomain = domain + 'p';
      console.log('🔧 Fixing truncated domain:', domain, '→', fixedDomain);
      return fixedDomain;
    }
    return domain;
  });
  
  console.log('🔧 Registering Replit Auth strategies for domains:', domains);
  
  for (const domain of domains) {
    console.log(`🔧 Registering strategy: replitauth:${domain}`);
    const protocol = domain.includes('localhost') ? 'http' : 'https';
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `${protocol}://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    let hostname = req.hostname === 'localhost' ? 'localhost:5000' : req.hostname;
    
    // Fix truncated hostname for production (.replit.ap → .replit.app)
    if (hostname.endsWith('.replit.ap')) {
      hostname = hostname + 'p';
      console.log('🔧 Fixing truncated hostname:', req.hostname, '→', hostname);
    }
    
    console.log('🔐 Login attempt for hostname:', hostname, 'Original:', req.hostname);
    passport.authenticate(`replitauth:${hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    let hostname = req.hostname === 'localhost' ? 'localhost:5000' : req.hostname;
    
    // Fix truncated hostname for production (.replit.ap → .replit.app)
    if (hostname.endsWith('.replit.ap')) {
      hostname = hostname + 'p';
      console.log('🔧 Fixing truncated hostname:', req.hostname, '→', hostname);
    }
    
    console.log('🔄 Callback attempt for hostname:', hostname, 'Original:', req.hostname);
    console.log('🔄 Request URL:', req.url);
    console.log('🔄 Request query:', req.query);
    
    passport.authenticate(`replitauth:${hostname}`, (err, user, info) => {
      console.log('🔄 Callback result - err:', err, 'user:', !!user, 'info:', info);
      
      if (err) {
        console.error('❌ Authentication error:', err);
        return res.redirect('/api/login');
      }
      
      if (!user) {
        console.error('❌ No user returned from authentication');
        return res.redirect('/api/login');
      }
      
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('❌ Login error:', loginErr);
          return res.redirect('/api/login');
        }
        
        console.log('✅ User successfully logged in, redirecting to home');
        return res.redirect('/');
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    let hostname = req.hostname;
    
    // Fix truncated hostname for production (.replit.ap → .replit.app)
    if (hostname.endsWith('.replit.ap')) {
      hostname = hostname + 'p';
      console.log('🔧 Fixing truncated logout hostname:', req.hostname, '→', hostname);
    }
    
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};