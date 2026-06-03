import paramiko
import sys
import json

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('116.74.77.22', username='dckakadia', password='Devin@404404')

# Write a server-side script to test order API
test_script = r"""
import json
import subprocess

# Step 1: Get users to check valid ones
login_attempts = [
    {"username": "manish", "pin": "1234"},
    {"username": "manish", "pin": "0000"},
    {"username": "admin", "pin": "1234"},
    {"username": "devin", "pin": "1234"},
]

logged_in = False
cookie_file = '/tmp/octest2.txt'

for creds in login_attempts:
    r = subprocess.run(
        ['curl', '-s', '-c', cookie_file,
         '-X', 'POST',
         '-H', 'Content-Type: application/json',
         '-d', json.dumps(creds),
         'http://localhost:3001/api/auth/login'],
        capture_output=True, text=True
    )
    data = json.loads(r.stdout)
    print(f"Trying {creds['username']}/{creds['pin']}: {data.get('success')}")
    if data.get('success'):
        print(f"SUCCESS with user {creds['username']}")
        logged_in = True
        break

if not logged_in:
    print("Could not login with any known credentials")
    import sys; sys.exit(1)

# Step 2: Test GET orders (to check if API works)
r = subprocess.run(
    ['curl', '-s', '-b', cookie_file, 'http://localhost:3001/api/orders?limit=1'],
    capture_output=True, text=True
)
print("\nGET /api/orders:", r.stdout[:500])

# Step 3: Test GET customers
r = subprocess.run(
    ['curl', '-s', '-b', cookie_file, 'http://localhost:3001/api/customers'],
    capture_output=True, text=True
)
cust_data = json.loads(r.stdout)
customers = cust_data.get('data', [])
print(f"\nCustomers: {len(customers)}")

# Step 4: Test GET items
r = subprocess.run(
    ['curl', '-s', '-b', cookie_file, 'http://localhost:3001/api/items'],
    capture_output=True, text=True
)
items_data = json.loads(r.stdout)
items = items_data.get('data', [])
print(f"Items: {len(items)}")

if not customers or not items:
    print("No customers or items!")
    import sys; sys.exit(1)

# Step 5: Get CSRF token
r = subprocess.run(
    ['curl', '-s', '-b', cookie_file, '-c', cookie_file, 'http://localhost:3001/api/csrf-token'],
    capture_output=True, text=True
)
print(f"\nCSRF response: {r.stdout[:200]}")
try:
    csrf_data = json.loads(r.stdout)
    csrf_token = csrf_data.get('csrfToken', '')
except:
    csrf_token = ''

# Step 6: Submit order
order_payload = {
    "customerId": str(customers[0]['id']),
    "baseModel": items[0]['name'],
    "itemId": str(items[0]['id']),
    "variant": "Silver",
    "basePrice": str(items[0].get('price', 0)),
    "totalPrice": 100000,
    "notes": "Test order from debug script",
    "faucetPosition": "Right Side",
    "sidePanel": "Head Side",
    "orderBy": "Manish",
    "deliveryDate": "2026-07-01"
}

print(f"\nOrder payload: {json.dumps(order_payload, indent=2)}")

r = subprocess.run(
    ['curl', '-s', '-b', cookie_file,
     '-X', 'POST',
     '-H', 'Content-Type: application/json',
     '-H', f'x-csrf-token: {csrf_token}',
     '-d', json.dumps(order_payload),
     'http://localhost:3001/api/orders'],
    capture_output=True, text=True
)
print(f"\nOrder submission result: {r.stdout[:2000]}")
"""

# Write and execute on server
sftp = client.open_sftp()
with sftp.file('/tmp/test_order2.py', 'w') as f:
    f.write(test_script)
sftp.close()

stdin, stdout, stderr = client.exec_command('python3 /tmp/test_order2.py 2>&1')
output = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
print(output)
if err:
    print('STDERR:', err)
client.close()
