import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-response";
import { createHold, releaseHold } from "@/lib/hotel/holds";
import { createHoldSchema } from "@/lib/hotel/types";
import { z } from "zod";

const releaseHoldSchema = z.object({
  token: z.string().min(1, "Hold token is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createHoldSchema.parse(body);
    const hold = await createHold(parsed);
    return successResponse(hold, "Room hold created", 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = releaseHoldSchema.parse(body);
    const released = await releaseHold(parsed.token);
    return successResponse({ released }, "Room hold released");
  } catch (err) {
    return handleRouteError(err);
  }
}
