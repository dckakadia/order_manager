const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  const defaultPin = '1234';
  const hashedPassword = await bcrypt.hash(defaultPin, 10);
  
  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: { pin: hashedPassword }
    });
    console.log(`Reset PIN for ${user.username} to: ${defaultPin}`);
  }
  
  console.log('\nAll users have been reset to PIN: 1234');
}

main()
  .catch(e => {
    console.error('Error resetting pins:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
