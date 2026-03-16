import { NextResponse } from "next/server";

import { registerUser } from "@/lib/server/auth/register";
import { getErrorMessage, getErrorStatus } from "@/lib/server/http-error";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: unknown;
      email?: unknown;
      password?: unknown;
    };

    const user = await registerUser({
      name: body.name,
      email: body.email,
      password: body.password,
    });

    return NextResponse.json(
      {
        ok: true,
        user,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/auth/register failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Registration failed.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
