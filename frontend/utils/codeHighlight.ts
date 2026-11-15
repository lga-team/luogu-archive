/** 轻量代码着色：只产出 token，不做任何 innerHTML 拼接，天然避免 <string.h> 被当成标签吞掉。 */
export type CodeTokenKind =
  | 'plain' | 'keyword' | 'string' | 'comment' | 'number'
  | 'preprocessor' | 'function' | 'operator' | 'punctuation' | 'constant' | 'type'

export interface CodeToken { text: string; kind: CodeTokenKind }
export interface CodeLine { tokens: CodeToken[] }

const JS_KEYWORDS = new Set([
  'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
  'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'from', 'function',
  'get', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'of', 'return', 'set', 'static',
  'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
])
const CPP_KEYWORDS = new Set([
  'alignas', 'auto', 'bool', 'break', 'case', 'catch', 'char', 'class', 'const', 'constexpr',
  'continue', 'default', 'delete', 'do', 'double', 'else', 'enum', 'explicit', 'extern', 'false',
  'float', 'for', 'friend', 'goto', 'if', 'inline', 'int', 'long', 'namespace', 'new', 'nullptr',
  'operator', 'private', 'protected', 'public', 'return', 'short', 'signed', 'sizeof', 'static',
  'struct', 'switch', 'template', 'this', 'throw', 'true', 'try', 'typedef', 'typename', 'union',
  'unsigned', 'using', 'virtual', 'void', 'volatile', 'while',
])
const LITERALS = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity', 'nullptr'])
const TYPES = new Set([
  'string', 'number', 'boolean', 'any', 'unknown', 'never', 'object', 'symbol', 'bigint',
  'Array', 'Date', 'Error', 'Map', 'Math', 'Object', 'Promise', 'RegExp', 'Set', 'String',
  'Number', 'Boolean', 'JSON', 'console', 'window', 'document', 'GM', 'unsafeWindow',
  'vector', 'map', 'set', 'pair', 'size_t', 'std', 'iostream',
])

function vocab(language: string) {
  const cpp = /^(?:c|cpp|c\+\+|cc|h|hpp)$/i.test(language)
  return {
    keywords: cpp ? CPP_KEYWORDS : JS_KEYWORDS,
    literals: LITERALS,
    types: TYPES,
  }
}

function scan(source: string, language: string): CodeToken[] {
  const { keywords, literals, types } = vocab(language)
  const out: CodeToken[] = []
  const push = (text: string, kind: CodeTokenKind) => { if (text) out.push({ text, kind }) }
  let i = 0

  while (i < source.length) {
    const rest = source.slice(i)
    const ch = source[i]

    // 块注释（可跨行）与行注释
    if (rest.startsWith('/*')) {
      const end = source.indexOf('*/', i + 2)
      const stop = end < 0 ? source.length : end + 2
      push(source.slice(i, stop), 'comment'); i = stop; continue
    }
    if (rest.startsWith('//')) {
      const end = source.indexOf('\n', i)
      const stop = end < 0 ? source.length : end
      push(source.slice(i, stop), 'comment'); i = stop; continue
    }

    // 预处理整行：#include <string.h> / #define / // ==UserScript== 之类整段保留为文本 token
    if (ch === '#') {
      const lineStart = source.lastIndexOf('\n', i - 1) + 1
      if (!/\S/.test(source.slice(lineStart, i))) {
        const end = source.indexOf('\n', i)
        const stop = end < 0 ? source.length : end
        push(source.slice(i, stop), 'preprocessor'); i = stop; continue
      }
    }

    // 字符串 / 字符 / 模板字符串
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1
      while (j < source.length) {
        if (source[j] === '\\') { j += 2; continue }
        if (source[j] === ch) { j += 1; break }
        if (source[j] === '\n' && ch !== '`') break
        j += 1
      }
      const stop = Math.min(j, source.length)
      push(source.slice(i, stop), 'string'); i = stop; continue
    }

    // 数字
    if (ch >= '0' && ch <= '9') {
      const m = /^(?:0[xX][0-9a-fA-F]+|0[bB][01]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)[a-zA-Z_]?/.exec(rest)
      if (m) { push(m[0], 'number'); i += m[0].length; continue }
    }

    // 标识符
    if (/[A-Za-z_$]/.test(ch)) {
      const m = /^[A-Za-z_$][\w$]*/.exec(rest)!
      const word = m[0]
      const after = /^\s*\(/.test(source.slice(i + word.length))
      let kind: CodeTokenKind = 'plain'
      if (keywords.has(word)) kind = 'keyword'
      else if (literals.has(word)) kind = 'constant'
      else if (after) kind = 'function'
      else if (types.has(word)) kind = 'type'
      push(word, kind); i += word.length; continue
    }

    // 空白（含换行，后续按 \n 切行）
    if (/\s/.test(ch)) {
      const m = /^\s+/.exec(rest)!
      push(m[0], 'plain'); i += m[0].length; continue
    }
    if ('{}()[];,.'.includes(ch)) { push(ch, 'punctuation'); i += 1; continue }
    const op = /^[+\-*/%=<>!&|^~?:]+/.exec(rest)
    if (op) { push(op[0], 'operator'); i += op[0].length; continue }
    push(ch, 'plain'); i += 1
  }
  return out
}

/** 把源码切成带 token 的行；token 文本一律交给 Vue 文本插值渲染，不会经过 HTML 解析。 */
export function tokenizeCode(code: string, language = 'javascript'): CodeLine[] {
  const source = code.replace(/\r\n?/g, '\n')
  const tokens = scan(source, language)
  const lines: CodeToken[][] = [[]]
  for (const token of tokens) {
    const parts = token.text.split('\n')
    parts.forEach((part, index) => {
      if (index > 0) lines.push([])
      if (part) lines[lines.length - 1].push({ text: part, kind: token.kind })
    })
  }
  if (lines.length > 1 && lines[lines.length - 1].length === 0) lines.pop()
  return lines.map(tokensOfLine => ({ tokens: tokensOfLine }))
}

/** 按文件名推断语言，未知一律按 JS 着色（插件代码绝大多数是 userscript）。 */
export function languageFromFilename(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || ''
  if (/^(?:c|cc|cpp|cxx|h|hpp)$/.test(ext)) return 'cpp'
  if (/^(?:json|css|html|py|ts|tsx|jsx|js|mjs)$/.test(ext)) return 'javascript'
  return 'javascript'
}
