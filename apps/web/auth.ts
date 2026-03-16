import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

const googleClientId = process.env.AUTH_GOOGLE_ID?.trim() ?? "";
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET?.trim() ?? "";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";

        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (user == null || user.passwordHash == null) {
          return null;
        }

        const matches = await bcrypt.compare(password, user.passwordHash);
        if (!matches) {
          return null;
        }

        return user;
      },
    }),
    ...(googleClientId !== "" && googleClientSecret !== ""
      ? [
          Google({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          }),
        ]
      : []),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user != null) {
        token.sub = user.id;
        token.gmEnabled =
          "gmEnabled" in user && typeof user.gmEnabled === "boolean" ? user.gmEnabled : false;
      }

      return token;
    },
    session({ session, token, user }) {
      const sessionUser = session.user;
      if (sessionUser != null) {
        sessionUser.id = typeof token?.sub === "string" ? token.sub : user.id;
        sessionUser.gmEnabled =
          typeof token?.gmEnabled === "boolean"
            ? token.gmEnabled
            : "gmEnabled" in user && typeof user.gmEnabled === "boolean"
              ? user.gmEnabled
              : false;
      }

      return session;
    },
  },
});
