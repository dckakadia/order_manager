import json

with open('scratch/db_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

customers = data['customers']
items = data['items']
orders = data['orders']
users = data['users']

def fmt_date(d):
    if not d:
        return '—'
    return d[:10]  # YYYY-MM-DD

def fmt_price(p):
    if p is None:
        return '—'
    return f"₹{int(p):,}"

# ── Build Markdown ─────────────────────────────────────────────
lines = []

# ── CUSTOMERS ──────────────────────────────────────────────────
lines.append("# 🗄️ Ocean Spas — Full Database View\n")
lines.append(f"*Snapshot as of {__import__('datetime').datetime.now().strftime('%d %b %Y, %H:%M IST')}*\n")

lines.append("\n---\n")
lines.append(f"## 👤 Customers ({len(customers)})\n")
lines.append("| ID | Name | Phone | Email | Address | Tax No. | Active | Created |")
lines.append("|-----|------|-------|-------|---------|---------|--------|---------|")
for c in customers:
    lines.append(
        f"| {c['id']} | {c['name']} | {c.get('phone') or '—'} | {c.get('email') or '—'} | "
        f"{(c.get('shippingAddress') or '—')[:40]} | {c.get('taxNumber') or '—'} | "
        f"{'✅' if c.get('isActive') else '❌'} | {fmt_date(c.get('createdAt'))} |"
    )

# ── ITEMS ──────────────────────────────────────────────────────
lines.append("\n---\n")
lines.append(f"## 📦 Items / Models ({len(items)})\n")
lines.append("| ID | Name | Category | Base Price | Silver | Gold | Platinum | Titanium | Active |")
lines.append("|-----|------|----------|-----------|--------|------|----------|----------|--------|")
for i in items:
    lines.append(
        f"| {i['id']} | {i['name']} | {i.get('category') or '—'} | {fmt_price(i.get('price'))} | "
        f"{fmt_price(i.get('silverPrice'))} | {fmt_price(i.get('goldPrice'))} | "
        f"{fmt_price(i.get('platinumPrice'))} | {fmt_price(i.get('titaniumPrice'))} | "
        f"{'✅' if i.get('isActive') else '❌'} |"
    )

# ── ORDERS ─────────────────────────────────────────────────────
lines.append("\n---\n")
lines.append(f"## 🛒 Orders ({len(orders)})\n")
lines.append("| ID | Customer | Model | Variant | Faucet | Panel | Price | Delivery | Status | Order By | Created |")
lines.append("|-----|---------|-------|---------|--------|-------|-------|----------|--------|----------|---------|")
for o in orders:
    cname = (o.get('customer') or {}).get('name', '—')
    lines.append(
        f"| {o['id']} | {cname} | {o.get('baseModel') or '—'} | {o.get('variant') or '—'} | "
        f"{o.get('faucetPosition') or '—'} | {o.get('sidePanel') or '—'} | "
        f"{fmt_price(o.get('totalPrice'))} | {fmt_date(o.get('deliveryDate'))} | "
        f"{o.get('status') or '—'} | {o.get('orderBy') or '—'} | {fmt_date(o.get('createdAt'))} |"
    )

# ── USERS ──────────────────────────────────────────────────────
lines.append("\n---\n")
lines.append(f"## 🔐 Users ({len(users)})\n")
lines.append("| ID | Username | Role | Active | Created |")
lines.append("|-----|---------|------|--------|---------|")
for u in users:
    lines.append(
        f"| {u['id']} | {u['username']} | {u['role']} | "
        f"{'✅' if u.get('isActive') else '❌'} | {fmt_date(u.get('createdAt'))} |"
    )

with open('scratch/db_view.md', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print("Done. Lines:", len(lines))
