(() => {
  const state = window.CSE206.state;
  const { inputLabels, outputLabels, outputNotations } = state;
  const { $, toast, copyHTML, getSanitizedParams } = window.CSE206.dom;
  const { kmap, sopStr, posStr } = window.CSE206.kmap;
  let activeModalOutputIdx = 0;
  let activeModalFormat = "word";
  function quartusBdfSymbol(type, x, y, instance) {
    const height = type === "NOT" ? 32 : 48;
    const width = type === "NOT" ? 48 : 64;
    const isAnd = type === "AND2" || type === "NAND2";
    const isXor = type === "XOR" || type === "XNOR";
    const isInverting = type === "NOT" || type === "NAND2" ||
      type === "NOR2" || type === "XNOR";
    const inputs = type === "NOT"
      ? [{ name: "IN", y: 16 }]
      : [{ name: "IN1", y: 16 }, { name: "IN2", y: 32 }];
    const inputPorts = inputs
      .map(
        (port) => `(port
    (pt 0 ${port.y})
    (input)
    (text "${port.name}" (rect 2 ${port.y - 9} 19 ${port.y + 3})(font "Courier New" (bold))(invisible))
    (text "${port.name}" (rect 2 ${port.y - 9} 19 ${port.y + 3})(font "Courier New" (bold))(invisible))
    (line (pt 0 ${port.y})(pt ${type === "NOT" ? 13 : isAnd ? 14 : 15} ${port.y}))
  )`,
      )
      .join("\n  ");
    const outputY = type === "NOT" ? 16 : 24;
    const outputLineStart = {
      NOT: 39,
      AND2: 42,
      NAND2: 57,
      OR2: 48,
      NOR2: 57,
      XOR: 49,
      XNOR: 57,
    }[type];
    const outputPort = `(port
    (pt ${width} ${outputY})
    (output)
    (text "OUT" (rect ${width - 16} ${outputY - 9} ${width + 1} ${outputY + 3})(font "Courier New" (bold))(invisible))
    (text "OUT" (rect ${width - 16} ${outputY - 9} ${width + 1} ${outputY + 3})(font "Courier New" (bold))(invisible))
    (line (pt ${outputLineStart} ${outputY})(pt ${width} ${outputY}))
  )`;
    const notDrawing = `(line (pt 13 25)(pt 13 7))
    (line (pt 13 7)(pt 31 16))
    (line (pt 13 25)(pt 31 16))
    (circle (rect 31 12 39 20))`;
    const andDrawing = `(line (pt 14 12)(pt 30 12))
    (line (pt 14 37)(pt 31 37))
    (line (pt 14 12)(pt 14 37))
    (arc (pt 31 37)(pt 30 12)(rect 18 12 43 37))`
      + (type === "NAND2"
        ? `\n    (circle (rect 49 20 57 28))
    (line (pt 57 24)(pt 64 24))`
        : "");
    const orDrawing = `(line (pt 12 16)(pt 23 16))
    (line (pt 12 32)(pt 23 32))
    (arc (pt 7 29)(pt 7 19)(rect -14 8 19 41))
    (arc (pt 49 24)(pt 25 13)(rect -6 13 57 76))
    (arc (pt 25 35)(pt 49 24)(rect -6 -27 57 36))
    (line (pt ${isInverting ? 57 : 52} 24)(pt 64 24))`
      + (isXor
        ? `\n    (arc (pt 8 36)(pt 8 12)(rect -21 7 14 42))`
        : "")
      + (type === "NOR2" || type === "XNOR"
        ? `\n    (circle (rect 49 20 57 28))`
        : "");
    const drawing = type === "NOT"
      ? notDrawing
      : isAnd
        ? andDrawing
        : orDrawing;

    return `(symbol
  (rect ${x} ${y} ${x + width} ${y + height})
  (text "${type}" (rect 1 0 29 10)(font "Arial" (font_size 6)))
  (text "${instance}" (rect 3 ${height - 11} 36 ${height + 1})(font "Arial"))
  ${inputPorts}
  ${outputPort}
  (drawing
    ${drawing}
  )
)`;
  }

        function quartusBdfPin(type, name, x, y) {
          const isInput = type === "input";
          const direction = isInput ? "INPUT" : "OUTPUT";
          const width = isInput ? 168 : 176;
          const portX = isInput ? width : 0;
          const labelRect = isInput
            ? `(rect 5 0 ${Math.min(width - 4, name.length * 8 + 5)} 10)`
            : `(rect 90 0 ${Math.min(width - 8, 90 + name.length * 8)} 10)`;
          const drawing = isInput
            ? `(line (pt 84 12)(pt 109 12))
    (line (pt 84 4)(pt 109 4))
    (line (pt 113 8)(pt 168 8))
    (line (pt 84 12)(pt 84 4))
    (line (pt 109 4)(pt 113 8))
    (line (pt 109 12)(pt 113 8))`
            : `(line (pt 0 8)(pt 52 8))
    (line (pt 52 4)(pt 78 4))
    (line (pt 52 12)(pt 78 12))
    (line (pt 52 12)(pt 52 4))
    (line (pt 78 4)(pt 82 8))
    (line (pt 82 8)(pt 78 12))
    (line (pt 78 12)(pt 82 8))`;
          return `(pin
  (${type})
  (rect ${x} ${y} ${x + width} ${y + 16})
  (text "${direction}" (rect ${isInput ? 125 : 1} 0 ${isInput ? 154 : 41} 9)(font "Arial" (font_size 6)))
  (text "${name}" ${labelRect}(font "Arial"))
  (pt ${portX} 8)
  (drawing
    ${drawing}
  )
  ${isInput ? `(text "VCC" (rect 128 7 148 17)(font "Arial" (font_size 6)))` : ""}
)`;
        }

        function getQuartusBdfInputBus(names) {
          if (names.length < 2) return null;
          const parsed = names.map((name) => {
            const bracketed = /^([A-Za-z_][A-Za-z0-9_]*)\[(\d+)\]$/.exec(name);
            if (bracketed) {
              return {
                base: bracketed[1],
                index: Number(bracketed[2]),
                style: "bracketed",
              };
            }
            const suffixed = /^([A-Za-z_][A-Za-z0-9_]*?)(\d+)$/.exec(name);
            return suffixed
              ? {
                  base: suffixed[1],
                  index: Number(suffixed[2]),
                  style: "suffixed",
                }
              : null;
          });
          if (parsed.some((entry) => !entry)) return null;
          const { base, style } = parsed[0];
          if (parsed.some((entry) => entry.base !== base || entry.style !== style)) {
            return null;
          }
          const indexes = parsed.map((entry) => entry.index);
          const min = Math.min(...indexes);
          const max = Math.max(...indexes);
          if (
            max - min + 1 !== indexes.length ||
            new Set(indexes).size !== indexes.length
          ) {
            return null;
          }
          return {
            label: `${base}[${min}..${max}]`,
            bitNames: indexes.map((index) => `${base}[${index}]`),
          };
        }

        function getQuartusBdfTerms(outIdx, format) {
          if (format !== "sop" && format !== "pos") {
            throw new Error(`Định dạng BDF không hợp lệ: ${format}`);
          }
          const output = state.last?.out[outIdx];
          if (!output) return null;
          return format === "sop" ? output.S : output.C;
        }

        function getQuartusBdfExpression(outIdx, format) {
          const { n } = state.last;
          const parity = getQuartusBdfParity(outIdx);
          if (parity) {
            const expression = parity.inputIndexes
              .map((index) => inputLabels[index])
              .join(" ^ ");
            return parity.inversion ? `(${expression})'` : expression;
          }
          const terms = getQuartusBdfTerms(outIdx, format);
          return format === "sop"
            ? sopStr(terms, n)
            : posStr(terms, n);
        }

        function getQuartusBdfOutputGroup(outIdx) {
          const outputNames = outputLabels.slice(0, state.last.m);
          const matching = window.CSE206.bdfExport
            .groupBuses(outputNames)
            .find((unit) =>
              unit.prefix && unit.bits.some((bit) => bit.position === outIdx),
            );
          return matching
            ? {
                indices: matching.bits.map((bit) => bit.position),
                label: matching.label,
                fileName: matching.prefix,
              }
            : {
                indices: [outIdx],
                label: outputLabels[outIdx],
                fileName: outputLabels[outIdx],
              };
        }

        function quartusBdfLiteralIndexes(terms, n, format) {
          const negative = new Set();
          terms.forEach((term) => {
            for (let index = 0; index < n; index++) {
              const bit = n - 1 - index;
              if ((term.m >> bit) & 1) continue;
              const value = (term.v >> bit) & 1;
              if (format === "sop" ? !value : value) negative.add(index);
            }
          });
          return negative;
        }

        function getQuartusBdfParity(outIdx) {
          const { n } = state.last;
          if (n < 2) return null;
          const rowCount = 1 << n;

          for (let supportSize = 2; supportSize <= n; supportSize++) {
            for (let mask = 1; mask < rowCount; mask++) {
              if (bitCount(mask) !== supportSize) continue;
              for (const inversion of [0, 1]) {
                let hasDefinedRows = false;
                let matches = true;
                for (let row = 0; row < rowCount; row++) {
                  const expected = state.tt[row][outIdx];
                  if (expected === "X") continue;
                  hasDefinedRows = true;
                  const parity = bitCount(row & mask) & 1;
                  if (Number(expected) !== (parity ^ inversion)) {
                    matches = false;
                    break;
                  }
                }
                if (matches && hasDefinedRows) {
                  return {
                    inputIndexes: inputLabels
                      .slice(0, n)
                      .map((_, index) => index)
                      .filter((index) => mask & (1 << (n - 1 - index))),
                    inversion,
                  };
                }
              }
            }
          }
          return null;
        }

        function estimateQuartusBdfGateCount(outIdx, format) {
          if (!state.last || !state.last.out[outIdx]) return null;
          const group = getQuartusBdfOutputGroup(outIdx);
          const inputNames = inputLabels.slice(0, state.last.n);
          const count = (memberFormat) =>
            window.CSE206.bdfExport.countMany(
              group.indices.map((index) => ({
                output: outputLabels[index],
                source: getQuartusBdfExpression(index, memberFormat),
              })),
              inputNames,
            );
          if (format !== "auto") return count(format);
          return Math.min(count("sop"), count("pos"));
        }

        function resolveQuartusBdfFormat(outIdx, requestedFormat) {
          if (requestedFormat === "sop" || requestedFormat === "pos") {
            return requestedFormat;
          }
          if (requestedFormat !== "auto") {
            throw new Error(`Định dạng BDF không hợp lệ: ${requestedFormat}`);
          }
          const sopCount = estimateQuartusBdfGateCount(outIdx, "sop");
          const posCount = estimateQuartusBdfGateCount(outIdx, "pos");
          return sopCount <= posCount ? "sop" : "pos";
        }

        function verifyQuartusBdfOutput(outIdx, format) {
          const group = getQuartusBdfOutputGroup(outIdx);
          for (const index of group.indices) {
            const terms = getQuartusBdfTerms(index, format);
            if (!terms) return false;
            const { n } = state.last;
            const rowCount = 1 << n;
            for (let row = 0; row < rowCount; row++) {
              const actual = format === "sop"
                ? terms.some((term) => (row & ~term.m) === term.v)
                : !terms.some((term) => (row & ~term.m) === term.v);
              const expected = state.tt[row][index];
              if (expected !== "X" && Number(actual) !== Number(expected)) {
                throw new Error(
                  `BDF ${format.toUpperCase()} không khớp bảng chân trị tại hàng ${row} (${outputLabels[index]}).`,
                );
              }
            }
          }
          return true;
        }

        function bitCount(value) {
          let count = 0;
          while (value) {
            count += value & 1;
            value >>>= 1;
          }
          return count;
        }

        function generateQuartusBdfLegacy(outIdx, format) {
          if (!state.last || !state.last.out[outIdx]) return null;
          const { n } = state.last;
          const isSop = format === "sop";
          const implicants = getQuartusBdfTerms(outIdx, format);
          const parityInversion = getQuartusBdfParity(outIdx);
          const symbols = [];
          const connectors = [];
          const gateLogic = [];
          let nextInstance = 1;
          const pinWidth = 168;
          const inputX = 32;
          const inputY = (index) => 64 + index * 80;
          const inputBus = getQuartusBdfInputBus(inputLabels.slice(0, n));
          const logicOffsetX = inputBus ? 48 : 0;
          const busX = inputX + pinWidth + 24;
          const inputSignalX = inputBus ? busX + 72 : inputX + pinWidth;
          const inputSignals = inputLabels.slice(0, n).map((name, index) => ({
            x: inputSignalX,
            y: inputY(index) + 8,
            name: inputBus ? inputBus.bitNames[index] : name,
          }));
          const usedNegative = parityInversion === null
            ? quartusBdfLiteralIndexes(implicants, n, format)
            : new Set();
          if (parityInversion === null) {
            if (
              !implicants.length ||
              implicants.some((term) => term.m === (1 << n) - 1)
            ) {
              usedNegative.add(0);
            }
          }

          function addWire(source, target) {
            const points = [source];
            if (source.x !== target.x && source.y !== target.y) {
              const middleX = Math.round(((source.x + target.x) / 2) / 8) * 8;
              points.push({ x: middleX, y: source.y });
              points.push({ x: middleX, y: target.y });
            }
            points.push(target);
            for (let index = 1; index < points.length; index++) {
              const from = points[index - 1];
              const to = points[index];
              if (from.x === to.x && from.y === to.y) continue;
              connectors.push(`(connector
  (pt ${from.x} ${from.y})
  (pt ${to.x} ${to.y})
)`);
            }
          }

          if (inputBus) {
            connectors.push(`(connector
  (pt ${inputX + pinWidth} ${inputSignals[0].y})
  (pt ${busX} ${inputSignals[0].y})
  (bus)
)`);
            for (let index = 0; index < inputSignals.length - 1; index++) {
              const signal = inputSignals[index];
              const nextSignal = inputSignals[index + 1];
              connectors.push(`(connector
  (pt ${busX} ${signal.y})
  (pt ${busX} ${nextSignal.y})
  (bus)
)`);
            }
            inputSignals.forEach((signal) => {
              const labelWidth = Math.max(40, signal.name.length * 8);
              connectors.push(`(connector
  (text "${signal.name}" (rect ${busX + 24} ${signal.y - 16} ${busX + 24 + labelWidth} ${signal.y + 1})(font "Intel Clear" ))
  (pt ${busX} ${signal.y})
  (pt ${signal.x} ${signal.y})
)`);
              connectors.push(`(junction (pt ${busX} ${signal.y}))`);
            });
          }

          function addGate(type, x, centerY, left, right = null) {
            const width = 64;
            const height = type === "NOT" ? 32 : 48;
            const top = Math.round((centerY - height / 2) / 8) * 8;
            const inputPoints = type === "NOT"
              ? [{ x, y: top + 16 }]
              : [{ x, y: top + 16 }, { x, y: top + 32 }];
            const prefix = {
              NOT: "not",
              AND2: "and",
              NAND2: "nand",
              OR2: "or",
              NOR2: "nor",
              XOR: "xor",
              XNOR: "xnor",
            }[type];
            if (!prefix) throw new Error(`Cổng BDF không được hỗ trợ: ${type}`);
            const instance = `${prefix}${nextInstance++}`;
            symbols.push(quartusBdfSymbol(type, x, top, instance));
            gateLogic.push({
              type,
              output: instance,
              left: left.name,
              right: right?.name,
            });
            addWire(left, inputPoints[0]);
            if (right) addWire(right, inputPoints[1]);
            return {
              x: x + (type === "NOT" ? 48 : width),
              y: top + (type === "NOT" ? 16 : 24),
              name: instance,
            };
          }

          const negativeSignals = new Map();
          function getNegativeSignal(index) {
            if (!negativeSignals.has(index)) {
              const source = inputSignals[index];
              negativeSignals.set(
                index,
                addGate("NOT", 248 + logicOffsetX, source.y + 32, source),
              );
            }
            return negativeSignals.get(index);
          }
          usedNegative.forEach(getNegativeSignal);

          function makeConstant(value, centerY) {
            const source = inputSignals[0];
            const inverse = getNegativeSignal(0);
            return addGate(
              value ? "XOR" : "XNOR",
              352 + logicOffsetX,
              centerY,
              source,
              inverse,
            );
          }

          const useNandNetwork = parityInversion === null && isSop &&
            implicants.length === 2 &&
            implicants.every((term) => n - bitCount(term.m) === 2);
          const useNorNetwork = parityInversion === null && !isSop &&
            implicants.length === 2 &&
            implicants.every((term) => n - bitCount(term.m) === 2);
          const finalGate = useNandNetwork
            ? "NAND2"
            : useNorNetwork
              ? "NOR2"
              : isSop
                ? "OR2"
                : "AND2";
          const termGate = isSop ? "NAND2" : "NOR2";
          let productRoots;
          if (parityInversion !== null) {
            const parityInputs = parityInversion.inputIndexes.map(
              (index) => inputSignals[index],
            );
            let current = parityInputs[0];
            for (let index = 1; index < parityInputs.length; index++) {
              const nextInput = parityInputs[index];
              current = addGate(
                index === 1 && parityInversion.inversion ? "XNOR" : "XOR",
                352 + logicOffsetX + (index - 1) * 112,
                (current.y + nextInput.y) / 2,
                current,
                nextInput,
              );
            }
            productRoots = [{
              ...current,
              productLayer: parityInputs.length - 1,
            }];
          } else {
            productRoots = implicants.map((term, termIndex) => {
              const literals = [];
              for (let index = 0; index < n; index++) {
                const bit = n - 1 - index;
                if ((term.m >> bit) & 1) continue;
                const value = (term.v >> bit) & 1;
                const isPositive = isSop ? Boolean(value) : !value;
                literals.push(
                  isPositive
                    ? inputSignals[index]
                    : getNegativeSignal(index),
                );
              }

              if (!literals.length) {
                return {
                  ...makeConstant(isSop, inputSignals[0].y + termIndex * 96),
                  productLayer: 0,
                };
              }

              let layer = 0;
              let current = literals;
              while (current.length > 1) {
                const next = [];
                for (let index = 0; index < current.length; index += 2) {
                  if (!current[index + 1]) {
                    next.push(current[index]);
                    continue;
                  }
                  const left = current[index];
                  const right = current[index + 1];
                  const lane = termIndex * 96;
                  const centerY = (left.y + right.y) / 2 + lane;
                  const gateX = 352 + logicOffsetX + layer * 224;
                  const complemented = addGate(
                    termGate,
                    gateX,
                    centerY,
                    left,
                    right,
                  );
                  next.push(
                    useNandNetwork || useNorNetwork
                      ? complemented
                      : addGate("NOT", gateX + 64, centerY, complemented),
                  );
                }
                current = next;
                layer++;
              }
              return {
                ...current[0],
                productLayer: layer * (useNandNetwork || useNorNetwork ? 1 : 2),
              };
            });
          }

          if (!productRoots.length) {
            productRoots.push({
              ...makeConstant(!isSop, inputSignals[0].y),
              productLayer: 0,
            });
          }

          let finalSignals = productRoots;
          let outputLayer =
            1 +
            Math.max(
              0,
              ...productRoots.map((root) => root.productLayer || 0),
            );
          while (finalSignals.length > 1) {
            const next = [];
            for (let index = 0; index < finalSignals.length; index += 2) {
              if (!finalSignals[index + 1]) {
                next.push(finalSignals[index]);
                continue;
              }
              const left = finalSignals[index];
              const right = finalSignals[index + 1];
              next.push(
                addGate(
                  finalGate,
                  352 + logicOffsetX + outputLayer * 112,
                  (left.y + right.y) / 2,
                  left,
                  right,
                ),
              );
            }
            finalSignals = next;
            outputLayer++;
          }

          const outputSignal = finalSignals[0];
          for (let row = 0; row < 1 << n; row++) {
            const values = new Map(
              inputSignals.map((signal, index) => [
                signal.name,
                Boolean((row >> (n - 1 - index)) & 1),
              ]),
            );
            for (const gate of gateLogic) {
              const left = values.get(gate.left);
              const right = gate.right ? values.get(gate.right) : undefined;
              if (left === undefined || (gate.right && right === undefined)) {
                throw new Error("Mạch BDF có kết nối tín hiệu không hợp lệ.");
              }
              const value = gate.type === "NOT"
                ? !left
                : gate.type === "AND2"
                  ? left && right
                  : gate.type === "NAND2"
                    ? !(left && right)
                    : gate.type === "OR2"
                      ? left || right
                      : gate.type === "NOR2"
                        ? !(left || right)
                        : gate.type === "XOR"
                          ? left !== right
                          : left === right;
              values.set(gate.output, value);
            }
            const expected = state.tt[row][outIdx];
            if (
              expected !== "X" &&
              Number(values.get(outputSignal.name)) !== Number(expected)
            ) {
              throw new Error(
                `Mạch BDF ${format.toUpperCase()} không khớp bảng chân trị tại hàng ${row}.`,
              );
            }
          }
          const outputPinX = outputSignal.x + 120;
          const outputPinY = outputSignal.y - 8;
          addWire(outputSignal, { x: outputPinX, y: outputSignal.y });

          const pins = inputBus
            ? [quartusBdfPin("input", inputBus.label, inputX, inputY(0))]
            : inputLabels
                .slice(0, n)
                .map((name, index) =>
                  quartusBdfPin("input", name, inputX, inputY(index)),
                );
          pins.push(
            quartusBdfPin(
              "output",
              outputLabels[outIdx],
              outputPinX,
              outputPinY,
            ),
          );
          const gateCount = estimateQuartusBdfGateCount(outIdx, format);
          if (symbols.length !== gateCount) {
            throw new Error(
              `Số cổng BDF không khớp dự kiến (${symbols.length}/${gateCount}).`,
            );
          }
          return [
            '/*',
            'WARNING: Do NOT edit the input and output ports in this file in a text',
            'editor if you plan to continue editing the block that represents it in',
            'the Block Editor! File corruption is VERY likely to occur.',
            '*/',
            '(header "graphic" (version "1.4"))',
            ...pins,
            ...symbols,
            ...connectors,
            "",
          ].join("\n").replace(/\n/g, "\r\n");
        }

        function parseBdfBusName(fieldId, label) {
          const name = $(fieldId).value.trim();
          if (!/^[A-Za-z_][A-Za-z0-9_]{0,15}$/.test(name)) {
            throw new Error(
              `Tên bus ${label} không hợp lệ. Dùng chữ, số hoặc _ (tối đa 16 ký tự).`,
            );
          }
          return name;
        }

        function inferBdfBusName(names) {
          const matches = names.map((name) =>
            /^([A-Za-z_][A-Za-z0-9_]*?)(?:0|[1-9]\d*)$/.exec(name),
          );
          if (matches.every(Boolean) && matches.every((match) => match[1] === matches[0][1])) {
            return matches[0][1];
          }
          return names[0];
        }

        function setBdfPortNameDefaults(outIdx) {
          const group = getQuartusBdfOutputGroup(outIdx);
          $("bdf-input-names").value = inferBdfBusName(
            inputLabels.slice(0, state.last.n),
          );
          $("bdf-output-names").value = inferBdfBusName(
            group.indices.map((index) => outputLabels[index]),
          );
        }

        function generateQuartusBdf(outIdx, format, portNames) {
          const group = getQuartusBdfOutputGroup(outIdx);
          const functions = group.indices.map((index) => ({
            source: getQuartusBdfExpression(index, format),
            output: outputLabels[index],
            expectedRows: state.tt.map((row) => row[index]),
          }));
          return window.CSE206.bdfExport.generateMany(
            functions,
            inputLabels.slice(0, state.last.n),
            portNames,
          );
        }

        function updateBdfFormatSummary() {
          if (!state.last || !state.last.out[activeModalOutputIdx]) return;
          const sopCount = estimateQuartusBdfGateCount(activeModalOutputIdx, "sop");
          const posCount = estimateQuartusBdfGateCount(activeModalOutputIdx, "pos");
          const selected = document.querySelector(
            'input[name="bdf-format"]:checked',
          )?.value || "auto";
          const selectedFormat = resolveQuartusBdfFormat(
            activeModalOutputIdx,
            selected,
          );
          const formatName = selectedFormat.toUpperCase();
          const selectedCount = selectedFormat === "sop" ? sopCount : posCount;
          $("bdf-sop-count").textContent = sopCount;
          $("bdf-pos-count").textContent = posCount;
          $("bdf-auto-count").textContent = `${Math.min(sopCount, posCount)} cổng`;
          $("bdf-summary-choice").textContent = selected === "auto"
            ? `Tự động chọn ${formatName}`
            : `Đang chọn ${formatName}`;
          $("bdf-gate-counts").textContent = selected === "auto"
            ? sopCount === posCount
              ? `${selectedCount} cổng ước tính · SOP và POS có cùng số cổng.`
              : `${selectedCount} cổng ước tính · ít hơn ${Math.abs(sopCount - posCount)} cổng so với ${sopCount < posCount ? "POS" : "SOP"}.`
            : `Ước tính ${selectedCount} cổng logic cho mạch ${formatName}.`;
        }

        function downloadQuartusBdf(outIdx, requestedFormat) {
          if (!state.last || !state.last.out[outIdx]) {
            toast("Không có kết quả để xuất.");
            return;
          }
          try {
            if ($("copy-modal").classList.contains("hidden")) {
              setBdfPortNameDefaults(outIdx);
            }
            const format = resolveQuartusBdfFormat(outIdx, requestedFormat);
            const portNames = {
              inputBus: parseBdfBusName("bdf-input-names", "input"),
              outputBus: parseBdfBusName("bdf-output-names", "output"),
            };
            if (portNames.inputBus.toLowerCase() === portNames.outputBus.toLowerCase()) {
              throw new Error("Tên bus input và output BDF phải khác nhau.");
            }
            verifyQuartusBdfOutput(outIdx, format);
            const generated = generateQuartusBdf(outIdx, format, portNames);
            if (!generated?.content) {
              toast("Không tạo được nội dung BDF.");
              return;
            }
            const { content, gateCount } = generated;
            const fileName = `${portNames.outputBus}.bdf`;
            const url = URL.createObjectURL(
              new Blob([content], { type: "text/plain;charset=utf-8" }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            $("copy-modal").classList.add("hidden");
            toast(`Đã xuất ${fileName} · ${format.toUpperCase()} · ${gateCount} cổng`);
          } catch (error) {
            toast(error instanceof Error ? error.message : String(error));
          }
        }

        window.downloadQuartusBdf = downloadQuartusBdf;
        window.exportQuartusBdf = function (outIdx, format) {
          if (format) {
            downloadQuartusBdf(outIdx, format);
            return;
          }
          window.openQuartusBdfModal(outIdx);
        };
        window.openQuartusBdfModal = function (outIdx) {
          if (!state.last || !state.last.out[outIdx]) {
            toast("Chưa có kết quả để xuất BDF.");
            return;
          }
          activeModalOutputIdx = outIdx;
          const group = getQuartusBdfOutputGroup(outIdx);
          setBdfPortNameDefaults(outIdx);
          $("bdf-format-auto").checked = true;
          $("modal-target-info").textContent =
            `Export · ${group.label}`;
          selectExportFormat("bdf");
          $("copy-modal").classList.remove("hidden");
          updateBdfFormatSummary();
          $("bdf-format-auto").focus();
        };

        document.querySelectorAll('input[name="bdf-format"]').forEach((input) => {
          input.addEventListener("change", updateBdfFormatSummary);
        });

        function selectExportFormat(format) {
          activeModalFormat = format;
          document.querySelectorAll(".fmt-btn").forEach((button) => {
            button.classList.toggle("selected", button.dataset.fmt === format);
          });
          const isBdf = format === "bdf";
          $("bdf-export-options").hidden = !isBdf;
          $("copy-content-options").hidden = isBdf;
          $("btn-modal-execute").textContent = isBdf
            ? "Export Quartus BDF"
            : format === "pdf"
              ? "Export PDF"
              : format === "word"
                ? "Export Word"
                : "Export TXT";
          if (isBdf) updateBdfFormatSummary();
        }

        window.openCustomCopyModal = function (outIdx) {
          activeModalOutputIdx = outIdx;
          $("modal-target-info").textContent =
            `Export · Output ${outputLabels[outIdx]}`;
          selectExportFormat("word");
          $("copy-modal").classList.remove("hidden");
        };

        $("btn-close-modal").onclick = () =>
          $("copy-modal").classList.add("hidden");

        document.querySelectorAll(".fmt-btn").forEach((button) => {
          button.onclick = () => selectExportFormat(button.dataset.fmt);
        });

        $("btn-modal-execute").onclick = () => {
          const outIdx = activeModalOutputIdx;
          if (activeModalFormat === "bdf") {
            const bdfFormat = document.querySelector(
              'input[name="bdf-format"]:checked',
            )?.value || "auto";
            downloadQuartusBdf(outIdx, bdfFormat);
            return;
          }

          const { n } = getSanitizedParams();
          const incGrid = $("copy-opt-grid").checked;
          const incSOP = $("copy-opt-sop").checked;
          const incPOS = $("copy-opt-pos").checked;
          const incMinterms = $("copy-opt-minterms").checked;

          if (!incGrid && !incSOP && !incPOS && !incMinterms) {
            toast("Vui lòng chọn ít nhất 1 thành phần!");
            return;
          }

          const outData = state.last.out[outIdx];
          const isMaxterm = outputNotations[outIdx] === "max";
          let html = `<h1>K-Map Analysis: ${outputLabels[outIdx]}</h1>`;
          let txt = `K-Map Analysis: ${outputLabels[outIdx]}\n\n`;
          if (incGrid) {
            const table = kmap(outIdx, true);
            html += table;
            const doc = new DOMParser().parseFromString(table, "text/html");
            txt += [...doc.querySelectorAll("tr")]
              .map((row) =>
                [...row.cells]
                  .map((cell) => cell.textContent.trim())
                  .join("\t"),
              )
              .join("\n") + "\n\n";
          }
          if (incMinterms) {
            const notation =
              `${isMaxterm ? "ΠM" : "Σm"}(${(isMaxterm ? outData.off : outData.on).join(", ") || "—"})`;
            html += `<p><strong>${isMaxterm ? "Maxterms" : "Minterms"}:</strong> ${notation} <strong>d:</strong> (${outData.dc.join(", ") || "—"})</p>`;
            txt += `${notation} | d: ${outData.dc.join(", ") || "—"}\n`;
          }
          if (incSOP) {
            const expression = `${outputLabels[outIdx]} = ${sopStr(outData.S, n)}`;
            html += `<p><strong>SOP Minimal:</strong> ${expression}</p>`;
            txt += `SOP: ${expression}\n`;
          }
          if (incPOS) {
            const expression = `${outputLabels[outIdx]} = ${posStr(outData.C, n)}`;
            html += `<p><strong>POS Minimal:</strong> ${expression}</p>`;
            txt += `POS: ${expression}\n`;
          }

          const title = `K-Map Analysis: ${outputLabels[outIdx]}`;
          const documentHtml = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { color: #172033; font: 12pt Arial, sans-serif; margin: 24mm; }
    h1 { font-size: 20pt; margin: 0 0 18pt; }
    p { margin: 10pt 0; }
    table { border-collapse: collapse; margin: 14pt auto; }
    th, td { border: 1px solid #64748b; padding: 6px 12px; text-align: center; }
    th { background: #f1f5f9; }
    @page { size: A4; margin: 18mm; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>${html}</body>
</html>`;
          const fileName = `${outputLabels[outIdx]}_kmap`;
          if (activeModalFormat === "pdf") {
            const printWindow = window.open("", "_blank");
            if (!printWindow) {
              toast("Không mở được cửa sổ PDF. Hãy cho phép cửa sổ bật lên rồi thử lại.");
              return;
            }
            printWindow.document.open();
            printWindow.document.write(documentHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => printWindow.print(), 250);
          } else {
            const isWord = activeModalFormat === "word";
            const blob = new Blob(
              [isWord ? documentHtml : txt],
              {
                type: isWord
                  ? "application/msword;charset=utf-8"
                  : "text/plain;charset=utf-8",
              },
            );
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${fileName}.${isWord ? "doc" : "txt"}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }
          $("copy-modal").classList.add("hidden");
          toast(
            activeModalFormat === "pdf"
              ? "Đã mở hộp thoại in. Chọn Save as PDF để lưu file."
              : `Đã xuất ${fileName}.${activeModalFormat === "word" ? "doc" : "txt"}`,
          );
        };

        $("copy-modal").addEventListener("click", (event) => {
          if (event.target === $("copy-modal")) {
            $("copy-modal").classList.add("hidden");
          }
        });
        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape") $("copy-modal").classList.add("hidden");
        });

        /* ---------- Paste từ Excel / Word ---------- */

})();
