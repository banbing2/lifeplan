/** 原生端与 Web 端日期时间字段共用的属性契约。 */
export type DateTimeFieldProps = {
  label: string;
  mode: 'date' | 'time';
  value: string;
  minimumDateKey?: string;
  disabled?: boolean;
  /** 仅用于允许空值的可选时间；必填日期和单次具体时刻不展示清除入口。 */
  clearable?: boolean;
  compact?: boolean;
  emptyLabel?: string;
  hideLabel?: boolean;
  error?: string;
  onChange: (value: string) => void;
};
