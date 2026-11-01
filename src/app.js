const $ = (id) => document.getElementById(id);
      const VAR_NAMES = ["A", "B", "C", "D", "E", "F", "G", "H"];
      let tt = [],
  inputLabels = [...VAR_NAMES],
  outputLabels = Array.from({ length: 16 }, (_, i) => `Y${i}`),
  last = null,
        activeModalOutputIdx = 0,
        activeModalFormat = "word";

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

      function applyLabelSeries(type) {
        const { n, m } = getSanitizedParams();
        const isInput = type === "input";
        const count = isInput ? n : m;
        const labels = isInput ? inputLabels : outputLabels;
        const seriesInput = $(isInput ? "input-label-series" : "output-label-series");
        const nextLabels = seriesInput.value.split(",").map((label) => label.trim());

        const otherLabels = isInput
          ? outputLabels.slice(0, m)
          : inputLabels.slice(0, n);
        const allLabels = [...nextLabels, ...otherLabels];
        if (nextLabels.length !== count) {
          toast(`Cần nhập đúng ${count} nhãn, phân tách bằng dấu phẩy.`);
          return;
        }
        if (
          allLabels.some((label) => !/^[A-Za-z_][A-Za-z0-9_]{0,15}$/.test(label)) ||
          new Set(allLabels.map((label) => label.toLowerCase())).size !== allLabels.length
        ) {
          toast("Nhãn không hợp lệ hoặc bị trùng. Dùng chữ/số/_ và đảm bảo các nhãn duy nhất.");
          return;
        }

        labels.splice(0, count, ...nextLabels);
        buildTT();
        solve();
        toast(isInput ? "Đã cập nhật nhãn biến." : "Đã cập nhật nhãn đầu ra.");
      }

      $("apply-input-labels").addEventListener("click", () =>
        applyLabelSeries("input"),
      );
      $("apply-output-labels").addEventListener("click", () =>
        applyLabelSeries("output"),
      );
      $("input-label-series").addEventListener("keydown", (e) => {
        if (e.key === "Enter") applyLabelSeries("input");
      });
      $("output-label-series").addEventListener("keydown", (e) => {
        if (e.key === "Enter") applyLabelSeries("output");
      });

      // Tool navigation
      document.querySelectorAll(".nav").forEach(
        (t) =>
          (t.onclick = () => {
            document
              .querySelectorAll(".nav")
              .forEach((x) => {
                const isActive = x === t;
                x.classList.toggle("on", isActive);
                if (isActive) x.setAttribute("aria-current", "page");
                else x.removeAttribute("aria-current");
              });
            document.querySelectorAll("main .tool-section").forEach((section) =>
              section.classList.toggle(
                "hidden",
                section.id !== "s" + t.dataset.t,
              ),
            );
            $("tool-title").textContent = t.dataset.title;
            $("tool-description").textContent = t.dataset.description;
            $("breadcrumb-current").textContent =
              t.dataset.t === "0" ? "K-MAP" : "CƠ SỐ";
            if (window.matchMedia("(max-width: 760px)").matches) {
              setSidebarCollapsed(true);
            }
          }),
      );

      const sidebarToggle = $("sidebar-toggle");
      function setSidebarCollapsed(collapsed) {
        document
          .querySelector(".app-shell")
          .classList.toggle("sidebar-collapsed", collapsed);
        const label = collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên";
        sidebarToggle.setAttribute("aria-label", label);
        sidebarToggle.title = label;
      }

      sidebarToggle.addEventListener("click", () => {
        setSidebarCollapsed(
          !document.querySelector(".app-shell").classList.contains("sidebar-collapsed"),
        );
      });

      /* ---------- K-Map & Truth Table Logic ---------- */
      function buildTT() {
        const { n, m } = getSanitizedParams();
        const R = 1 << n;
        tt = Array.from({ length: R }, (_, r) =>
          Array.from({ length: m }, (_, c) => (tt[r] && tt[r][c]) || "0"),
        );

        let h =
          '<table class="t"><tr>' +
          inputLabels.slice(0, n)
            .map(
              (label, i) =>
                `<th><input class="column-label" data-label-type="input" data-label-index="${i}" aria-label="Nhãn biến đầu vào ${i + 1}" maxlength="16" value="${label}"></th>`,
            )
            .join("") +
          outputLabels.slice(0, m)
            .map(
              (label, i) =>
                `<th><input class="column-label output-label" data-label-type="output" data-label-index="${i}" aria-label="Nhãn đầu ra ${i + 1}" maxlength="16" value="${label}"></th>`,
            )
            .join("") +
          "</tr>";
        for (let r = 0; r < R; r++) {
          h +=
            "<tr>" +
            r
              .toString(2)
              .padStart(n, "0")
              .split("")
              .map((b) => `<td>${b}</td>`)
              .join("") +
            tt[r]
              .map(
                (v, c) =>
                  `<td><select data-r="${r}" data-c="${c}">${["0", "1", "X"].map((o) => `<option ${o === v ? "selected" : ""}>${o}</option>`).join("")}</select></td>`,
              )
              .join("") +
            "</tr>";
        }
        $("tt").innerHTML = h + "</table>";
        $("kmap-summary").textContent = `${R} hàng · ${n} biến · ${m} đầu ra`;
        $("input-label-series").value = inputLabels.slice(0, n).join(", ");
        $("output-label-series").value = outputLabels.slice(0, m).join(", ");
      }

      $("tt").addEventListener("change", (e) => {
        const s = e.target;
        if (s.dataset.r !== undefined) {
          tt[s.dataset.r][s.dataset.c] = s.value;
          return;
        }

        if (s.dataset.labelType) {
          const label = s.value.trim();
          const { n, m } = getSanitizedParams();
          const labels = [
            ...inputLabels.slice(0, n),
            ...outputLabels.slice(0, m),
          ];
          const otherLabels = labels.filter(
            (_, i) =>
              i !==
              (s.dataset.labelType === "input"
                ? Number(s.dataset.labelIndex)
                : n + Number(s.dataset.labelIndex)),
          );
          if (!/^[A-Za-z_][A-Za-z0-9_]{0,15}$/.test(label)) {
            toast("Nhãn phải bắt đầu bằng chữ cái hoặc _, tối đa 16 ký tự.");
            s.value =
              s.dataset.labelType === "input"
                ? inputLabels[s.dataset.labelIndex]
                : outputLabels[s.dataset.labelIndex];
            return;
          }
          if (otherLabels.some((other) => other.toLowerCase() === label.toLowerCase())) {
            toast("Mỗi nhãn cột phải là duy nhất.");
            s.value =
              s.dataset.labelType === "input"
                ? inputLabels[s.dataset.labelIndex]
                : outputLabels[s.dataset.labelIndex];
            return;
          }

          if (s.dataset.labelType === "input")
            inputLabels[s.dataset.labelIndex] = label;
          else outputLabels[s.dataset.labelIndex] = label;
          s.value = label;
          $("input-label-series").value = inputLabels
            .slice(0, n)
            .join(", ");
          $("output-label-series").value = outputLabels
            .slice(0, m)
            .join(", ");
          solve();
        }
      });

      $("tt").addEventListener("input", (e) => {
        const s = e.target;
        if (!s.dataset.labelType) return;

        const label = s.value.trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]{0,15}$/.test(label)) return;
        const { n, m } = getSanitizedParams();
        const labels = [
          ...inputLabels.slice(0, n),
          ...outputLabels.slice(0, m),
        ];
        const currentIndex =
          s.dataset.labelType === "input"
            ? Number(s.dataset.labelIndex)
            : n + Number(s.dataset.labelIndex);
        const otherLabels = labels.filter((_, i) => i !== currentIndex);
        if (otherLabels.some((other) => other.toLowerCase() === label.toLowerCase())) {
          return;
        }

        if (s.dataset.labelType === "input")
          inputLabels[s.dataset.labelIndex] = label;
        else outputLabels[s.dataset.labelIndex] = label;
        $("input-label-series").value = inputLabels.slice(0, n).join(", ");
        $("output-label-series").value = outputLabels.slice(0, m).join(", ");
        solve();
      });

      $("n").onchange = $("m").onchange = () => {
        buildTT();
        solve();
      };

      function qm(on, dc) {
        if (!on.length) return [];
        let cur = new Map();
        [...on, ...dc].forEach((t) => cur.set(t + ",0", { v: t, m: 0 }));
        const P = [];

        while (cur.size) {
          const a = [...cur.values()],
            nx = new Map(),
            u = new Set();
          for (let i = 0; i < a.length; i++) {
            for (let j = i + 1; j < a.length; j++) {
              const x = a[i],
                y = a[j];
              if (x.m !== y.m) continue;
              const d = x.v ^ y.v;
              if (d && !(d & (d - 1))) {
                const v = x.v & ~d,
                  m = x.m | d;
                nx.set(v + "," + m, { v, m });
                u.add(i);
                u.add(j);
              }
            }
          }
          a.forEach((p, i) => {
            if (!u.has(i)) P.push(p);
          });
          cur = nx;
        }

        const cv = (p, t) => (t & ~p.m) === p.v,
          left = new Set(on),
          sel = [];
        on.forEach((t) => {
          const c = P.filter((p) => cv(p, t));
          if (c.length === 1 && !sel.includes(c[0])) sel.push(c[0]);
        });
        sel.forEach((p) => on.forEach((t) => cv(p, t) && left.delete(t)));

        while (left.size) {
          let b = null,
            bc = -1;
          P.forEach((p) => {
            const c = [...left].filter((t) => cv(p, t)).length;
            if (c > bc) {
              bc = c;
              b = p;
            }
          });
          if (!b) break;
          sel.push(b);
          [...left].forEach((t) => cv(b, t) && left.delete(t));
        }
        return sel;
      }

      const lits = (t, n, inv) => {
        const a = [];
        for (let i = 0; i < n; i++) {
          const b = n - 1 - i;
          if ((t.m >> b) & 1) continue;
          const bit = (t.v >> b) & 1;
          a.push(inputLabels[i] + ((inv ? bit : !bit) ? "'" : ""));
        }
        return a;
      };

      const sopStr = (T, n) =>
        T.length
          ? T.map((t) => {
              const literals = lits(t, n);
              const separator = inputLabels
                .slice(0, n)
                .some((label) => label.length > 1)
                ? " · "
                : "";
              return literals.join(separator) || "1";
            }).join(" + ")
          : "0";
      const posStr = (C, n) =>
        !C.length
          ? "1"
          : C.some((t) => !lits(t, n).length)
            ? "0"
            : C.map((t) => {
                const a = lits(t, n, 1);
                return a.length > 1 && C.length > 1
                  ? "(" + a.join(" + ") + ")"
                  : a.join(" + ");
              }).join("");

      function kmap(i, w) {
        const { n } = getSanitizedParams();
        const rv = n >> 1,
          cvn = n - rv,
          gy = (k) => k ^ (k >> 1),
          bin = (k, d) => (d ? k.toString(2).padStart(d, "0") : "");
        const bd = w
          ? "border:1px solid #64748b;"
          : "border:1px solid #334155;";
        const pd = "padding:6px 12px;text-align:center;font-family:monospace;";
        const hc = w
          ? "font-weight:bold;background:#e2e8f0;color:#0f172a;"
          : "background:#0f172a;font-weight:bold;color:#94a3b8;";
        const groupLabel = (labels) =>
          labels.every((label) => label.length === 1)
            ? labels.join("")
            : labels.join(", ");

        let h = `<table class="kmap-table" style="${w ? "border-collapse:collapse;margin-bottom:0.5rem" : ""}"><tr><td class="kmap-axis" style="${w ? `${bd}${pd}${hc}` : ""}">${groupLabel(inputLabels.slice(0, rv))}\\${groupLabel(inputLabels.slice(rv, n))}</td>`;
        for (let c = 0; c < 1 << cvn; c++)
          h += `<td class="kmap-axis" style="${w ? `${bd}${pd}${hc}` : ""}">${bin(gy(c), cvn)}</td>`;
        h += "</tr>";

        for (let r = 0; r < 1 << rv; r++) {
          h += `<tr><td class="kmap-axis" style="${w ? `${bd}${pd}${hc}` : ""}">${bin(gy(r), rv)}</td>`;
          for (let c = 0; c < 1 << cvn; c++) {
            const mt = (gy(r) << cvn) | gy(c),
              v = tt[mt][i];
            const col = w
              ? ""
              : v === "1"
                ? "background:#166534;color:#4ade80;font-weight:bold;"
                : v === "X"
                  ? "background:#854d0e;color:#facc15;"
                  : "color:#64748b;";
            const valueClass =
              v === "1" ? "kmap-value-one" : v === "X" ? "kmap-value-x" : "";
            h += `<td class="kmap-value ${valueClass}" style="${w ? `${bd}${pd}${col}` : ""}" title="m${mt}">${v}</td>`;
          }
          h += "</tr>";
        }
        return h + "</table>";
      }

      function solve() {
        const { n, m } = getSanitizedParams();
        const R = 1 << n;
        last = { n, m, out: [] };
        let h = "";

        for (let i = 0; i < m; i++) {
          const on = [],
            dc = [],
            off = [];
          for (let r = 0; r < R; r++) {
            const v = tt[r][i];
            (v === "1" ? on : v === "X" ? dc : off).push(r);
          }
          const S = qm(on, dc),
            C = qm(off, dc);
          const outputLabel = outputLabels[i];
          last.out.push({ S, C, on, dc });

          h += `<article class="result-card">
      <div class="result-heading">
        <div><span class="result-label">OUTPUT</span><h3>${outputLabel}</h3></div>
        <div class="result-actions">
          <button class="result-action" onclick="window.copySingleExpr(${i},'SOP')">SOP</button>
          <button class="result-action" onclick="window.copySingleExpr(${i},'POS')">POS</button>
          <button class="result-action" title="Copy K-Map" aria-label="Copy K-Map ${outputLabel}" onclick="window.copyKmap(${i})">K-Map</button>
          <button class="result-action custom-copy" onclick="window.openCustomCopyModal(${i})">Export</button>
        </div>
      </div>
      <div class="term-summary"><span>Σm(<span class="grn">${on.join(", ") || "—"}</span>)</span><span>d(<span class="yel">${dc.join(", ") || "—"}</span>)</span></div>
      <div class="map-container">${kmap(i, false)}</div>
      <div class="expression-row sop-row"><span class="expression-label">SOP</span><code>${outputLabel} = ${sopStr(S, n)}</code></div>
      <div class="expression-row pos-row"><span class="expression-label">POS</span><code>${outputLabel} = ${posStr(C, n)}</code></div>
    </article>`;
        }
        $("res").innerHTML = h;
      }
      $("solve").onclick = solve;

      /* ---------- Custom Granular Copy Helpers ---------- */
      window.copySingleExpr = function (outIdx, type) {
        const { n } = getSanitizedParams();
        if (!last || !last.out[outIdx]) return;
        const out = last.out[outIdx];
        const expr =
          type === "SOP"
            ? `${outputLabels[outIdx]} = ${sopStr(out.S, n)}`
            : `${outputLabels[outIdx]} = ${posStr(out.C, n)}`;
        copyText(expr);
      };

      window.copyKmap = function (outIdx) {
        if (!last || !last.out[outIdx]) return;

        const table = kmap(outIdx, true);
        const doc = new DOMParser().parseFromString(table, "text/html");
        const rows = [...doc.querySelectorAll("tr")].map((row) =>
          [...row.cells].map((cell) => cell.textContent.trim()).join("\t"),
        );
        const heading = `K-Map: ${outputLabels[outIdx]}`;
        const plainText = `${heading}\n${rows.join("\n")}`;

        copyHTML(`<h3>${heading}</h3>${table}`, plainText);
      };

      window.openCustomCopyModal = function (outIdx) {
        activeModalOutputIdx = outIdx;
        $("modal-target-info").textContent =
          `Custom Copy: Output ${outputLabels[outIdx]}`;
        $("copy-modal").classList.remove("hidden");
      };

      $("btn-close-modal").onclick = () =>
        $("copy-modal").classList.add("hidden");

      document.querySelectorAll(".fmt-btn").forEach((btn) => {
        btn.onclick = () => {
          document
            .querySelectorAll(".fmt-btn")
            .forEach((b) => b.classList.toggle("selected", b === btn));
          activeModalFormat = btn.dataset.fmt;
        };
      });

      $("btn-modal-execute").onclick = () => {
        const outIdx = activeModalOutputIdx;
        const { n } = getSanitizedParams();
        const incGrid = $("copy-opt-grid").checked;
        const incSOP = $("copy-opt-sop").checked;
        const incPOS = $("copy-opt-pos").checked;
        const incMinterms = $("copy-opt-minterms").checked;

        if (!incGrid && !incSOP && !incPOS && !incMinterms) {
          toast("Vui lòng chọn ít nhất 1 thành phần!");
          return;
        }

        const outData = last.out[outIdx];
        if (activeModalFormat === "word") {
          let html = `<h3>K-Map Analysis: ${outputLabels[outIdx]}</h3>`;
          if (incGrid) html += kmap(outIdx, true);
          if (incMinterms)
            html += `<p><b>Minterms:</b> Σm(${outData.on.join(", ") || "—"}) <b>d:</b> (${outData.dc.join(", ") || "—"})</p>`;
          if (incSOP)
            html += `<p><b>SOP Minimal:</b> ${outputLabels[outIdx]} = ${sopStr(outData.S, n)}</p>`;
          if (incPOS)
            html += `<p><b>POS Minimal:</b> ${outputLabels[outIdx]} = ${posStr(outData.C, n)}</p>`;
          copyHTML(html, html.replace(/<[^>]+>/g, " "));
        } else {
          let txt = `=== K-Map ${outputLabels[outIdx]} ===\n`;
          if (incMinterms)
            txt += `Sigma_m: ${outData.on.join(", ") || "none"} | d: ${outData.dc.join(", ") || "none"}\n`;
          if (incSOP)
            txt += `SOP: ${outputLabels[outIdx]} = ${sopStr(outData.S, n)}\n`;
          if (incPOS)
            txt += `POS: ${outputLabels[outIdx]} = ${posStr(outData.C, n)}\n`;
          copyText(txt);
        }
        $("copy-modal").classList.add("hidden");
      };

      /* ---------- Paste từ Excel / Word ---------- */
      function pstMsg(t, ok) {
        const e = $("pst");
        e.textContent = t;
        e.className = "text-sm font-medium " + (ok ? "grn" : "red");
        toast(t);
      }

      function applyPaste(txt, html) {
        const norm = (c) => {
          c = String(c).trim().toUpperCase();
          return c === "0" || c === "1"
            ? c
            : c === "X" || c === "-" || c === "D" || c === "*"
              ? "X"
              : null;
        };
        const isData = (c) => /^[01]+$/.test(c) || norm(c) !== null;
        let rows = (txt || "")
          .replace(/\r/g, "")
          .split("\n")
          .filter((r) => r.trim() !== "")
          .map((r) => r.split("\t").map((c) => c.trim().replace(/^"|"$/g, "")));
        if (rows.length < 2 && html) {
          const d = new DOMParser().parseFromString(html, "text/html");
          rows = [...d.querySelectorAll("tr")].map((tr) =>
            [...tr.children].map((c) => c.textContent.trim()),
          );
        }
        if (rows.length && rows.every((r) => r.length === 1))
          rows = rows.map((r) => r[0].split(/[\s,;|]+/).filter(Boolean));
        if (!rows.length) {
          pstMsg("Không tìm thấy dữ liệu bảng", 0);
          return false;
        }

        let hdr = null;
        if (rows[0].some((c) => !isData(c))) hdr = rows.shift();
        if (!rows.length) {
          pstMsg("Bảng chỉ có dòng tiêu đề", 0);
          return false;
        }

        const R = rows.length,
          C = rows[0].length;
        if (rows.some((r) => r.length !== C)) {
          pstMsg("Các hàng có số cột không đều", 0);
          return false;
        }

        const parse = (t) => (/^[01]+$/.test(t) ? parseInt(t, 2) : -1),
          uniq = (a) => a.every((x) => x >= 0) && new Set(a).size === a.length;
        const hk = hdr ? hdr.findIndex((c) => !/^[A-Ha-h]$/.test(c)) : -1,
          hdrK = hdr ? (hk < 0 ? hdr.length : hk) : 0;

        let k = 0,
          n = 0,
          ids = null;
        if (C > 1 && rows.every((r) => /^[01]+$/.test(r[0]))) {
          const Ln = Math.max(...rows.map((r) => r[0].length));
          if (Ln >= 1 && Ln <= 8) {
            const a = rows.map((r) => parse(r[0]));
            if (uniq(a)) {
              k = 1;
              n = Ln;
              ids = a;
            }
          }
        }
        if (!k)
          for (let kk = Math.min(8, C - 1); kk >= 1; kk--) {
            if (hdr && kk !== hdrK) continue;
            if (
              !rows.every((r) => r.slice(0, kk).every((c) => /^[01]$/.test(c)))
            )
              continue;
            const a = rows.map((r) => parse(r.slice(0, kk).join("")));
            const inc = a.every((x, i) => !i || x > a[i - 1]);
            if (uniq(a) && R <= 1 << kk && (hdr || inc || R === 1 << kk)) {
              k = kk;
              n = kk;
              ids = a;
              break;
            }
          }

        if (!k) n = Math.max(1, Math.ceil(Math.log2(R)));
        const m = C - k;
        if (m < 1 || m > 16) {
          pstMsg(`Số cột ngõ ra = ${m} (cho phép 1–16)`, 0);
          return false;
        }

        const data = Array.from({ length: 1 << n }, () => Array(m).fill("0"));
        rows.forEach((r, i) => {
          data[ids ? ids[i] : i] = r.slice(k).map(norm);
        });
        if (data.some((r) => r.includes(null))) {
          pstMsg("Ô ngõ ra chỉ được chứa 0, 1 hoặc X", 0);
          return false;
        }

        tt = data;
        $("n").value = n;
        $("m").value = m;
        buildTT();
        solve();
        pstMsg(`Đã cập nhật: ${n} ngõ vào, ${m} ngõ ra (${R} hàng)`, 1);
        return true;
      }

      $("pta").addEventListener("paste", (e) => {
        const cd = e.clipboardData;
        if (!cd) return;
        e.preventDefault();
        $("pta").value = cd.getData("text/plain");
        applyPaste(cd.getData("text/plain"), cd.getData("text/html"));
      });
      $("pap").onclick = () => applyPaste($("pta").value, "");

      /* ---------- Integer Base Converter ---------- */
      function conv() {
        const w = BigInt($("bw").value),
          M = 1n << w,
          s = $("bv").value.trim().replace(/\s/g, ""),
          b = $("bb").value;
        let u;
        try {
          if (!s) throw "Nhập giá trị";
          if (b === "10") {
            if (!/^-?\d+$/.test(s)) throw "Số Decimal không hợp lệ";
            const v = BigInt(s);
            if (v < -(M / 2n) || v >= M)
              throw `Ngoài phạm vi ${w}-bit: ${-(M / 2n)} … ${M - 1n}`;
            u = ((v % M) + M) % M;
          } else {
            if (!(b === "2" ? /^[01]+$/ : /^(0x)?[0-9a-f]+$/i).test(s))
              throw "Chuỗi nhập vào không hợp lệ";
            u = BigInt((b === "2" ? "0b" : "0x") + s.replace(/^0x/i, ""));
            if (u >= M) throw `Vượt quá giới hạn ${w}-bit`;
          }
          const sg = u >= M / 2n ? u - M : u,
            W = Number(w);
          $("bo").innerHTML = tbl(
            ["Dạng", "Giá trị"],
            [
              ["Unsigned", u.toString()],
              ["Signed (Bù 2)", sg.toString()],
              ["Binary", u.toString(2).padStart(W, "0")],
              [
                "Hexadecimal",
                "0x" +
                  u
                    .toString(16)
                    .toUpperCase()
                    .padStart(W / 4, "0"),
              ],
              [
                "Phủ định Bù 2 (−x)",
                ((M - u) % M).toString(2).padStart(W, "0"),
              ],
            ],
          );
        } catch (e) {
          $("bo").innerHTML =
            `<span class="red text-sm font-medium">${e}</span>`;
        }
      }
      $("bv").oninput = $("bb").onchange = $("bw").onchange = conv;

      // Initial setup execution
      buildTT();
      solve();
      conv();
