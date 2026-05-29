const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateUsers() {
  try {
    // admin-1234 -> devin-7930
    await prisma.user.update({
      where: { username: 'admin' },
      data: { username: 'devin', pin: '7930' }
    });
    
    // manager-1234 -> sunil-1234
    await prisma.user.update({
      where: { username: 'manager' },
      data: { username: 'sunil', pin: '1234' }
    });
    
    // sales-1234 -> manish-7411
    await prisma.user.update({
      where: { username: 'sales' },
      data: { username: 'manish', pin: '7411' }
    });
    console.log('Users updated successfully.');
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

updateUsers();
