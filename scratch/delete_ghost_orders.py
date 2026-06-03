import paramiko
import sys

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('116.74.77.22', username='dckakadia', password='Devin@404404')

delete_script = """
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const ghostIds = [55, 56, 57];

  // Show them first
  const orders = await p.order.findMany({
    where: { id: { in: ghostIds } },
    include: { customer: true }
  });

  console.log('Orders to delete:');
  orders.forEach(o => {
    console.log(`  #${o.id} - ${o.customer?.name} - ${o.baseModel} - ${o.createdAt}`);
  });

  if (orders.length === 0) {
    console.log('No matching orders found.');
    return;
  }

  const delHist = await p.orderStatusHistory.deleteMany({ where: { orderId: { in: ghostIds } } });
  console.log(`Deleted ${delHist.count} status history records`);

  const delAtt = await p.orderAttachment.deleteMany({ where: { orderId: { in: ghostIds } } });
  console.log(`Deleted ${delAtt.count} attachments`);

  const delOrders = await p.order.deleteMany({ where: { id: { in: ghostIds } } });
  console.log(`Deleted ${delOrders.count} ghost orders`);

  const remaining = await p.order.count({ where: { id: { in: ghostIds } } });
  console.log(`Remaining ghost orders: ${remaining} (should be 0)`);

  const latest = await p.order.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { customer: true }
  });
  console.log('Latest 5 orders after cleanup:');
  latest.forEach(o => {
    console.log(`  #${o.id} - ${o.customer?.name} - ${o.baseModel} - ${o.status}`);
  });
}

main().catch(console.error).finally(() => p.$disconnect());
"""

sftp = client.open_sftp()
# Write to the backend dir directly so @prisma/client resolves
with sftp.file('/home/dckakadia/order_manager/backend/delete_ghost.js', 'w') as f:
    f.write(delete_script)
sftp.close()

stdin, stdout, stderr = client.exec_command(
    'cd /home/dckakadia/order_manager/backend && node delete_ghost.js && rm delete_ghost.js'
)
output = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
print(output)
if err:
    print('ERR:', err)
client.close()
