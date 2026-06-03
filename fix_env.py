import paramiko
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('116.74.77.22', username='dckakadia', password='Devin@404404')
stdin, stdout, stderr = client.exec_command('sed -i \"s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=\\\"http://localhost:5173,http://localhost:3000,http://116.74.77.22:3000,http://localhost,capacitor://localhost,ionic://localhost\\\"|\" /home/dckakadia/order_manager/backend/.env && pm2 restart order_manager')
print(stdout.read().decode('utf-8', 'ignore'))
