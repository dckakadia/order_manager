const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = [
    { username: 'manish', pin: '7411', role: 'SALES' },
    { username: 'sunil', pin: '1234', role: 'MANAGER' },
    { username: 'devin', pin: '7930', role: 'ADMIN' },
  ];

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { username: u.username } });
    if (!existing) {
      await prisma.user.create({ data: u });
      console.log(`Created user: ${u.username}`);
    } else {
      console.log(`User already exists: ${u.username}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
