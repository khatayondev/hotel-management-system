import { PrismaClient, DepositType } from "@prisma/client";

const prisma = new PrismaClient();

interface ServiceDef {
  name: string;
  durationMin: number;
  pricePesewas: number;
  description: string;
}

interface CategoryDef {
  name: string;
  slug: string;
  description: string;
  services: ServiceDef[];
}

const MENU: CategoryDef[] = [
  {
    name: "Lashes",
    slug: "lashes",
    description: "Premium lash extensions crafted for lasting elegance and eye-framing beauty.",
    services: [
      {
        name: "Classic Lashes",
        durationMin: 60,
        pricePesewas: 14000, // GH₵ 140.00
        description: "Natural 1:1 extension application providing subtle, everyday definition and length. (1 hour)",
      },
      {
        name: "Hybrid Lashes",
        durationMin: 90,
        pricePesewas: 17000, // GH₵ 170.00
        description: "Seamless blend of classic and volume fans for textured, wispy fullness. (1 hour 30 mins)",
      },
      {
        name: "Volume Lashes",
        durationMin: 90,
        pricePesewas: 20000, // GH₵ 200.00
        description: "Lush multi-lash handmade fans delivering dramatic, fluffy volume. (1 hour 30 mins)",
      },
      {
        name: "Wispy Lashes",
        durationMin: 110,
        pricePesewas: 20000, // GH₵ 200.00
        description: "Kim-K style staggered lengths with eye-catching spiky peaks. (1 hour 50 mins)",
      },
      {
        name: "Mega Volume Lashes",
        durationMin: 120,
        pricePesewas: 26000, // GH₵ 260.00
        description: "Ultra-dark, maximum density fans crafted with super-fine lightweight fibers. (2 hours)",
      },
    ],
  },
  {
    name: "Fashion Braces",
    slug: "fashion-braces",
    description: "Trendy aesthetic fashion dental accessories and styling.",
    services: [
      {
        name: "Power Chain",
        durationMin: 30,
        pricePesewas: 30000, // GH₵ 300.00
        description: "Continuous connected aesthetic color chain for vibrant statement smiles. (30 mins)",
      },
      {
        name: "Ligature",
        durationMin: 30,
        pricePesewas: 20000, // GH₵ 200.00
        description: "Individual aesthetic fashion colored elastic ties in custom shades. (30 mins)",
      },
    ],
  },
  {
    name: "Pedicure",
    slug: "pedicure",
    description: "Therapeutic foot care, cuticle rejuvenation, and luxury exfoliating treatments.",
    services: [
      {
        name: "Regular Pedicure",
        durationMin: 60,
        pricePesewas: 12000, // GH₵ 120.00
        description: "Foot soak, nail shaping, cuticle cleanup, scrub, massage, and polish. (1 hour)",
      },
      {
        name: "Jelly Pedicure",
        durationMin: 90,
        pricePesewas: 16000, // GH₵ 160.00
        description: "Ultra-hydrating gel bath that locks in heat and moisture, followed by deep massage. (1 hour 30 mins)",
      },
    ],
  },
  {
    name: "Facials",
    slug: "facials",
    description: "Deep-cleansing, glow-restoring skincare and targeted blemish treatments.",
    services: [
      {
        name: "Dermaplaning",
        durationMin: 90,
        pricePesewas: 15000, // GH₵ 150.00
        description: "Precision medical-grade blade exfoliation removing dead skin cells and peach fuzz for glass skin. (1 hour 30 mins)",
      },
      {
        name: "Acne Treatment",
        durationMin: 120,
        pricePesewas: 25000, // GH₵ 250.00
        description: "Intensive deep-pore extraction, antibacterial high-frequency therapy, and clarifying mask. (2 hours)",
      },
    ],
  },
  {
    name: "Hair Installation",
    slug: "hair-installation",
    description: "Flawless lace melts, customization, and long-lasting protective styling.",
    services: [
      {
        name: "Full Frontal",
        durationMin: 90,
        pricePesewas: 16000, // GH₵ 160.00
        description: "Ear-to-ear HD lace frontal custom plucked, bleached, melted, and styled to perfection. (1 hour 30 mins)",
      },
      {
        name: "Closure",
        durationMin: 60,
        pricePesewas: 10000, // GH₵ 100.00
        description: "Lace closure installation with invisible parting, baby hair styling, and clean finish. (1 hour)",
      },
      {
        name: "Frontal Pony",
        durationMin: 150,
        pricePesewas: 20000, // GH₵ 200.00
        description: "Sleek snatched frontal ponytail installation with 360 perimeter melt. (2 hours 30 mins)",
      },
    ],
  },
  {
    name: "Makeup & Bridal Glam",
    slug: "makeup",
    description: "Flawless red-carpet glam, bridal beauty, and photo-ready transformations.",
    services: [
      {
        name: "Bridal Soft Glam",
        durationMin: 90,
        pricePesewas: 55000, // GH₵ 550.00
        description: "Skin-prep, HD waterproof foundation, custom lash clusters, and touch-up kit. (1 hour 30 mins)",
      },
    ],
  },
  {
    name: "Hair Styling & Braids",
    slug: "hair",
    description: "Signature protective braids, knotless styles, and trendsetting extensions.",
    services: [
      {
        name: "Goddess Knotless Braids (Mid-Back)",
        durationMin: 180,
        pricePesewas: 35000, // GH₵ 350.00
        description: "Painless knotless technique with human hair curls attached. (3 hours)",
      },
    ],
  },
];

