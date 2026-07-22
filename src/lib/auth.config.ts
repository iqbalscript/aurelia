import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [], // providers diisi di auth.ts, bukan di sini
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
    authorized: ({ auth, request }) => {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      const isPublicPath =
        pathname.startsWith("/login") || pathname.startsWith("/api/auth");

      if (!isLoggedIn && !isPublicPath) return false;

      if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
        return auth?.user?.role === "ADMIN";
      }

      return true;
    },
  },
} satisfies NextAuthConfig;