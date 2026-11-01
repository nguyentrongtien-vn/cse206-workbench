(() => {
  const state = window.CSE206.state;
  const { inputLabels, outputLabels, outputNotations } = state;
  const { $, toast, getSanitizedParams } = window.CSE206.dom;
  const { buildTT, solve } = window.CSE206.kmap;
  function pstMsg(t, ok) {
    const e = $("pst");
    e.textContent = t;
    e.className = "text-sm font-medium " + (ok ? "grn" : "red");
    toast(t);
  }

  function normalizeSigmaPi(value) {
    return value
      .replace(/[Σσ∑]/g, "sum")
      .replace(/[Ππ∏]/g, "prod");
  }

  function parseCanonicalFormulas(txt) {
    const normalizedText = normalizeSigmaPi(txt || "");
    const formulaMarker = /(?:sigma|sum|prod|pi)\s*[mM]/i;
    if (!formulaMarker.test(normalizedText)) return null;

    const lines = normalizedText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const formulas = lines.map((line) => {
      const normalizedLine = normalizeSigmaPi(line);
      const match = normalizedLine.match(
        /^(?:[A-Za-z]\)\s*)?(?:([A-Za-z_][A-Za-z0-9_]{0,15})\s*(?:\(([^()]*)\))?\s*=\s*)?(sum|prod|sigma|pi)\s*[mM]\s*\(([^()]*)\)\s*(?:\+\s*(?:d|dc)\s*\(([^()]*)\))?$/i,
      );
      if (!match) {
        throw "Công thức không hợp lệ. Dùng dạng a) Σ m(1,3) hoặc a) Π M(0,2).";
      }

      const [, name, variableText, operator, termText, dontCareText = ""] = match;
      const kind = /^(?:Σ|∑|sigma|sum)$/i.test(operator) ? "min" : "max";
      const parseIndexes = (value) => {
        if (!value.trim()) return [];
        if (!/^\s*\d+(?:\s*(?:,|\s)\s*\d+)*\s*$/.test(value)) {
          throw "Chỉ số minterm/maxterm phải là các số nguyên, phân tách bằng dấu phẩy.";
        }
        return value.trim().split(/[,\s]+/).map(Number);
      };
      const variables = variableText === undefined
        ? null
        : variableText.split(/[,\s]+/).filter(Boolean);

      if (variables && (
        !variables.length ||
        variables.some((variable) => !/^[A-Za-z_][A-Za-z0-9_]{0,15}$/.test(variable)) ||
        new Set(variables.map((variable) => variable.toLowerCase())).size !== variables.length
      )) {
        throw "Tên biến không hợp lệ hoặc bị trùng trong danh sách đầu vào.";
      }

      return {
        name,
        variables,
        kind,
        indexes: parseIndexes(termText),
        dontCares: parseIndexes(dontCareText),
      };
    });

    const declaredVariables = formulas.find((formula) => formula.variables)?.variables;
    const { n: currentN } = getSanitizedParams();
    const n = declaredVariables
      ? declaredVariables.length
      : currentN;
    const variables = declaredVariables || inputLabels.slice(0, n);
    if (n < 1 || n > 8) {
      throw "Số biến phải nằm trong khoảng 1–8.";
    }
    if (formulas.some((formula) =>
      formula.variables && formula.variables.join(",").toLowerCase() !== variables.join(",").toLowerCase()
    )) {
      throw "Tất cả công thức phải dùng cùng danh sách biến theo cùng thứ tự.";
    }
    if (formulas.length > 16) {
      throw "Có thể nhập tối đa 16 hàm đầu ra.";
    }

    const rowCount = 1 << n;
    const outputNames = formulas.map((formula, index) => formula.name || `F${index + 1}`);
    const allNames = [...variables, ...outputNames];
    if (new Set(allNames.map((label) => label.toLowerCase())).size !== allNames.length) {
      throw "Tên biến và tên hàm đầu ra phải duy nhất.";
    }

    const data = Array.from({ length: rowCount }, () => []);
    formulas.forEach((formula, column) => {
      const indexes = [...formula.indexes, ...formula.dontCares];
      if (new Set(indexes).size !== indexes.length) {
        throw "Chỉ số trong minterm/maxterm và don't-care không được trùng nhau.";
      }
      if (indexes.some((index) => !Number.isInteger(index) || index < 0 || index >= rowCount)) {
        throw `Chỉ số phải nằm trong khoảng 0–${rowCount - 1}.`;
      }

      for (let row = 0; row < rowCount; row++) {
        const isDontCare = formula.dontCares.includes(row);
        const isListed = formula.indexes.includes(row);
        data[row][column] = isDontCare
          ? "X"
          : (formula.kind === "min" ? isListed : !isListed) ? "1" : "0";
      }
    });

    return { n, variables, outputNames, data, formulas };
  }

  function applyPaste(txt, html) {
    let formula;
    try {
      formula = parseCanonicalFormulas(txt || "");
    } catch (error) {
      pstMsg(error, 0);
      return false;
    }
    if (formula) {
      state.tt = formula.data;
      inputLabels.splice(0, formula.n, ...formula.variables);
      outputLabels.splice(0, formula.outputNames.length, ...formula.outputNames);
      outputNotations.splice(
        0,
        formula.outputNames.length,
        ...formula.formulas.map((item) => item.kind),
      );
      $("n").value = formula.n;
      $("m").value = formula.outputNames.length;
      buildTT();
      solve();
      pstMsg(`Đã cập nhật ${formula.outputNames.length} hàm từ công thức ${formula.n} biến`, 1);
      return true;
    }

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

    state.tt = data;
    outputNotations.splice(0, m, ...Array(m).fill("min"));
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
  const applyTermIndexes = () => {
    const indexes = $("term-indexes").value.trim();
    if (!indexes) {
      pstMsg("Vui lòng nhập danh sách chỉ số.", 0);
      return;
    }
    const operator = $("term-kind").value === "max" ? "ΠM" : "Σm";
    const formula = `${operator}(${indexes})`;
    $("pta").value = formula;
    applyPaste(formula, "");
  };
  $("apply-term-indexes").addEventListener("click", applyTermIndexes);
  $("term-indexes").addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyTermIndexes();
  });

  /* ---------- Integer Base Converter ---------- */

})();
