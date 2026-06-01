# Bug Fixes Implementation Plan - Order Manager

**Total Bugs Found**: 35+ across frontend and backend  
**Critical Issues**: 6  
**High Priority**: 8  
**Medium Priority**: 12  
**Low Priority**: 9+

---

## PHASE 1: CRITICAL SECURITY & CRASH FIXES (MUST DO FIRST)

**Estimated Time**: 4-6 hours | **Effort**: High | **Risk**: High  
**Impact**: Prevents app crashes, fixes authentication bypass, stops data loss

### 1.1 Fix Silent Error Handlers (`.catch(() => {})`)

**Severity**: CRITICAL | **Files**: SalesForm.jsx, ManagerDashboard.jsx, App.jsx  
**Lines**: SalesForm.jsx L91-107, ManagerDashboard.jsx L28, App.jsx L123

**Problem**:

```javascript
// BEFORE - Silent failure
fetch(url)
  .then((res) => res.json())
  .then((data) => setOrders(data))
  .catch(() => {}); // ERROR LOST
```

**Solution**:

- Replace all `.catch(() => {})` with proper error handlers
- Add console.error() for debugging
- Show toast/alert to user about errors
- Log error to backend for monitoring

**Implementation**:

```javascript
// AFTER
.catch(err => {
  console.error('Failed to fetch orders:', err);
  setError('Failed to load orders. Please try again.');
  setLoading(false);
});
```

**Files to Fix**:

- [ ] frontend/src/SalesForm.jsx (3 locations)
- [ ] frontend/src/ManagerDashboard.jsx (2 locations)
- [ ] frontend/src/App.jsx (2 locations)
- [ ] frontend/src/LiveOrderStatus.jsx (2 locations)
- [ ] frontend/src/CustomerMaster.jsx (1 location)

---

### 1.2 Add Response Status Checks Before JSON Parsing

**Severity**: CRITICAL | **Files**: Login.jsx, SalesForm.jsx, All API calls  
**Lines**: Login.jsx L22, SalesForm.jsx L85-105, ManagerDashboard.jsx L23-34

**Problem**:

```javascript
// BEFORE - Crashes on error
const response = await fetch(url);
const data = await response.json(); // May fail if 500 error!
if (data.success) { ... }
```

**Solution**:

- Check `res.ok` or `res.status === 200` before calling `.json()`
- Handle error responses properly
- Provide meaningful error messages

**Implementation**:

```javascript
// AFTER
const response = await fetch(url);
if (!response.ok) {
  throw new Error(`API error: ${response.status} ${response.statusText}`);
}
const data = await response.json();
if (data.success) { ... }
```

**Files to Fix**:

- [ ] frontend/src/Login.jsx (L22)
- [ ] frontend/src/SalesForm.jsx (L85-105, 296-308)
- [ ] frontend/src/ManagerDashboard.jsx (L23-34)
- [ ] frontend/src/App.jsx (L30)
- [ ] frontend/src/LiveOrderStatus.jsx (L125-140)
- [ ] frontend/src/CustomerMaster.jsx (all fetch calls)

**Test Cases**:

- [ ] Verify app doesn't crash when server returns 500
- [ ] Verify user sees error message for network failures
- [ ] Verify invalid JSON doesn't crash app

---

### 1.3 Remove Hard-Coded Username in Authorization

**Severity**: CRITICAL | **Files**: backend/routes/orders.js  
**Lines**: orders.js L264-265

**Problem**:

```javascript
// BEFORE - Hard-coded business logic
if (req.user && req.user.username === "sunil") {
  return res
    .status(403)
    .json({ success: false, error: "You do not have permission" });
}
```

**Solution**:

- Remove hard-coded username
- Use role-based access control or database permission flags
- Make it configurable or admin-settable

**Implementation**:

```javascript
// AFTER - Use role-based access
if (req.user.role !== "ADMIN") {
  return res.status(403).json({ success: false, error: "Admin only" });
}
```

**Files to Fix**:

- [ ] backend/server.js (search for hard-coded usernames)
- [ ] backend/middleware/auth.js (verify role checks)

**Test Cases**:

- [ ] Non-admin cannot delete photos
- [ ] Admin can delete photos
- [ ] Error message is generic (no username leakage)

---

### 1.4 Fix Inconsistent localStorage Keys

