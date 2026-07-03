import paramiko

host = '116.74.77.22'
user = 'dckakadia'
passwd = 'Devin@404404'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=passwd)
stdin, stdout, stderr = client.exec_command('uname -a')
print(stdout.read().decode('utf-8', errors='replace'))
print(stderr.read().decode('utf-8', errors='replace'))
client.close()
