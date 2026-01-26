// ============================================================================
// Auth Routes
// ============================================================================

import {
  DEMO_USERS,
  createSession,
  createSessionCookie,
  createExpiredSessionCookie,
  getSessionIdFromCookies,
  getSession,
  deleteSession,
} from "./session";

// POST /api/auth/login
export async function handleLogin(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return Response.json({ error: "Email and password are required" }, { status: 400 });
    }

    const demoUser = DEMO_USERS[email];
    if (!demoUser || demoUser.password !== password) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const session = createSession(demoUser.user);

    return new Response(
      JSON.stringify({
        user: session.user,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": createSessionCookie(session.id),
        },
      }
    );
  } catch (error) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}

// POST /api/auth/logout
export async function handleLogout(req: Request): Promise<Response> {
  const cookieHeader = req.headers.get("cookie");
  const sessionId = getSessionIdFromCookies(cookieHeader);

  if (sessionId) {
    deleteSession(sessionId);
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": createExpiredSessionCookie(),
    },
  });
}

// GET /api/auth/me
export async function handleMe(req: Request): Promise<Response> {
  const cookieHeader = req.headers.get("cookie");
  const sessionId = getSessionIdFromCookies(cookieHeader);

  if (!sessionId) {
    return Response.json({ user: null }, { status: 200 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return new Response(JSON.stringify({ user: null }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": createExpiredSessionCookie(),
      },
    });
  }

  return Response.json({ user: session.user }, { status: 200 });
}