**Severity**: CRITICAL | **Files**: Login.jsx, App.jsx, SalesForm.jsx, LiveOrderStatus.jsx

**Problem**:

```javascript
// INCONSISTENT
Login.jsx: localStorage.setItem(config.storage.userRole, data.role); // Uses config key
SalesForm.jsx: const role = localStorage.getItem('ocean_spas_role'); // Hard-coded key!
cookieAuth.js: res.cookie('user_role', role); // Different key name
```

**Solution**:

- Create single constants file for all storage keys
- Use only these constants throughout app
- Migrate all hard-coded keys

**Implementation**:

```javascript
// frontend/src/constants.js
export const STORAGE_KEYS = {
  AUTH_TOKEN: "ocean_spas_auth_token",
  USER_ROLE: "ocean_spas_user_role",
  USER_ID: "ocean_spas_user_id",
  SELECTED_CUSTOMER: "ocean_spas_selected_customer",
};

// Usage in all files
localStorage.setItem(STORAGE_KEYS.USER_ROLE, role);
const role = localStorage.getItem(STORAGE_KEYS.USER_ROLE);
```

**Files to Fix**:

- [ ] frontend/src/Login.jsx (L25-26)
- [ ] frontend/src/SalesForm.jsx (L81, search for 'ocean_spas_role')
- [ ] frontend/src/LiveOrderStatus.jsx (L71)
- [ ] frontend/src/ManagerDashboard.jsx (L18)
- [ ] frontend/src/CustomerMaster.jsx (search for localStorage)
- [ ] Create: frontend/src/constants.js

**Test Cases**:

- [ ] All role-based UI elements render correctly
- [ ] User role persists after page refresh
- [ ] Switching between roles works correctly

---

### 1.5 Fix Socket.IO Listener Memory Leaks

**Severity**: CRITICAL | **Files**: SalesForm.jsx, LiveOrderStatus.jsx, ManagerDashboard.jsx  
**Lines**: ManagerDashboard.jsx L42-59, LiveOrderStatus.jsx L84-105

**Problem**:

```javascript
// BEFORE - Listeners stack up
useEffect(() => {
  socket.on("new_order", refreshOrders);
  socket.on("order_updated", handleUpdate);
  // No cleanup of old listeners!
  return () => {
    // Missing socket.off() calls!
  };
}, [socket]);
```

**Solution**:

- Properly remove listeners in cleanup function
- Use Socket.IO's `.off()` method to unsubscribe
- Fix dependency array to prevent duplicate listeners

**Implementation**:

```javascript
// AFTER - Proper cleanup
useEffect(() => {
  if (!socket) return;

  const handleNewOrder = (order) => {
    setOrders((prev) => [...prev, order]);
  };
  const handleOrderUpdated = (order) => {
    /* ... */
  };

  socket.on("new_order", handleNewOrder);
  socket.on("order_updated", handleOrderUpdated);

  return () => {
    socket.off("new_order", handleNewOrder);
    socket.off("order_updated", handleOrderUpdated);
  };
}, [socket]);
```

**Files to Fix**:

- [ ] frontend/src/SalesForm.jsx (L103-117)
- [ ] frontend/src/LiveOrderStatus.jsx (L84-105)
- [ ] frontend/src/ManagerDashboard.jsx (L42-59)

**Test Cases**:

- [ ] Open and close dashboard 10 times → check browser memory
- [ ] Verify socket events only fire once (not 2-3x)
- [ ] Navigate between pages → verify listeners clean up

---

## PHASE 2: HIGH PRIORITY FIXES (DO AFTER PHASE 1)

**Estimated Time**: 3-4 hours | **Effort**: Medium  
**Impact**: Prevents data loss, fixes security vulnerabilities, improves reliability

### 2.1 Validate Backup Restore Data Structure

**Severity**: HIGH | **Files**: backend/server.js  
**Lines**: server.js POST /api/backup/restore

**Problem**:

```javascript
// BEFORE - Only checks if arrays exist, not structure
if (!orders || !customers || !items || !users) {
  return res.status(400).json({ error: "Invalid format" });
}
// But accepts orders with invalid customerId!
```

**Solution**:

- Validate each record has required fields
- Check foreign key references exist
- Validate data types (numbers are numbers, dates are dates)
- Create validation schema using Joi or similar

**Implementation**:

