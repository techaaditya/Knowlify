/**
 * Tiny, safe math-expression evaluator for the function plotter.
 *
 * Compiles a string like "-x + 1", "x^2", "2sin(x) + 1" into a fast
 * `(x: number) => number`. Uses a hand-rolled tokenizer + shunting-yard →
 * RPN evaluator so there is NO `eval`/`Function` and no arbitrary code
 * execution — only numbers, `x`, a fixed set of math functions/constants,
 * and the operators + - * / ^ (with implicit multiplication like `2x`).
 */

export type CompiledExpr = (x: number) => number;

const FUNCS: Record<string, (a: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  exp: Math.exp,
  ln: Math.log,
  log: (a) => Math.log10(a),
  log2: (a) => Math.log2(a),
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
};

const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E, tau: Math.PI * 2 };

type Token =
  | { t: 'num'; v: number }
  | { t: 'var' }
  | { t: 'const'; v: number }
  | { t: 'func'; name: string }
  | { t: 'op'; op: '+' | '-' | '*' | '/' | '^' }
  | { t: 'u'; op: 'u-' | 'u+' } // unary
  | { t: 'lp' }
  | { t: 'rp' };

/** Normalise common ways the model writes an expression. */
function normalise(raw: string): string {
  let s = raw.trim();
  // Strip a leading "y =", "f(x) =", "y=" etc.
  s = s.replace(/^\s*(y|f\s*\(\s*x\s*\))\s*=\s*/i, '');
  // Unicode operators → ascii.
  s = s
    .replace(/[×∙·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/\*\*/g, '^');
  // Collapse doubled signs the model sometimes emits: "-x + +1" → "-x + 1".
  s = s.replace(/\+\s*\+/g, '+').replace(/-\s*\+/g, '-').replace(/\+\s*-/g, '-');
  return s;
}

function rawTokenize(s: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const isDigit = (c: string) => c >= '0' && c <= '9';
  const isAlpha = (c: string) => /[a-zA-Z_]/.test(c);
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t' || c === '\n') {
      i++;
      continue;
    }
    if (isDigit(c) || (c === '.' && isDigit(s[i + 1] ?? ''))) {
      let j = i + 1;
      while (j < s.length && (isDigit(s[j]) || s[j] === '.')) j++;
      const num = Number(s.slice(i, j));
      if (!Number.isFinite(num)) throw new Error(`bad number: ${s.slice(i, j)}`);
      out.push({ t: 'num', v: num });
      i = j;
      continue;
    }
    if (isAlpha(c)) {
      let j = i + 1;
      while (j < s.length && (isAlpha(s[j]) || isDigit(s[j]))) j++;
      const name = s.slice(i, j).toLowerCase();
      i = j;
      if (name === 'x') out.push({ t: 'var' });
      else if (name in CONSTS) out.push({ t: 'const', v: CONSTS[name] });
      else if (name in FUNCS) out.push({ t: 'func', name });
      else throw new Error(`unknown name: ${name}`);
      continue;
    }
    if (c === '(') {
      out.push({ t: 'lp' });
      i++;
      continue;
    }
    if (c === ')') {
      out.push({ t: 'rp' });
      i++;
      continue;
    }
    if (c === '+' || c === '-' || c === '*' || c === '/' || c === '^') {
      out.push({ t: 'op', op: c });
      i++;
      continue;
    }
    throw new Error(`unexpected character: ${c}`);
  }
  return out;
}

/** Insert implicit-multiplication ops (2x, 3(x+1), (x)(x), x sin(x)…). */
function withImplicitMul(toks: Token[]): Token[] {
  const out: Token[] = [];
  for (let k = 0; k < toks.length; k++) {
    const prev = out[out.length - 1];
    const cur = toks[k];
    const prevEndsValue =
      prev && (prev.t === 'num' || prev.t === 'var' || prev.t === 'const' || prev.t === 'rp');
    const curStartsValue =
      cur.t === 'num' || cur.t === 'var' || cur.t === 'const' || cur.t === 'func' || cur.t === 'lp';
    if (prevEndsValue && curStartsValue) out.push({ t: 'op', op: '*' });
    out.push(cur);
  }
  return out;
}

