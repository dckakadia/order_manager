import paramiko
import sys

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('116.74.77.22', username='dckakadia', password='Devin@404404')

# Check recent orders in the database
check_script = """
import subprocess
import json

# Check recent orders
r = subprocess.run(
    ['node', '-e', '''
const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
p.order.findMany({
  take: 5,
  orderBy: {createdAt: 'desc'},
  include: {customer: true}
}).then(orders => {
  orders.forEach(o => {
    console.log(JSON.stringify({
      id: o.id,
      customerId: o.customerId,
      customerName: o.customer?.name,
      baseModel: o.baseModel,
      createdAt: o.createdAt,
      status: o.status
    }));
  });
}).catch(console.error).finally(() => p.$disconnect());
'''],
    capture_output=True,
    text=True,
    cwd='/home/dckakadia/order_manager/backend'
)
print('RECENT ORDERS:')
print(r.stdout)
if r.stderr:
    print('ERR:', r.stderr[:500])
"""

sftp = client.open_sftp()
with sftp.file('/tmp/check_orders.py', 'w') as f:
    f.write(check_script)
sftp.close()

stdin, stdout, stderr = client.exec_command('python3 /tmp/check_orders.py 2>&1')
output = stdout.read().decode('utf-8', errors='replace')
print(output)
client.close()
