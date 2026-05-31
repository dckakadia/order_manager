const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const users = [
    { username: 'devin', pin: '1234', role: 'ADMIN' },
    { username: 'paresh', pin: '5678', role: 'MANAGER' },
    { username: 'manish', pin: '7411', role: 'SALES' }
  ];

  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.pin, 10);
    
    await prisma.user.upsert({
      where: { username: user.username },
      update: {
        pin: hashedPassword,
        role: user.role,
        isActive: true
      },
      create: {
        username: user.username,
        pin: hashedPassword,
        role: user.role,
        isActive: true
      }
    });
    console.log(`Upserted user: ${user.username} (Role: ${user.role})`);
  }
  
  console.log('Seed completed successfully.');
}

main()
  .catch(e => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
