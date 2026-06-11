import paramiko
import sys

server_ip = '116.74.77.22'
username = 'dckakadia'
password = 'Devin@404404'

try:
    print(f"Connecting to {server_ip} as {username}...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(server_ip, username=username, password=password)
    
    cmd = "pm2 restart order-manager"
    print(f"Executing: {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd)
    
    print(stdout.read().decode())
    print(stderr.read().decode())
    client.close()
    
    print("SUCCESSFULLY RESTARTED SERVER!")
except Exception as e:
    print(f"Failed: {e}")
