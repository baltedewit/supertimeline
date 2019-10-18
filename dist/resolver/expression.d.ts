import { Expression, ExpressionObj } from '../api/api';
export declare const OPERATORS: string[];
export declare function interpretExpression(expr: null): null;
export declare function interpretExpression(expr: number): number;
export declare function interpretExpression(expr: ExpressionObj): ExpressionObj;
export declare function interpretExpression(expr: string | Expression): Expression;
/** Try to simplify an expression, this includes:
 * * Combine constant operands, using arithmetic operators
 * ...more to come?
 */
export declare function simplifyExpression(expr0: Expression): Expression;
interface InnerExpression {
    inner: Array<any>;
    rest: Array<string>;
}
export declare function wrapInnerExpressions(words: Array<any>): InnerExpression;
export {};
