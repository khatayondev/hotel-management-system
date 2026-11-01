import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { ROLES } from "../lib/rbac";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Starting full system cleanup of bookings and test data...\n");

  // 1. Delete dependent transactional records in correct order
  console.log("Deleting payment requests...");
  const deletedPaymentRequests = await prisma.paymentRequest.deleteMany({});
  console.log(`✓ Deleted ${deletedPaymentRequests.count} payment requests.`);

  console.log("Deleting receipts...");
  const deletedReceipts = await prisma.receipt.deleteMany({});
  console.log(`✓ Deleted ${deletedReceipts.count} receipts.`);

  console.log("Deleting payments...");
  const deletedPayments = await prisma.payment.deleteMany({});
  console.log(`✓ Deleted ${deletedPayments.count} payments.`);

  console.log("Deleting refunds...");
  const deletedRefunds = await prisma.refund.deleteMany({});
  console.log(`✓ Deleted ${deletedRefunds.count} refunds.`);

  console.log("Deleting booking items...");
  const deletedItems = await prisma.bookingItem.deleteMany({});
  console.log(`✓ Deleted ${deletedItems.count} items.`);

  console.log("Deleting slot holds...");
  const deletedSlotHolds = await prisma.slotHold.deleteMany({});
  console.log(`✓ Deleted ${deletedSlotHolds.count} slot holds.`);

  console.log("Deleting notification jobs queue...");
  const deletedNotifJobs = await prisma.notificationJob.deleteMany({});
  console.log(`✓ Deleted ${deletedNotifJobs.count} notification jobs.`);

  console.log("Deleting all bookings...");
  const deletedBookings = await prisma.booking.deleteMany({});
  console.log(`✓ Deleted ${deletedBookings.count} bookings.`);

  console.log("Deleting test customers...");
  const deletedCustomers = await prisma.customer.deleteMany({});
  console.log(`✓ Deleted ${deletedCustomers.count} customers.`);

  // 2. Clear old sessions & password reset tokens
  await prisma.session.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  console.log("✓ Cleared all active sessions & reset tokens.");

  // 3. Remove old test user accounts
  const deletedTestUsers = await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { contains: "staff-test-" } },
        { email: { endsWith: "@aurastudio.gh" } },
      ],
    },
  });
  console.log(`✓ Removed ${deletedTestUsers.count} old test/aura accounts.`);

  // 4. Create / Verify the 4 fresh @beccascrownbeauty.com accounts
  console.log("\n👑 Creating new operational accounts with domain @beccascrownbeauty.com...\n");

  const ownerRole = await prisma.role.findUniqueOrThrow({ where: { name: ROLES.OWNER_ADMIN } });
  const managerRole = await prisma.role.findUniqueOrThrow({ where: { name: ROLES.MANAGER } });
  const staffRole = await prisma.role.findUniqueOrThrow({ where: { name: ROLES.STAFF_RECEPTIONIST } });
  const frontDeskRole = await prisma.role.findUniqueOrThrow({ where: { name: ROLES.FRONT_DESK } });

  const accounts = [
    {
      email: "owner@beccascrownbeauty.com",
      name: "Akosua Addo (Owner)",
      phone: "+233241112233",
      roleId: ownerRole.id,
      passwordPlain: "BeccaCrown2026!Admin",
      roleName: "OWNER_ADMIN",
    },
    {
      email: "frontdesk@beccascrownbeauty.com",
      name: "Front Desk Tablet",
      phone: "+233240001122",
      roleId: frontDeskRole.id,
      passwordPlain: "FrontDesk2026!Tablet",
      roleName: "FRONT_DESK",
    },
    {
      email: "manager@beccascrownbeauty.com",
      name: "Kojo Mensah",
      phone: "+233248889900",
      roleId: managerRole.id,
      passwordPlain: "ManagerCrown2026!",
      roleName: "MANAGER",
    },
    {
      email: "reception@beccascrownbeauty.com",
      name: "Abena Serwaa",
      phone: "+233245556677",
      roleId: staffRole.id,
      passwordPlain: "ReceptionCrown2026!",
      roleName: "STAFF_RECEPTIONIST",
    },
  ];

  for (const acc of accounts) {
    const passwordHash = await hash(acc.passwordPlain);
    await prisma.user.upsert({
      where: { email: acc.email },
      update: {
        name: acc.name,
        phone: acc.phone,
        passwordHash,
        roleId: acc.roleId,
        active: true,
        deletedAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        mustChangePassword: false,
      },
      create: {
        email: acc.email,
        name: acc.name,
        phone: acc.phone,
        passwordHash,
        roleId: acc.roleId,
        active: true,
        mustChangePassword: false,
      },
    });

    console.log(`  ✓ ${acc.roleName.padEnd(20)} | ${acc.email} | Name: ${acc.name}`);
  }

  console.log("\n=======================================================");
  console.log(" 🎉 System Successfully Cleaned & New Accounts Active!");
  console.log("=======================================================\n");
}

main()
  .catch((e) => {
    console.error("❌ Cleanup error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
