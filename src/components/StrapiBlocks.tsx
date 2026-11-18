// src/components/StrapiBlocks.tsx
import React from "react";

type TextLeaf = {
  type?: string;
  text?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
};

type BlockNode = {
  type?: string;
  format?: "ordered" | "unordered";
  level?: number;
  children?: Array<TextLeaf | BlockNode>;
};

function renderLeaf(leaf: TextLeaf, idx: number): React.ReactNode {
  let content: React.ReactNode = leaf.text ?? "";
  if (!content) return null;

  if (leaf.bold) content = <strong className="font-bold text-text">{content}</strong>;
  if (leaf.italic) content = <em>{content}</em>;
  if (leaf.underline) content = <u>{content}</u>;
  if (leaf.strikethrough) content = <s>{content}</s>;

  return <React.Fragment key={idx}>{content}</React.Fragment>;
}

export default function StrapiBlocks({
  blocks,
  className = "",
}: {
  blocks: unknown;
  className?: string;
}) {
  if (!blocks) return null;

  if (typeof blocks === "string") {
    return (
      <div className={`whitespace-pre-line text-sm leading-relaxed text-text/85 ${className}`}>
        {blocks}
      </div>
    );
  }

  if (!Array.isArray(blocks)) return null;

  return (
    <div className={`space-y-3 text-sm leading-relaxed text-text/85 ${className}`}>
      {(blocks as BlockNode[]).map((block, i) => {
        const children = Array.isArray(block.children)
          ? block.children.map((c, ci) => renderLeaf(c as TextLeaf, ci))
          : null;

        if (block.type === "list") {
          const Tag = block.format === "ordered" ? "ol" : "ul";
          const listCls =
            block.format === "ordered" ? "list-decimal pl-5 space-y-1" : "list-disc pl-5 space-y-1";
          return (
            <Tag key={i} className={listCls}>
              {(block.children ?? []).map((item: any, liIdx: number) => (
                <li key={liIdx}>
                  {Array.isArray(item?.children)
                    ? item.children.map((c: TextLeaf, ci: number) => renderLeaf(c, ci))
                    : null}
                </li>
              ))}
            </Tag>
          );
        }

        if (block.type === "heading") {
          return (
            <h3 key={i} className="pt-2 text-base font-bold text-text">
              {children}
            </h3>
          );
        }

        return <p key={i}>{children}</p>;
      })}
    </div>
  );
}