const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log("Fetching all users from the database...\n");
  const users = await prisma.user.findMany();
  
  console.log("-------------------------------------------------");
  console.log("| ID | Username    | Role    | Active | PIN (Hash/Plain)");
  console.log("-------------------------------------------------");
  
  for (const user of users) {
    let displayPin = user.pin;
    // If it's a bcrypt hash, it starts with $2
    if (user.pin && user.pin.startsWith('$2')) {
      displayPin = "[ENCRYPTED (Cannot be read)]";
    }
    
    console.log(`| ${user.id.toString().padEnd(2)} | ${user.username.padEnd(11)} | ${user.role.padEnd(7)} | ${user.isActive ? 'Yes' : 'No'}   | ${displayPin}`);
  }
  console.log("-------------------------------------------------\n");
}

main()
  .catch(e => {
    console.error('Error fetching users:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
