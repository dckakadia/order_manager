import paramiko

host = '116.74.77.22'
user = 'dckakadia'
passwd = 'Devin@404404'

commands = [
    'echo ---NGINX-ROOT---',
    'sudo -S nginx -T 2>/dev/null | grep -n "root\|listen\|server_name\|try_files\|index" | head -80',
    'echo ---SITES---',
    'sudo -S grep -R -n "root\|listen\|server_name\|try_files\|index\|alias" /etc/nginx/sites-enabled /etc/nginx/sites-available 2>/dev/null | head -80',
    'echo ---INDEX-STAT---',
    'sudo -S stat -c "%n %s %y" /home/dckakadia/order_manager/frontend/dist/index.html',
    'echo ---INDEX-CAT---',
    'sudo -S sed -n "1,40p" /home/dckakadia/order_manager/frontend/dist/index.html',
    'echo ---DIST-LS---',
    'sudo -S ls -l /home/dckakadia/order_manager/frontend/dist | head -40',
    'echo ---CSS-ASSET-FIND---',
    'sudo -S grep -R -n "index-w9OAvP1Y.css\|index-CrWKqPem.css" /home/dckakadia/order_manager | head -50',
]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=passwd)

for cmd in commands:
    stdin, stdout, stderr = client.exec_command(cmd)
    stdin.write(passwd + '\n')
    stdin.flush()
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    print('CMD:', cmd)
    print('OUT:')
    print(out)
    print('ERR:')
    print(err)
    print('------')

client.close()
