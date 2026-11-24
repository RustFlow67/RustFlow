"use client";
import type { ButtonHTMLAttributes, ReactNode } from 'react';
export default function SwipeButton({children,className='',trailing, ...props}:ButtonHTMLAttributes<HTMLButtonElement> & {children:ReactNode;trailing?:ReactNode}) {
  return <button {...props} className={`swipe-button group ${className}`}><span className="swipe-window"><span className="swipe-layer swipe-first">{children}{trailing}</span><span className="swipe-layer swipe-second" aria-hidden="true">{children}{trailing}</span></span></button>;
}
