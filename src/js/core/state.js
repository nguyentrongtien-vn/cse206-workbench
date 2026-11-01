window.CSE206 = window.CSE206 || {};
window.CSE206.state = {
  tt: [],
  inputLabels: Array.from({ length: 5 }, (_, i) => 3 - i).map(i => `A${i}`),
  outputLabels: Array.from({ length: 16 }, (_, i) => `Z${i}`),
  outputNotations: Array(16).fill("min"),
  last: null,
};