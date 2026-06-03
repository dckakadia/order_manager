const jwt = require('jsonwebtoken');

async function testFetch() {
  const secret = 'your-super-secret-jwt-key-change-this-in-production-min-32-characters';
  const token = jwt.sign({ id: 1, role: 'ADMIN' }, secret, { expiresIn: '1h' });
  
  try {
    const res = await fetch('http://116.74.77.22:3000/api/orders/45/attachments', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const text = await res.text();
    console.log("Response:", text);
  } catch (err) {
    console.error("Error:", err);
  }
}
testFetch();
