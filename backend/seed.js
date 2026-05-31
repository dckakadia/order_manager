const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
require('dotenv').config();

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
      // CRITICAL FIX: Hash PIN with bcrypt
      const hashedPin = await bcrypt.hash(u.pin, 10);
      await prisma.user.create({ 
        data: { 
          username: u.username, 
          pin: hashedPin,  // Store hashed PIN
          role: u.role 
        } 
      });
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
