import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('116.74.77.22', username='dckakadia', password='Devin@404404')

script = """
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const customerName = 'DEVIDAS CHHAGANBHAI KAKADIA';

  // Find the customer
  const customer = await p.customer.findFirst({ where: { name: customerName } });
  if (!customer) {
    console.log('Customer not found!');
    return;
  }
  console.log(`Found customer: #${customer.id} - ${customer.name} (${customer.phone})`);

  // Find all their orders
  const orders = await p.order.findMany({
    where: { customerId: customer.id },
    select: { id: true, baseModel: true, status: true, createdAt: true }
  });
  console.log(`\\nFound ${orders.length} orders:`);
  orders.forEach(o => console.log(`  #${o.id} - ${o.baseModel} - ${o.status}`));

  const orderIds = orders.map(o => o.id);

  // Delete status history
  const h = await p.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
  console.log(`\\nDeleted ${h.count} status history records`);

  // Delete attachments
  const a = await p.orderAttachment.deleteMany({ where: { orderId: { in: orderIds } } });
  console.log(`Deleted ${a.count} attachments`);

  // Delete all orders
  const o = await p.order.deleteMany({ where: { customerId: customer.id } });
  console.log(`Deleted ${o.count} orders`);

  // Delete the customer
  await p.customer.delete({ where: { id: customer.id } });
  console.log(`\\nCustomer '${customerName}' deleted successfully.`);
}

main().catch(console.error).finally(() => p.$disconnect());
"""

sftp = client.open_sftp()
with sftp.file('/home/dckakadia/order_manager/backend/del_customer.js', 'w') as f:
    f.write(script)
sftp.close()

stdin, stdout, stderr = client.exec_command(
    'cd /home/dckakadia/order_manager/backend && node del_customer.js && rm del_customer.js'
)
print(stdout.read().decode('utf-8', errors='replace'))
err = stderr.read().decode('utf-8', errors='replace')
if err:
    print('ERR:', err)
client.close()