```javascript
// AFTER
const validateBackupData = (data) => {
  const errors = [];

  // Validate users
  data.users?.forEach((u, i) => {
    if (!u.id || !u.username) errors.push(`User[${i}] missing id/username`);
  });

  // Validate customers
  data.customers?.forEach((c, i) => {
    if (!c.id || !c.name) errors.push(`Customer[${i}] missing id/name`);
  });

  // Validate orders reference valid customers
  data.orders?.forEach((o, i) => {
    const validCustomer = data.customers.find((c) => c.id === o.customerId);
    if (!validCustomer)
      errors.push(`Order[${i}] references invalid customerId`);
  });

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
};
```

**Files to Fix**:

- [ ] backend/server.js (POST /api/backup/restore)

**Test Cases**:

- [ ] Reject backup with invalid customerId references
- [ ] Reject backup with missing required fields
- [ ] Accept valid backup and restore successfully

---

### 2.2 Add File Path Validation (Path Traversal Prevention)

**Severity**: HIGH | **Files**: backend/server.js  
**Lines**: DELETE /api/orders/:id/attachments/:attachmentId

**Problem**:

```javascript
// BEFORE - No path validation
const filePath = attachment.filePath;
fs.unlinkSync(filePath); // Could be ../../../etc/passwd!
```

**Solution**:

- Validate file paths are within allowed directory
- Use path.normalize() and path.resolve()
- Check no ".." in path
- Store only relative paths in database

**Implementation**:

```javascript
// AFTER
const path = require("path");
const UPLOADS_DIR = path.resolve(__dirname, "../uploads");

const validateFilePath = (filePath) => {
  const normalizedPath = path.normalize(filePath);
  const absolutePath = path.resolve(UPLOADS_DIR, normalizedPath);

  // Ensure resolved path is still within UPLOADS_DIR
  if (!absolutePath.startsWith(UPLOADS_DIR)) {
    throw new Error("Invalid file path");
  }

  return absolutePath;
};

// Usage
const attachment = await prisma.attachment.findUnique({ where: { id } });
const safeFilePath = validateFilePath(attachment.filePath);
fs.unlinkSync(safeFilePath);
```

**Files to Fix**:

- [ ] backend/server.js (DELETE attachment endpoint)
- [ ] backend/seed.js (if creating file references)

**Test Cases**:

- [ ] Cannot delete files outside uploads directory
- [ ] Cannot use `../` to traverse directories
- [ ] Valid file paths still work

---

### 2.3 Add Attachment ID Parameter Validation

**Severity**: HIGH | **Files**: backend/server.js  
**Lines**: DELETE /api/orders/:id/attachments/:attachmentId

**Problem**:

```javascript
// BEFORE - No validation
const attachmentId = parseInt(req.params.attachmentId); // Could be NaN!
const attachment = await prisma.attachment.findUnique({
  where: { id: attachmentId },
});
// NaN causes silent failure
```

**Solution**:

- Add [param('attachmentId').isInt()] validation using express-validator
- Handle validation errors properly

**Implementation**:

```javascript
// AFTER
app.delete(
  "/api/orders/:id/attachments/:attachmentId",
  authMiddleware,
  [
    param("id").isInt().withMessage("Invalid order ID"),
    param("attachmentId").isInt().withMessage("Invalid attachment ID"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const attachmentId = parseInt(req.params.attachmentId);
    // ...
  },
);
```

**Files to Fix**:

- [ ] backend/server.js (all DELETE routes with parameters)

**Test Cases**:

- [ ] Reject attachmentId="abc" with validation error
- [ ] Accept attachmentId="123" and delete attachment
- [ ] Return 404 if attachment doesn't exist

---

### 2.4 Socket.IO Connection Status Check

**Severity**: HIGH | **Files**: SalesForm.jsx, LiveOrderStatus.jsx, ManagerDashboard.jsx

**Problem**:

```javascript
// BEFORE - No connection check
if (socket) {
  socket.on("new_order", refreshOrders);
  // But socket might disconnect anytime without notice!
}
```

**Solution**:

- Add listener for socket.io 'disconnect' event
- Show user when real-time updates are unavailable
- Add reconnection indicator
- Queue updates while disconnected

**Implementation**:

