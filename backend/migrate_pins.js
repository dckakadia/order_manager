const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  let updatedCount = 0;

  for (const user of users) {
    // Check if the pin is already a bcrypt hash
    // bcrypt hashes start with $2a$, $2b$, or $2y$ and are 60 chars long
    if (user.pin && !user.pin.startsWith('$2')) {
      const hashedPassword = await bcrypt.hash(user.pin, 10);
      
      await prisma.user.update({
        where: { id: user.id },
        data: { pin: hashedPassword }
      });
      
      console.log(`Updated PIN hash for user: ${user.username}`);
      updatedCount++;
    } else {
      console.log(`User ${user.username} already has a hashed PIN or no PIN.`);
    }
  }
  
  console.log(`Migration completed. Updated ${updatedCount} users.`);
}

main()
  .catch(e => {
    console.error('Error during migration:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
