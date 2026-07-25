# صفحة إعداد مساعد واتساب — Amalal

الصفحة تقود العميل عبر أربع مراحل:

1. ربط واتساب وعرض QR.
2. اختيار نوع المساعد: بيع، دعم، أو الاثنين.
3. إدخال معلومات النشاط واللغة وأسلوب الرد.
4. مراجعة الإعدادات ثم تشغيل المساعد.

## الملفات

- `index.html`: الصفحة.
- `styles.css`: التصميم.
- `app.js`: منطق الخطوات والاتصال بالـAPI.
- `server-example.js`: Backend Proxy آمن بين الصفحة وn8n.
- `package.json`: تشغيل مثال Node.js.

## تركيب سريع

ضع `index.html` و`styles.css` و`app.js` داخل مجلد `public`.

ثم:

```bash
npm install
npm start
```

أضف في Coolify لخدمة الموقع:

```env
AMALAL_N8N_URL=https://n8n.amalal.cloud
AMALAL_APP_SECRET=نفس_السر_الموجود_في_n8n
PORT=3000
```

## مهم أمنياً

لا تضع `EVOLUTION_API_KEY` ولا `AMALAL_APP_SECRET` داخل `app.js` أو `index.html`.

المتصفح ينادي فقط:

- `POST /api/whatsapp/connect`
- `GET /api/whatsapp/status`
- `POST /api/assistant/config`

والـBackend هو الذي يتواصل مع n8n باستعمال السر.

## بيانات المستخدم بعد Login

في الإنتاج، خذ المستخدم من Session في `server-example.js`:

```js
return req.user;
```

ولا تعتمد على `userId` القادم من المتصفح.

## Endpoint حفظ إعدادات المساعد

الصفحة تنتظر Workflow في n8n بهذا المسار:

```text
POST /webhook/amalal-save-assistant-config
```

ويجب أن يرجع:

```json
{
  "ok": true
}
```
