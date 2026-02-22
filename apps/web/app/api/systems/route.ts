import { NextResponse } from "next/server";
import { getErrorMessage, getErrorStatus } from "@/lib/server/http-error";
import {
  createSystem,
  listSystems,
  parseSystemName,
} from "@/lib/server/systems";

export async function GET() {
  try {
    const systems = await listSystems();
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
    const body = (await req.json()) as { name?: unknown };
    const name = parseSystemName(body.name);
    const system = await createSystem(name);

    return NextResponse.json({ ok: true, system }, { status: 201 });
  } catch (error) {
    console.error("POST /api/systems failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Failed to create system.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
