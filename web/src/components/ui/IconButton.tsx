/**
 * @fileoverview 统一图标按钮。
 */

import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react";
import { cn } from "../../lib/cn";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** 按钮内容，通常为图标 */
  children: ReactNode;
};

/**
 * 顶栏 / 侧栏通用图标按钮。
 * @param props - 原生 button 属性 + children
 * @returns 组件 JSX
 */
export function IconButton(props: IconButtonProps): ReactElement {
  const { children, className, type = "button", ...rest } = props;

  return (
    <button type={type} className={cn("btn-icon", className)} {...rest}>
      {children}
    </button>
  );
}
