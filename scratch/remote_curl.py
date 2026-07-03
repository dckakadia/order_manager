import paramiko

host = '116.74.77.22'
user = 'dckakadia'
passwd = 'Devin@404404'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=passwd)

commands = [
    'echo ---ADMIN-HTML---',
    'curl -s -D - -H "Cache-Control: no-cache" http://127.0.0.1:3000/admin | sed -n "1,40p"',
    'echo ---CSS-LINK---',
    'curl -s -H "Cache-Control: no-cache" http://127.0.0.1:3000/admin | grep -oP "href=\"/assets/index[^\"]+\.css" | head -1',
    'echo ---CSS-CONTENT---',
    'curl -s -H "Cache-Control: no-cache" http://127.0.0.1:3000/assets/index-CrWKqPem.css | sed -n "1,40p"',
]

for cmd in commands:
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    print('CMD:', cmd)
    print('OUT:')
    print(out)
    print('ERR:')
    print(err)
    print('------')

client.close()
