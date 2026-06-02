import paramiko
import sys

def test_backup():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect('116.74.77.22', username='dckakadia', password='Devin@404404')
        stdin, stdout, stderr = client.exec_command("node -e \"require('/home/dckakadia/order_manager/backend/backup.js').performBackup().then(console.log).catch(console.error)\"")
        out = stdout.read()
        err = stderr.read()
        if out:
            sys.stdout.buffer.write(out)
            print()
        if err:
            sys.stdout.buffer.write(err)
            print()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()

if __name__ == '__main__':
    test_backup()
