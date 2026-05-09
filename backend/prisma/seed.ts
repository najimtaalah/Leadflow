import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEED_PASSWORD = "Test1234!";

async function main() {
  const hash = await bcrypt.hash(SEED_PASSWORD, 12);

  const users = [
    { email: "commercial@test.fr", firstName: "Alice", lastName: "Martin", role: Role.COMMERCIAL },
    { email: "closer@test.fr", firstName: "Bob", lastName: "Dupont", role: Role.CLOSER },
    { email: "gestionnaire@test.fr", firstName: "Claire", lastName: "Bernard", role: Role.GESTIONNAIRE },
    { email: "admin@test.fr", firstName: "David", lastName: "Petit", role: Role.ADMIN },
    { email: "superadmin@test.fr", firstName: "Eva", lastName: "Durand", role: Role.SUPER_ADMIN },
  ];

  for (const userData of users) {
    await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        ...userData,
        passwordHash: hash,
      },
    });
    console.log(`✓ User ${userData.email} (${userData.role})`);
  }

  console.log("Seed terminé — 5 comptes de test créés.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
