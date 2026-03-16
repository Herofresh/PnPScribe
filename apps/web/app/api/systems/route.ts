import { NextResponse } from "next/server";
import { getErrorMessage, getErrorStatus } from "@/lib/server/http-error";
import {
  createSystem,
  listSystemsForOwner,
  parseSystemName,
} from "@/lib/server/systems";
import { requireGmUser, requireSessionUser } from "@/lib/server/auth/access";

export async function GET() {
  try {
    const user = await requireSessionUser();
    const systems = await listSystemsForOwner(user.id);
    return NextResponse.json({ ok: true, systems });
  } catch (error) {
    console.error("GET /api/systems failed", error);
    return NextResponse.json(
      { ok: false, error: "Failed to load systems." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireGmUser();
    const body = (await req.json()) as { name?: unknown };
    const name = parseSystemName(body.name);
    const system = await createSystem(name, user.id);

    return NextResponse.json({ ok: true, system }, { status: 201 });
  } catch (error) {
    console.error("POST /api/systems failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Failed to create system.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
