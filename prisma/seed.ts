import {
  PrismaClient,
  DepositType,
  BookingStatus,
  BookingSource,
  PaymentStatus,
} from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { PERMISSION_KEYS, DEFAULT_ROLE_PERMISSIONS, ROLES } from "../lib/rbac";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Seed Roles
  const ownerRole = await prisma.role.upsert({
    where: { name: ROLES.OWNER_ADMIN },
    update: {},
    create: {
      name: ROLES.OWNER_ADMIN,
      description: "Full administrative and financial access to the studio",
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { name: ROLES.MANAGER },
    update: {},
    create: {
      name: ROLES.MANAGER,
      description: "Operational manager for bookings, staff shifts, POS, and inventory",
    },
  });

  const staffRole = await prisma.role.upsert({
    where: { name: ROLES.STAFF_RECEPTIONIST },
    update: {},
    create: {
      name: ROLES.STAFF_RECEPTIONIST,
      description: "Service staff member and stylist",
    },
  });

  const frontDeskRole = await prisma.role.upsert({
    where: { name: ROLES.FRONT_DESK },
    update: {
      description: "Front desk tablet terminal: appointments board, check-in, walk-in POS, and customer contact",
    },
    create: {
      name: ROLES.FRONT_DESK,
      description: "Front desk tablet terminal: appointments board, check-in, walk-in POS, and customer contact",
    },
  });

  // 2. Seed Permissions
  const allPermissions = Object.values(PERMISSION_KEYS);
  for (const permName of allPermissions) {
    const perm = await prisma.permission.upsert({
      where: { name: permName },
      update: {},
      create: {
        name: permName,
        description: `Permission to ${permName}`,
      },
    });

    // Owner gets all
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: ownerRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: ownerRole.id,
        permissionId: perm.id,
      },
    });

    // Manager default permissions
    if (DEFAULT_ROLE_PERMISSIONS[ROLES.MANAGER].includes(permName)) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: managerRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: managerRole.id,
          permissionId: perm.id,
        },
      });
    }

    // Staff default permissions
    if (DEFAULT_ROLE_PERMISSIONS[ROLES.STAFF_RECEPTIONIST].includes(permName)) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: staffRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: staffRole.id,
          permissionId: perm.id,
        },
      });
    }

    // Front Desk default permissions
    if (DEFAULT_ROLE_PERMISSIONS[ROLES.FRONT_DESK].includes(permName)) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: frontDeskRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: frontDeskRole.id,
          permissionId: perm.id,
        },
      });
    }
  }

  // 3. Seed Users with Argon2id hash
  const ownerPasswordHash = await hash("BeccaCrown2026!Admin");
  const ownerUser = await prisma.user.upsert({
    where: { email: "owner@beccascrownbeauty.com" },
    update: {
      passwordHash: ownerPasswordHash,
      phone: "+233241112233",
      name: "Akosua Addo (Owner)",
      active: true,
      deletedAt: null,
      roleId: ownerRole.id,
    },
    create: {
      email: "owner@beccascrownbeauty.com",
      phone: "+233241112233",
      name: "Akosua Addo (Owner)",
      passwordHash: ownerPasswordHash,
      roleId: ownerRole.id,
      mustChangePassword: false,
      active: true,
    },
  });

  const staffPasswordHash = await hash("ReceptionCrown2026!");
  await prisma.user.upsert({
    where: { email: "reception@beccascrownbeauty.com" },
    update: {
      passwordHash: staffPasswordHash,
      phone: "+233245556677",
      name: "Abena Serwaa",
      active: true,
      deletedAt: null,
      roleId: staffRole.id,
    },
    create: {
      email: "reception@beccascrownbeauty.com",
      phone: "+233245556677",
      name: "Abena Serwaa",
      passwordHash: staffPasswordHash,
      roleId: staffRole.id,
      mustChangePassword: false,
      active: true,
    },
  });

  const frontDeskPasswordHash = await hash("FrontDesk2026!Tablet");
  await prisma.user.upsert({
    where: { email: "frontdesk@beccascrownbeauty.com" },
    update: {
      passwordHash: frontDeskPasswordHash,
      phone: "+233240001122",
      name: "Front Desk Tablet",
      active: true,
      deletedAt: null,
      roleId: frontDeskRole.id,
    },
    create: {
      email: "frontdesk@beccascrownbeauty.com",
      phone: "+233240001122",
      name: "Front Desk Tablet",
      passwordHash: frontDeskPasswordHash,
      roleId: frontDeskRole.id,
      mustChangePassword: false,
      active: true,
    },
  });

  const managerPasswordHash = await hash("ManagerCrown2026!");
  await prisma.user.upsert({
    where: { email: "manager@beccascrownbeauty.com" },
    update: {
      passwordHash: managerPasswordHash,
      phone: "+233248889900",
      name: "Kojo Mensah",
      active: true,
      deletedAt: null,
      roleId: managerRole.id,
    },
    create: {
      email: "manager@beccascrownbeauty.com",
      phone: "+233248889900",
      name: "Kojo Mensah",
      passwordHash: managerPasswordHash,
      roleId: managerRole.id,
      mustChangePassword: false,
      active: true,
    },
  });

  // 4. Seed Categories
  const makeupCat = await prisma.serviceCategory.upsert({
    where: { slug: "makeup" },
    update: {},
    create: {
      name: "Makeup & Bridal Glam",
      slug: "makeup",
      description: "Professional makeup for weddings, events, photoshoots, and natural glam.",
    },
  });

  const lashCat = await prisma.serviceCategory.upsert({
    where: { slug: "lash-tech" },
    update: {},
    create: {
      name: "Lash Tech & Brow Art",
      slug: "lash-tech",
      description: "Classic, hybrid, and mega volume eyelash extensions and microshading.",
    },
  });

  const hairCat = await prisma.serviceCategory.upsert({
    where: { slug: "hair" },
    update: {},
    create: {
      name: "Hair Styling & Braids",
      slug: "hair",
      description: "Knotless braids, luxury wig installs, silk presses, and treatments.",
    },
  });

  const dressCat = await prisma.serviceCategory.upsert({
    where: { slug: "dress-and-fashion" },
    update: {},
    create: {
      name: "Dress & Fashion Rental",
      slug: "dress-and-fashion",
      description: "Designer evening gowns, luxury bridal robes, and traditional fashion rentals.",
    },
  });

  // 5. Seed Services (idempotent find or create)
  let bridalMakeup = await prisma.service.findFirst({ where: { name: "Bridal Soft Glam" } });
  if (!bridalMakeup) {
    bridalMakeup = await prisma.service.create({
      data: {
        name: "Bridal Soft Glam",
        categoryId: makeupCat.id,
        description: "Skin-prep, HD waterproof foundation, custom lash clusters, and touch-up kit.",
        durationMin: 90,
        bufferMin: 15,
        pricePesewas: 55000, // GH₵ 550.00
        depositType: DepositType.PERCENTAGE,
        depositValue: 30, // 30% deposit
      },
    });
  }

  let hybridLashes = await prisma.service.findFirst({ where: { name: "Hybrid Volume Lash Full Set" } });
  if (!hybridLashes) {
    hybridLashes = await prisma.service.create({
      data: {
        name: "Hybrid Volume Lash Full Set",
        categoryId: lashCat.id,
        description: "Full textured mix of classic individual lashes and volume fans.",
        durationMin: 90,
        bufferMin: 15,
        pricePesewas: 28000, // GH₵ 280.00
        depositType: DepositType.PERCENTAGE,
        depositValue: 30,
      },
    });
  }

  let knotlessBraids = await prisma.service.findFirst({ where: { name: "Goddess Knotless Braids (Mid-Back)" } });
  if (!knotlessBraids) {
    knotlessBraids = await prisma.service.create({
      data: {
        name: "Goddess Knotless Braids (Mid-Back)",
        categoryId: hairCat.id,
        description: "Painless knotless technique with human hair curly curls attached.",
        durationMin: 180,
        bufferMin: 30,
        pricePesewas: 35000, // GH₵ 350.00
        depositType: DepositType.PERCENTAGE,
        depositValue: 30,
      },
    });
  }

  let dressRental = await prisma.service.findFirst({ where: { name: "Luxury Emerald Velvet Evening Gown" } });
  if (!dressRental) {
    dressRental = await prisma.service.create({
      data: {
        name: "Luxury Emerald Velvet Evening Gown",
        categoryId: dressCat.id,
        description: "3-day weekend gala rental including complimentary dry cleaning and fitting.",
        durationMin: 60,
        bufferMin: 30,
        pricePesewas: 45000, // GH₵ 450.00
        depositType: DepositType.FULL, // Full rental deposit
        depositValue: 100,
      },
    });
  }

  // 5b. Seed Live Studio Menu (5 Categories, 14 Services)
  const studioMenu = [
    {
      name: "Lashes",
      slug: "lashes",
      description: "Premium lash extensions crafted for lasting elegance.",
      services: [
        { name: "Classic Lashes", durationMin: 60, pricePesewas: 14000, desc: "Natural 1:1 extension application. (1 hour)" },
        { name: "Hybrid Lashes", durationMin: 90, pricePesewas: 17000, desc: "Seamless blend of classic and volume fans. (1 hour 30 mins)" },
        { name: "Volume Lashes", durationMin: 90, pricePesewas: 20000, desc: "Lush multi-lash handmade fans. (1 hour 30 mins)" },
        { name: "Wispy Lashes", durationMin: 110, pricePesewas: 20000, desc: "Kim-K style staggered lengths with spiky peaks. (1 hour 50 mins)" },
        { name: "Mega Volume Lashes", durationMin: 120, pricePesewas: 26000, desc: "Ultra-dark, maximum density fans. (2 hours)" },
      ],
    },
    {
      name: "Fashion Braces",
      slug: "fashion-braces",
      description: "Trendy aesthetic fashion dental accessories.",
      services: [
        { name: "Power Chain", durationMin: 30, pricePesewas: 30000, desc: "Continuous connected aesthetic color chain. (30 mins)" },
        { name: "Ligature", durationMin: 30, pricePesewas: 20000, desc: "Individual aesthetic fashion colored elastic ties. (30 mins)" },
      ],
    },
    {
      name: "Pedicure",
      slug: "pedicure",
      description: "Therapeutic foot care and luxury exfoliating treatments.",
      services: [
        { name: "Regular Pedicure", durationMin: 60, pricePesewas: 12000, desc: "Foot soak, shaping, cuticle cleanup, scrub, polish. (1 hour)" },
        { name: "Jelly Pedicure", durationMin: 90, pricePesewas: 16000, desc: "Ultra-hydrating gel bath with deep massage. (1 hour 30 mins)" },
      ],
    },
    {
      name: "Facials",
      slug: "facials",
      description: "Deep-cleansing, glow-restoring skincare.",
      services: [
        { name: "Dermaplaning", durationMin: 90, pricePesewas: 15000, desc: "Precision blade exfoliation removing dead skin cells. (1 hour 30 mins)" },
        { name: "Acne Treatment", durationMin: 120, pricePesewas: 25000, desc: "Deep-pore extraction and high-frequency therapy. (2 hours)" },
      ],
    },
    {
      name: "Hair Installation",
      slug: "hair-installation",
      description: "Flawless lace melts, customization, and protective styling.",
      services: [
        { name: "Full Frontal", durationMin: 90, pricePesewas: 16000, desc: "Ear-to-ear HD lace frontal custom plucked and styled. (1 hour 30 mins)" },
        { name: "Closure", durationMin: 60, pricePesewas: 10000, desc: "Lace closure installation with invisible parting. (1 hour)" },
        { name: "Frontal Pony", durationMin: 150, pricePesewas: 20000, desc: "Sleek frontal ponytail installation with 360 melt. (2 hours 30 mins)" },
      ],
    },
  ];

  const allStudioServices = [];
  for (let cIdx = 0; cIdx < studioMenu.length; cIdx++) {
    const cDef = studioMenu[cIdx];
    const cat = await prisma.serviceCategory.upsert({
      where: { slug: cDef.slug },
      update: { name: cDef.name, description: cDef.description, order: cIdx + 1, deletedAt: null },
      create: { name: cDef.name, slug: cDef.slug, description: cDef.description, order: cIdx + 1 },
    });

    for (let sIdx = 0; sIdx < cDef.services.length; sIdx++) {
      const sDef = cDef.services[sIdx];
      const existing = await prisma.service.findFirst({ where: { name: sDef.name } });
      let svc;
      if (existing) {
        svc = await prisma.service.update({
          where: { id: existing.id },
          data: {
            categoryId: cat.id,
            durationMin: sDef.durationMin,
            bufferMin: 15,
            pricePesewas: sDef.pricePesewas,
            description: sDef.desc,
            active: true,
            deletedAt: null,
            order: sIdx + 1,
            depositType: DepositType.PERCENTAGE,
            depositValue: 30,
          },
        });
      } else {
        svc = await prisma.service.create({
          data: {
            name: sDef.name,
            categoryId: cat.id,
            durationMin: sDef.durationMin,
            bufferMin: 15,
            pricePesewas: sDef.pricePesewas,
            description: sDef.desc,
            active: true,
            order: sIdx + 1,
            depositType: DepositType.PERCENTAGE,
            depositValue: 30,
          },
        });
      }
      allStudioServices.push(svc);
    }
  }

  // 6. Seed Staff and Schedules (idempotent)
  const staff1 = await prisma.staff.upsert({
    where: { userId: ownerUser.id },
    update: { phone: "+233241112233", active: true },
    create: {
      name: "Akosua Addo",
      phone: "+233241112233",
      bio: "Master Lash Technician, Skincare Specialist & Studio Founder.",
      userId: ownerUser.id,
      active: true,
    },
  });

  // Assign bridalMakeup and all studio services to staff1
  await prisma.staffService.upsert({
    where: { staffId_serviceId: { staffId: staff1.id, serviceId: bridalMakeup.id } },
    update: {},
    create: { staffId: staff1.id, serviceId: bridalMakeup.id },
  });

  for (const svc of allStudioServices) {
    await prisma.staffService.upsert({
      where: { staffId_serviceId: { staffId: staff1.id, serviceId: svc.id } },
      update: {},
      create: { staffId: staff1.id, serviceId: svc.id },
    });
  }

  let staff2 = await prisma.staff.findFirst({ where: { phone: "+233504445566" } });
  if (!staff2) {
    staff2 = await prisma.staff.create({
      data: {
        name: "Yaa Asantewaa",
        phone: "+233504445566",
        bio: "Senior Hairstylist and Braiding Specialist.",
        staffServices: {
          create: [{ serviceId: knotlessBraids.id }],
        },
      },
    });
  }

  let staff3 = await prisma.staff.findFirst({ where: { phone: "+233207778899" } });
  if (!staff3) {
    staff3 = await prisma.staff.create({
      data: {
        name: "Jessica Kyei",
        phone: "+233207778899",
        bio: "Certified Eyelash Technician & Brow Artist.",
        staffServices: {
          create: [{ serviceId: hybridLashes.id }],
        },
      },
    });
  }

  // Seed weekly schedules (Monday = 1 through Saturday = 6 from 09:00 to 18:00)
  const staffMembers = [staff1, staff2, staff3];
  for (const staff of staffMembers) {
    for (let weekday = 1; weekday <= 6; weekday++) {
      const existing = await prisma.staffSchedule.findFirst({
        where: { staffId: staff.id, weekday },
      });
      if (!existing) {
        await prisma.staffSchedule.create({
          data: {
            staffId: staff.id,
            weekday,
            startTime: "09:00",
            endTime: "18:00",
          },
        });
      }
    }
  }

  // 7. Seed Default Settings & Receipt Counter
  await prisma.setting.upsert({
    where: { key: "salon_name" },
    update: {
      value: "Becca's Crown Beauty Vault",
    },
    create: {
      key: "salon_name",
      value: "Becca's Crown Beauty Vault",
      description: "Official business trade name",
    },
  });

  if (process.env.RESEND_API_KEY) {
    await prisma.setting.upsert({
      where: { key: "resend_api_key" },
      update: {
        value: process.env.RESEND_API_KEY,
      },
      create: {
        key: "resend_api_key",
        value: process.env.RESEND_API_KEY,
        description: "Resend Transactional Email API Key",
      },
    });
  }

  await prisma.setting.upsert({
    where: { key: "slot_hold_minutes" },
    update: {},
    create: {
      key: "slot_hold_minutes",
      value: "10",
      description: "Minutes a customer can hold a booking slot during payment",
    },
  });

  await prisma.receiptCounter.upsert({
    where: { prefix: "RCP-2026" },
    update: {},
    create: {
      prefix: "RCP-2026",
      lastNumber: 1000,
    },
  });

  // 8. Seed Customers
  const customer1 = await prisma.customer.upsert({
    where: { phone: "+233245551234" },
    update: {},
    create: {
      name: "Ama Pokuaa",
      phone: "+233245551234",
      email: "ama.pokuaa@gmail.com",
    },
  });

  const customer2 = await prisma.customer.upsert({
    where: { phone: "+233509987766" },
    update: {},
    create: {
      name: "Serwaa Boateng",
      phone: "+233509987766",
      email: "serwaa.b@yahoo.com",
    },
  });

  const customer3 = await prisma.customer.upsert({
    where: { phone: "+233204456677" },
    update: {},
    create: {
      name: "Abena Osei",
      phone: "+233204456677",
      email: "abena.osei@outlook.com",
    },
  });

  const customer4 = await prisma.customer.upsert({
    where: { phone: "+233271122334" },
    update: {},
    create: {
      name: "Efua Mensah",
      phone: "+233271122334",
      email: "efua.m@gmail.com",
    },
  });

  const customer5 = await prisma.customer.upsert({
    where: { phone: "+233543344556" },
    update: {},
    create: {
      name: "Nana Yaa Asare",
      phone: "+233543344556",
      email: "nanayaa@gmail.com",
    },
  });

  console.log("✅ Seed completed successfully with clean operational catalogue!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