async function main() {
  console.log("=====================================================");
  console.log(" 🌺 Aura Studio - Updating Services & Solo Stylist");
  console.log("=====================================================\n");

  // 1. Identify primary/owner staff member
  let primaryStaff = await prisma.staff.findFirst({
    where: { active: true, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  if (!primaryStaff) {
    console.log("Creating primary studio owner stylist...");
    primaryStaff = await prisma.staff.create({
      data: {
        name: "Akosua Addo (Lead Artist)",
        phone: "+233241112233",
        bio: "Founder, Certified Lash Technician, Skincare & Hair Installation Specialist.",
        active: true,
      },
    });
  } else {
    console.log(`Primary Solo Stylist: "${primaryStaff.name}" (${primaryStaff.id})`);
  }

  // Deactivate any secondary staff so only 1 solo stylist is active for now
  const secondaryStaff = await prisma.staff.updateMany({
    where: {
      id: { not: primaryStaff.id },
      active: true,
    },
    data: {
      active: false,
    },
  });
  console.log(`Set ${secondaryStaff.count} secondary staff members to inactive (Solo Shop Mode).`);

  // Ensure primary staff has full working schedules Monday - Saturday (9am to 7pm)
  console.log("Configuring working schedules for solo stylist (Mon - Sat, 09:00 - 19:00)...");
  for (let weekday = 1; weekday <= 6; weekday++) {
    const existing = await prisma.staffSchedule.findFirst({
      where: { staffId: primaryStaff.id, weekday },
    });
    if (existing) {
      await prisma.staffSchedule.update({
        where: { id: existing.id },
        data: {
          startTime: "09:00",
          endTime: "19:00",
          isDayOff: false,
          active: true,
        },
      });
    } else {
      await prisma.staffSchedule.create({
        data: {
          staffId: primaryStaff.id,
          weekday,
          startTime: "09:00",
          endTime: "19:00",
          isDayOff: false,
          active: true,
        },
      });
    }
  }

  // Soft-deactivate previous demo services that don't match the new catalog
  const allNewServiceNames = MENU.flatMap((cat) => cat.services.map((s) => s.name));
  await prisma.service.updateMany({
    where: {
      name: { notIn: allNewServiceNames },
    },
    data: {
      active: false,
    },
  });

  // Soft-delete test categories not in the MENU
  const allNewCategorySlugs = MENU.map((c) => c.slug);
  await prisma.serviceCategory.updateMany({
    where: {
      slug: { notIn: allNewCategorySlugs },
    },
    data: {
      deletedAt: new Date(),
    },
  });

  // 2. Upsert Categories and Services
  for (let catIdx = 0; catIdx < MENU.length; catIdx++) {
    const catDef = MENU[catIdx];
    console.log(`\n📂 Category: ${catDef.name} (${catDef.slug})`);

    const category = await prisma.serviceCategory.upsert({
      where: { slug: catDef.slug },
      update: {
        name: catDef.name,
        description: catDef.description,
        order: catIdx + 1,
        deletedAt: null,
      },
      create: {
        name: catDef.name,
        slug: catDef.slug,
        description: catDef.description,
        order: catIdx + 1,
      },
    });

    for (let sIdx = 0; sIdx < catDef.services.length; sIdx++) {
      const sDef = catDef.services[sIdx];
      
      // Check existing service
      const existingService = await prisma.service.findFirst({
        where: { name: sDef.name },
      });

      let service;
      if (existingService) {
        service = await prisma.service.update({
          where: { id: existingService.id },
          data: {
            categoryId: category.id,
            durationMin: sDef.durationMin,
            bufferMin: 15, // 15-minute buffer between client bookings
            pricePesewas: sDef.pricePesewas,
            description: sDef.description,
            active: true,
            deletedAt: null,
            order: sIdx + 1,
            depositType: DepositType.PERCENTAGE,
            depositValue: 30, // 30% booking deposit standard
          },
        });
      } else {
        service = await prisma.service.create({
          data: {
            name: sDef.name,
            categoryId: category.id,
            durationMin: sDef.durationMin,
            bufferMin: 15,
            pricePesewas: sDef.pricePesewas,
            description: sDef.description,
            active: true,
            order: sIdx + 1,
            depositType: DepositType.PERCENTAGE,
            depositValue: 30,
          },
        });
      }

      // Link to solo stylist
      await prisma.staffService.upsert({
        where: {
          staffId_serviceId: {
            staffId: primaryStaff.id,
            serviceId: service.id,
          },
        },
        update: {},
        create: {
          staffId: primaryStaff.id,
          serviceId: service.id,
        },
      });

      console.log(`  ✓ ${service.name.padEnd(25)} | ${sDef.durationMin}m | GH₵ ${(sDef.pricePesewas / 100).toFixed(2)}`);
    }
  }

  console.log("\n=====================================================");
  console.log(" 🎉 All Services Updated & Assigned to Solo Stylist!");
  console.log("=====================================================\n");
}

main()
  .catch((e) => {
    console.error("❌ Error updating services:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
