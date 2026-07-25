/**
 * Amalal Backend Proxy
 * Node.js 18+ / Express
 *
 * الهدف:
 * - عدم إرسال AMALAL_APP_SECRET إلى المتصفح.
 * - أخذ userId من Session الحقيقية.
 * - تمرير الطلبات من الموقع إلى n8n.
 *
 * Environment Variables:
 * AMALAL_N8N_URL=https://n8n.amalal.cloud
 * AMALAL_APP_SECRET=ضع_السر_الخاص_بالموقع
 */

import express from "express";

const app = express();
app.use(express.json());
app.use(express.static("public"));

const N8N_URL = process.env.AMALAL_N8N_URL;
const APP_SECRET = process.env.AMALAL_APP_SECRET;

function requireConfig() {
  if (!N8N_URL || !APP_SECRET) {
    throw new Error("Missing AMALAL_N8N_URL or AMALAL_APP_SECRET");
  }
}

function getLoggedInUser(req) {
  // في الإنتاج: استعمل req.user أو Session ديالك.
  // هذا fallback للتجربة فقط.
  return req.user || {
    id: req.body?.userId || req.query?.userId || "demo-user",
    email: req.body?.email || "demo@example.com"
  };
}

async function n8nJson(path, options = {}) {
  requireConfig();

  const response = await fetch(`${N8N_URL.replace(/\/$/, "")}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-amalal-secret": APP_SECRET,
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`n8n returned non-JSON response (${response.status})`);
  }

  if (!response.ok) {
    const error = new Error(data.error || data.message || "n8n request failed");
    error.status = response.status;
    throw error;
  }

  return data;
}

app.post("/api/whatsapp/connect", async (req, res) => {
  try {
    const user = getLoggedInUser(req);

    const data = await n8nJson("/webhook/amalal-provision-whatsapp", {
      method: "POST",
      body: JSON.stringify({
        userId: String(user.id),
        email: user.email || ""
      })
    });

    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message });
  }
});

app.get("/api/whatsapp/status", async (req, res) => {
  try {
    const user = getLoggedInUser(req);

    const params = new URLSearchParams({
      userId: String(user.id)
    });

    const data = await n8nJson(
      `/webhook/amalal-whatsapp-status?${params.toString()}`,
      { method: "GET" }
    );

    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message });
  }
});

app.post("/api/assistant/config", async (req, res) => {
  try {
    const user = getLoggedInUser(req);

    const payload = {
      ...req.body,
      userId: String(user.id),
      email: user.email || req.body.email || ""
    };

    /*
      أنشئ Workflow في n8n بمسار:
      POST /webhook/amalal-save-assistant-config

      دوره:
      1. التحقق من x-amalal-secret
      2. حفظ إعدادات المستخدم في قاعدة البيانات
      3. إرجاع { "ok": true }
    */
    const data = await n8nJson("/webhook/amalal-save-assistant-config", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Amalal onboarding running");
});