```javascript
// AFTER - In App.jsx
useEffect(() => {
  if (!socket) return;

  const handleConnect = () => {
    console.log("Socket connected");
    setIsConnected(true);
    refreshAllData(); // Sync after reconnect
  };

  const handleDisconnect = () => {
    console.log("Socket disconnected");
    setIsConnected(false);
  };

  socket.on("connect", handleConnect);
  socket.on("disconnect", handleDisconnect);

  return () => {
    socket.off("connect", handleConnect);
    socket.off("disconnect", handleDisconnect);
  };
}, [socket]);

// In UI - show status indicator
<div style={{ color: isConnected ? "green" : "red" }}>
  {isConnected ? "🟢 Real-time" : "🔴 Offline"}
</div>;
```

**Files to Fix**:

- [ ] frontend/src/App.jsx (add connection status)
- [ ] frontend/src/SalesForm.jsx (check isConnected before relying on socket)
- [ ] frontend/src/LiveOrderStatus.jsx (same)

**Test Cases**:

- [ ] Disconnect socket → UI shows "Offline"
- [ ] Reconnect socket → UI shows "Real-time" and syncs data
- [ ] User understands real-time updates are unavailable

---

### 2.5 Validate Photo Upload with Size Check Before Compression

**Severity**: HIGH | **Files**: frontend/src/SalesForm.jsx  
**Lines**: L219-228

**Problem**:

```javascript
// BEFORE - Only checks size AFTER compression
blob = await compressImage(blob);
if (blob.size > 1 * 1024 * 1024) {
  alert("Could not compress below 1MB");
  // Wasted compression work!
}
```

**Solution**:

- Check file size before compression
- Reject too-large files early
- Show progress percentage accurately

**Implementation**:

```javascript
// AFTER
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB max before compression
const MAX_COMPRESSED_SIZE = 1 * 1024 * 1024; // 1MB max after compression

const handleAddPhoto = async (file) => {
  // Check original size first
  if (file.size > MAX_FILE_SIZE) {
    alert(
      `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 5MB.`,
    );
    return;
  }

  // Then compress
  let blob = await compressImage(file);

  // Final check after compression
  if (blob.size > MAX_COMPRESSED_SIZE) {
    alert(`Compression failed. Try a smaller image.`);
    return;
  }

  // Upload
};
```

**Files to Fix**:

- [ ] frontend/src/SalesForm.jsx (L219-228, 252-265)

**Test Cases**:

- [ ] Reject 10MB image before compression
- [ ] Accept 2MB image and compress to <1MB
- [ ] Show appropriate error messages

---

## PHASE 3: MEDIUM PRIORITY FIXES (DO AFTER PHASE 2)

**Estimated Time**: 4-5 hours | **Effort**: Medium  
**Impact**: Improves data integrity, prevents memory leaks, better UX

### 3.1 Add Required Field Validation on Order Creation

**Severity**: MEDIUM | **Files**: backend/server.js  
**Lines**: POST /api/orders

**Problem**:

```javascript
// BEFORE - Missing validation
const order = await prisma.order.create({
  data: {
    customerName: data.customerName, // No validation!
    phone: data.phone,
    email: data.email,
    // ...
  },
});
```

**Solution**:

- Validate all required fields with express-validator
- Define data schema clearly
- Provide specific error messages

**Implementation**:

```javascript
// AFTER
app.post(
  "/api/orders",
  authMiddleware,
  [
    body("customerName")
      .trim()
      .notEmpty()
      .withMessage("Customer name required"),
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email required"),
    body("phone")
      .trim()
      .isLength({ min: 5, max: 20 })
      .withMessage("Valid phone required"),
    body("baseModel").trim().notEmpty().withMessage("Base model required"),
    body("totalPrice").isFloat({ min: 0 }).withMessage("Valid price required"),
    body("shippingAddress")
      .trim()
      .isLength({ max: 500 })
      .withMessage("Address too long"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    // ... create order
  },
);
```

**Files to Fix**:

- [ ] backend/server.js (all POST/PUT endpoints)

**Test Cases**:

- [ ] Reject order with missing customerName
- [ ] Reject order with invalid email
- [ ] Accept valid order with all required fields

---

### 3.2 Fix Race Condition in Form State Management

**Severity**: MEDIUM | **Files**: frontend/src/SalesForm.jsx  
**Lines**: L301-315

**Problem**:

```javascript
// BEFORE - Race condition possible
setSubmitted(true);
setTimeout(() => {
  setSubmitted(false); // What if user submits again in 3 seconds?
  resetForm();
}, 3000);
```

**Solution**:

