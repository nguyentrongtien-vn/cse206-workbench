# CSE-206 Workbench

A lightweight, dependency-free browser tool with K-Map simplification and
integer base conversion.

Truth-table column labels can be edited directly in the header. Labels must be
unique identifiers (letters, numbers, and underscores) and are reflected in
the K-Maps, minimized expressions, and copy/export output.
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
comma-separated indexes in the search field, and apply them.
Each output includes **Xem từng bước**, which shows the SOP/POS grouping,
implicant selection, and Boolean-law identities used for each reduction.

## Run

Open `index.html` in a modern browser. No installation, build step, framework,
or external CDN is required. Clipboard features work best when served over
`localhost` or another secure context.

## Project layout

```text
index.html
src/
  app.js
  styles.css
```

- `index.html` contains the page structure.
- `src/styles.css` contains the local design system and responsive styles.
- `src/app.js` contains the interactive tools and calculations.
