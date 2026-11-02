(() => {
  window.CSE206 = window.CSE206 || {};
  window.CSE206.bdfModules = window.CSE206.bdfModules || {};


  function tokenize(source, longNames, inputNames) {
    const tokens = [];
    const namesByLength = [...inputNames].sort(
      (left, right) => right.length - left.length,
    );
    let index = 0;
    while (index < source.length) {
      if (/\s/.test(source[index])) {
        index++;
        continue;
      }
      const rest = source.slice(index);
      const knownName = namesByLength.find((name) =>
        rest.startsWith(name),
      );
      if (knownName) {
        tokens.push({ type: "id", value: knownName });
        index += knownName.length;
        continue;
      }
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

  function parseExpression(source, inputNames) {
    const longNames = inputNames.some((name) => !/^[A-Za-z][0-9]*$/.test(name));
    return parse(tokenize(source.replace(/·/g, "*"), longNames, inputNames));
  }

  window.CSE206.bdfModules.expression = { parseExpression, collectVariables };
})();
