This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Run development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Novel Store Features

Fitur utama:
- Login/Register/Logout (cookie HttpOnly session)
- Checkout novel via PayPal atau Midtrans
- Riwayat order user login

## API Endpoints

Auth:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Orders:
- `GET /api/orders`

Checkout:
- `POST /api/checkout/paypal`
- `GET /api/checkout/paypal/capture`
- `POST /api/checkout/midtrans`
- `GET /api/checkout/midtrans/finish`
- `POST /api/checkout/paypal-cart`
- `POST /api/checkout/midtrans-cart`

Webhooks:
- `POST /api/webhooks/paypal`
- `POST /api/webhooks/midtrans`

## Environment Variables

Buat `.env.local`:

```bash
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_WEBHOOK_ID=your_paypal_webhook_id

MIDTRANS_SERVER_KEY=your_midtrans_server_key

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Catatan:
- Midtrans endpoint saat ini dipaksa ke Snap Sandbox.
- Store user/order saat ini in-memory (reset saat server restart), cocok untuk development/demo.
- Return URL PayPal sekarang diarahkan ke endpoint capture (`/api/checkout/paypal/capture`) agar status order bisa berubah ke `paid` segera setelah user selesai bayar.
- UI cart menyimpan item di `localStorage` browser (`evrit_cart_v1`) agar cart tetap ada saat reload.

## Webhook Test Dengan Ngrok

1. Jalankan app lokal:

```bash
npm run dev
```

2. Jalankan tunnel ngrok ke port app kamu (contoh `3001`):

```bash
ngrok http 3001
```

3. Simpan URL ngrok, contoh:

```text
https://abc123.ngrok-free.app
```

4. Daftarkan webhook URL:
- PayPal webhook URL: `https://abc123.ngrok-free.app/api/webhooks/paypal`
- Midtrans payment notification URL: `https://abc123.ngrok-free.app/api/webhooks/midtrans`

### Uji PayPal (Sandbox)

1. Di PayPal Developer Dashboard, buat webhook ke URL:
`https://abc123.ngrok-free.app/api/webhooks/paypal`
2. Subscribe minimal event:
- `CHECKOUT.ORDER.APPROVED`
- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.DENIED`
3. Simpan `Webhook ID` ke `.env.local` sebagai `PAYPAL_WEBHOOK_ID`.
4. Gunakan fitur **Send Test Webhook** dari dashboard untuk kirim event.
5. Cek status order di UI riwayat order.

### Uji Midtrans (Sandbox)

Midtrans mengirim callback dengan signature SHA512:
`sha512(order_id + status_code + gross_amount + server_key)`.

Contoh uji manual via `curl`:

```bash
ORDER_ID="NOVEL-TEST-001"
STATUS_CODE="200"
GROSS_AMOUNT="199000.00"
SERVER_KEY="SB-Mid-server-xxx"
SIGNATURE=$(node -e "const c=require('crypto');const [o,s,g,k]=process.argv.slice(1);process.stdout.write(c.createHash('sha512').update(o+s+g+k).digest('hex'))" "$ORDER_ID" "$STATUS_CODE" "$GROSS_AMOUNT" "$SERVER_KEY")

curl -X POST "https://abc123.ngrok-free.app/api/webhooks/midtrans" \
  -H "Content-Type: application/json" \
  -d "{
    \"order_id\":\"$ORDER_ID\",
    \"status_code\":\"$STATUS_CODE\",
    \"gross_amount\":\"$GROSS_AMOUNT\",
    \"signature_key\":\"$SIGNATURE\",
    \"transaction_status\":\"settlement\",
    \"fraud_status\":\"accept\"
  }"
```

Catatan penting test:
- `order_id` webhook harus sama dengan `paymentReference` order yang dibuat saat checkout, supaya status bisa ter-update.
