(() => {
  window.CSE206 = window.CSE206 || {};
  window.CSE206.bdfModules = window.CSE206.bdfModules || {};

  const MAX_FANIN = 8;
  const { collectVariables } = window.CSE206.bdfModules.expression;

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

  window.CSE206.bdfModules.netlist = { synthesize, synthesizeMany, evaluate };
})();
