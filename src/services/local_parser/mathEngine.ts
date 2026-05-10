import { parser } from 'mathjs';

export interface MathResult {
  variable: string;
  expression: string;
  value: number | string;
  isEvaluation: boolean;
  lineIndex: number;
}

export class MathEngine {
  /**
   * Processes content to extract variables and evaluate pending results.
   */
  public process(content: string): MathResult[] {
    const results: MathResult[] = [];
    const p = parser();

    // Split by lines
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) continue;

      const plainText = trimmed.replace(/(\*\*|\*|_)/g, '');

      // 1. EVALUATION TRIGGER: name = expr =
      // e.g. "total = a + b ="
      const evalMatch = plainText.match(/^([a-zA-Z_]\w*)\s*=\s*([^=]+)=$/);
      if (evalMatch) {
        const name = evalMatch[1].trim();
        const expr = evalMatch[2].trim();
        try {
          const val = p.evaluate(expr);
          p.set(name, val);
          results.push({
            variable: name,
            expression: expr,
            value: val,
            isEvaluation: true,
            lineIndex: i
          });
        } catch (e) {
          console.warn(`Math Error: "${plainText}"`, e);
        }
        continue;
      }

      // 2. CONFIRMED RESULT: name = expr = value
      // e.g. "c = a + b = 6"
      const confirmedMatch = plainText.match(/^([a-zA-Z_]\w*)\s*=\s*([^=]+)=\s*(-?\d+(\.\d+)?)$/);
      if (confirmedMatch) {
        const name = confirmedMatch[1].trim();
        const expr = confirmedMatch[2].trim();
        try {
          const val = p.evaluate(expr);
          p.set(name, val);
          // Also push to results so we can detect if it should be updated
          results.push({
            variable: name,
            expression: expr,
            value: val,
            isEvaluation: true,
            lineIndex: i
          });
        } catch (e) {
          p.set(name, parseFloat(confirmedMatch[3]));
        }
        continue;
      }

      // 3. FLEXIBLE ASSIGNMENT: name = value/expr anywhere in line
      // Supports "Beli jeruk = 10"
      const anyAssignMatch = plainText.match(/([a-zA-Z_]\w*)\s*=\s*([^=]+)$/);
      if (anyAssignMatch) {
        const name = anyAssignMatch[1].trim();
        const expr = anyAssignMatch[2].trim();
        try {
          const val = p.evaluate(expr);
          p.set(name, val);
        } catch (e) {}
      } else {
        try { p.evaluate(plainText); } catch (e) {}
      }
    }

    return results;
  }
}

export const mathEngine = new MathEngine();
