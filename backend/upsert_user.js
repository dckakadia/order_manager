const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log('Current users:', users);

  const manish = await prisma.user.upsert({
    where: { username: 'manish' },
    update: { pin: '7411', role: 'SALES' },
    create: { username: 'manish', pin: '7411', role: 'SALES' },
  });
  console.log('Upserted user:', manish);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
