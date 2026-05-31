const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration to link existing orders to Master records...');

  const orders = await prisma.order.findMany();
  let updatedCount = 0;

  for (const order of orders) {
    let customerId = order.customerId;
    let itemId = order.itemId;

    // Find customer by name if not already linked
    if (!customerId && order.customerName) {
      const customer = await prisma.customer.findFirst({
        where: { name: order.customerName }
      });
      if (customer) {
        customerId = customer.id;
      }
    }

    // Find item by name if not already linked
    if (!itemId && order.baseModel) {
      const item = await prisma.item.findFirst({
        where: { name: order.baseModel }
      });
      if (item) {
        itemId = item.id;
      }
    }

    // Update order if we found new links
    if ((customerId && customerId !== order.customerId) || (itemId && itemId !== order.itemId)) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          customerId: customerId,
          itemId: itemId
        }
      });
      updatedCount++;
    }
  }

  console.log(`Migration complete. Successfully linked ${updatedCount} legacy orders.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
