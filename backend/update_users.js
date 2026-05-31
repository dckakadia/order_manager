const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
require('dotenv').config();

const prisma = new PrismaClient();

async function updateUsers() {
  try {
    // CRITICAL FIX: Hash PINs with bcrypt before storing
    const hashedPin7930 = await bcrypt.hash('7930', 10);
    const hashedPin1234 = await bcrypt.hash('1234', 10);
    const hashedPin7411 = await bcrypt.hash('7411', 10);

    // admin-1234 -> devin-7930
    await prisma.user.upsert({
      where: { username: 'devin' },
      update: { pin: hashedPin7930 },
      create: { username: 'devin', pin: hashedPin7930, role: 'ADMIN' }
    });
    
    // manager-1234 -> sunil-1234
    await prisma.user.upsert({
      where: { username: 'sunil' },
      update: { pin: hashedPin1234 },
      create: { username: 'sunil', pin: hashedPin1234, role: 'MANAGER' }
    });
    
    // sales-1234 -> manish-7411
    await prisma.user.upsert({
      where: { username: 'manish' },
      update: { pin: hashedPin7411 },
      create: { username: 'manish', pin: hashedPin7411, role: 'SALES' }
    });
    
    console.log('Users updated successfully with hashed PINs.');
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

updateUsers();
