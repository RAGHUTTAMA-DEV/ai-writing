import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from '../prisma/index';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists with this Google ID
        let user = await prisma.user.findUnique({
          where: { googleId: profile.id },
        });

        if (user) {
          // User exists, return the user
          return done(null, user);
        }

        // Check if user exists with same email
        const existingEmailUser = await prisma.user.findUnique({
          where: { email: profile.emails?.[0]?.value },
        });

        if (existingEmailUser) {
          // Link Google account to existing email user
          user = await prisma.user.update({
            where: { email: profile.emails?.[0]?.value },
            data: { googleId: profile.id },
          });
          return done(null, user);
        }

        // Create new user
        const email = profile.emails?.[0]?.value;
        const firstName = profile.name?.givenName || '';
        const lastName = profile.name?.familyName || '';
        const avatar = profile.photos?.[0]?.value || '';

        if (!email) {
          return done(new Error('No email found in Google profile'), false);
        }

        // Generate a unique username from email or Google display name
        let username = profile.displayName?.replace(/\s+/g, '').toLowerCase() || 
                      email.split('@')[0].toLowerCase();
        
        // Ensure username is unique
        let usernameExists = await prisma.user.findUnique({
          where: { username },
        });
        
        let counter = 1;
        const originalUsername = username;
        while (usernameExists) {
          username = `${originalUsername}${counter}`;
          usernameExists = await prisma.user.findUnique({
            where: { username },
          });
          counter++;
        }

        user = await prisma.user.create({
          data: {
            email,
            username,
            googleId: profile.id,
            firstName,
            lastName,
            avatar,
            password: null, // No password for OAuth users
          },
        });

        return done(null, user);
      } catch (error) {
        console.error('Google OAuth error:', error);
        return done(error, false);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        bio: true,
        avatar: true,
        role: true,
        googleId: true,
      },
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
