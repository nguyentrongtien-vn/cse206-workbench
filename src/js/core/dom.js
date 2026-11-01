(() => {
  const $ = (id) => document.getElementById(id);
  function toast(m) {
    const t = $("toast");
    t.textContent = m;
    t.style.opacity = "1";
    t.style.transform = "translateY(0)";
    clearTimeout(toast.timeout);
    toast.timeout = setTimeout(() => {
      t.style.opacity = "0";
      t.style.transform = "translateY(8px)";
    }, 1800);
  }

  function fbCopy(s) {
    const a = document.createElement("textarea");
    a.value = s;
    document.body.appendChild(a);
    a.select();
    try {
      document.execCommand("copy");
      toast("Đã copy!");
    } catch (e) {
      toast("Copy thất bại");
    }
    a.remove();
  }

  function copyText(s) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(s)
        .then(() => toast("Đã copy!"))
        .catch(() => fbCopy(s));
    } else {
      fbCopy(s);
    }
  }

  function fbHTML(h) {
    const d = document.createElement("div");
    d.contentEditable = true;
    d.style.cssText = "position:fixed;left:-9999px";
    d.innerHTML = h;
    document.body.appendChild(d);
    const r = document.createRange();
    r.selectNodeContents(d);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    try {
      document.execCommand("copy");
      toast("Đã copy!");
    } catch (e) {
      toast("Copy thất bại");
    }
    s.removeAllRanges();
    d.remove();
  }

  function copyHTML(h, txt) {
    try {
      const it = new ClipboardItem({
        "text/html": new Blob([h], { type: "text/html" }),
        "text/plain": new Blob([txt], { type: "text/plain" }),
      });
      navigator.clipboard
        .write([it])
        .then(() => toast("Đã copy!"))
        .catch(() => fbHTML(h));
    } catch (e) {
      fbHTML(h);
    }
  }

  const tbl = (h, rows) =>
    `<table class="t"><tr>${h.map((x) => `<th>${x}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((x) => `<td>${x}</td>`).join("")}</tr>`).join("")}</table>`;

  function getSanitizedParams() {
    let n = parseInt($("n").value) || 4;
    let m = parseInt($("m").value) || 2;
    n = Math.max(1, Math.min(8, n));
    m = Math.max(1, Math.min(16, m));
    $("n").value = n;
    $("m").value = m;
    return { n, m };
  }

    window.$ = $;
    window.CSE206.dom = { $, toast, copyText, copyHTML, tbl, getSanitizedParams };
})();
