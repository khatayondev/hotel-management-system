import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth";
import { successResponse, errorResponse, handleRouteError } from "@/lib/api-response";
import { sendSms } from "@/lib/sms";
import { formatPesewas } from "@/lib/money";
import { getSettings } from "@/lib/settings";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }

    const { id } = await params;
    const receipt = await prisma.receipt.findUnique({
      where: { id },
    });

    if (!receipt) {
      return errorResponse("Receipt not found", "NOT_FOUND", 404);
    }

    const settings = await getSettings();
    const hotelName = settings.hotelName || "Aura Royal Hotel";

    const msg = `${hotelName}: Receipt ${receipt.receiptNumber}. Guest: ${
      receipt.customerName
    }. Total: ${formatPesewas(receipt.totalPesewas)}. Paid: ${formatPesewas(
      receipt.amountPaidPesewas
    )}. Balance: ${formatPesewas(receipt.balanceDuePesewas)}. Thank you for choosing us!`;

    const smsRes = await sendSms({
      recipient: receipt.customerPhone,
      message: msg,
      senderId: "HotelDesk",
    });

    return successResponse({ success: true, messageId: smsRes.messageId }, "SMS receipt dispatched");
  } catch (err) {
    return handleRouteError(err);
  }
}

