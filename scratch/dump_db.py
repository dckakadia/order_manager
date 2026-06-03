import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('116.74.77.22', username='dckakadia', password='Devin@404404')

script = """
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const customers = await p.customer.findMany({ orderBy: { id: 'asc' } });
  const items = await p.item.findMany({ orderBy: { id: 'asc' } });
  const orders = await p.order.findMany({
    orderBy: { id: 'asc' },
    include: { customer: true, item: true }
  });
  const users = await p.user.findMany({ orderBy: { id: 'asc' } });

  console.log(JSON.stringify({ customers, items, orders, users }, null, 0));
}

main().catch(console.error).finally(() => p.$disconnect());
"""

sftp = client.open_sftp()
with sftp.file('/home/dckakadia/order_manager/backend/dump_db.js', 'w') as f:
    f.write(script)
sftp.close()

stdin, stdout, stderr = client.exec_command(
    'cd /home/dckakadia/order_manager/backend && node dump_db.js && rm dump_db.js'
)
output = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
if err:
    import sys
    sys.stderr.write(err)
print(output)
client.close()
