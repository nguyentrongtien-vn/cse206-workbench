(() => {
  const state = window.CSE206.state;
  const { inputLabels, outputLabels, outputNotations } = state;
  const { $, toast, copyText, copyHTML, getSanitizedParams } = window.CSE206.dom;
  function buildTT() {
      const { n, m } = getSanitizedParams();
      const R = 1 << n;
      state.tt = Array.from({ length: R }, (_, r) =>
        Array.from({ length: m }, (_, c) => (state.tt[r] && state.tt[r][c]) || "0"),
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
          state.tt[r]
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
        state.tt[s.dataset.r][s.dataset.c] = s.value;
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

    $("tt").addEventListener("keydown", (e) => {
      const s = e.target;
      if (!s.dataset.labelType) return;

      if (e.key === "Escape") {
        e.preventDefault();
        s.value =
          s.dataset.labelType === "input"
            ? inputLabels[s.dataset.labelIndex]
            : outputLabels[s.dataset.labelIndex];
        s.blur();
        return;
      }

      if (e.key !== "Enter") return;
      e.preventDefault();

      const labelFields = [...$("tt").querySelectorAll(".column-label")];
      const currentIndex = labelFields.indexOf(s);
      const nextIndex = currentIndex + (e.shiftKey ? -1 : 1);
      s.blur();
      labelFields[nextIndex]?.focus();
    });

    function copyTruthTable() {
      const { n, m } = getSanitizedParams();
      const rows = [
        [...inputLabels.slice(0, n), ...outputLabels.slice(0, m)],
        ...state.tt.map((values, rowIndex) => [
          ...rowIndex.toString(2).padStart(n, "0"),
          ...values,
        ]),
      ];
      copyText(rows.map((row) => row.join("\t")).join("\n"));
    }

    $("tt").addEventListener("click", (event) => {
      if (event.target.closest("input, select, button")) return;
      setActiveCopyTarget($("tt"));
      copyTruthTable();
    });

    $("n").onchange = $("m").onchange = () => {
      buildTT();
      solve();
    };

    function qmTrace(on, dc, collectSteps = true, n = 0) {
      if (!on.length) {
        return {
          target: on,
          rounds: [],
          primes: [],
          selected: [],
          selections: [],
        };
      }

      let current = new Map();
      [...on, ...dc].forEach((term) =>
        current.set(`${term},0`, { v: term, m: 0 }),
      );
      const rounds = collectSteps ? [] : null;
      const primes = [];
      const bitCount = (value) => {
        let count = 0;
        while (value) {
          count += value & 1;
          value >>>= 1;
        }
        return count;
      };

      while (current.size) {
        const terms = [...current.values()];
        const next = new Map();
        const combined = new Set();
        const groups = collectSteps ? new Map() : null;
        const combinations = collectSteps ? [] : null;
        if (groups) {
          terms.forEach((term) => {
            const ones = bitCount(term.v & ~term.m);
            if (!groups.has(ones)) groups.set(ones, []);
            groups.get(ones).push(term);
          });
        }

        for (let i = 0; i < terms.length; i++) {
          for (let j = i + 1; j < terms.length; j++) {
            const left = terms[i];
            const right = terms[j];
            if (left.m !== right.m) continue;
            const difference = left.v ^ right.v;
            if (!difference || (difference & (difference - 1))) continue;

            const result = {
              v: left.v & ~difference,
              m: left.m | difference,
            };
            next.set(`${result.v},${result.m}`, result);
            combined.add(i);
            combined.add(j);
            if (combinations) {
              combinations.push({ left, right, result, difference });
            }
          }
        }

        const roundPrimes = terms.filter((_, index) => !combined.has(index));
        primes.push(...roundPrimes);
        if (rounds) {
          rounds.push({
            groups: [...groups.entries()].map(([ones, items]) => ({
              ones,
              items,
            })),
            combinations,
            primes: roundPrimes,
          });
        }
        current = next;
      }

      const covers = (implicant, term) =>
        (term & ~implicant.m) === implicant.v;
      const uniquePrimes = [...new Map(
        primes.map((prime) => [`${prime.v},${prime.m}`, prime]),
      ).values()];
      const primeCoverMap = new Map(
        uniquePrimes.map((prime) => [
          prime,
          new Set(on.filter((term) => covers(prime, term))),
        ]),
      );

      const comparePrimes = (left, right) => {
        const leftLits = left.reduce((sum, prime) => sum + lits(prime, n).length, 0);
        const rightLits = right.reduce((sum, prime) => sum + lits(prime, n).length, 0);
        if (left.length !== right.length) return left.length - right.length;
        if (leftLits !== rightLits) return leftLits - rightLits;
        const factoredLength = (terms) => factorSopTerms(terms, n).length;
        const leftFactoredLength = factoredLength(left);
        const rightFactoredLength = factoredLength(right);
        if (leftFactoredLength !== rightFactoredLength) {
          return leftFactoredLength - rightFactoredLength;
        }
        return left
          .map((prime) => `${prime.v},${prime.m}`)
          .sort()
          .join("|")
          .localeCompare(
            right.map((prime) => `${prime.v},${prime.m}`).sort().join("|"),
          );
      };

      let bestSelection = [];
      let examinedCovers = 0;
      const solveCover = (remainingTerms, availablePrimes, chosen = []) => {
        if (examinedCovers >= 4096) return;
        if (!remainingTerms.size) {
          examinedCovers++;
          const candidate = [...chosen].sort((a, b) => a.v - b.v || a.m - b.m);
          if (!bestSelection.length || comparePrimes(candidate, bestSelection) < 0) {
            bestSelection = candidate;
          }
          return;
        }

        if (bestSelection.length && chosen.length > bestSelection.length) {
          return;
        }

        const target = [...remainingTerms].sort((a, b) => {
          const left = availablePrimes.filter((prime) => primeCoverMap.get(prime)?.has(a)).length;
          const right = availablePrimes.filter((prime) => primeCoverMap.get(prime)?.has(b)).length;
          if (left !== right) return right - left;
          return a - b;
        })[0];

        const candidates = availablePrimes.filter((prime) =>
          primeCoverMap.get(prime)?.has(target),
        );
        if (!candidates.length) return;

        candidates
          .sort((a, b) => {
            const left = [...remainingTerms].filter((term) => primeCoverMap.get(a)?.has(term)).length;
            const right = [...remainingTerms].filter((term) => primeCoverMap.get(b)?.has(term)).length;
            if (left !== right) return right - left;
            return lits(a, n).length - lits(b, n).length;
          })
          .forEach((prime) => {
            const nextRemaining = new Set(
              [...remainingTerms].filter((term) => !primeCoverMap.get(prime)?.has(term)),
            );
            solveCover(
              nextRemaining,
              availablePrimes.filter((candidate) => candidate !== prime),
              [...chosen, prime],
            );
          });
      };

      if (on.length) {
        solveCover(new Set(on), uniquePrimes);
      }

      const selected = bestSelection.length ? bestSelection : [];
      if (collectSteps) {
        const uncovered = new Set(on);
        selected.forEach((prime) =>
          on.forEach((term) => covers(prime, term) && uncovered.delete(term)),
        );
        const selections = [];
        selected.forEach((prime) => {
          const covered = on.filter((term) => covers(prime, term));
          if (covered.length) {
            selections.push({
              prime,
              reason: `Phủ các ô ${covered.join(", ")}`,
              covered,
            });
          }
        });
        if (uncovered.size) {
          selections.push({
            prime: null,
            reason: `Chưa phủ ${[...uncovered].join(", ")}`,
            covered: [...uncovered],
          });
        }
        return {
          target: on,
          rounds: rounds || [],
          primes: uniquePrimes,
          selected,
          selections,
        };
      }

      return {
        target: on,
        rounds: rounds || [],
        primes: uniquePrimes,
        selected,
        selections: [],
      };
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

    const formatCompactLiteral = (literal, n) => {
      const label = inputLabels
        .slice(0, n)
        .find((name) => literal === name || literal === `${name}'`);
      if (!label || label.length === 1) return literal;
      return `${label}${literal.endsWith("'") ? "'" : ""}`;
    };

    const sopStr = (T, n, compact = false) =>
      T.length
        ? T.map((t) => {
            const literals = lits(t, n);
            return (
              (compact
                ? literals
                    .map((literal) => formatCompactLiteral(literal, n))
                    .join("")
                : literals.join(
                    inputLabels
                      .slice(0, n)
                      .some((label) => label.length > 1)
                      ? " · "
                      : "",
                  )) || "1"
            );
          }).join(compact ? "+" : " + ")
        : "0";
    const posStr = (C, n, compact = false) =>
      !C.length
        ? "1"
        : C.some((t) => !lits(t, n).length)
          ? "0"
          : C.map((t) => {
              const a = lits(t, n, 1);
              const clause = compact
                ? a.map((literal) => formatCompactLiteral(literal, n)).join("+")
                : a.join(" + ");
              const needsParens = C.length > 1 && a.length > 1;
              return needsParens ? `(${clause})` : clause;
            }).join(
              compact
                ? ""
                : inputLabels.slice(0, n).some((label) => label.length > 1)
                  ? " · "
                  : "",
            );

    function factorSopTerms(terms, n) {
      const entries = terms.map((term, index) => ({
        index,
        literals: Array.from({ length: n }, (_, variableIndex) => {
          const bit = n - variableIndex - 1;
          if ((term.m >> bit) & 1) return null;
          return {
            index: variableIndex,
            value: (term.v >> bit) & 1,
          };
        }).filter(Boolean),
      }));
      const pairs = [];

      for (let left = 0; left < entries.length; left++) {
        for (let right = left + 1; right < entries.length; right++) {
          const first = entries[left];
          const second = entries[right];
          const shared = first.literals.filter((literal) =>
            second.literals.some(
              (candidate) =>
                candidate.index === literal.index &&
                candidate.value === literal.value,
            ),
          );
          const firstOnly = first.literals.filter(
            (literal) =>
              !shared.some((candidate) => candidate.index === literal.index),
          );
          const secondOnly = second.literals.filter(
            (literal) =>
              !shared.some((candidate) => candidate.index === literal.index),
          );
          const xorPair =
            firstOnly.length === 2 &&
            secondOnly.length === 2 &&
            firstOnly.every((literal) =>
              secondOnly.some(
                (candidate) =>
                  candidate.index === literal.index &&
                  candidate.value !== literal.value,
              ),
            );
          if (!shared.length && !xorPair) continue;

          pairs.push({
            first,
            second,
            shared,
            firstOnly,
            secondOnly,
            xorPair,
            score: shared.length * 10 + Number(xorPair),
          });
        }
      }

      const used = new Set();
      const replacements = new Map();
      pairs
        .sort((left, right) => right.score - left.score)
        .forEach((pair) => {
          if (
            used.has(pair.first.index) ||
            used.has(pair.second.index)
          ) {
            return;
          }
          const literal = ({ index, value }) =>
            `${inputLabels[index]}${value ? "" : "'"}`;
          const common = pair.shared.map(literal).join("");
          let replacement;

          if (pair.xorPair) {
            const firstIndex = pair.firstOnly[0].index;
            const secondIndex = pair.firstOnly[1].index;
            const firstName = inputLabels[firstIndex];
            const secondName = inputLabels[secondIndex];
            const samePolarity =
              pair.firstOnly[0].value === pair.firstOnly[1].value;
            const parity = samePolarity
              ? `(${firstName}⊕${secondName})'`
              : `${firstName}⊕${secondName}`;
            replacement = common ? `${common}(${parity})` : parity;
          } else {
            const firstRemainder = pair.firstOnly.map(literal).join("") || "1";
            const secondRemainder =
              pair.secondOnly.map(literal).join("") || "1";
            replacement = common
              ? `${common}(${firstRemainder}+${secondRemainder})`
              : `${firstRemainder}+${secondRemainder}`;
          }

          used.add(pair.first.index);
          used.add(pair.second.index);
          replacements.set(
            Math.min(pair.first.index, pair.second.index),
            replacement,
          );
        });

      const result = [];
      entries.forEach((entry) => {
        if (replacements.has(entry.index)) {
          result.push(replacements.get(entry.index));
        } else if (!used.has(entry.index)) {
          result.push(
            entry.literals.map(({ index, value }) =>
              `${inputLabels[index]}${value ? "" : "'"}`,
            ).join("") || "1",
          );
        }
      });
      return result.join("+") || "0";
    }

    function optimizeExpression(outputIndex, n, sopTerms) {
      const output = outputLabels[outputIndex];
      const inputNames = inputLabels.slice(0, n);
      const bdfExport = window.CSE206.bdfExport;
      if (!bdfExport) {
        throw new Error("BDF optimizer chưa được khởi tạo.");
      }
      const source = factorSopTerms(sopTerms, n).replace(/⊕/g, "^");
      const analysis = bdfExport.analyze(source, output, inputNames);
      return {
        source,
        display: source
          .replace(/\s+/g, "")
          .replace(/[·*]/g, "")
          .replace(/\^/g, "⊕"),
        gateCount: analysis.gateCount,
        type: /^[01]$/.test(source)
          ? "CONST"
          : analysis.gateTypes.length === 1
            ? analysis.gateTypes[0]
            : analysis.gateTypes.join("/"),
      };
    }

    const GROUP_COLORS = [
      { color: "#2563eb", tint: "#dbeafe" },
      { color: "#dc2626", tint: "#fee2e2" },
      { color: "#059669", tint: "#d1fae5" },
      { color: "#9333ea", tint: "#f3e8ff" },
      { color: "#d97706", tint: "#fef3c7" },
      { color: "#0891b2", tint: "#cffafe" },
      { color: "#db2777", tint: "#fce7f3" },
      { color: "#4f46e5", tint: "#e0e7ff" },
    ];

    function getBooleanGroups(sopTrace, posTrace) {
      return [
        ...sopTrace.selected.map((implicant, index) => ({
          implicant,
          index,
          isPos: false,
          color: GROUP_COLORS[index % GROUP_COLORS.length],
        })),
        ...posTrace.selected.map((implicant, index) => ({
          implicant,
          index,
          isPos: true,
          color:
            GROUP_COLORS[
              (index + sopTrace.selected.length) % GROUP_COLORS.length
            ],
        })),
      ];
    }

    function termFormula(term, n, isPos = false) {
      const literals = lits(term, n, isPos);
      if (!literals.length) return isPos ? "0" : "1";
      return isPos
        ? literals.length === 1
          ? literals[0]
          : `(${literals.join(" + ")})`
        : literals.join(" · ");
    }

    function combinationFormula(combination, n, isPos) {
      const { left, right, result, difference } = combination;
      const bit = Math.log2(difference);
      const variable = inputLabels[n - bit - 1];
      const leftBit = Boolean(left.v & difference);
      const rightBit = Boolean(right.v & difference);
      const literal = (value) =>
        `${variable}${(isPos ? value : !value) ? "'" : ""}`;
      const leftLiteral = literal(leftBit);
      const rightLiteral = literal(rightBit);
      const common = lits(result, n, isPos).join(isPos ? " + " : " · ");
      if (isPos) {
        const leftClause = common
          ? `(${common} + ${leftLiteral})`
          : `(${leftLiteral})`;
        const rightClause = common
          ? `(${common} + ${rightLiteral})`
          : `(${rightLiteral})`;
        return `${leftClause} · ${rightClause} = ${termFormula(result, n, true)}`;
      }

      const leftTerm = termFormula(left, n);
      const rightTerm = termFormula(right, n);
      const factor = common ? `${common} · ` : "";
      return `${leftTerm} + ${rightTerm} = ${factor}(${leftLiteral} + ${rightLiteral}) = ${termFormula(result, n)}`;
    }

    function booleanReductionSteps(sopTrace, posTrace, n, outputLabel, optimal) {
      const groups = getBooleanGroups(sopTrace, posTrace);
      const sop = sopStr(sopTrace.selected, n, true);
      const reduced = factorSopTerms(sopTrace.selected, n);
      const pos = posStr(posTrace.selected, n, true);
      const kmapGroups = sopTrace.selected.map((term, index) => {
        const color = GROUP_COLORS[index % GROUP_COLORS.length];
        const covered = sopTrace.target.filter(
          (minterm) => (minterm & ~term.m) === term.v,
        );
        return `<li style="--qm-color:${color.color};--qm-tint:${color.tint}"><span class="qm-color-swatch"></span><strong>S${index + 1}</strong><code>${termFormula(term, n)}</code><small>m(${covered.join(", ")})</small></li>`;
      }).join("");
      const renderFormulas = (trace, isPos, label) => {
        const formulas = [
          ...new Set(
            trace.rounds.flatMap((round) =>
              round.combinations.map((combination) =>
                combinationFormula(combination, n, isPos),
              ),
            ),
          ),
        ];
        return formulas.map((formula) => `
          <li><strong>${label}</strong><code>${formula}</code></li>`).join("");
      };
      const formulas = [
        renderFormulas(sopTrace, false, "SOP"),
        renderFormulas(posTrace, true, "POS"),
      ].join("");
      return {
        groups,
        html: `<section class="boolean-step-section">
          <h4>Nhóm màu trên K-map</h4>
          ${kmapGroups
            ? `<ul class="qm-kmap-legend">${kmapGroups}</ul>`
            : `<p class="steps-legend">Không có nhóm ô 1 cần tô màu.</p>`}
          <p class="steps-legend">Mã S1, S2… và màu tương ứng với các nhóm tô trên K-map; một ô 1 có thể thuộc nhiều nhóm.</p>
        </section>
        <section class="boolean-step-section">
          <h4>Công thức đã dùng</h4>
          ${formulas
            ? `<ul class="qm-formula-list">${formulas}</ul>`
            : `<p class="steps-legend">Không cần ghép thêm công thức.</p>`}
        </section>
        <section class="boolean-step-section">
          <h4>Kết quả</h4>
          <div class="boolean-reduction-equation"><span>${outputLabel} = ${sop}</span><span>→ gom nhân tử →</span><strong>${outputLabel} = ${reduced}</strong></div>
          <p class="qm-final-formula"><strong>POS:</strong> ${outputLabel} = ${pos}</p>
          <p class="qm-final-formula"><strong>Tối ưu cổng:</strong> ${outputLabel} = ${optimal.display} <span>(${optimal.gateCount} cổng)</span></p>
        </section>`,
      };
    }

    function kmap(i, w, groups = []) {
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
      const rowGroupLabel = inputLabels.slice(0, rv).join("");
      const columnGroupLabel = inputLabels.slice(rv, n).join("");
      const tableStyle = w
        ? "border-collapse:collapse;margin:0.5rem auto;color:#111827"
        : "";
      const headerStyle = w
        ? `${bd}${pd}font-weight:bold;background:#f3f4f6;color:#111827;`
        : "";
      const axisStyle = w
        ? `${bd}${pd}background:#f8fafc;color:#334155;`
        : "";
      const valueStyle = w
        ? `${bd}${pd}background:#fff;color:#111827;`
        : "";
      const renderGroups = groups
        .filter((group) => !group.isPos)
        .map((group) => {
          const cells = new Set(
            Array.from({ length: 1 << n }, (_, mt) => mt).filter(
              (mt) => (mt & ~group.implicant.m) === group.implicant.v,
            ),
          );
          const rows = new Set();
          const columns = new Set();
          for (const mt of cells) {
            rows.add(mt >> cvn);
            columns.add(mt & ((1 << cvn) - 1));
          }
          return {
            ...group,
            cells,
            stripeDirection:
              rows.size > columns.size
                ? "vertical"
                : rows.size < columns.size
                  ? "horizontal"
                  : group.index % 2
                    ? "vertical"
                    : "horizontal",
          };
        });
      const mintermAt = (r, c) => (gy(r) << cvn) | gy(c);

      let h = `<table class="kmap-table" style="${tableStyle}"><tr><th class="kmap-corner kmap-axis" rowspan="2" colspan="2" style="${headerStyle}">K-map</th><th class="kmap-column-group kmap-axis" colspan="${1 << cvn}" style="${headerStyle}">${columnGroupLabel}</th></tr><tr>`;
      for (let c = 0; c < 1 << cvn; c++)
        h += `<th class="kmap-axis" style="${axisStyle}">${bin(gy(c), cvn)}</th>`;
      h += "</tr>";

      for (let r = 0; r < 1 << rv; r++) {
        h += "<tr>";
        if (r === 0)
          h += `<th class="kmap-row-group kmap-axis" rowspan="${1 << rv}" style="${headerStyle}">${rowGroupLabel}</th>`;
        h += `<th class="kmap-axis" style="${axisStyle}">${bin(gy(r), rv)}</th>`;
        for (let c = 0; c < 1 << cvn; c++) {
          const mt = mintermAt(r, c),
            v = state.tt[mt][i];
          const cellGroups = v === "1" || v === "X"
            ? renderGroups.filter((group) => group.cells.has(mt))
            : [];
          const valueClass =
            v === "1" ? "kmap-value-one" : v === "X" ? "kmap-value-x" : "";
          const groupStops = cellGroups
            .map((group, index) => {
              const start = (index / cellGroups.length) * 100;
              const end = ((index + 1) / cellGroups.length) * 100;
              return `${group.color.tint} ${start}% ${end}%`;
            })
            .join(", ");
          const horizontalGroups = cellGroups.filter(
            (group) => group.stripeDirection === "horizontal",
          ).length;
          const gradientDirection =
            horizontalGroups * 2 >= cellGroups.length ? "to bottom" : "to right";
          const groupStyle = !w && cellGroups.length
            ? `--group-fill:linear-gradient(${gradientDirection},${groupStops});`
            : "";
          const cellStyle = w
            ? `${bd}${pd}${v === "X" ? "background:#fff7df;color:#9c6a0a;font-weight:bold;" : valueStyle}`
            : groupStyle;
          const groupClass = cellGroups.length ? " kmap-value-grouped" : "";
          const groupTitle = cellGroups.length
            ? `; nhóm ${cellGroups.map((group) => `${group.isPos ? "P" : "S"}${group.index + 1}`).join(", ")}`
            : "";
          h += `<td class="kmap-value ${valueClass}${groupClass}" style="${cellStyle}" title="m${mt}${groupTitle}"><span>${v === "0" ? "" : v}</span></td>`;
        }
        h += "</tr>";
      }
      return h + "</table>";
    }

    function solve() {
      const { n, m } = getSanitizedParams();
      const R = 1 << n;
      state.last = { n, m, out: [] };
      let h = "";

      for (let i = 0; i < m; i++) {
        const on = [],
          dc = [],
          off = [];
        for (let r = 0; r < R; r++) {
          const v = state.tt[r][i];
          (v === "1" ? on : v === "X" ? dc : off).push(r);
        }
        const sopTrace = qmTrace(on, dc, false, n);
        const posTrace = qmTrace(off, dc, false, n);
        const S = sopTrace.selected;
        const C = posTrace.selected;
        const outputLabel = outputLabels[i];
        const optimal = optimizeExpression(i, n, S);
        const groups = getBooleanGroups(sopTrace, posTrace);
        const notation = outputNotations[i] || "min";
        state.last.out.push({ S, C, on, off, dc, sopTrace, posTrace, optimal });

        h += `<article class="result-card">
  <div class="result-heading">
    <div><span class="result-label">OUTPUT</span><h3>${outputLabel}</h3></div>
    <div class="result-actions">
      <button class="result-action" type="button" onclick="window.openCustomCopyModal(${i})">Export riêng</button>
      <button class="result-action step-toggle" aria-expanded="false" onclick="window.toggleBooleanSteps(${i})">Xem từng bước</button>
    </div>
  </div>
  <div class="term-summary"><span>${notation === "max" ? "ΠM" : "Σm"}(<span class="grn">${(notation === "max" ? off : on).join(", ") || "—"}</span>)</span><span>d(<span class="yel">${dc.join(", ") || "—"}</span>)</span></div>
  <div class="map-container" data-copy-map="${i}" role="button" tabindex="0" aria-label="Sao chép K-Map ${outputLabel}" title="Bấm để sao chép K-Map">${kmap(i, false, groups)}</div>
  <div class="expression-row optimized-row" data-copy-type="OPT" data-output-index="${i}" role="button" tabindex="0" aria-label="Sao chép biểu thức tối ưu ${outputLabel}" title="Bấm để sao chép"><span class="expression-label">${optimal.type}</span><code>${outputLabel}=${optimal.display}</code><small class="expression-gate-count">${optimal.gateCount} cổng · riêng ${outputLabel}</small></div>
  <div class="expression-row sop-row" data-copy-type="SOP" data-output-index="${i}" role="button" tabindex="0" aria-label="Sao chép biểu thức SOP ${outputLabel}" title="Bấm để sao chép"><span class="expression-label">SOP</span><code>${outputLabel}=${sopStr(S, n, true)}</code></div>
  <div class="expression-row pos-row" data-copy-type="POS" data-output-index="${i}" role="button" tabindex="0" aria-label="Sao chép biểu thức POS ${outputLabel}" title="Bấm để sao chép"><span class="expression-label">POS</span><code>${outputLabel}=${posStr(C, n, true)}</code></div>
  <div class="boolean-steps" id="boolean-steps-${i}" hidden></div>
</article>`;
      }
      $("res").innerHTML = h;
    }
    $("solve").onclick = solve;

    function copyFromResult(target) {
      const expression = target.closest("[data-copy-type]");
      if (expression) {
        setActiveCopyTarget(expression);
        window.copySingleExpr(
          Number(expression.dataset.outputIndex),
          expression.dataset.copyType,
        );
        return true;
      }

      const map = target.closest("[data-copy-map]");
      if (!map) return false;
      setActiveCopyTarget(map);
      window.copyKmap(Number(map.dataset.copyMap));
      return true;
    }

    function setActiveCopyTarget(target) {
      $("res").querySelectorAll(".copy-feedback-active").forEach((active) => {
        active.classList.remove("copy-feedback-active");
      });
      $("tt").classList.remove("copy-feedback-active");
      target.classList.add("copy-feedback-active");
    }

    $("res").addEventListener("click", (event) => {
      copyFromResult(event.target);
    });

    $("res").addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (!copyFromResult(event.target)) return;
      event.preventDefault();
    });

    window.toggleBooleanSteps = function (outIdx) {
      if (!state.last || !state.last.out[outIdx]) return;
      const panel = $(`boolean-steps-${outIdx}`);
      const button = $("res")
        .querySelectorAll(".result-card")
        [outIdx].querySelector(".step-toggle");
      if (!panel.hidden) {
        panel.hidden = true;
        button.setAttribute("aria-expanded", "false");
        button.textContent = "Xem từng bước";
        $("res").querySelectorAll(".result-card")[outIdx]
          .querySelector(".map-container").innerHTML = kmap(
            outIdx,
            false,
            getBooleanGroups(
              state.last.out[outIdx].sopTrace,
              state.last.out[outIdx].posTrace,
            ),
          );
        return;
      }

      const out = state.last.out[outIdx];
      let { sopTrace, posTrace } = out;
      if (sopTrace.target.length && !sopTrace.rounds.length) {
        sopTrace = qmTrace(out.on, out.dc, true, state.last.n);
        out.sopTrace = sopTrace;
      }
      if (posTrace.target.length && !posTrace.rounds.length) {
        posTrace = qmTrace(out.off, out.dc, true, state.last.n);
        out.posTrace = posTrace;
      }
      const steps = booleanReductionSteps(
        sopTrace,
        posTrace,
        state.last.n,
        outputLabels[outIdx],
        out.optimal,
      );
      panel.innerHTML = steps.html;
      $("res").querySelectorAll(".result-card")[outIdx]
        .querySelector(".map-container").innerHTML = kmap(
          outIdx,
          false,
          steps.groups,
        );
      panel.hidden = false;
      button.setAttribute("aria-expanded", "true");
      button.textContent = "Ẩn các bước";
    };

    /* ---------- Custom Granular Copy Helpers ---------- */
    window.copySingleExpr = function (outIdx, type) {
      const { n } = getSanitizedParams();
      if (!state.last || !state.last.out[outIdx]) return;
      const out = state.last.out[outIdx];
      const expr =
        type === "OPT"
          ? `${outputLabels[outIdx]}=${out.optimal.display}`
          : type === "SOP"
            ? `${outputLabels[outIdx]}=${sopStr(out.S, n, true)}`
            : `${outputLabels[outIdx]}=${posStr(out.C, n, true)}`;
      copyText(expr);
    };

    window.copyKmap = function (outIdx) {
      if (!state.last || !state.last.out[outIdx]) return;

      const table = kmap(outIdx, true);
      const doc = new DOMParser().parseFromString(table, "text/html");
      const rows = [...doc.querySelectorAll("tr")].map((row) =>
        [...row.cells].map((cell) => cell.textContent.trim()).join("\t"),
      );
      const heading = `K-Map: ${outputLabels[outIdx]}`;
      const plainText = `${heading}\n${rows.join("\n")}`;

      copyHTML(`<h3>${heading}</h3>${table}`, plainText);
    };

    window.CSE206.kmap = { buildTT, solve, kmap, sopStr, posStr };
})();
