/** CSS Modules 在 Web 端导出只读类名映射。 */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;

  export default classes;
}

/** 全局 CSS 仅用于副作用导入，不导出运行时成员。 */
declare module '*.css';
