import {
  Children,
  forwardRef,
  isValidElement,
  type OptionHTMLAttributes,
  type SelectHTMLAttributes,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "multiple" | "size">;

/** A themed menu with a native form control for existing change handlers and form values. */
export const ThemedSelect = forwardRef<HTMLSelectElement, Props>(function ThemedSelect(
  {
    children,
    value,
    defaultValue,
    onChange,
    id,
    className,
    style,
    disabled,
    required,
    "aria-label": label,
    "aria-labelledby": labelledBy,
    "aria-describedby": describedBy,
    "aria-invalid": invalid,
    title,
    ...props
  },
  ref,
) {
  const nativeRef = useRef<HTMLSelectElement>(null);
  useImperativeHandle(ref, () => nativeRef.current!);
  const emptyValue = useId();
  const options = Children.toArray(children).flatMap((child) => {
    if (!isValidElement<OptionHTMLAttributes<HTMLOptionElement>>(child) || child.type !== "option")
      return [];
    return [
      {
        value: String(child.props.value ?? child.props.children ?? ""),
        label: child.props.children,
        disabled: child.props.disabled,
        hidden: child.props.hidden,
      },
    ];
  });
  const [localValue, setLocalValue] = useState(String(defaultValue ?? options[0]?.value ?? ""));
  const selected = value === undefined ? localValue : String(value);
  return (
    <>
      <Select
        value={selected || emptyValue}
        disabled={disabled}
        required={required}
        onValueChange={(encoded) => {
          const next = encoded === emptyValue ? "" : encoded;
          setLocalValue(next);
          if (nativeRef.current) {
            nativeRef.current.value = next;
            nativeRef.current.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }}
      >
        <SelectTrigger
          id={id}
          className={cn("w-auto gap-2", className)}
          style={style}
          aria-label={label}
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          title={title}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options
            .filter((option) => !option.hidden)
            .map((option) => (
              <SelectItem
                key={option.value}
                value={option.value || emptyValue}
                disabled={option.disabled}
              >
                {option.label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      <select
        {...props}
        ref={nativeRef}
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only pointer-events-none"
        value={selected}
        disabled={disabled}
        required={required}
        onChange={(event) => onChange?.(event)}
      >
        {children}
      </select>
    </>
  );
});
