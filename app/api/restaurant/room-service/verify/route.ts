import { NextRequest } from "next/server";
import { verifyRoomServiceOtp } from "@/lib/restaurant/room-service";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { validateCsrf } from "@/lib/csrf";
import { successResponse, handleRouteError } from "@/lib/api-response";
import { z } from "zod";

const verifyOtpSchema = z.object({
  roomNumber: z.string().min(1, "Room number is required"),
  phone: z.string().min(9, "Phone number is required"),
  code: z.string().length(6, "Verification code must be 6 digits"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    checkRateLimit(`rs_verify_route:${ip}`, 10, 60);
    validateCsrf(req);

    const body = await req.json();
    const parsed = verifyOtpSchema.parse(body);

    const result = verifyRoomServiceOtp(parsed.roomNumber, parsed.phone, parsed.code);

    return successResponse(
      result,
      `Room ${parsed.roomNumber} verified. You can now order room service charged to your folio.`
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