- Use a flag to prevent double submission
- Check form state before allowing new submission
- Use AbortController to cancel in-flight requests if form resets

**Implementation**:

```javascript
// AFTER
const [isSubmitting, setIsSubmitting] = useState(false);
const abortControllerRef = useRef(null);

const handleSubmit = async (e) => {
  e.preventDefault();

  // Prevent double submission
  if (isSubmitting) return;

  setIsSubmitting(true);
  abortControllerRef.current = new AbortController();

  try {
    const response = await fetch(`${config.api.baseURL}/api/orders`, {
      method: "POST",
      body: JSON.stringify(formData),
      signal: abortControllerRef.current.signal,
    });

    if (response.ok) {
      setSubmitted(true);
      resetForm();
      setTimeout(() => setSubmitted(false), 3000);
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("Submit error:", error);
    }
  } finally {
    setIsSubmitting(false);
  }
};
```

**Files to Fix**:

- [ ] frontend/src/SalesForm.jsx (L301-315)

**Test Cases**:

- [ ] Rapid clicks don't create multiple orders
- [ ] Form properly resets after submission
- [ ] Navigating away cancels in-flight request

---

### 3.3 Fix Missing Null Safety in Date Fields

**Severity**: MEDIUM | **Files**: frontend/src/SalesForm.jsx, LiveOrderStatus.jsx  
**Lines**: SalesForm.jsx L46, LiveOrderStatus.jsx L156

**Problem**:

```javascript
// BEFORE - Crashes if date is null
const renderDeliveryDate = (dateString) => {
  const dDate = new Date(dateString);
  return dDate.toLocaleDateString(...); // NaN if dateString is null
};
```

**Solution**:

- Add null checks for all optional fields
- Provide fallback values
- Use optional chaining

**Implementation**:

```javascript
// AFTER
const renderDeliveryDate = (dateString) => {
  if (!dateString) return "Not scheduled";
  try {
    const dDate = new Date(dateString);
    if (isNaN(dDate.getTime())) return "Invalid date";
    return dDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (e) {
    return "Invalid date";
  }
};
```

**Files to Fix**:

- [ ] frontend/src/SalesForm.jsx (all date fields)
- [ ] frontend/src/LiveOrderStatus.jsx (all date fields)
- [ ] frontend/src/ManagerDashboard.jsx (all date fields)

**Test Cases**:

- [ ] Null date displays "Not scheduled"
- [ ] Invalid date displays "Invalid date"
- [ ] Valid date displays correctly

---

### 3.4 Clear localStorage Selectively on 401

**Severity**: MEDIUM | **Files**: frontend/src/CustomerMaster.jsx, App.jsx  
**Lines**: CustomerMaster.jsx L20-21

**Problem**:

```javascript
// BEFORE - Clears everything
if (res.status === 401) {
  localStorage.clear(); // Loses all settings!
  window.location.href = "/login";
}
```

**Solution**:

- Only clear auth-related keys
- Preserve user preferences and cache
- Create selective clear function

**Implementation**:

```javascript
// AFTER
const clearAuthStorage = () => {
  // Only clear auth keys
  localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER_ROLE);
  localStorage.removeItem(STORAGE_KEYS.USER_ID);
  // Preserve other keys like theme, language, etc.
};

if (res.status === 401) {
  clearAuthStorage();
  window.location.href = "/login";
}
```

**Files to Fix**:

- [ ] frontend/src/CustomerMaster.jsx (L20-21)
- [ ] frontend/src/SalesForm.jsx (search for localStorage.clear)
- [ ] frontend/src/App.jsx (search for localStorage.clear)

**Test Cases**:

- [ ] On 401, only auth keys are cleared
- [ ] User preferences persist
- [ ] Navigate back to login
- [ ] Can login again

---

### 3.5 Fix Orphaned File Cleanup on Upload Failure

**Severity**: MEDIUM | **Files**: frontend/src/SalesForm.jsx  
**Lines**: L252-265

**Problem**:

```javascript
// BEFORE - Blob stays in memory if upload fails
blob = await compressImage(blob);
const response = await uploadFile(blob);
if (!response.ok) {
  // But blob is still in memory!
}
```

**Solution**:

- Explicitly revoke blob URLs
- Clear state on failure
- Add memory cleanup

**Implementation**:

