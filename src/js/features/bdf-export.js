(() => {
  const MAX_FANIN = 8;
  const T = "\t";
  const snap8 = (value) => Math.round(value / 8) * 8;
  const gateHeight = (gate) =>
    gate.type === "NOT" ? 32 : 16 * (gate.ins.length + 1);
  const gateWidth = (gate) => (gate.type === "NOT" ? 48 : 64);
  const outputOffset = (gate) =>
    gate.type === "NOT" ? 16 : gateHeight(gate) / 2;

  function tokenize(source, longNames) {
    const tokens = [];
    let index = 0;
    while (index < source.length) {
      if (/\s/.test(source[index])) {
        index++;
        continue;
      }
      const rest = source.slice(index);
      const identifier = (longNames ? /^[A-Za-z_]\w*/ : /^[A-Za-z][0-9]*/).exec(
        rest,
      );
      if (identifier) {
        tokens.push({ type: "id", value: identifier[0] });
        index += identifier[0].length;
        continue;
      }
      const constant = /^[01]/.exec(rest);
      if (constant) {
        tokens.push({ type: "constant", value: Number(constant[0]) });
        index++;
        continue;
      }
      const operator = /^[()'!~+|*&.^]/.exec(rest);
      if (operator) {
        tokens.push({ type: "op", value: operator[0] });
        index++;
        continue;
      }
      throw new Error(
        `Ký tự không hợp lệ "${source[index]}" trong biểu thức BDF.`,
      );
    }
    return tokens;
  }

  const mkNot = (node) =>
    node.type === "not" ? node.child : { type: "not", child: node };
  function mkNode(type, args) {
    const flat = [];
    args.forEach((arg) => {
      if (arg.type === type) flat.push(...arg.args);
      else flat.push(arg);
    });
    return flat.length === 1 ? flat[0] : { type, args: flat };
  }

  function parse(tokens) {
    let position = 0;
    const peek = () => tokens[position];
    const isOp = (...values) =>
      peek()?.type === "op" && values.includes(peek().value);
    const startsFactor = () =>
      peek()?.type === "id" ||
      peek()?.type === "constant" ||
      isOp("(", "!", "~");

    function parseOr() {
      const args = [parseXor()];
      while (isOp("+", "|")) {
        position++;
        args.push(parseXor());
      }
      return mkNode("or", args);
    }
    function parseXor() {
      const args = [parseAnd()];
      while (isOp("^")) {
        position++;
        args.push(parseAnd());
      }
      return mkNode("xor", args);
    }
    function parseAnd() {
      const args = [parseUnary()];
      for (;;) {
        if (isOp("*", "&", ".")) {
          position++;
          args.push(parseUnary());
        } else if (startsFactor()) {
          args.push(parseUnary());
        } else {
          break;
        }
      }
      return mkNode("and", args);
    }
    function parseUnary() {
      if (isOp("!", "~")) {
        position++;
        return mkNot(parseUnary());
      }
      let factor = parsePrimary();
      while (isOp("'")) {
        position++;
        factor = mkNot(factor);
      }
      return factor;
    }
    function parsePrimary() {
      const token = peek();
      if (!token) throw new Error("Biểu thức BDF kết thúc đột ngột.");
      if (token.type === "id" || token.type === "constant") {
        position++;
        return token.type === "id"
          ? { type: "var", name: token.value }
          : { type: "constant", value: token.value };
      }
      if (isOp("(")) {
        position++;
        const expression = parseOr();
        if (!isOp(")")) throw new Error('Thiếu dấu ")" trong biểu thức BDF.');
        position++;
        return expression;
      }
      throw new Error(`Token BDF không mong đợi "${token.value}".`);
    }

    const expression = parseOr();
    if (position < tokens.length) {
      throw new Error(
        `Thừa token "${tokens[position].value}" trong biểu thức BDF.`,
      );
    }
    return expression;
  }

  function collectVariables(node, variables) {
    if (node.type === "var") variables.add(node.name);
    else if (node.type === "not") collectVariables(node.child, variables);
    else if (node.type === "and" || node.type === "or" || node.type === "xor") {
      node.args.forEach((arg) => collectVariables(arg, variables));
    }
  }

  function synthesizeMany(expressions, inputNames) {
    const variables = new Set();
    expressions.forEach((entry) => collectVariables(entry.expression, variables));
    const unknownInputs = [...variables].filter((name) => !inputNames.includes(name));
    if (unknownInputs.length) {
      throw new Error(`Biến không tồn tại trong bảng: ${unknownInputs.join(", ")}.`);
    }
    const inputs = inputNames.slice();
    const outputNames = expressions.map((entry) => entry.output);
    if (new Set(outputNames).size !== outputNames.length) {
      throw new Error("Tên đầu ra BDF bị trùng.");
    }
    const conflictingOutput = outputNames.find((name) => inputs.includes(name));
    if (conflictingOutput) {
      throw new Error(`"${conflictingOutput}" vừa là đầu vào vừa là đầu ra.`);
    }

    const gates = [];
    const usedNames = new Set([...inputNames, ...outputNames]);
    const commonSubexpressions = new Map();
    let nextNet = 0;
    const newNet = () => {
      let name;
      do {
        name = `w${++nextNet}`;
      } while (usedNames.has(name));
      usedNames.add(name);
      return name;
    };

    function gate(type, ins, out) {
      if (!out) {
        const key = `${type}|${ins.join(",")}`;
        if (commonSubexpressions.has(key)) return commonSubexpressions.get(key);
        out = newNet();
        commonSubexpressions.set(key, out);
      }
      gates.push({ type, ins, out });
      return out;
    }

    function nary(kind, nets, negated, out) {
      if (kind === "xor") {
        let current = nets[0];
        for (let index = 1; index < nets.length; index++) {
          const last = index === nets.length - 1;
          current = gate(
            last && negated ? "XNOR" : "XOR",
            [current, nets[index]],
            last ? out : undefined,
          );
        }
        return current;
      }

      const base = kind.toUpperCase();
      while (nets.length > MAX_FANIN) {
        const next = [];
        for (let index = 0; index < nets.length; index += MAX_FANIN) {
          const group = nets.slice(index, index + MAX_FANIN);
          next.push(group.length === 1 ? group[0] : gate(base, group));
        }
        nets = next;
      }
      return gate(`${negated ? "N" : ""}${base}`, nets, out);
    }

    function emit(node, out) {
      if (node.type === "var") {
        if (!out) return node.name;
        return gate("OR", [node.name, node.name], out);
      }
      if (node.type === "constant") {
        const source = inputs[0];
        const inverse = gate("NOT", [source]);
        return gate(node.value ? "OR" : "AND", [source, inverse], out);
      }
      if (node.type === "not") {
        const child = node.child;
        if (
          child.type === "and" ||
          child.type === "or" ||
          child.type === "xor"
        ) {
          return nary(
            child.type,
            child.args.map((arg) => emit(arg)),
            true,
            out,
          );
        }
        return gate("NOT", [emit(child)], out);
      }
      if (
        (node.type === "or" || node.type === "and") &&
        node.args.every((arg) => arg.type === "not")
      ) {
        const invertedKind = node.type === "or" ? "and" : "or";
        return nary(
          invertedKind,
          node.args.map((arg) => emit(arg.child)),
          true,
          out,
        );
      }
      return nary(
        node.type,
        node.args.map((arg) => emit(arg)),
        false,
        out,
      );
    }

    expressions.forEach((entry) => emit(entry.expression, entry.output));
    return { inputs, outputs: outputNames, gates };
  }

  function synthesize(expression, output, inputNames) {
    return synthesizeMany([{ expression, output }], inputNames);
  }

  function groupBuses(names) {
    const byPrefix = new Map();
    names.forEach((name, index) => {
      const match = /^([A-Za-z_]+)(0|[1-9]\d*)$/.exec(name);
      if (!match) return;
      const [, prefix, indexText] = match;
      if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
      byPrefix.get(prefix).push({ name, index: Number(indexText), position: index });
    });

    const grouped = new Map();
    byPrefix.forEach((bits, prefix) => {
      const indexes = bits.map((bit) => bit.index).sort((a, b) => a - b);
      const contiguous = indexes.every((value, index) =>
        index === 0 || value === indexes[index - 1] + 1,
      );
      if (bits.length < 2 || !contiguous) return;
      const orderedBits = [...bits].sort((a, b) => b.index - a.index);
      const unit = {
        prefix,
        bits: orderedBits,
        label: `${prefix}[${orderedBits[0].index}..${orderedBits[orderedBits.length - 1].index}]`,
        position: Math.min(...bits.map((bit) => bit.position)),
      };
      bits.forEach((bit) => grouped.set(bit.name, unit));
    });

    const units = [];
    const seen = new Set();
    names.forEach((name, index) => {
      const group = grouped.get(name);
      if (!group) {
        units.push({ plain: name, position: index });
      } else if (!seen.has(group.prefix)) {
        seen.add(group.prefix);
        units.push(group);
      }
    });
    return units.sort((left, right) => left.position - right.position);
  }

  function layout({ inputs, outputs, gates }) {
    const pinX = 200;
    const levels = {};
    inputs.forEach((name) => (levels[name] = 0));
    gates.forEach((gate) => {
      gate.level = 1 + Math.max(...gate.ins.map((name) => levels[name]));
      levels[gate.out] = gate.level;
    });
    const maxLevel = Math.max(...gates.map((gate) => gate.level));
    const pinColumn = maxLevel + 1;
    const nets = {};
    const getNet = (name) =>
      nets[name] ||
      (nets[name] = { name, sourceColumn: levels[name], sinks: [] });
    inputs.forEach(getNet);
    gates.forEach((gate) => getNet(gate.out));
    gates.forEach((gate) =>
      gate.ins.forEach((name, port) =>
        getNet(name).sinks.push({ column: gate.level, gate, port }),
      ),
    );
    outputs.forEach((name) =>
      getNet(name).sinks.push({ column: pinColumn, pin: name }),
    );
    const allNets = Object.values(nets);
    const longNets = allNets.filter((net) =>
      net.sinks.some((sink) => sink.column > net.sourceColumn + 1),
    );
    longNets.forEach((net, index) => (net.laneY = 24 + 8 * index));
    const top = snap8(24 + 8 * longNets.length + 40);

    const inputUnits = groupBuses(inputs);
    const hasInputBus = inputUnits.some((unit) => unit.prefix);
    const busInputX = pinX + 32;
    const inputTapX = hasInputBus ? busInputX + 64 : pinX;
    const sourceY = {};
    const inputPins = [];
    const buses = [];
    let inputY = top;
    inputUnits.forEach((unit) => {
      if (unit.plain) {
        sourceY[unit.plain] = inputY + 8;
        getNet(unit.plain).sourceX = pinX;
        inputPins.push({ label: unit.plain, y: inputY });
        inputY += 80;
        return;
      }

      const ys = unit.bits.map((bit, index) => inputY + 8 + 32 * index);
      const segments = [
        { x1: pinX, y1: ys[0], x2: busInputX, y2: ys[0], bus: true },
      ];
      for (let index = 0; index + 1 < ys.length; index++) {
        segments.push({
          x1: busInputX,
          y1: ys[index],
          x2: busInputX,
          y2: ys[index + 1],
          bus: true,
        });
      }
      unit.bits.forEach((bit, index) => {
        sourceY[bit.name] = ys[index];
        const net = getNet(bit.name);
        net.sourceX = inputTapX;
        net.inputTap = {
          x1: busInputX,
          y1: ys[index],
          x2: inputTapX,
          y2: ys[index],
          label: `${unit.prefix}[${bit.index}]`,
        };
      });
      inputPins.push({ label: unit.label, y: inputY });
      buses.push({ name: unit.prefix, segments });
      inputY += 8 + 32 * (unit.bits.length - 1) + 64;
    });
    inputs.forEach((name) => {
      getNet(name).sourceY = sourceY[name];
    });

    const channels = Array.from({ length: maxLevel + 1 }, () => []);
    allNets.forEach((net) => {
      channels[net.sourceColumn].push({ kind: "trunk", net });
      net.sinks.forEach((sink) => {
        if (sink.column > net.sourceColumn + 1) {
          channels[sink.column - 1].push({ kind: "drop", net, sink });
        }
      });
    });
    const channelWidths = channels.map((items) => 16 * (items.length + 1));
    const channelLeft = [inputTapX];
    const columns = [];
    for (let column = 0; column <= maxLevel; column++) {
      if (column > 0) channelLeft[column] = columns[column] + 64;
      columns[column + 1] = channelLeft[column] + channelWidths[column];
    }
    const outputX = columns[maxLevel + 1];

    let previous = inputs.map((name) => ({ y: sourceY[name], net: name }));
    for (let level = 1; level <= maxLevel; level++) {
      const gatesAtLevel = gates.filter((gate) => gate.level === level);
      gatesAtLevel.forEach((gate) => {
        const average =
          gate.ins.reduce((sum, name) => sum + sourceY[name], 0) /
          gate.ins.length;
        gate.wantedY = snap8(average - outputOffset(gate));
      });
      gatesAtLevel.sort((left, right) => left.wantedY - right.wantedY);
      let bottom = top - 16;
      gatesAtLevel.forEach((gate) => {
        gate.x = columns[level];
        let y = Math.max(gate.wantedY, bottom + 16, top);
        const collides = (candidateY) =>
          gate.ins.some((name, port) =>
            previous.some(
              (source) =>
                source.y === candidateY + 16 * (port + 1) &&
                source.net !== name,
            ),
          );
        while (collides(y)) y += 8;
        gate.y = y;
        bottom = y + gateHeight(gate);
        sourceY[gate.out] = y + outputOffset(gate);
      });
      previous = gatesAtLevel.map((gate) => ({
        y: sourceY[gate.out],
        net: gate.out,
      }));
    }

    const outputUnits = groupBuses(outputs);
    const hasOutputBus = outputUnits.some((unit) => unit.prefix);
    const busOutputX = hasOutputBus ? outputX + 64 : outputX;
    const outputPinX = hasOutputBus ? busOutputX + 32 : outputX;
    const outputPins = [];
    let lastOutputY = -Infinity;
    const placeOutputY = (name) => {
      let y = Math.max(snap8(sourceY[name]), top + 8, lastOutputY + 32);
      while (
        previous.some((source) => source.y === y && source.net !== name)
      ) {
        y += 8;
      }
      lastOutputY = y;
      return y;
    };
    outputUnits.forEach((unit) => {
      if (unit.plain) {
        const y = placeOutputY(unit.plain);
        outputPins.push({ label: unit.plain, y: y - 8 });
        getNet(unit.plain).sinks.forEach((sink) => {
          if (sink.pin) {
            sink.x = outputPinX;
            sink.y = y;
          }
        });
        return;
      }

      const ys = unit.bits.map((bit) => placeOutputY(bit.name));
      const segments = [
        {
          x1: busOutputX,
          y1: ys[0],
          x2: outputPinX,
          y2: ys[0],
          bus: true,
        },
      ];
      for (let index = 0; index + 1 < ys.length; index++) {
        segments.push({
          x1: busOutputX,
          y1: ys[index],
          x2: busOutputX,
          y2: ys[index + 1],
          bus: true,
        });
      }
      unit.bits.forEach((bit, index) => {
        const net = getNet(bit.name);
        net.outputTap = {
          x1: outputX,
          y1: ys[index],
          x2: busOutputX,
          y2: ys[index],
          label: `${unit.prefix}[${bit.index}]`,
        };
        net.sinks.forEach((sink) => {
          if (sink.pin) {
            sink.x = outputX;
            sink.y = ys[index];
          }
        });
      });
      outputPins.push({ label: unit.label, y: ys[0] - 8 });
      buses.push({ name: unit.prefix, segments });
      lastOutputY += 32;
    });

    allNets.forEach((net) => {
      const sourceGate = gates.find((gate) => gate.out === net.name);
      if (sourceGate) {
        net.sourceX = sourceGate.x + gateWidth(sourceGate);
        net.sourceY = sourceY[net.name];
      }
      net.sinks.forEach((sink) => {
        if (sink.gate) {
          sink.x = sink.gate.x;
          sink.y = sink.gate.y + 16 * (sink.port + 1);
        }
      });
    });

    channels.forEach((items, column) => {
      const key = (item) =>
        item.kind === "trunk" ? item.net.sourceY : item.sink.y;
      items.sort((left, right) => {
        if (left.kind !== right.kind) return left.kind === "trunk" ? -1 : 1;
        return key(left) - key(right);
      });
      items.forEach((item, index) => {
        const x = channelLeft[column] + 16 * (index + 1);
        if (item.kind === "trunk") item.net.trunkX = x;
        else item.sink.dropX = x;
      });
    });
    return {
      nets: allNets,
      top,
      outputX,
      inputPins,
      outputPins: outputPins.map((pin) => ({ ...pin, x: outputPinX })),
      buses,
    };
  }

  function routeNet(net) {
    const segments = [];
    const add = (x1, y1, x2, y2, extra = {}) => {
      if (x1 !== x2 || y1 !== y2) {
        segments.push({ x1, y1, x2, y2, ...extra });
      }
    };
    const adjacent = net.sinks.filter(
      (sink) => sink.column === net.sourceColumn + 1,
    );
    const distant = net.sinks.filter(
      (sink) => sink.column > net.sourceColumn + 1,
    );
    if (net.inputTap) {
      add(net.inputTap.x1, net.inputTap.y1, net.inputTap.x2, net.inputTap.y2, {
        label: net.inputTap.label,
      });
    }
    add(net.sourceX, net.sourceY, net.trunkX, net.sourceY);
    const branchYs = new Set([net.sourceY, ...adjacent.map((sink) => sink.y)]);
    if (distant.length) branchYs.add(net.laneY);
    const orderedYs = [...branchYs].sort((a, b) => a - b);
    for (let index = 0; index + 1 < orderedYs.length; index++) {
      add(net.trunkX, orderedYs[index], net.trunkX, orderedYs[index + 1]);
    }
    adjacent.forEach((sink) => add(net.trunkX, sink.y, sink.x, sink.y));
    let previousX = net.trunkX;
    distant
      .sort((left, right) => left.dropX - right.dropX)
      .forEach((sink) => {
        add(previousX, net.laneY, sink.dropX, net.laneY);
        previousX = sink.dropX;
        add(sink.dropX, net.laneY, sink.dropX, sink.y);
        add(sink.dropX, sink.y, sink.x, sink.y);
      });
    if (net.outputTap) {
        add(net.outputTap.x1, net.outputTap.y1, net.outputTap.x2, net.outputTap.y2, {
          label: net.outputTap.label,
        });
    }
    return segments;
  }

  const textWidth = (text, perCharacter = 5.5) =>
    Math.ceil(perCharacter * text.length);
  function renderInputPin(name, y) {
    return `(pin
${T}(input)
${T}(rect 32 ${y} 200 ${y + 16})
${T}(text "INPUT" (rect 125 0 153 10)(font "Arial" (font_size 6)))
${T}(text "${name}" (rect 5 0 ${5 + textWidth(name)} 12)(font "Arial" ))
${T}(pt 168 8)
${T}(drawing
${T}${T}(line (pt 84 12)(pt 109 12))
${T}${T}(line (pt 84 4)(pt 109 4))
${T}${T}(line (pt 113 8)(pt 168 8))
${T}${T}(line (pt 84 12)(pt 84 4))
${T}${T}(line (pt 109 4)(pt 113 8))
${T}${T}(line (pt 109 12)(pt 113 8))
${T})
${T}(text "VCC" (rect 128 7 148 17)(font "Arial" (font_size 6)))
)`;
  }

  function renderOutputPin(name, x, y) {
    return `(pin
${T}(output)
${T}(rect ${x} ${y} ${x + 176} ${y + 16})
${T}(text "OUTPUT" (rect 1 0 39 10)(font "Arial" (font_size 6)))
${T}(text "${name}" (rect 90 0 ${90 + textWidth(name)} 12)(font "Arial" ))
${T}(pt 0 8)
${T}(drawing
${T}${T}(line (pt 0 8)(pt 52 8))
${T}${T}(line (pt 52 4)(pt 78 4))
${T}${T}(line (pt 52 12)(pt 78 12))
${T}${T}(line (pt 52 12)(pt 52 4))
${T}${T}(line (pt 78 4)(pt 82 8))
${T}${T}(line (pt 82 8)(pt 78 12))
${T}${T}(line (pt 78 12)(pt 82 8))
${T})
)`;
  }

  function renderSegment(segment) {
    const label = segment.label
      ? `${T}(text "${segment.label}" (rect ${segment.x1 + 10} ${segment.y1 - 16} ${segment.x1 + 10 + textWidth(segment.label)} ${segment.y1 + 1})(font "Intel Clear" ))\n`
      : "";
    return `(connector
${label}${T}(pt ${segment.x1} ${segment.y1})
${T}(pt ${segment.x2} ${segment.y2})
${segment.bus ? `${T}(bus)\n` : ""})`;
  }

  function renderSymbol(gate, instance) {
    const count = gate.ins.length;
    const height = gateHeight(gate);
    const width = gateWidth(gate);
    const middle = height / 2;
    const kind = {
      NOT: "NOT",
      AND: "AND",
      NAND: "AND",
      OR: "OR",
      NOR: "OR",
      XOR: "XOR",
      XNOR: "XOR",
    }[gate.type];
    const negated = /^(NAND|NOR|XNOR)/.test(gate.type);
    const label =
      gate.type === "NOT" || kind === "XOR"
        ? gate.type
        : `${gate.type}${count}`;
    const drawing = [];
    const ports = [];
    const portText = (name, y, x = 2) =>
      `${T}${T}(text "${name}" (rect ${x} ${y - 9} ${x + 17} ${y + 3})(font "Courier New" (bold))(invisible))\n`.repeat(
        2,
      );
    let header = `(symbol
${T}(rect ${gate.x} ${gate.y} ${gate.x + width} ${gate.y + height})
${T}(text "${label}" (rect 1 0 ${1 + 6 * label.length} 10)(font "Arial" (font_size 6)))
${T}(text "${instance}" (rect 3 ${height - 11} ${3 + 5 * instance.length - 3} ${height + 1})(font "Arial" ))
`;

    if (kind === "NOT") {
      ports.push(`${T}(port
${T}${T}(pt 0 16)
${T}${T}(input)
${portText("IN", 16)}${T}${T}(line (pt 0 16)(pt 13 16))
${T})`);
      ports.push(`${T}(port
${T}${T}(pt 48 16)
${T}${T}(output)
${portText("OUT", 16, 32)}${T}${T}(line (pt 39 16)(pt 48 16))
${T})`);
      drawing.push(
        "(line (pt 13 25)(pt 13 7))",
        "(line (pt 13 7)(pt 31 16))",
        "(line (pt 13 25)(pt 31 16))",
        "(circle (rect 31 12 39 20))",
      );
    } else {
      const lineEnd = kind === "AND" ? 14 : kind === "OR" ? 15 : 11;
      for (let index = 1; index <= count; index++) {
        const y = 16 * index;
        ports.push(`${T}(port
${T}${T}(pt 0 ${y})
${T}${T}(input)
${portText(`IN${index}`, y)}${T}${T}(line (pt 0 ${y})(pt ${lineEnd} ${y}))
${T})`);
      }
      let right;
      if (kind === "AND") {
        const top = 12;
        const bottom = height - 12;
        const radius = Math.min((bottom - top) / 2, 20);
        drawing.push(
          `(line (pt 14 ${top})(pt 31 ${top}))`,
          `(line (pt 14 ${bottom})(pt 31 ${bottom}))`,
          `(line (pt 14 ${top})(pt 14 ${bottom}))`,
          `(arc (pt 31 ${bottom})(pt 31 ${top})(rect ${31 - radius} ${top} ${31 + radius} ${bottom}))`,
        );
        right = 31 + radius;
      } else {
        const top = 13;
        const bottom = height - 13;
        const curveHeight = middle - top;
        const outerRadius = Math.round(3 * curveHeight);
        const innerRadius = Math.round(1.5 * curveHeight);
        drawing.push(
          `(line (pt 14 ${top})(pt 25 ${top}))`,
          `(line (pt 14 ${bottom})(pt 25 ${bottom}))`,
          `(arc (pt 14 ${bottom})(pt 14 ${top})(rect -14 ${middle - innerRadius} 19 ${middle + innerRadius}))`,
          `(arc (pt 49 ${middle})(pt 25 ${top})(rect -6 ${top} 57 ${top + 2 * outerRadius}))`,
          `(arc (pt 25 ${bottom})(pt 49 ${middle})(rect -6 ${bottom - 2 * outerRadius} 57 ${bottom}))`,
        );
        if (kind === "XOR") {
          drawing.push(
            `(arc (pt 8 ${bottom})(pt 8 ${top})(rect -20 ${middle - innerRadius} 13 ${middle + innerRadius}))`,
          );
        }
        right = 49;
      }
      const outputStart = negated ? right + 8 : right;
      if (negated) {
        drawing.push(
          `(circle (rect ${right} ${middle - 4} ${right + 8} ${middle + 4}))`,
        );
      }
      ports.push(`${T}(port
${T}${T}(pt 64 ${middle})
${T}${T}(output)
${portText("OUT", middle, 48)}${T}${T}(line (pt ${outputStart} ${middle})(pt 64 ${middle}))
${T})`);
    }
    header += ports.join("\n");
    return `${header}
${T}(drawing
${drawing.map((line) => `${T}${T}${line}`).join("\n")}
${T})
)`;
  }

  function evaluate(gates, inputNames, row) {
    const values = new Map(
      inputNames.map((name, index) => [
        name,
        Boolean((row >> (inputNames.length - index - 1)) & 1),
      ]),
    );
    for (const gate of gates) {
      const args = gate.ins.map((name) => values.get(name));
      const missingSignal = gate.ins.find(
        (name, index) => args[index] === undefined,
      );
      if (missingSignal) {
        throw new Error(
          `Netlist BDF dùng tín hiệu chưa được tạo: ${missingSignal}.`,
        );
      }
      const value =
        gate.type === "NOT"
          ? !args[0]
          : gate.type === "AND"
            ? args.every(Boolean)
            : gate.type === "NAND"
              ? !args.every(Boolean)
              : gate.type === "OR"
                ? args.some(Boolean)
                : gate.type === "NOR"
                  ? !args.some(Boolean)
                  : gate.type === "XOR"
                    ? args.reduce((parity, bit) => parity !== bit, false)
                    : args.reduce((parity, bit) => parity !== bit, false) ===
                      false;
      values.set(gate.out, value);
    }
    return values;
  }

  function parseExpression(source, inputNames) {
    const longNames = inputNames.some((name) => !/^[A-Za-z][0-9]*$/.test(name));
    return parse(tokenize(source.replace(/·/g, "*"), longNames));
  }

  function count(source, output, inputNames) {
    return synthesize(parseExpression(source, inputNames), output, inputNames)
      .gates.length;
  }

  function countMany(functions, inputNames) {
    const expressions = functions.map((entry) => ({
      output: entry.output,
      expression: parseExpression(entry.source, inputNames),
    }));
    return synthesizeMany(expressions, inputNames).gates.length;
  }

  function generateMany(functions, inputNames) {
    const expressions = functions.map((entry) => ({
      output: entry.output,
      expression: parseExpression(entry.source, inputNames),
    }));
    const netlist = synthesizeMany(expressions, inputNames);
    const rowCount = functions[0]?.expectedRows.length || 0;
    for (let row = 0; row < rowCount; row++) {
      const values = evaluate(netlist.gates, inputNames, row);
      for (const entry of functions) {
        const expected = entry.expectedRows[row];
        if (
          expected !== "X" &&
          Number(values.get(entry.output)) !== Number(expected)
        ) {
          throw new Error(
            `Mạch BDF không khớp bảng chân trị tại hàng ${row} (${entry.output}).`,
          );
        }
      }
    }

    const placed = layout(netlist);
    const parts = [
      "/*",
      "WARNING: Do NOT edit the input and output ports in this file in a text",
      "editor if you plan to continue editing the block that represents it in",
      "the Block Editor! File corruption is VERY likely to occur.",
      "*/",
      '(header "graphic" (version "1.4"))',
    ];
    placed.inputPins.forEach((pin) =>
      parts.push(renderInputPin(pin.label, pin.y)),
    );
    placed.outputPins.forEach((pin) =>
      parts.push(renderOutputPin(pin.label, pin.x, pin.y)),
    );
    netlist.gates.forEach((gate, index) =>
      parts.push(renderSymbol(gate, index === 0 ? "inst" : `inst${index}`)),
    );

    const segments = [
      ...placed.buses.flatMap((bus) => bus.segments),
      ...placed.nets.flatMap(routeNet),
    ];
    const endpointCounts = {};
    segments.forEach((segment) => {
      parts.push(renderSegment(segment));
      [`${segment.x1} ${segment.y1}`, `${segment.x2} ${segment.y2}`].forEach(
        (point) => {
          endpointCounts[point] = (endpointCounts[point] || 0) + 1;
        },
      );
    });
    const junctions = new Set(
      Object.entries(endpointCounts)
        .filter(([, count]) => count >= 3)
        .map(([point]) => point),
    );
    junctions.forEach((point) => parts.push(`(junction (pt ${point}))`));
    return {
      content: `${parts.join("\n")}\n`,
      gateCount: netlist.gates.length,
    };
  }

  function generate(source, output, inputNames, expectedRows) {
    return generateMany(
      [{ source, output, expectedRows }],
      inputNames,
    );
  }

  window.CSE206.bdfExport = { count, countMany, generate, generateMany, groupBuses };
})();
