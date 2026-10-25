import { useRef } from "react";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type AdminStickyNoteFormatAction = "bold" | "italic" | "bulleted-list" | "numbered-list";

export type NoteTextEdit = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

function selectedLineRange(value: string, start: number, end: number) {
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const nextNewline = value.indexOf("\n", end);
  return { start: lineStart, end: nextNewline === -1 ? value.length : nextNewline };
}

export function applyAdminStickyNoteFormat(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  action: AdminStickyNoteFormatAction,
): NoteTextEdit {
  if (action === "bold" || action === "italic") {
    const marker = action === "bold" ? "**" : "*";
    const selected = value.slice(selectionStart, selectionEnd);
    const replacement = `${marker}${selected}${marker}`;
    return {
      value: `${value.slice(0, selectionStart)}${replacement}${value.slice(selectionEnd)}`,
      selectionStart: selectionStart + marker.length,
      selectionEnd: selectionStart + marker.length + selected.length,
    };
  }

  const range = selectedLineRange(value, selectionStart, selectionEnd);
  const selected = value.slice(range.start, range.end);
  const lines = selected ? selected.split("\n") : [""];
  const expression = action === "bulleted-list" ? /^-\s+/ : /^\d+\.\s+/;
  const allFormatted = lines.every((line) => expression.test(line));
  const formattedLines = allFormatted
    ? lines.map((line) => line.replace(expression, ""))
    : lines.map((line, index) => action === "bulleted-list" ? `- ${line}` : `${index + 1}. ${line}`);
  const replacement = formattedLines.join("\n");
  return {
    value: `${value.slice(0, range.start)}${replacement}${value.slice(range.end)}`,
    selectionStart: range.start,
    selectionEnd: range.start + replacement.length,
  };
}

function inlineMarkup(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={key}>{part.slice(1, -1)}</em>;
    return part;
  });
}

export function AdminStickyNoteRichText({ value }: { value: string }) {
  const lines = value.split("\n");
  const blocks: React.ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (/^-\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^-\s+/.test(lines[index])) items.push(lines[index++].replace(/^-\s+/, ""));
      blocks.push(<ul key={`bullet-${index}`} className="ml-5 list-disc space-y-1">{items.map((item, itemIndex) => <li key={itemIndex}>{inlineMarkup(item, `bullet-${index}-${itemIndex}`)}</li>)}</ul>);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) items.push(lines[index++].replace(/^\d+\.\s+/, ""));
      blocks.push(<ol key={`number-${index}`} className="ml-5 list-decimal space-y-1">{items.map((item, itemIndex) => <li key={itemIndex}>{inlineMarkup(item, `number-${index}-${itemIndex}`)}</li>)}</ol>);
      continue;
    }
    if (!line.trim()) { index += 1; continue; }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^(?:-\s+|\d+\.\s+)/.test(lines[index])) paragraph.push(lines[index++]);
    blocks.push(<p key={`paragraph-${index}`} className="whitespace-pre-wrap">{inlineMarkup(paragraph.join("\n"), `paragraph-${index}`)}</p>);
  }
  return <div className="space-y-2 text-sm leading-relaxed">{blocks}</div>;
}

export function AdminStickyNoteRichTextEditor({
  value,
  onChange,
  ariaLabel,
  rows = 4,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  rows?: number;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const applyFormat = (action: AdminStickyNoteFormatAction) => {
    const textarea = textareaRef.current;
    const edit = applyAdminStickyNoteFormat(value, textarea?.selectionStart ?? value.length, textarea?.selectionEnd ?? value.length, action);
    onChange(edit.value);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    });
  };
  return <div className="overflow-hidden rounded-md border border-input bg-white shadow-sm">
    <div className="flex flex-wrap items-center gap-1 border-b border-input bg-muted/40 px-2 py-1.5" role="toolbar" aria-label="Text formatting">
      <Button type="button" variant="ghost" size="sm" className="h-8 px-2" aria-label="Bold text" title="Bold" onClick={() => applyFormat("bold")}><Bold className="h-4 w-4" /></Button>
      <Button type="button" variant="ghost" size="sm" className="h-8 px-2" aria-label="Italic text" title="Italic" onClick={() => applyFormat("italic")}><Italic className="h-4 w-4" /></Button>
      <span className="mx-1 h-5 border-l border-border" aria-hidden="true" />
      <Button type="button" variant="ghost" size="sm" className="h-8 px-2" aria-label="Bulleted list" title="Bulleted list" onClick={() => applyFormat("bulleted-list")}><List className="h-4 w-4" /></Button>
      <Button type="button" variant="ghost" size="sm" className="h-8 px-2" aria-label="Numbered list" title="Numbered list" onClick={() => applyFormat("numbered-list")}><ListOrdered className="h-4 w-4" /></Button>
      <span className="ml-1 text-xs text-muted-foreground">Bold, italic, bulleted and numbered lists</span>
    </div>
    <Textarea ref={textareaRef} value={value} onChange={(event) => onChange(event.target.value)} placeholder="What should the admin team know?" maxLength={3000} rows={rows} aria-label={ariaLabel} className={`min-h-28 resize-y border-0 bg-transparent shadow-none focus-visible:ring-0 ${className ?? ""}`} />
  </div>;
}
