import paramiko, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('116.74.77.22', username='dckakadia', password='Devin@404404')

cmds = [
    'echo Devin@404404 | sudo -S lsof -i :3000 -n -P 2>&1',
    'echo Devin@404404 | sudo -S fuser -v 3000/tcp 2>&1',
    'ps aux | grep node | grep -v grep',
    'echo Devin@404404 | sudo -S netstat -tlnp | grep 3000',
    'cat /home/dckakadia/order_manager/backend/.env | grep -v PASSWORD | grep -v SECRET',
]

for cmd in cmds:
    print(f'\n--- {cmd} ---')
    stdin, stdout, stderr = client.exec_command(cmd)
    stdout.channel.recv_exit_status()
    print(stdout.read().decode('utf-8', errors='replace'))
    err = stderr.read().decode('utf-8', errors='replace')
    if err.strip(): print('STDERR:', err)

client.close()
