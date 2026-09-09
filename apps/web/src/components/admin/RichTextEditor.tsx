"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sanitizeArticleHtml } from "@/lib/sanitize-html";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  /** Trả về URL ảnh sau khi upload lên máy chủ. */
  onUploadImage: (file: File) => Promise<string>;
  disabled?: boolean;
  placeholder?: string;
}

type ExecCommand =
  | "bold"
  | "italic"
  | "underline"
  | "formatBlock"
  | "insertUnorderedList"
  | "insertOrderedList"
  | "justifyLeft"
  | "justifyCenter"
  | "justifyRight"
  | "insertHTML"
  | "createLink"
  | "removeFormat"
  | "undo"
  | "redo";

const TABLE_HTML =
  '<table><thead><tr><th>Cột 1</th><th>Cột 2</th><th>Cột 3</th></tr></thead><tbody>' +
  '<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>' +
  '<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>' +
  '</tbody></table><p><br></p>';

const SAFE_LINK = /^(https?:\/\/|mailto:|tel:|\/|#)/i;

const FORMAT_BLOCK_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "BLOCKQUOTE", "PRE", "DIV"]);
const CLEAR_FORMAT_WRAPPERS = new Set(["A", "B", "CODE", "EM", "I", "S", "SPAN", "STRONG", "SUB", "SUP", "U"]);

/** Tìm block gần nhất chứa một điểm đầu/cuối của Range trong editor. */
function findBlockAtBoundary(root: HTMLElement, node: Node, offset: number): HTMLElement | null {
  let current: Node | null = node;

  // Khi boundary nằm ở chính editor (ví dụ chọn nguyên một đoạn), lấy node ở
  // ngay sau boundary hoặc node ngay trước nó để tìm block tương ứng.
  if (current === root) {
    current = root.childNodes[offset] ?? root.childNodes[offset - 1] ?? null;
  }

  if (current && current.nodeType !== 1) current = current.parentNode;
  while (current && current !== root) {
    if (current.nodeType === 1 && FORMAT_BLOCK_TAGS.has((current as HTMLElement).tagName)) {
      return current as HTMLElement;
    }
    current = current.parentNode;
  }
  return null;
}

function fragmentHasContent(fragment: DocumentFragment): boolean {
  return Boolean(fragment.textContent?.trim() || fragment.querySelector("img, table, hr, br"));
}

function rangeCoversWholeBlock(range: Range, block: HTMLElement): boolean {
  const fullRange = document.createRange();
  fullRange.selectNodeContents(block);
  return (
    range.compareBoundaryPoints(Range.START_TO_START, fullRange) === 0 &&
    range.compareBoundaryPoints(Range.END_TO_END, fullRange) === 0
  );
}

function createBlockWithContent(source: HTMLElement, tagName: string, content: DocumentFragment): HTMLElement {
  const block = document.createElement(tagName);
  for (const attribute of Array.from(source.attributes)) {
    // id của heading chỉ được thêm khi render trang công khai; không nhân bản id
    // cũ trong editor khi tách một đoạn thành nhiều block.
    if (attribute.name !== "id") block.setAttribute(attribute.name, attribute.value);
  }
  block.append(content);
  return block;
}

/** Bỏ các thẻ/thuộc tính định dạng trong một fragment nhưng giữ lại nội dung, ảnh và xuống dòng. */
function stripInlineFormatting(fragment: DocumentFragment): DocumentFragment {
  for (const element of Array.from(fragment.querySelectorAll("*"))) {
    element.removeAttribute("style");
    element.removeAttribute("class");

    if (!CLEAR_FORMAT_WRAPPERS.has(element.tagName) || !element.parentNode) continue;
    const parent = element.parentNode;
    while (element.firstChild) parent.insertBefore(element.firstChild, element);
    element.remove();
  }
  return fragment;
}

