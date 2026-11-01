(() => {
  window.CSE206 = window.CSE206 || {};
  window.CSE206.bdfModules = window.CSE206.bdfModules || {};


  const snap8 = (value) => Math.round(value / 8) * 8;
  const gateHeight = (gate) =>
    gate.type === "NOT" ? 32 : 16 * (gate.ins.length + 1);
  const gateWidth = (gate) => (gate.type === "NOT" ? 48 : 64);
  const outputOffset = (gate) =>
    gate.type === "NOT" ? 16 : gateHeight(gate) / 2;

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

  function namedBus(name, width) {
    if (width === 1) return [{ plain: name, position: 0 }];
    return [{
      prefix: name,
      bits: Array.from({ length: width }, (_, position) => ({
        index: width - position - 1,
        position,
      })),
      label: `${name}[${width - 1}..0]`,
      position: 0,
    }];
  }

  function layout(
    { inputs, outputs, gates },
    {
      inputLabels = inputs,
      outputLabels = outputs,
      inputBusLabel,
      outputBusLabel,
    } = {},
  ) {
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

    const inputUnits = inputBusLabel
      ? namedBus(inputBusLabel, inputs.length)
      : groupBuses(inputLabels);
    const hasInputBus = inputUnits.some((unit) => unit.prefix);
    const busInputX = pinX + 32;
    const inputTapX = hasInputBus ? busInputX + 64 : pinX;
    const sourceY = {};
    const inputPins = [];
    const buses = [];
    let inputY = top;
    inputUnits.forEach((unit) => {
      if (unit.plain) {
        const inputName = inputs[unit.position];
        sourceY[inputName] = inputY + 8;
        getNet(inputName).sourceX = pinX;
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
        const inputName = inputs[bit.position];
        sourceY[inputName] = ys[index];
        const net = getNet(inputName);
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

    const outputUnits = outputBusLabel
      ? namedBus(outputBusLabel, outputs.length)
      : groupBuses(outputLabels);
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
        const outputName = outputs[unit.position];
        const y = placeOutputY(outputName);
        outputPins.push({ label: unit.plain, y: y - 8 });
        getNet(outputName).sinks.forEach((sink) => {
          if (sink.pin) {
            sink.x = outputPinX;
            sink.y = y;
          }
        });
        return;
      }

      const ys = unit.bits.map((bit) => placeOutputY(outputs[bit.position]));
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
        const net = getNet(outputs[bit.position]);
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

  window.CSE206.bdfModules.layout = {
    gateHeight,
    gateWidth,
    groupBuses,
    layout,
    routeNet,
  };
})();
