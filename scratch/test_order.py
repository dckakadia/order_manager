import paramiko
import sys

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('116.74.77.22', username='dckakadia', password='Devin@404404')

# Write a small test script to the server
test_script = """
import json
import subprocess
import sys

# Step 1: Login to get cookie
login_result = subprocess.run(
    ['curl', '-s', '-c', '/tmp/octest.txt', '-X', 'POST',
     'http://localhost:3001/api/auth/login',
     '-H', 'Content-Type: application/json',
     '-d', '{"username":"manish","pin":"1234"}'],
    capture_output=True, text=True
)
print("LOGIN:", login_result.stdout[:500])

try:
    login_data = json.loads(login_result.stdout)
    if not login_data.get('success'):
        print("LOGIN FAILED:", login_data)
        sys.exit(1)
except:
    print("Failed to parse login response:", login_result.stdout)
    sys.exit(1)

# Step 2: Get customers
cust_result = subprocess.run(
    ['curl', '-s', '-b', '/tmp/octest.txt',
     'http://localhost:3001/api/customers'],
    capture_output=True, text=True
)
cust_data = json.loads(cust_result.stdout)
print("CUSTOMERS count:", len(cust_data.get('data', [])))

# Step 3: Get items
items_result = subprocess.run(
    ['curl', '-s', '-b', '/tmp/octest.txt',
     'http://localhost:3001/api/items'],
    capture_output=True, text=True
)
items_data = json.loads(items_result.stdout)
print("ITEMS count:", len(items_data.get('data', [])))
print("FIRST ITEM:", json.dumps(items_data.get('data', [{}])[0], indent=2) if items_data.get('data') else 'None')

# Step 4: Try to create an order
customers = cust_data.get('data', [])
items = items_data.get('data', [])
if not customers or not items:
    print("No customers or items to test with")
    sys.exit(1)

order_payload = json.dumps({
    "customerId": customers[0]['id'],
    "baseModel": items[0]['name'],
    "itemId": items[0]['id'],
    "variant": "Silver",
    "basePrice": items[0].get('price', 0),
    "totalPrice": 100000,
    "notes": "Test order",
    "faucetPosition": "Right Side",
    "sidePanel": "Head Side",
    "orderBy": "Manish",
    "deliveryDate": "2026-07-01"
})

# Get CSRF token first
csrf_result = subprocess.run(
    ['curl', '-s', '-b', '/tmp/octest.txt', '-c', '/tmp/octest.txt',
     'http://localhost:3001/api/csrf-token'],
    capture_output=True, text=True
)
print("CSRF:", csrf_result.stdout[:200])
try:
    csrf_data = json.loads(csrf_result.stdout)
    csrf_token = csrf_data.get('csrfToken', '')
except:
    csrf_token = ''
    print("No CSRF token")

order_result = subprocess.run(
    ['curl', '-s', '-b', '/tmp/octest.txt',
     '-X', 'POST',
     '-H', 'Content-Type: application/json',
     '-H', f'x-csrf-token: {csrf_token}',
     '-d', order_payload,
     'http://localhost:3001/api/orders'],
    capture_output=True, text=True
)
print("ORDER RESULT:", order_result.stdout[:1000])
"""

# Write the test script to the server
sftp = client.open_sftp()
with sftp.file('/tmp/test_order.py', 'w') as f:
    f.write(test_script)
sftp.close()

# Run it
stdin, stdout, stderr = client.exec_command('python3 /tmp/test_order.py 2>&1')
output = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
sys.stdout.buffer.write(output.encode('utf-8'))
if err:
    sys.stdout.buffer.write(b'\nSTDERR:\n')
    sys.stdout.buffer.write(err.encode('utf-8'))
client.close()
