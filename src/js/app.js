(() => {
  const state = window.CSE206.state;
  const { inputLabels, outputLabels } = state;
  const { $, toast, getSanitizedParams } = window.CSE206.dom;
  const { buildTT, solve } = window.CSE206.kmap;
  const { conv } = window.CSE206.converter;
  function applyLabelSeries(type) {
    const { n, m } = getSanitizedParams();
    const isInput = type === "input";
    const count = isInput ? n : m;
    const labels = isInput ? inputLabels : outputLabels;
    const seriesInput = $(isInput ? "input-label-series" : "output-label-series");
    const nextLabels = seriesInput.value
      .split(/[,\t\r\n;|]+/)
      .map((label) => label.trim())
      .filter(Boolean);

    const otherLabels = isInput
      ? outputLabels.slice(0, m)
      : inputLabels.slice(0, n);
    const allLabels = [...nextLabels, ...otherLabels];
    if (nextLabels.length !== count) {
      toast(`Cần nhập đúng ${count} nhãn, phân tách bằng dấu phẩy hoặc tab.`);
      return;
    }
    if (
      allLabels.some((label) => !/^[A-Za-z_][A-Za-z0-9_]{0,15}$/.test(label)) ||
      new Set(allLabels.map((label) => label.toLowerCase())).size !== allLabels.length
    ) {
      toast("Nhãn không hợp lệ hoặc bị trùng. Dùng chữ/số/_ và đảm bảo các nhãn duy nhất.");
      return;
    }

    labels.splice(0, count, ...nextLabels);
    buildTT();
    solve();
    toast(isInput ? "Đã cập nhật nhãn biến." : "Đã cập nhật nhãn đầu ra.");
  }

  $("apply-input-labels").addEventListener("click", () =>
    applyLabelSeries("input"),
  );
  $("apply-output-labels").addEventListener("click", () =>
    applyLabelSeries("output"),
  );
  $("input-label-series").addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyLabelSeries("input");
  });
  $("output-label-series").addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyLabelSeries("output");
  });
  document.querySelectorAll(".nav").forEach(
    (t) =>
      (t.onclick = () => {
        document
          .querySelectorAll(".nav")
          .forEach((x) => {
            const isActive = x === t;
            x.classList.toggle("on", isActive);
            if (isActive) x.setAttribute("aria-current", "page");
            else x.removeAttribute("aria-current");
          });
        document.querySelectorAll("main .tool-section").forEach((section) =>
          section.classList.toggle(
            "hidden",
            section.id !== "s" + t.dataset.t,
          ),
        );
        $("tool-title").textContent = t.dataset.title;
        $("tool-description").textContent = t.dataset.description;
        $("breadcrumb-current").textContent =
          t.dataset.t === "0" ? "K-MAP" : "CƠ SỐ";
        if (window.matchMedia("(max-width: 760px)").matches) {
          setSidebarCollapsed(true);
        }
      }),
  );

  const sidebarToggle = $("sidebar-toggle");
  function setSidebarCollapsed(collapsed) {
    document
      .querySelector(".app-shell")
      .classList.toggle("sidebar-collapsed", collapsed);
    const label = collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên";
    sidebarToggle.setAttribute("aria-label", label);
    sidebarToggle.title = label;
  }

  sidebarToggle.addEventListener("click", () => {
    setSidebarCollapsed(
      !document.querySelector(".app-shell").classList.contains("sidebar-collapsed"),
    );
  });

  buildTT();
  solve();
  conv();
})();
