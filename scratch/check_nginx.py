import paramiko, sys, io, subprocess
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# Check nginx config
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('116.74.77.22', username='dckakadia', password='Devin@404404')

print('=== nginx config ===')
stdin, stdout, stderr = client.exec_command('echo Devin@404404 | sudo -S cat /etc/nginx/sites-enabled/order_manager 2>/dev/null || echo Devin@404404 | sudo -S cat /etc/nginx/sites-enabled/default 2>/dev/null || echo Devin@404404 | sudo -S grep -r "3001\|order_manager\|proxy_pass" /etc/nginx/ 2>/dev/null | head -40')
stdout.channel.recv_exit_status()
print(stdout.read().decode('utf-8', errors='replace'))

client.close()
