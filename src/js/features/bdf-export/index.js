(() => {
  window.CSE206 = window.CSE206 || {};
  window.CSE206.bdfModules = window.CSE206.bdfModules || {};

  const { parseExpression } = window.CSE206.bdfModules.expression;
  const { synthesize, synthesizeMany, evaluate } =
    window.CSE206.bdfModules.netlist;
  const { groupBuses, layout, routeNet } = window.CSE206.bdfModules.layout;
  const { renderInputPin, renderOutputPin, renderSegment, renderSymbol } =
    window.CSE206.bdfModules.serializer;

  function count(source, output, inputNames) {
    return synthesize(parseExpression(source, inputNames), output, inputNames)
      .gates.length;
  }

  function analyze(source, output, inputNames) {
    const netlist = synthesize(
      parseExpression(source, inputNames),
      output,
      inputNames,
    );
    return {
      gateCount: netlist.gates.length,
      gateTypes: [...new Set(netlist.gates.map((gate) => gate.type))],
    };
  }

  function countMany(functions, inputNames) {
    const expressions = functions.map((entry) => ({
      output: entry.output,
      expression: parseExpression(entry.source, inputNames),
    }));
    return synthesizeMany(expressions, inputNames).gates.length;
  }

  function getPortNames(portNames) {
    if (!portNames) return null;
    const { inputBus, outputBus } = portNames;
    const allNames = [inputBus, outputBus];
    if (allNames.some((name) => !/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(name))) {
      throw new Error("Tên bus BDF không hợp lệ. Dùng chữ, số hoặc _ (tối đa 63 ký tự).");
    }
    if (new Set(allNames.map((name) => name.toLowerCase())).size !== allNames.length) {
      throw new Error("Tên bus input và output BDF phải khác nhau.");
    }
    return { inputBus, outputBus };
  }

  function generateMany(functions, inputNames, portNames) {
    const labels = getPortNames(portNames);
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

    const placed = layout(netlist, {
      inputBusLabel: labels?.inputBus,
      outputBusLabel: labels?.outputBus,
    });
    const parts = [
      "/*",
      "WARNING: Do NOT edit the input and output ports in this file in a text",
      "editor if you plan to continue editing the block that represents it in",
      "the Block Editor! File corruption is VERY likely to occur.",
      "*/",
      `/*
      Copyright (C) 2019  Intel Corporation. All rights reserved.
      Your use of Intel Corporation's design tools, logic functions 
      and other software and tools, and any partner logic 
      functions, and any output files from any of the foregoing 
      (including device programming or simulation files), and any 
      associated documentation or information are expressly subject 
      to the terms and conditions of the Intel Program License 
      Subscription Agreement, the Intel Quartus Prime License Agreement,
      the Intel FPGA IP License Agreement, or other applicable license
      agreement, including, without limitation, that your use is for
      the sole purpose of programming logic devices manufactured by
      Intel and sold by Intel or its authorized distributors.  Please
      refer to the applicable agreement for further details, at
      https://fpgasoftware.intel.com/eula.
      */`,
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
    return generateMany([{ source, output, expectedRows }], inputNames);
  }

  const api = { analyze, count, countMany, generate, generateMany, groupBuses };
  window.CSE206.bdfModules.index = api;
  window.CSE206.bdfExport = api;
})();
