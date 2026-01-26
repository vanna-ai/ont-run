// ============================================================================
// Session Management
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string;
  groups: string[];
}

export interface Session {
  id: string;
  user: User;
  createdAt: number;
  expiresAt: number;
}

// In-memory session store (use Redis/DB in production)
const sessions = new Map<string, Session>();

// Session TTL: 24 hours
const SESSION_TTL = 24 * 60 * 60 * 1000;

// Demo users with different access levels
export const DEMO_USERS: Record<string, { password: string; user: Omit<User, "id"> }> = {
  "admin@example.com": {
    password: "admin123",
    user: {
      email: "admin@example.com",
      name: "Admin User",
      groups: ["admin", "support", "public"],
    },
  },
  "support@example.com": {
    password: "support123",
    user: {
      email: "support@example.com",
      name: "Support User",
      groups: ["support", "public"],
    },
  },
  "user@example.com": {
    password: "user123",
    user: {
      email: "user@example.com",
      name: "Public User",
      groups: ["public"],
    },
  },
};

// Generate a random session ID
function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Create a new session for a user
export function createSession(user: Omit<User, "id">): Session {
  const sessionId = generateSessionId();
  const now = Date.now();

  const session: Session = {
    id: sessionId,
    user: {
      ...user,
      id: generateSessionId().slice(0, 16),
    },
    createdAt: now,
    expiresAt: now + SESSION_TTL,
  };

  sessions.set(sessionId, session);
  return session;
}

// Get a session by ID
export function getSession(sessionId: string): Session | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  // Check if expired
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }

  return session;
}

// Delete a session
export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

// Parse session ID from cookie header
export function getSessionIdFromCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").reduce(
    (acc, cookie) => {
      const [key, value] = cookie.trim().split("=");
      if (key && value) acc[key] = value;
      return acc;
    },
    {} as Record<string, string>
  );

  return cookies["session"] || null;
}

// Create Set-Cookie header value
export function createSessionCookie(sessionId: string, maxAge?: number): string {
  const parts = [`session=${sessionId}`, "Path=/", "HttpOnly", "SameSite=Lax"];

  if (maxAge !== undefined) {
    parts.push(`Max-Age=${maxAge}`);
  } else {
    parts.push(`Max-Age=${SESSION_TTL / 1000}`);
  }

  // In production, add Secure flag
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

// Create expired cookie to clear session
export function createExpiredSessionCookie(): string {
  return createSessionCookie("", 0);
}

// Get user from request (utility function)
export function getUserFromRequest(req: Request): User | null {
  const cookieHeader = req.headers.get("cookie");
  const sessionId = getSessionIdFromCookies(cookieHeader);
  if (!sessionId) return null;

  const session = getSession(sessionId);
  return session?.user || null;
}
