window.CSE206 = window.CSE206 || {};
window.CSE206.state = {
  tt: [],
  inputLabels: ["A", "B", "C", "D", "E", "F", "G", "H"],
  outputLabels: Array.from({ length: 16 }, (_, i) => `Y${i}`),
  outputNotations: Array(16).fill("min"),
  last: null,
};
