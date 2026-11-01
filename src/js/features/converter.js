(() => {
  const { $, tbl } = window.CSE206.dom;
  function conv() {
    const w = BigInt($("bw").value),
      M = 1n << w,
      s = $("bv").value.trim().replace(/\s/g, ""),
      b = $("bb").value;
    let u;
    try {
      if (!s) throw "Nhập giá trị";
      if (b === "10") {
        if (!/^-?\d+$/.test(s)) throw "Số Decimal không hợp lệ";
        const v = BigInt(s);
        if (v < -(M / 2n) || v >= M)
          throw `Ngoài phạm vi ${w}-bit: ${-(M / 2n)} … ${M - 1n}`;
        u = ((v % M) + M) % M;
      } else {
        if (!(b === "2" ? /^[01]+$/ : /^(0x)?[0-9a-f]+$/i).test(s))
          throw "Chuỗi nhập vào không hợp lệ";
        u = BigInt((b === "2" ? "0b" : "0x") + s.replace(/^0x/i, ""));
        if (u >= M) throw `Vượt quá giới hạn ${w}-bit`;
      }
      const sg = u >= M / 2n ? u - M : u,
        W = Number(w);
      $("bo").innerHTML = tbl(
        ["Dạng", "Giá trị"],
        [
          ["Unsigned", u.toString()],
          ["Signed (Bù 2)", sg.toString()],
          ["Binary", u.toString(2).padStart(W, "0")],
          [
            "Hexadecimal",
            "0x" +
              u
                .toString(16)
                .toUpperCase()
                .padStart(W / 4, "0"),
          ],
          [
            "Phủ định Bù 2 (−x)",
            ((M - u) % M).toString(2).padStart(W, "0"),
          ],
        ],
      );
    } catch (e) {
      $("bo").innerHTML =
        `<span class="red text-sm font-medium">${e}</span>`;
    }
  }
  $("bv").oninput = $("bb").onchange = $("bw").onchange = conv;

    window.CSE206.converter = { conv };
})();
