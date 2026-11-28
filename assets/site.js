/* ATT Florida — site script
 * 1. Mobile menu
 * 2. Pre-qualification form with passport uploads
 *
 * FORM_ENDPOINT: paste the Google Apps Script "Web app" URL here (see apps-script/README).
 * While it is empty the form runs in preview mode and nothing is sent.
 */
const FORM_ENDPOINT = "";
const PASSPORT_MIN_VALID = "2027-11-01"; // 6 months after the May 1, 2027 return
const MAX_FILE_MB = 8;
const PRICE_PP = 3570;
const PAYMENT_DEADLINE = new Date(2027, 2, 7); // balance fully paid by the first week of March 2027

// Monthly installments start next month and must end by March 2027, capped at 4.
function maxInstallments(today = new Date()) {
  if (today > PAYMENT_DEADLINE) return 0;
  const months = (2027 - today.getFullYear()) * 12 + (2 - today.getMonth()); // months until March 2027
  return Math.max(1, Math.min(4, months));
}

/* ---------- Menu ---------- */
(() => {
  const btn = document.querySelector(".menu-btn");
  const nav = document.getElementById("nav");
  if (!btn || !nav) return;
  btn.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
  });
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) { nav.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); }
  });
})();

/* ---------- Form ---------- */
(() => {
  const form = document.getElementById("lead-form");
  if (!form) return;
  const list = document.getElementById("travelers");
  const tpl = document.getElementById("traveler-tpl");
  const count = document.getElementById("f-count");
  const status = document.getElementById("form-status");
  const submit = document.getElementById("f-submit");

  function renderTravelers() {
    const want = Number(count.value);
    while (list.children.length < want) {
      const i = list.children.length + 1;
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.querySelector("[data-n]").textContent = i;
      node.querySelectorAll("[data-k]").forEach((el) => {
        const id = `t${i}-${el.dataset.k}`;
        el.id = id;
        el.name = id;
        const label = node.querySelector(`[data-for="${el.dataset.k}"]`);
        if (label) label.htmlFor = id;
      });
      wireTraveler(node);
      list.appendChild(node);
    }
    while (list.children.length > want) list.lastElementChild.remove();
    if (want === 1) {
      const first = list.querySelector('[data-k="name"]');
      const owner = document.getElementById("f-name");
      if (first && !first.value && owner.value) first.value = owner.value;
    }
  }

  function wireTraveler(node) {
    const expiry = node.querySelector('[data-k="expiry"]');
    const warn = node.querySelector("[data-expiry-warn]");
    expiry.addEventListener("change", () => { warn.hidden = !expiry.value || expiry.value >= PASSPORT_MIN_VALID; });

    const drop = node.querySelector("[data-drop]");
    const input = node.querySelector('[data-k="passport"]');
    const nameOut = node.querySelector("[data-file-name]");
    const show = () => {
      const f = input.files[0];
      nameOut.textContent = f ? `${f.name} · ${(f.size / 1048576).toFixed(1)} MB` : "";
      input.removeAttribute("aria-invalid");
      drop.style.borderColor = "";
    };
    input.addEventListener("change", show);
    ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("over")));
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      if (e.dataTransfer.files.length) { input.files = e.dataTransfer.files; show(); }
    });
  }

  count.addEventListener("change", () => { renderTravelers(); renderPlan(); });
  renderTravelers();

  // Payment plan: 50% deposit, balance in up to 4 installments
  const instField = document.getElementById("installments-field");
  const instSel = document.getElementById("f-installments");
  const summary = document.getElementById("plan-summary");
  const usd = (n) => "US$ " + n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  function planText() {
    const people = Number(count.value);
    const total = PRICE_PP * people;
    const plan = form.querySelector('input[name="plan"]:checked')?.value;
    const who = people === 1 ? "1 traveler" : people + " travelers";
    if (plan === "Pay in full") return `Total for ${who}: ${usd(total)}, paid in full. Airfare not included.`;
    const n = Number(instSel.value);
    const each = Math.round((total / 2 / n) * 100) / 100;
    return `Total for ${who}: ${usd(total)}. 50% deposit: ${usd(total / 2)}. Then ${n === 1 ? "1 payment" : n + " monthly installments"} of ${usd(each)}, fully paid by the first week of March 2027. Airfare not included.`;
  }
  const maxN = maxInstallments();
  [...instSel.options].forEach((o) => { o.disabled = Number(o.value) > maxN; o.hidden = o.disabled; });
  if (Number(instSel.value) > maxN) instSel.value = String(Math.max(1, maxN));
  if (maxN === 0) {
    const full = form.querySelector('input[name="plan"][value="Pay in full"]');
    full.checked = true;
    form.querySelector('input[name="plan"][value="50% deposit + installments"]').closest("label").hidden = true;
  }
  function renderPlan() {
    instField.hidden = form.querySelector('input[name="plan"]:checked')?.value === "Pay in full";
    summary.textContent = planText();
  }
  form.querySelectorAll('input[name="plan"]').forEach((el) => el.addEventListener("change", renderPlan));
  instSel.addEventListener("change", renderPlan);
  renderPlan();

  function setStatus(msg, isError) {
    status.hidden = false;
    status.textContent = msg;
    status.classList.toggle("error", !!isError);
  }

  function validate() {
    let firstBad = null;
    form.querySelectorAll("input, select, textarea").forEach((el) => {
      el.removeAttribute("aria-invalid");
      let ok = el.checkValidity();
      if (ok && el.type === "file" && el.files[0] && el.files[0].size > MAX_FILE_MB * 1048576) ok = false;
      if (!ok) {
        el.setAttribute("aria-invalid", "true");
        if (el.type === "file") el.closest("[data-drop]").style.borderColor = "var(--red)";
        firstBad = firstBad || el;
      }
    });
    if (firstBad) {
      const isFile = firstBad.type === "file";
      const tooBig = isFile && firstBad.files[0];
      setStatus(
        tooBig ? `One passport file is larger than ${MAX_FILE_MB} MB. Please upload a smaller photo or PDF.`
        : isFile ? "Please upload a passport copy for every traveler."
        : firstBad.type === "checkbox" ? "Please accept the passport authorization to continue."
        : "Please fill in the highlighted fields.",
        true
      );
      (isFile ? firstBad.closest("[data-drop]") : firstBad).scrollIntoView({ behavior: "smooth", block: "center" });
      if (!isFile) firstBad.focus({ preventScroll: true });
      return false;
    }
    return true;
  }

  // Shrink large photos before upload so phone pictures go through quickly.
  async function fileToPayload(file) {
    let blob = file;
    if (/^image\/(jpeg|png|webp)$/.test(file.type) && file.size > 1.5 * 1048576) {
      try {
        const bmp = await createImageBitmap(file);
        const scale = Math.min(1, 2200 / Math.max(bmp.width, bmp.height));
        const c = document.createElement("canvas");
        c.width = Math.round(bmp.width * scale);
        c.height = Math.round(bmp.height * scale);
        c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
        blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85)) || file;
      } catch (_) { blob = file; }
    }
    const data = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const name = blob === file ? file.name : file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return { name, type: blob.type || file.type || "application/octet-stream", data };
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const fd = new FormData(form);
    const travelers = [...list.children].map((node, idx) => {
      const v = (k) => node.querySelector(`[data-k="${k}"]`);
      return {
        n: idx + 1,
        name: v("name").value.trim(),
        dob: v("dob").value,
        nationality: v("nationality").value.trim(),
        expiry: v("expiry").value,
        expiresTooSoon: v("expiry").value < PASSPORT_MIN_VALID,
        file: v("passport").files[0],
      };
    });

    if (!FORM_ENDPOINT) {
      showDone(true);
      return;
    }

    submit.disabled = true;
    submit.textContent = "Sending…";
    setStatus("Uploading passports. This can take a moment on mobile data.");
    try {
      for (const t of travelers) t.passport = await fileToPayload(t.file);
      const payload = {
        package: "Natal & Rio de Janeiro · Private group · Apr 19 – May 1, 2027",
        submittedAt: new Date().toISOString(),
        fullName: fd.get("fullName"), email: fd.get("email"), phone: fd.get("phone"),
        residence: fd.get("residence"), travelers: travelers.length, room: fd.get("room"),
        flights: fd.get("flights"),
        questions: fd.get("questions"), payment: fd.get("payment"),
        plan: fd.get("plan") === "Pay in full" ? "Pay in full" : `50% deposit + ${fd.get("installments")}x`,
        planSummary: planText(),
        notes: fd.get("notes"),
        emergencyName: fd.get("emergencyName"), emergencyPhone: fd.get("emergencyPhone"),
        travelerDetails: travelers.map(({ file, ...rest }) => rest),
      };
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // avoids a CORS preflight on Apps Script
        body: JSON.stringify(payload),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || out.ok === false) throw new Error(out.error || `HTTP ${res.status}`);
      showDone(false);
    } catch (err) {
      submit.disabled = false;
      submit.textContent = "Submit reservation";
      setStatus("We couldn't send your reservation. Check your connection and try again. If it keeps failing, contact ATT Florida directly.", true);
    }
  });

  function showDone(preview) {
    const name = String(new FormData(form).get("fullName") || "").split(" ")[0];
    const box = document.createElement("div");
    box.className = "done";
    const h = document.createElement("h2");
    h.textContent = preview ? "Preview: reservation not sent" : `Thank you${name ? ", " + name : ""}!`;
    const p = document.createElement("p");
    p.className = "note";
    p.textContent = preview
      ? "This preview isn't connected to a destination yet, so nothing was stored. On the live site, the reservation and passport copies go straight to the ATT Florida team."
      : "We received your reservation and passport copies. Our team will confirm your spot and send you a secure payment link.";
    const wm = document.createElement("img");
    wm.className = "watermark on-light";
    wm.src = "assets/in-god-we-trust.png"; wm.alt = "";
    box.append(h, p, wm);
    if (preview) {
      const back = document.createElement("button");
      back.type = "button"; back.className = "btn btn-navy"; back.textContent = "Back to the form";
      back.addEventListener("click", () => { box.replaceWith(form); status.hidden = true; });
      box.append(back);
    }
    form.replaceWith(box);
    box.scrollIntoView({ behavior: "smooth", block: "center" });
  }
})();
