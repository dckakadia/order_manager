import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('116.74.77.22', username='dckakadia', password='Devin@404404')

script = """
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Delete in correct order to respect foreign keys

  const h = await p.orderStatusHistory.deleteMany({});
  console.log(`Deleted ${h.count} status history records`);

  const a = await p.orderAttachment.deleteMany({});
  console.log(`Deleted ${a.count} attachments`);

  const o = await p.order.deleteMany({});
  console.log(`Deleted ${o.count} orders`);

  const c = await p.customer.deleteMany({});
  console.log(`Deleted ${c.count} customers`);

  // Verify
  const oc = await p.order.count();
  const cc = await p.customer.count();
  console.log(`\\nVerification — Orders: ${oc}, Customers: ${cc}`);
  console.log('All cleared successfully.');
}

main().catch(console.error).finally(() => p.$disconnect());
"""

sftp = client.open_sftp()
with sftp.file('/home/dckakadia/order_manager/backend/clear_all.js', 'w') as f:
    f.write(script)
sftp.close()

stdin, stdout, stderr = client.exec_command(
    'cd /home/dckakadia/order_manager/backend && node clear_all.js && rm clear_all.js'
)
print(stdout.read().decode('utf-8', errors='replace'))
err = stderr.read().decode('utf-8', errors='replace')
if err:
    print('ERR:', err)
client.close()
