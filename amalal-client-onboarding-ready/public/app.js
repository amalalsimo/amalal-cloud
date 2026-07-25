(() => {
  "use strict";

  const config = window.AMALAL_CONFIG || { apiBase: "/api" };
  const currentUser = window.AMALAL_USER || {};
  const state = {
    step: 1,
    instanceName: "",
    connected: false,
    assistantMode: "",
    form: {},
    statusTimer: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const modeLabels = {
    sales: "البيع واستقبال الطلبات",
    support: "خدمة العملاء",
    sales_support: "البيع + خدمة العملاء"
  };

  const languageLabels = {
    darija: "الدارجة المغربية",
    arabic: "العربية",
    french: "الفرنسية",
    english: "الإنجليزية",
    auto: "حسب لغة العميل"
  };

  const toneLabels = {
    friendly: "ودي وبسيط",
    professional: "مهني ورسمي",
    short: "مختصر ومباشر",
    persuasive: "تجاري ومقنع"
  };

  function apiUrl(path) {
    return `${String(config.apiBase || "").replace(/\/$/, "")}${path}`;
  }

  function showAlert(message) {
    const box = $("#globalAlert");
    box.textContent = message;
    box.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearAlert() {
    $("#globalAlert").classList.add("hidden");
  }

  function setStep(step) {
    clearAlert();
    state.step = step;

    $$(".wizard-step").forEach(section => {
      section.classList.toggle("is-visible", Number(section.dataset.step) === step);
    });

    $$(".step-item").forEach(item => {
      const itemStep = Number(item.dataset.stepIndicator);
      item.classList.toggle("is-active", itemStep === step);
      item.classList.toggle("is-complete", itemStep < step);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function parseJsonResponse(response) {
    const text = await response.text();
    let data;

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error("الخادم رجّع جواباً غير صالح. تأكد من ربط Backend مع n8n.");
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || "تعذر إتمام العملية.");
    }

    return data;
  }

  async function startWhatsAppConnection() {
    clearAlert();

    $("#connectIdle").classList.add("hidden");
    $("#qrState").classList.add("hidden");
    $("#connectedState").classList.add("hidden");
    $("#connectLoading").classList.remove("hidden");

    try {
      const response = await fetch(apiUrl("/whatsapp/connect"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userId: String(currentUser.id || ""),
          email: String(currentUser.email || "")
        })
      });

      const data = await parseJsonResponse(response);
      state.instanceName = data.instanceName || state.instanceName;

      if (data.connected) {
        markConnected();
        return;
      }

      if (!data.qrCode) {
        throw new Error(data.error || "لم يتم إنشاء QR. أعد المحاولة بعد لحظات.");
      }

      $("#qrImage").src = data.qrCode;
      $("#connectLoading").classList.add("hidden");
      $("#qrState").classList.remove("hidden");
      $("#connectionStatus").textContent = "في انتظار مسح QR...";
      $("#connectionStatus").className = "status-box status-waiting";

      startStatusPolling();
    } catch (error) {
      $("#connectLoading").classList.add("hidden");
      $("#connectIdle").classList.remove("hidden");
      showAlert(error.message || "تعذر إنشاء اتصال واتساب.");
    }
  }

  function startStatusPolling() {
    clearInterval(state.statusTimer);
    state.statusTimer = setInterval(checkConnectionStatus, 3000);
    checkConnectionStatus();
  }

  async function checkConnectionStatus() {
    try {
      const params = new URLSearchParams({
        userId: String(currentUser.id || ""),
        instanceName: state.instanceName || ""
      });

      const response = await fetch(
        `${apiUrl("/whatsapp/status")}?${params.toString()}`,
        { credentials: "include", cache: "no-store" }
      );

      const data = await parseJsonResponse(response);

      if (data.connected) {
        markConnected();
        return;
      }

      $("#connectionStatus").textContent =
        `الحالة: ${data.status || data.state || "في انتظار مسح الرمز"}`;
    } catch {
      $("#connectionStatus").textContent = "تعذر فحص الحالة مؤقتاً...";
    }
  }

  function markConnected() {
    clearInterval(state.statusTimer);
    state.connected = true;

    $("#connectLoading").classList.add("hidden");
    $("#qrState").classList.add("hidden");
    $("#connectIdle").classList.add("hidden");
    $("#connectedState").classList.remove("hidden");

    $("#connectedInstanceText").textContent = state.instanceName
      ? `تم تجهيز الاتصال: ${state.instanceName}`
      : "رقمك جاهز لاستقبال الرسائل.";
  }

  function validateMode() {
    const selected = $('input[name="assistantMode"]:checked');

    if (!selected) {
      showAlert("اختار أولاً كيف تريد أن يعمل المساعد.");
      return false;
    }

    state.assistantMode = selected.value;
    return true;
  }

  function validateAssistantForm() {
    const form = $("#assistantForm");
    const requiredFields = $$("[required]", form);
    let valid = true;

    requiredFields.forEach(field => {
      const empty = !String(field.value || "").trim();
      field.classList.toggle("field-error", empty);
      valid = valid && !empty;
    });

    if (!valid) {
      showAlert("كمّل المعلومات المطلوبة قبل المتابعة.");
      return false;
    }

    const formData = new FormData(form);
    state.form = Object.fromEntries(formData.entries());
    return true;
  }

  function renderReview() {
    const f = state.form;
    const rows = [
      ["نوع المساعد", modeLabels[state.assistantMode] || state.assistantMode],
      ["اسم النشاط", f.businessName],
      ["نوع النشاط", f.businessType],
      ["اللغة", languageLabels[f.language] || f.language],
      ["أسلوب الرد", toneLabels[f.tone] || f.tone],
      ["وصف النشاط", f.businessDescription],
      ["رسالة الترحيب", f.welcomeMessage || "سيتم استعمال رسالة افتراضية"],
      ["أوقات العمل", f.workingHours || "غير محددة"],
      ["التحويل لموظف", $("#handoffRule option:checked").textContent],
      ["تعليمات إضافية", f.restrictions || "لا توجد"]
    ];

    $("#reviewBox").innerHTML = `
      <div class="review-section">
        <h3>إعدادات المساعد</h3>
        ${rows.map(([label, value]) => `
          <div class="review-row">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value || "—")}</strong>
          </div>
        `).join("")}
      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function saveAssistantConfiguration() {
    clearAlert();

    const button = $("#activateBtn");
    const previousText = button.textContent;
    button.disabled = true;
    button.textContent = "جاري الحفظ والتشغيل...";

    try {
      const payload = {
        userId: String(currentUser.id || ""),
        email: String(currentUser.email || ""),
        instanceName: state.instanceName,
        assistantMode: state.assistantMode,
        ...state.form
      };

      const response = await fetch(apiUrl("/assistant/config"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
      });

      const data = await parseJsonResponse(response);

      if (data.ok === false) {
        throw new Error(data.error || "تعذر حفظ إعدادات المساعد.");
      }

      localStorage.setItem(
        `amalal-assistant-${currentUser.id || "demo"}`,
        JSON.stringify(payload)
      );

      $("#resultMode").textContent = modeLabels[state.assistantMode] || "مساعد ذكي";
      setStep(5);
    } catch (error) {
      showAlert(error.message || "تعذر تشغيل المساعد.");
    } finally {
      button.disabled = false;
      button.textContent = previousText;
    }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(`amalal-assistant-${currentUser.id || "demo"}`);
      if (!raw) return;

      const draft = JSON.parse(raw);

      if (draft.assistantMode) {
        const radio = $(`input[name="assistantMode"][value="${draft.assistantMode}"]`);
        if (radio) radio.checked = true;
      }

      Object.entries(draft).forEach(([key, value]) => {
        const field = document.getElementById(key);
        if (field && typeof value === "string") field.value = value;
      });
    } catch {
      // Ignore invalid local draft.
    }
  }

  $("#connectBtn").addEventListener("click", startWhatsAppConnection);
  $("#refreshQrBtn").addEventListener("click", startWhatsAppConnection);

  $$("[data-next-step]").forEach(button => {
    button.addEventListener("click", () => setStep(Number(button.dataset.nextStep)));
  });

  $$("[data-prev-step]").forEach(button => {
    button.addEventListener("click", () => setStep(Number(button.dataset.prevStep)));
  });

  $("#modeNextBtn").addEventListener("click", () => {
    if (!validateMode()) return;
    setStep(3);
  });

  $("#assistantForm").addEventListener("submit", event => {
    event.preventDefault();

    if (!validateAssistantForm()) return;

    renderReview();
    setStep(4);
  });

  $("#activateBtn").addEventListener("click", saveAssistantConfiguration);

  $("#restartBtn").addEventListener("click", () => {
    setStep(2);
  });

  loadDraft();
})();
