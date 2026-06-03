const jwt = require('jsonwebtoken');
const fs = require('fs');

async function testUpload() {
  const secret = 'your-super-secret-jwt-key-change-this-in-production-min-32-characters';
  
  // Create a token for user ID 1 (or any valid user)
  const token = jwt.sign({ id: 1, role: 'ADMIN' }, secret, { expiresIn: '1h' });
  
  // Create a dummy Base64 image (small 1x1 pixel JPEG or PNG)
  const base64Image = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

  const payload = {
    imageBase64: base64Image,
    fileName: `test_photo_${Date.now()}.jpg`,
    photoType: 'location_photo'
  };

  try {
    const res = await fetch('http://116.74.77.22:3000/api/orders/45/attachments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
  } catch (err) {
    console.error("Error:", err);
  }
}

testUpload();
