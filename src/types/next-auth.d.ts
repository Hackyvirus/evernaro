import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    orgId?: string;
    orgSlug?: string;
    orgName?: string;
    role?: string;
    isPlatformAdmin?: boolean;
  }

  interface Session {
    user: {
      id: string;
      orgId?: string;
      orgSlug?: string;
      orgName?: string;
      role?: string;
      isPlatformAdmin?: boolean;
      ev?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    orgId?: string;
    orgSlug?: string;
    orgName?: string;
    role?: string;
    isPlatformAdmin?: boolean;
    ev?: boolean;
  }
}
