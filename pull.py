import paramiko
import sys

server_ip = '116.74.77.22'
username = 'dckakadia'
password = 'Devin@404404'
remote_project_dir = '/home/dckakadia/order_manager'

try:
    print(f"Connecting to {server_ip} as {username}...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(server_ip, username=username, password=password)
    
    remote_cmds = [
        f"cd {remote_project_dir} && git restore backend/package-lock.json frontend/package-lock.json backend/uploads/releases/release.json",
        f"cd {remote_project_dir} && git pull",
        f"cd {remote_project_dir}/frontend && npm install && npm run build",
        "pm2 restart order_manager"
    ]
    
    for cmd in remote_cmds:
        print(f"Executing: {cmd}")
        stdin, stdout, stderr = client.exec_command(cmd)
        exit_status = stdout.channel.recv_exit_status()
        
        out_bytes = stdout.read()
        err_bytes = stderr.read()
        
        if out_bytes:
            sys.stdout.buffer.write(out_bytes)
            sys.stdout.buffer.write(b'\n')
            sys.stdout.flush()
        if err_bytes:
            print("ERROR/WARNING:")
            sys.stdout.buffer.write(err_bytes)
            sys.stdout.buffer.write(b'\n')
            sys.stdout.flush()
            
        if exit_status != 0:
            print(f"Command '{cmd}' failed with status {exit_status}")
            client.close()
            sys.exit(1)
            
    client.close()
    print("SUCCESSFULLY PULLED AND RESTARTED SERVER!")
    
except Exception as e:
    print(f"Remote deployment failed: {e}")
    sys.exit(1)
