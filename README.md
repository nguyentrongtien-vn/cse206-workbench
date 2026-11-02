# CSE-206 Workbench

A lightweight, dependency-free browser tool with K-Map simplification and
integer base conversion.

Truth-table column labels can be edited directly in the header. Press Enter to
save and move to the next label, Shift+Enter to move back, or Escape to cancel.
Labels must be unique identifiers (letters, numbers, and underscores) and are
reflected in the K-Maps, minimized expressions, and copy/export output.
The initial configuration shows seven outputs in descending order (`D6` to
`D0`), matching common 7-segment signal naming.
Use the input/output label fields to apply several labels at once; separate
labels with commas or tabs, or paste a list copied from a spreadsheet. The
truth-table's **Sao chép bảng** button copies the current labels and values as
tab-separated text for pasting into Excel, Word, or another spreadsheet.

The input area also accepts minterm/maxterm formulas, one function per line,
such as `a) Σ m(0,2,4,6,8,10,12)` or `b) Π M(1,3,5,7)`. Minterm indexes are
set to 1, maxterm indexes to 0, and optional `+ d(...)` indexes are treated as
don't-cares. If the variable list is omitted, the current input count and
labels are used.
For a quick single-function entry, select **Minterm** or **Maxterm**, enter the
comma-separated indexes in the search field, and use the same **Áp dụng bảng /
công thức** button as pasted tables and formulas. Pasting table data fills the
input area; click the shared button to apply it. In the formula textarea,
Ctrl+Enter (or Cmd+Enter) applies the current input.
Each output includes **Xem từng bước**, which shows the minimized SOP and a
compact factored Boolean equivalent, using XOR where a complementary pair is
recognized. The optimized result uses that same final factored expression and
shows its synthesized gate count. Displayed expressions omit the AND operator;
adjacent variable names are parsed using the configured input labels.
Each output card exports its own K-map and output pin to a separate BDF file;
the optimized-row and BDF dialog gate counts both refer only to that selected
output.
Use **Export** on an output card to choose PDF, Word (`.doc`), plain text
(`.txt`), or Quartus BDF (`.bdf`). PDF export opens the browser's print dialog;
choose **Save as PDF** to download it. For document exports, select which
K-Map details to include. BDF export offers SOP, POS, or automatic mode, which
chooses the form with fewer synthesized gates. The generated circuit is checked
against every defined truth-table row before download; don't-care rows are
ignored. BDF auto mode compares optimized, SOP, and POS implementations using
the same synthesized gate count used for the displayed optimized expression.
BDF generation synthesizes the selected Boolean expression into Quartus
primitive gates and routes each net independently; XOR/XNOR parity functions
are recognized. Contiguous numbered input labels (such as `A0`, `A1`) are
automatically exported as bus pins with labeled bit taps. The BDF dialog lets
you rename the input bus and the selected output pin. Expressions and wiring
remain connected to the original signals. Open the file in Quartus Prime Block
Editor.

## Run

Open `index.html` in a modern browser. No installation, build step, framework,
or external CDN is required. Clipboard features work best when served over
`localhost` or another secure context.

## Project layout

```text
index.html
src/
  css/
    styles.css
  data/
    bdf-library.json
  js/
    app.js
    core/
      state.js
      dom.js
    features/
      kmap.js
      export.js
      paste.js
      converter.js
      bdf-export/
        expression.js
        netlist.js
        layout.js
        serializer.js
        index.js
```

- `index.html` contains the page structure.
- `src/css/styles.css` contains the local design system and responsive styles.
- `src/data/bdf-library.json` catalogs the BDF gates and pins currently emitted
  by the exporter; it is a reference catalog, not the complete Quartus library.
- `src/js/core/state.js` stores the shared truth-table data and labels.
- `src/js/core/dom.js` contains DOM, notification, clipboard, and table helpers.
- `src/js/features/kmap.js` builds the truth table, simplifies Boolean functions, and
  renders K-Maps.
- `src/js/features/export.js` handles PDF, Word, TXT, and verified Quartus BDF
  exports and its UI.
- `src/js/features/bdf-export/` contains the BDF pipeline: expression parsing,
  netlist synthesis and verification, circuit layout/routing, serialization,
  and the public export API. The script order in `index.html` follows these
  dependencies.
- `src/js/features/paste.js` imports pasted tables and minterm/maxterm formulas.
- `src/js/features/converter.js` handles integer base conversion.
- `src/js/app.js` wires navigation, label controls, and initial rendering.
