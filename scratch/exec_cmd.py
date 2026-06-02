import paramiko
import sys

def find_credentials_deep():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect('116.74.77.22', username='dckakadia', password='Devin@404404')
        stdin, stdout, stderr = client.exec_command('find /home/dckakadia/ -name "*.json" | xargs grep -l "private_key" 2>/dev/null')
        out = stdout.read()
        sys.stdout.buffer.write(out)
        print()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()

if __name__ == '__main__':
    find_credentials_deep()
