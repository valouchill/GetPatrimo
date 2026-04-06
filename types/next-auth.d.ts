import 'next-auth';
import { DefaultSession } from 'next-auth';

export type AppRole = 'owner' | 'tenant' | 'admin' | 'superadmin';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role?: AppRole;
      totpEnabled?: boolean;
      impersonatedBy?: string;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role?: AppRole;
    totpEnabled?: boolean;
    impersonatedBy?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role?: AppRole;
    totpEnabled?: boolean;
    impersonatedBy?: string;
  }
}
