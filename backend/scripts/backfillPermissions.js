const { PrismaClient } = require('@prisma/client');
const { getDefaultPermissions } = require('../services/permissionDefaults');

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ include: { pagePermissions: true } });
  for (const user of users) {
    if (user.pagePermissions.length > 0) {
      console.log(`Skipped ${user.username} (already has ${user.pagePermissions.length} permission rows)`);
      continue;
    }
    const defaults = getDefaultPermissions(user.role);
    await prisma.userPagePermission.createMany({
      data: defaults.map(p => ({ userId: user.id, ...p }))
    });
    console.log(`Backfilled ${defaults.length} page permissions for ${user.username} (${user.role})`);
  }
  console.log('Backfill completed successfully.');
}

main()
  .catch(e => {
    console.error('Error during backfill:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
