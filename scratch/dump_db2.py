import paramiko
import json

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

  console.log(JSON.stringify({ customers, items, orders, users }));
}

main().catch(console.error).finally(() => p.$disconnect());
"""

sftp = client.open_sftp()
with sftp.file('/home/dckakadia/order_manager/backend/dump_db2.js', 'w') as f:
    f.write(script)
sftp.close()

stdin, stdout, stderr = client.exec_command(
    'cd /home/dckakadia/order_manager/backend && node dump_db2.js && rm dump_db2.js'
)
raw = stdout.read().decode('utf-8', errors='replace')
stderr.read()
client.close()

data = json.loads(raw)

# Save as proper UTF-8 JSON
with open('scratch/db_data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2, default=str)

print(f"customers: {len(data['customers'])}")
print(f"items: {len(data['items'])}")
print(f"orders: {len(data['orders'])}")
print(f"users: {len(data['users'])}")