function ToolbarButton({
  label,
  title,
  onClick,
  active = false,
  disabled = false,
  className = "",
}: {
  label: string;
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      // Giữ nguyên con trỏ (selection) trong khung soạn thảo khi bấm nút toolbar.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-2.5 py-1.5 text-[12px] font-bold leading-none transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-brand-navy bg-brand-navy text-white"
          : "border-black/10 bg-white text-brand-navy/70 hover:border-brand-orange hover:text-brand-orange"
      } ${className}`}
    >
      {label}
    </button>
  );
}

export function RichTextEditor({ value, onChange, onUploadImage, disabled, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const lastEmittedRef = useRef<string>("");

  const [mode, setMode] = useState<"rich" | "html">("rich");
  const [inTable, setInTable] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const findAncestor = useCallback((node: Node | null, tagName: string): HTMLElement | null => {
    const root = editorRef.current;
    let current: Node | null = node;
    while (current && current !== root) {
      if (current.nodeType === 1 && (current as HTMLElement).tagName.toLowerCase() === tagName) {
        return current as HTMLElement;
      }
      current = current.parentNode;
    }
    return null;
  }, []);

  const refreshEmptyState = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    setIsEmpty(!el.textContent?.trim() && !el.querySelector("img, table, hr"));
  }, []);

  // Nạp nội dung từ ngoài vào (mở modal Sửa, reset form). Không ghi đè trong lúc gõ vì
  // gán innerHTML sẽ làm con trỏ nhảy về đầu khung.
  useEffect(() => {
    const el = editorRef.current;
    if (!el || mode !== "rich") return;
    if (value === lastEmittedRef.current) return;
    el.innerHTML = value;
    lastEmittedRef.current = value;
    refreshEmptyState();
  }, [value, mode, refreshEmptyState]);

  const emit = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    lastEmittedRef.current = html;
    refreshEmptyState();
    onChange(html);
  }, [onChange, refreshEmptyState]);

  const saveRange = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) return;
    savedRangeRef.current = range.cloneRange();
    setInTable(Boolean(findAncestor(range.startContainer, "table")));
  }, [findAncestor]);

  const restoreRange = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const range = savedRangeRef.current;
    if (!range || !el.contains(range.commonAncestorContainer)) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, []);

  const exec = useCallback(
    (command: ExecCommand, argument?: string) => {
      if (disabled) return;
      restoreRange();
      // styleWithCSS = false → sinh <b>/<i> thay vì <span style>, HTML lưu xuống gọn hơn.
      document.execCommand("styleWithCSS", false, "false");
      document.execCommand(command, false, argument);
      saveRange();
      emit();
    },
    [disabled, emit, restoreRange, saveRange],
  );

  /**
   * formatBlock mặc định của trình duyệt luôn đổi toàn bộ block chứa vùng chọn.
   * Với H1/H2/H3, nếu người dùng chỉ bôi một phần câu thì tách block thành phần
   * trước — heading — phần sau để chỉ phần đã chọn được đổi cấp.
   */
  function setHeading(tagName: "h1" | "h2" | "h3") {
    if (disabled) return;
    restoreRange();

    const root = editorRef.current;
    const range = savedRangeRef.current;
    const startBlock = root && range ? findBlockAtBoundary(root, range.startContainer, range.startOffset) : null;
    const endBlock = root && range ? findBlockAtBoundary(root, range.endContainer, range.endOffset) : null;

    if (
      root &&
      range &&
      !range.collapsed &&
      startBlock &&
      startBlock === endBlock &&
      !rangeCoversWholeBlock(range, startBlock)
    ) {
      const beforeRange = document.createRange();
      beforeRange.selectNodeContents(startBlock);
      beforeRange.setEnd(range.startContainer, range.startOffset);

      const afterRange = document.createRange();
      afterRange.selectNodeContents(startBlock);
      afterRange.setStart(range.endContainer, range.endOffset);

      const before = beforeRange.cloneContents();
      const selected = range.cloneContents();
      const after = afterRange.cloneContents();
      const hasBefore = fragmentHasContent(before);
      const hasSelected = fragmentHasContent(selected);
      const hasAfter = fragmentHasContent(after);

      if (hasSelected && startBlock.parentNode) {
        const heading = createBlockWithContent(startBlock, tagName, selected);
        const replacement = document.createDocumentFragment();
        if (hasBefore) replacement.append(createBlockWithContent(startBlock, startBlock.tagName.toLowerCase(), before));
        replacement.append(heading);
        if (hasAfter) replacement.append(createBlockWithContent(startBlock, startBlock.tagName.toLowerCase(), after));
        startBlock.replaceWith(replacement);

        const nextRange = document.createRange();
        nextRange.selectNodeContents(heading);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(nextRange);
        savedRangeRef.current = nextRange.cloneRange();
        setInTable(Boolean(findAncestor(nextRange.startContainer, "table")));
        emit();
        return;
      }
    }

    // Không có vùng chọn riêng (hoặc đang chọn nhiều block): dùng hành vi block
    // chuẩn của trình duyệt để đổi tất cả block giao với vùng chọn.
    exec("formatBlock", `<${tagName}>`);
  }

  /**
   * Đưa vùng chọn về đoạn văn thường, không chỉ xoá đậm/nghiêng.
   * removeFormat của trình duyệt chỉ xử lý định dạng inline và bỏ lại H1/H2/H3,
   * nên phải tách block khi vùng chọn chỉ là một phần của heading.
   */
  function clearFormatting() {
    if (disabled) return;
    restoreRange();

    const root = editorRef.current;
    const range = savedRangeRef.current;
    const startBlock = root && range ? findBlockAtBoundary(root, range.startContainer, range.startOffset) : null;
    const endBlock = root && range ? findBlockAtBoundary(root, range.endContainer, range.endOffset) : null;

    if (root && range && !range.collapsed && startBlock && startBlock === endBlock) {
      const coversWholeBlock = rangeCoversWholeBlock(range, startBlock);

      if (coversWholeBlock) {
        const paragraph = document.createElement("p");
        paragraph.append(stripInlineFormatting(range.cloneContents()));
        startBlock.replaceWith(paragraph);

        const nextRange = document.createRange();
        nextRange.selectNodeContents(paragraph);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(nextRange);
        savedRangeRef.current = nextRange.cloneRange();
        setInTable(Boolean(findAncestor(nextRange.startContainer, "table")));
        emit();
        return;
      }

      // Trong một đoạn văn thường, chỉ cần thay fragment đã chọn để không tạo
      // thêm các dòng mới không cần thiết.
      if (startBlock.tagName === "P" || startBlock.tagName === "DIV") {
        const cleaned = stripInlineFormatting(range.cloneContents());
        if (fragmentHasContent(cleaned)) {
          range.deleteContents();
          const wrapper = document.createElement("span");
          wrapper.append(cleaned);
          range.insertNode(wrapper);

          const first = wrapper.firstChild;
          const last = wrapper.lastChild;
          const parent = wrapper.parentNode;
          if (first && last && parent) {
            const nextRange = document.createRange();
            nextRange.setStartBefore(first);
            nextRange.setEndAfter(last);
            while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper);
            wrapper.remove();

            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(nextRange);
            savedRangeRef.current = nextRange.cloneRange();
            setInTable(Boolean(findAncestor(nextRange.startContainer, "table")));
            emit();
            return;
          }
        }
      } else {
        // Một phần H1/H2/H3/blockquote/pre được chọn: giữ phần trước và sau,
        // nhưng đưa riêng phần đã chọn vào <p> bình thường.
        const beforeRange = document.createRange();
        beforeRange.selectNodeContents(startBlock);
        beforeRange.setEnd(range.startContainer, range.startOffset);

        const afterRange = document.createRange();
        afterRange.selectNodeContents(startBlock);
        afterRange.setStart(range.endContainer, range.endOffset);

        const before = beforeRange.cloneContents();
        const selected = stripInlineFormatting(range.cloneContents());
        const after = afterRange.cloneContents();

        if (fragmentHasContent(selected) && startBlock.parentNode) {
          const replacement = document.createDocumentFragment();
          if (fragmentHasContent(before)) {
            replacement.append(createBlockWithContent(startBlock, startBlock.tagName.toLowerCase(), before));
          }
          const paragraph = document.createElement("p");
          paragraph.append(selected);
          replacement.append(paragraph);
          if (fragmentHasContent(after)) {
            replacement.append(createBlockWithContent(startBlock, startBlock.tagName.toLowerCase(), after));
          }
          startBlock.replaceWith(replacement);

          const nextRange = document.createRange();
          nextRange.selectNodeContents(paragraph);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(nextRange);
          savedRangeRef.current = nextRange.cloneRange();
          setInTable(Boolean(findAncestor(nextRange.startContainer, "table")));
          emit();
          return;
        }
      }
    }

    // Với vùng chọn trải qua nhiều block, dùng hành vi chuẩn để xoá inline
    // format và đổi các block liên quan về <p>.
    restoreRange();
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand("removeFormat", false);
    document.execCommand("formatBlock", false, "<p>");
    saveRange();
    emit();
  }

  function currentCell(): HTMLTableCellElement | null {
    const range = savedRangeRef.current;
    if (!range) return null;
    const cell = findAncestor(range.startContainer, "td") ?? findAncestor(range.startContainer, "th");
    return (cell as HTMLTableCellElement | null) ?? null;
  }

  /** Thao tác bảng chỉnh thẳng trên DOM — execCommand không có lệnh nào cho bảng. */
  function withTable(action: (cell: HTMLTableCellElement, row: HTMLTableRowElement, table: HTMLTableElement) => void) {
    if (disabled) return;
    restoreRange();
    const cell = currentCell();
    const row = (cell?.parentElement ?? null) as HTMLTableRowElement | null;
    const table = row ? (findAncestor(row, "table") as HTMLTableElement | null) : null;
    if (!cell || !row || !table) return;
    action(cell, row, table);
    emit();
  }

  function addRow(position: "before" | "after") {
    withTable((_cell, row, table) => {
      const newRow = document.createElement("tr");
      for (let i = 0; i < row.cells.length; i += 1) {
        const td = document.createElement("td");
        td.innerHTML = "&nbsp;";
        newRow.appendChild(td);
      }
      const body = table.tBodies[0] ?? table.appendChild(document.createElement("tbody"));
      if (row.parentElement === body) {
        body.insertBefore(newRow, position === "before" ? row : row.nextSibling);
      } else {
        // Con trỏ đang ở hàng tiêu đề: hàng mới luôn nằm đầu phần thân bảng.
        body.insertBefore(newRow, body.firstChild);
      }
    });
  }

  function deleteRow() {
    withTable((_cell, row, table) => {
      if (table.rows.length <= 1) {
        table.remove();
        return;
      }
      row.remove();
    });
  }

  function addColumn(position: "left" | "right") {
    withTable((cell, _row, table) => {
      const index = cell.cellIndex;
      for (const row of Array.from(table.rows)) {
        const reference = row.cells[index] ?? null;
        const isHeaderRow = row.cells[0]?.tagName.toLowerCase() === "th";
        const newCell = document.createElement(isHeaderRow ? "th" : "td");
        newCell.innerHTML = isHeaderRow ? "Cột mới" : "&nbsp;";
        if (!reference) {
          row.appendChild(newCell);
        } else {
          row.insertBefore(newCell, position === "left" ? reference : reference.nextSibling);
        }
      }
    });
  }

  function deleteColumn() {
    withTable((cell, _row, table) => {
      const index = cell.cellIndex;
      if ((table.rows[0]?.cells.length ?? 0) <= 1) {
        table.remove();
        return;
      }
      for (const row of Array.from(table.rows)) {
        row.cells[index]?.remove();
      }
    });
  }

  /** Bật/tắt hàng tiêu đề: đổi hàng đầu giữa <th> trong <thead> và <td> thường. */
  function toggleHeaderRow() {
    withTable((_cell, _row, table) => {
      const head = table.tHead;
      if (head) {
        const body = table.tBodies[0] ?? table.appendChild(document.createElement("tbody"));
        for (const row of Array.from(head.rows)) {
          for (const headerCell of Array.from(row.cells)) {
            const td = document.createElement("td");
            td.innerHTML = headerCell.innerHTML;
            headerCell.replaceWith(td);
          }
          body.insertBefore(row, body.firstChild);
        }
        head.remove();
        return;
      }
      const firstRow = table.rows[0];
      if (!firstRow) return;
      for (const bodyCell of Array.from(firstRow.cells)) {
        const th = document.createElement("th");
        th.innerHTML = bodyCell.innerHTML;
        bodyCell.replaceWith(th);
      }
      const newHead = document.createElement("thead");
      newHead.appendChild(firstRow);
      table.insertBefore(newHead, table.firstChild);
    });
  }

  /** Ô đang gộp (colspan > 1) thì tách ra, ngược lại gộp với ô kế bên phải. */
  function mergeOrSplitCell() {
    withTable((cell, row) => {
      const span = cell.colSpan || 1;
      if (span > 1) {
        cell.colSpan = 1;
        for (let i = 1; i < span; i += 1) {
          const sibling = document.createElement(cell.tagName.toLowerCase() === "th" ? "th" : "td");
          sibling.innerHTML = "&nbsp;";
          cell.parentElement?.insertBefore(sibling, cell.nextSibling);
        }
        return;
      }
      const next = row.cells[cell.cellIndex + 1];
      if (!next) return;
      if (next.innerHTML.replace(/&nbsp;/g, "").trim()) {
        cell.innerHTML = `${cell.innerHTML} ${next.innerHTML}`;
      }
      cell.colSpan = span + (next.colSpan || 1);
      next.remove();
    });
  }

  function deleteTable() {
    if (!window.confirm("Xoá bảng này khỏi bài viết?")) return;
    withTable((_cell, _row, table) => table.remove());
  }

  function insertLink() {
    restoreRange();
    const selectedText = window.getSelection()?.toString() ?? "";
    const url = window.prompt("Nhập đường dẫn (https://…)", "https://")?.trim();
    if (!url) return;
    if (!SAFE_LINK.test(url)) {
      window.alert("Đường dẫn phải bắt đầu bằng https://, mailto:, tel: hoặc /");
      return;
    }
    if (selectedText) {
      exec("createLink", url);
      return;
    }
    const text = window.prompt("Chữ hiển thị cho liên kết", url)?.trim();
    if (!text) return;
    const safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    exec("insertHTML", `<a href="${url}">${safeText}</a>&nbsp;`);
  }

  async function handleImageFile(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const url = await onUploadImage(file);
      const alt = window.prompt("Mô tả ảnh (alt — tốt cho SEO, có thể bỏ trống)", "")?.trim() ?? "";
      restoreRange();
      document.execCommand(
        "insertHTML",
        false,
        `<img src="${url}" alt="${alt.replace(/"/g, "&quot;")}" /><p><br></p>`,
      );
      saveRange();
      emit();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Tải ảnh lên thất bại.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  /** Dán từ Word/web: giữ định dạng cơ bản nhưng lọc ngay bằng đúng bộ sanitize lúc lưu. */
  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");
    event.preventDefault();
    if (html) {
      document.execCommand("insertHTML", false, sanitizeArticleHtml(html));
    } else if (text) {
      document.execCommand("insertText", false, text);
    }
    saveRange();
    emit();
  }

  function toggleHtmlMode() {
    if (mode === "rich") {
      setMode("html");
      return;
    }
    // Quay lại khung soạn thảo: buộc effect nạp lại HTML vừa sửa tay.
    lastEmittedRef.current = "";
    setMode("rich");
  }

  const richDisabled = disabled || mode === "html";

  return (
    <div className={`rounded-xl border border-black/10 bg-white ${disabled ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-black/10 px-2.5 py-2">
        <ToolbarButton label="B" title="In đậm (Ctrl+B)" className="font-extrabold" onClick={() => exec("bold")} disabled={richDisabled} />
        <ToolbarButton label="I" title="In nghiêng (Ctrl+I)" className="italic" onClick={() => exec("italic")} disabled={richDisabled} />
        <ToolbarButton label="U" title="Gạch chân (Ctrl+U)" className="underline" onClick={() => exec("underline")} disabled={richDisabled} />
        <span className="mx-1 h-5 w-px bg-black/10" />
        <ToolbarButton
          label="H1"
          title="Tiêu đề lớn — chỉ phần bôi đen sẽ đổi; không bôi thì đổi cả đoạn"
          onClick={() => setHeading("h1")}
          disabled={richDisabled}
        />
        <ToolbarButton
          label="H2"
          title="Tiêu đề mục — chỉ phần bôi đen sẽ đổi; không bôi thì đổi cả đoạn"
          onClick={() => setHeading("h2")}
          disabled={richDisabled}
        />
        <ToolbarButton
          label="H3"
          title="Tiêu đề phụ — chỉ phần bôi đen sẽ đổi; không bôi thì đổi cả đoạn"
          onClick={() => setHeading("h3")}
          disabled={richDisabled}
        />
        <ToolbarButton label="¶" title="Đoạn văn thường" onClick={() => exec("formatBlock", "<p>")} disabled={richDisabled} />
        <span className="mx-1 h-5 w-px bg-black/10" />
        <ToolbarButton label="• List" title="Danh sách gạch đầu dòng" onClick={() => exec("insertUnorderedList")} disabled={richDisabled} />
        <ToolbarButton label="1. List" title="Danh sách đánh số" onClick={() => exec("insertOrderedList")} disabled={richDisabled} />
        <span className="mx-1 h-5 w-px bg-black/10" />
        <ToolbarButton label="Trái" title="Canh trái" onClick={() => exec("justifyLeft")} disabled={richDisabled} />
        <ToolbarButton label="Giữa" title="Canh giữa" onClick={() => exec("justifyCenter")} disabled={richDisabled} />
        <ToolbarButton label="Phải" title="Canh phải" onClick={() => exec("justifyRight")} disabled={richDisabled} />
        <span className="mx-1 h-5 w-px bg-black/10" />
        <ToolbarButton
          label={uploading ? "⏳ Đang tải…" : "🖼 Chèn ảnh"}
          title="Tải ảnh lên và chèn vào bài"
          onClick={() => fileInputRef.current?.click()}
          disabled={richDisabled || uploading}
        />
        <ToolbarButton label="🔗 Liên kết" title="Chèn liên kết" onClick={insertLink} disabled={richDisabled} />
        <ToolbarButton
          label="▦ Chèn bảng"
          title="Chèn bảng 3 cột có hàng tiêu đề"
          active={inTable}
          onClick={() => exec("insertHTML", TABLE_HTML)}
          disabled={richDisabled}
        />
        <ToolbarButton label="❝ Quote" title="Trích dẫn" onClick={() => exec("formatBlock", "<blockquote>")} disabled={richDisabled} />
        <ToolbarButton label="— Kẻ ngang" title="Chèn đường kẻ ngang" onClick={() => exec("insertHTML", "<hr /><p><br></p>")} disabled={richDisabled} />
        <ToolbarButton
          label="✕ Xoá định dạng"
          title="Đưa phần đang chọn về đoạn văn thường và xoá định dạng chữ"
          onClick={clearFormatting}
          disabled={richDisabled}
        />
        <div className="ml-auto flex gap-1.5">
          <ToolbarButton label="↶" title="Hoàn tác (Ctrl+Z)" onClick={() => exec("undo")} disabled={richDisabled} />
          <ToolbarButton label="↷" title="Làm lại (Ctrl+Y)" onClick={() => exec("redo")} disabled={richDisabled} />
          <ToolbarButton label="</> HTML" title="Xem / sửa mã HTML" active={mode === "html"} onClick={toggleHtmlMode} disabled={disabled} />
        </div>
      </div>

      {inTable && mode === "rich" && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-black/10 bg-black/[0.02] px-2.5 py-2">
          <span className="mr-1 text-[10.5px] font-bold uppercase tracking-wide text-brand-navy/40">Bảng</span>
          <ToolbarButton label="+ Hàng trên" title="Thêm hàng phía trên" onClick={() => addRow("before")} disabled={disabled} />
          <ToolbarButton label="+ Hàng dưới" title="Thêm hàng phía dưới" onClick={() => addRow("after")} disabled={disabled} />
          <ToolbarButton label="− Xoá hàng" title="Xoá hàng hiện tại" onClick={deleteRow} disabled={disabled} />
          <ToolbarButton label="+ Cột trái" title="Thêm cột bên trái" onClick={() => addColumn("left")} disabled={disabled} />
          <ToolbarButton label="+ Cột phải" title="Thêm cột bên phải" onClick={() => addColumn("right")} disabled={disabled} />
          <ToolbarButton label="− Xoá cột" title="Xoá cột hiện tại" onClick={deleteColumn} disabled={disabled} />
          <ToolbarButton label="Hàng tiêu đề" title="Bật / tắt hàng tiêu đề" onClick={toggleHeaderRow} disabled={disabled} />
          <ToolbarButton label="Gộp / Tách ô" title="Gộp ô với ô kế bên, hoặc tách ô đã gộp" onClick={mergeOrSplitCell} disabled={disabled} />
          <ToolbarButton label="🗑 Xoá bảng" title="Xoá cả bảng" onClick={deleteTable} disabled={disabled} />
        </div>
      )}

      {mode === "rich" ? (
        <div className="relative">
          {isEmpty && placeholder && (
            <div className="pointer-events-none absolute left-4 top-3.5 text-[14.5px] text-brand-navy/30">{placeholder}</div>
          )}
          <div
            ref={editorRef}
            contentEditable={!disabled}
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="Nội dung bài viết"
            onInput={emit}
            onBlur={emit}
            onPaste={handlePaste}
            onSelect={saveRange}
            onKeyUp={saveRange}
            onMouseUp={saveRange}
            onFocus={saveRange}
            className="article-rich max-h-[55vh] min-h-[380px] overflow-auto px-4 py-3.5 outline-none"
          />
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(event) => {
            lastEmittedRef.current = event.target.value;
            onChange(event.target.value);
          }}
          disabled={disabled}
          spellCheck={false}
          className="min-h-[380px] w-full resize-y bg-transparent px-4 py-3.5 font-mono text-[12.5px] leading-[1.7] text-brand-navy outline-none"
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleImageFile(file);
        }}
      />

      {uploadError && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-[12px] font-medium text-red-700">{uploadError}</div>
      )}
    </div>
  );
}
