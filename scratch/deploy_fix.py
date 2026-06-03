import paramiko, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('116.74.77.22', username='dckakadia', password='Devin@404404')

cmds = [
    'cd /home/dckakadia/order_manager && git pull',
    'pm2 restart order_manager',
    'sleep 5',
    'pm2 list',
    'curl -s http://localhost:3001/health',
    'curl -s http://localhost:3000/api/customers | head -c 400',
]
for cmd in cmds:
    print(f'\n--- {cmd} ---')
    stdin, stdout, stderr = client.exec_command(cmd)
    stdout.channel.recv_exit_status()
    print(stdout.read().decode('utf-8', errors='replace'))
    err = stderr.read().decode('utf-8', errors='replace')
    if err.strip(): print('STDERR:', err)

client.close()
