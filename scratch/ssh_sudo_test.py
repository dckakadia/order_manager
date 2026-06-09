import paramiko

host = '116.74.77.22'
user = 'dckakadia'
passwd = 'Devin@404404'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=passwd)

stdin, stdout, stderr = client.exec_command('echo START; sudo -S -p "" true; echo END')
stdin.write(passwd + '\n')
stdin.flush()

out = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
print('OUT:')
print(out)
print('ERR:')
print(err)
client.close()
