(() => {
  window.CSE206 = window.CSE206 || {};
  window.CSE206.bdfModules = window.CSE206.bdfModules || {};

  const T = "\t";
  const { gateHeight, gateWidth } = window.CSE206.bdfModules.layout;

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

  window.CSE206.bdfModules.serializer = { renderInputPin, renderOutputPin, renderSegment, renderSymbol };
})();
