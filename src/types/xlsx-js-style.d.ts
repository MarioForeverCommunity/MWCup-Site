declare module 'xlsx-js-style' {
  // Re-export all types from 'xlsx' to make this module type-compatible with SheetJS
  export * from 'xlsx'
  // Provide a default export compatible with both CJS and ESM consumers
  import * as XLSX from 'xlsx'
  const xlsx: typeof XLSX
  export default xlsx
}
