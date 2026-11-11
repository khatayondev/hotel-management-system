import { NextRequest } from "next/server";
import { requestRoomServiceOtp } from "@/lib/restaurant/room-service";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { validateCsrf } from "@/lib/csrf";
import { successResponse, handleRouteError } from "@/lib/api-response";
import { z } from "zod";

const requestOtpSchema = z.object({
  roomNumber: z.string().min(1, "Room number is required"),
  phone: z.string().min(9, "Ghana phone number is required"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    checkRateLimit(`rs_otp_route:${ip}`, 10, 60);
    validateCsrf(req);

    const body = await req.json();
    const parsed = requestOtpSchema.parse(body);

    const result = await requestRoomServiceOtp(parsed.roomNumber, parsed.phone, ip);

    return successResponse(
      result,
      `Verification code sent to registered phone for Room ${parsed.roomNumber}`
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