/** Mark leading/after-operator +/- as unary. */
function markUnary(toks: Token[]): Token[] {
  const out: Token[] = [];
  for (let k = 0; k < toks.length; k++) {
    const cur = toks[k];
    if (cur.t === 'op' && (cur.op === '+' || cur.op === '-')) {
      const prev = out[out.length - 1];
      const isUnary =
        !prev || prev.t === 'op' || prev.t === 'u' || prev.t === 'lp';
      if (isUnary) {
        out.push({ t: 'u', op: cur.op === '-' ? 'u-' : 'u+' });
        continue;
      }
    }
    out.push(cur);
  }
  return out;
}

const PREC: Record<string, number> = { '+': 2, '-': 2, '*': 3, '/': 3, 'u-': 4, 'u+': 4, '^': 5 };
const RIGHT_ASSOC = new Set(['^', 'u-', 'u+']);

/** Shunting-yard: token stream → RPN. */
function toRPN(toks: Token[]): Token[] {
  const output: Token[] = [];
  const stack: Token[] = [];
  for (const tok of toks) {
    switch (tok.t) {
      case 'num':
      case 'var':
      case 'const':
        output.push(tok);
        break;
      case 'func':
        stack.push(tok);
        break;
      case 'u':
      case 'op': {
        const o1 = tok.t === 'u' ? tok.op : tok.op;
        while (stack.length) {
          const top = stack[stack.length - 1];
          if (top.t === 'func') {
            output.push(stack.pop()!);
            continue;
          }
          if (top.t === 'op' || top.t === 'u') {
            const o2 = top.t === 'u' ? top.op : top.op;
            const shift = RIGHT_ASSOC.has(o1) ? PREC[o2] > PREC[o1] : PREC[o2] >= PREC[o1];
            if (shift) {
              output.push(stack.pop()!);
              continue;
            }
          }
          break;
        }
        stack.push(tok);
        break;
      }
      case 'lp':
        stack.push(tok);
        break;
      case 'rp': {
        let found = false;
        while (stack.length) {
          const top = stack.pop()!;
          if (top.t === 'lp') {
            found = true;
            break;
          }
          output.push(top);
        }
        if (!found) throw new Error('mismatched parentheses');
        // Pop a function sitting on top of the (now removed) '('.
        const top = stack[stack.length - 1];
        if (top && top.t === 'func') output.push(stack.pop()!);
        break;
      }
    }
  }
  while (stack.length) {
    const top = stack.pop()!;
    if (top.t === 'lp' || top.t === 'rp') throw new Error('mismatched parentheses');
    output.push(top);
  }
  return output;
}

/** Compile an expression string into `(x) => number`. Throws on invalid input. */
export function compileExpr(raw: string): CompiledExpr {
  const rpn = toRPN(markUnary(withImplicitMul(rawTokenize(normalise(raw)))));
  if (rpn.length === 0) throw new Error('empty expression');
  // Validate once by evaluating at a probe value.
  const evaluate = (x: number): number => {
    const st: number[] = [];
    for (const tok of rpn) {
      switch (tok.t) {
        case 'num':
          st.push(tok.v);
          break;
        case 'const':
          st.push(tok.v);
          break;
        case 'var':
          st.push(x);
          break;
        case 'func': {
          const a = st.pop();
          if (a === undefined) throw new Error('bad expression');
          st.push(FUNCS[tok.name](a));
          break;
        }
        case 'u': {
          const a = st.pop();
          if (a === undefined) throw new Error('bad expression');
          st.push(tok.op === 'u-' ? -a : a);
          break;
        }
        case 'op': {
          const b = st.pop();
          const a = st.pop();
          if (a === undefined || b === undefined) throw new Error('bad expression');
          switch (tok.op) {
            case '+':
              st.push(a + b);
              break;
            case '-':
              st.push(a - b);
              break;
            case '*':
              st.push(a * b);
              break;
            case '/':
              st.push(a / b);
              break;
            case '^':
              st.push(Math.pow(a, b));
              break;
          }
          break;
        }
      }
    }
    if (st.length !== 1) throw new Error('bad expression');
    return st[0];
  };
  evaluate(1); // probe: surface structural errors at compile time
  return evaluate;
}
