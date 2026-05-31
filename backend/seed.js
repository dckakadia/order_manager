const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('7411', 10);
  
  await prisma.user.upsert({
    where: { username: 'manish' },
    update: {},
    create: {
      username: 'manish',
      pin: hashedPassword,
      role: 'SALES'
    }
  });
  
  console.log('Seed completed.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
