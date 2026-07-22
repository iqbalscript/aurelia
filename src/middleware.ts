import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  return; // logic redirect sudah dipindah ke callback `authorized`
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};