"use client";

import type { CSSProperties, MouseEvent, AnchorHTMLAttributes } from "react";

const baseStyle: CSSProperties = {
  display: "inline-block",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "2.16px",
  textTransform: "uppercase",
  textDecoration: "none",
  padding: "4px 8px",
  borderRadius: 0,
  lineHeight: 1,
  transition: "background-color 160ms ease, color 160ms ease",
};

const variants = {
  black: {
    backgroundColor: "#000000",
    color: "#ffffff",
    hoverBackgroundColor: "#ffffff",
    hoverColor: "#000000",
  },
  white: {
    backgroundColor: "#ffffff",
    color: "#000000",
    hoverBackgroundColor: "#000000",
    hoverColor: "#ffffff",
  },
};

type Props = {
  href?: string;
  children?: string;
  variant?: keyof typeof variants;
  style?: CSSProperties;
};

export default function BAverageBadge({
  href = "https://b-average.com",
  children = "B AVERAGE",
  variant = "black",
  style = {},
  ...props
}: Props & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const chosen = variants[variant] || variants.black;

  const handleMouseEnter = (event: MouseEvent<HTMLAnchorElement>) => {
    event.currentTarget.style.backgroundColor = chosen.hoverBackgroundColor;
    event.currentTarget.style.color = chosen.hoverColor;
  };

  const handleMouseLeave = (event: MouseEvent<HTMLAnchorElement>) => {
    event.currentTarget.style.backgroundColor = chosen.backgroundColor;
    event.currentTarget.style.color = chosen.color;
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        ...baseStyle,
        backgroundColor: chosen.backgroundColor,
        color: chosen.color,
        ...style,
      }}
      {...props}
    >
      {children}
    </a>
  );
}
