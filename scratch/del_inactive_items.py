import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('116.74.77.22', username='dckakadia', password='Devin@404404')

script = """
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const inactiveIds = [1, 2, 3, 4, 5, 6];

  // Show what we're deleting
  const items = await p.item.findMany({ where: { id: { in: inactiveIds } } });
  console.log('Items to delete:');
  items.forEach(i => console.log(`  #${i.id} - ${i.name} (${i.category})`));

  // Delete them
  const del = await p.item.deleteMany({ where: { id: { in: inactiveIds } } });
  console.log(`\\nDeleted ${del.count} inactive items.`);

  // Verify remaining
  const remaining = await p.item.findMany({ orderBy: { id: 'asc' } });
  console.log(`\\nRemaining items (${remaining.length}):`);
  remaining.forEach(i => console.log(`  #${i.id} - ${i.name} [${i.isActive ? 'ACTIVE' : 'INACTIVE'}]`));
}

main().catch(console.error).finally(() => p.$disconnect());
"""

sftp = client.open_sftp()
with sftp.file('/home/dckakadia/order_manager/backend/del_inactive.js', 'w') as f:
    f.write(script)
sftp.close()

stdin, stdout, stderr = client.exec_command(
    'cd /home/dckakadia/order_manager/backend && node del_inactive.js && rm del_inactive.js'
)
print(stdout.read().decode('utf-8', errors='replace'))
err = stderr.read().decode('utf-8', errors='replace')
if err:
    print('ERR:', err)
client.close()