```javascript
// AFTER
const handleUploadPhoto = async (photo) => {
  const photoId = photo.id;
  const blobUrl = URL.createObjectURL(photo.blob);

  try {
    setLocationPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, blobUrl } : p)),
    );

    const response = await uploadFile(photo.blob);
    if (!response.ok) {
      throw new Error("Upload failed");
    }
  } catch (error) {
    console.error("Photo upload failed:", error);
    // Clean up blob URL
    URL.revokeObjectURL(blobUrl);
    // Remove from state
    setLocationPhotos((prev) => prev.filter((p) => p.id !== photoId));
    setError("Photo upload failed. Try again.");
  }
};
```

**Files to Fix**:

- [ ] frontend/src/SalesForm.jsx (L252-265)
- [ ] frontend/src/OrderPhotos.jsx (photo upload logic)

**Test Cases**:

- [ ] Upload large photo → simulate network error
- [ ] Verify blob URL is cleaned up
- [ ] Memory usage doesn't grow

---

## PHASE 4: LOW PRIORITY FIXES (POLISH & OPTIMIZATION)

**Estimated Time**: 2-3 hours | **Effort**: Low  
**Impact**: Better UX, performance, code quality

### 4.1 Fix Missing Loading States

**Severity**: LOW | **Files**: ManagerDashboard.jsx, CustomerMaster.jsx

- [ ] Add loading skeleton for orders
- [ ] Add loading spinner for customer search
- [ ] Disable buttons while submitting

### 4.2 Improve Error Messages

**Severity**: LOW | **Files**: All error handlers

- [ ] Replace generic "An error occurred" with specific messages
- [ ] Show which field failed validation
- [ ] Provide recovery suggestions

### 4.3 Fix Memory Leak in Blob URLs

**Severity**: LOW | **Files**: PhotoModal.jsx

- [ ] Add URL.revokeObjectURL() on unmount
- [ ] Track created blob URLs in state
- [ ] Clean up on component unmount

### 4.4 Add Request Retry Logic

**Severity**: LOW | **Files**: All fetch calls

- [ ] Add exponential backoff retry for failed requests
- [ ] Retry max 3 times for network errors
- [ ] Don't retry for 4xx errors

### 4.5 Validate Input Trimming Consistently

**Severity**: LOW | **Files**: All form inputs

- [ ] Use `.trim()` on all text inputs
- [ ] Validate no whitespace-only values
- [ ] Be consistent across frontend and backend

---

## IMPLEMENTATION TIMELINE

| Phase     | Priority | Duration   | Start | End   | Status  |
| --------- | -------- | ---------- | ----- | ----- | ------- |
| Phase 1   | CRITICAL | 4-6h       | Now   | Day 1 | ⏳ TODO |
| Phase 2   | HIGH     | 3-4h       | Day 1 | Day 2 | ⏳ TODO |
| Phase 3   | MEDIUM   | 4-5h       | Day 2 | Day 3 | ⏳ TODO |
| Phase 4   | LOW      | 2-3h       | Day 3 | Day 3 | ⏳ TODO |
| **TOTAL** | -        | **13-18h** |       |       |         |

---

## QUICK REFERENCE: MOST CRITICAL FIXES

**MUST DO FIRST (Do today)**:

1. Fix `.catch(() => {})` blocks → Add error logging
2. Add `res.ok` checks → Prevent crashes on error responses
3. Fix hard-coded username → Use role-based access
4. Fix localStorage key inconsistency → Use constants
5. Fix Socket.IO memory leaks → Proper cleanup

**DO NEXT (Tomorrow)**: 6. Validate backup restore data → Prevent data corruption 7. Validate file paths → Prevent directory traversal 8. Check Socket.IO connection → Show offline status 9. Validate photo size before compression → Save CPU

---

## TESTING CHECKLIST

After completing each phase:

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Manual testing of fixed features
- [ ] Browser console has no errors/warnings
- [ ] Network tab shows no failed requests
- [ ] Memory profiler shows no leaks
- [ ] Performance metrics improved

---

## SUCCESS CRITERIA

✅ **Phase 1 Complete**: App doesn't crash, errors shown to users, auth works correctly  
✅ **Phase 2 Complete**: No security vulnerabilities, data integrity preserved  
✅ **Phase 3 Complete**: No memory leaks, smooth UX, proper error handling  
✅ **Phase 4 Complete**: Professional polish, good performance, great UX

**Go ahead and I'll implement Phase 1 first!**
