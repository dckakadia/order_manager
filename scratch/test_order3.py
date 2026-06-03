import paramiko
import sys

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('116.74.77.22', username='dckakadia', password='Devin@404404')

test_script = """
import json
import subprocess

cookie_file = '/tmp/octest3.txt'

# Step 1: Login
r = subprocess.run(
    ['curl', '-s', '-c', cookie_file,
     '-X', 'POST',
     '-H', 'Content-Type: application/json',
     '-d', json.dumps({"username": "devin", "pin": "7930"}),
     'http://localhost:3001/api/auth/login'],
    capture_output=True, text=True
)
login_data = json.loads(r.stdout)
print("LOGIN:", json.dumps(login_data, indent=2))
if not login_data.get('success'):
    print("FAILED to login")
    import sys; sys.exit(1)

# Step 2: Get CSRF token
r = subprocess.run(
    ['curl', '-s', '-b', cookie_file, '-c', cookie_file,
     'http://localhost:3001/api/csrf-token'],
    capture_output=True, text=True
)
csrf_data = json.loads(r.stdout)
csrf_token = csrf_data.get('csrfToken', '')
print("CSRF token obtained:", bool(csrf_token))

# Step 3: Get customers
r = subprocess.run(
    ['curl', '-s', '-b', cookie_file, 'http://localhost:3001/api/customers'],
    capture_output=True, text=True
)
customers = json.loads(r.stdout).get('data', [])
print(f"Customers: {len(customers)}")

# Step 4: Get items
r = subprocess.run(
    ['curl', '-s', '-b', cookie_file, 'http://localhost:3001/api/items'],
    capture_output=True, text=True
)
items_resp = json.loads(r.stdout)
items = items_resp.get('data', [])
print(f"Items: {len(items)}")

# Find "Bathtub-2305-Aristo" like the screenshot
target_item = None
for item in items:
    if 'Aristo' in item.get('name', ''):
        target_item = item
        break
if not target_item and items:
    target_item = items[0]

print(f"Using item: {target_item.get('name')} (id={target_item.get('id')})")

# Find customer "DEVIDAS" like the screenshot
target_cust = None
for c in customers:
    if 'DEVIDAS' in c.get('name', '').upper():
        target_cust = c
        break
if not target_cust and customers:
    target_cust = customers[0]

print(f"Using customer: {target_cust.get('name')} (id={target_cust.get('id')})")

# Step 5: Submit order exactly as the form would
order_payload = {
    "customerId": str(target_cust['id']),
    "baseModel": target_item['name'],
    "itemId": str(target_item['id']),
    "variant": "Titanium",
    "basePrice": target_item.get('price', 0),
    "totalPrice": 150000,
    "notes": "",
    "faucetPosition": "Right Side",
    "sidePanel": "Head Side",
    "orderBy": "Manish",
    "deliveryDate": "2026-07-15",
    "customerName": target_cust['name'],
    "phone": target_cust.get('phone', ''),
    "email": target_cust.get('email', ''),
    "shippingAddress": target_cust.get('shippingAddress', ''),
    "taxNumber": target_cust.get('taxNumber', ''),
    "manualPrice": "150000"
}

print(f"\\nSubmitting order payload: {json.dumps(order_payload, indent=2)}")

r = subprocess.run(
    ['curl', '-s', '-b', cookie_file,
     '-X', 'POST',
     '-H', 'Content-Type: application/json',
     '-H', f'x-csrf-token: {csrf_token}',
     '-d', json.dumps(order_payload),
     'http://localhost:3001/api/orders'],
    capture_output=True, text=True
)
print(f"\\nOrder result: {r.stdout}")
"""

sftp = client.open_sftp()
with sftp.file('/tmp/test_order3.py', 'w') as f:
    f.write(test_script)
sftp.close()

stdin, stdout, stderr = client.exec_command('python3 /tmp/test_order3.py 2>&1')
output = stdout.read().decode('utf-8', errors='replace')
print(output)
client.close()
