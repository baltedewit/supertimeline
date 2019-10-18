"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("underscore");
var lib_1 = require("../lib");
exports.OPERATORS = ['&', '|', '+', '-', '*', '/', '%', '!'];
function interpretExpression(expr) {
    if (lib_1.isNumeric(expr)) {
        return parseFloat(expr);
    }
    else if (_.isString(expr)) {
        var operatorList = exports.OPERATORS;
        var regexpOperators = _.map(operatorList, function (o) { return '\\' + o; }).join('');
        expr = expr.replace(new RegExp('([' + regexpOperators + '\\(\\)])', 'g'), ' $1 '); // Make sure there's a space between every operator & operand
        var words = _.compact(expr.split(' '));
        if (words.length === 0)
            return null; // empty expression
        // Fix special case: a + - b
        for (var i = words.length - 2; i >= 1; i--) {
            if ((words[i] === '-' || words[i] === '+') && wordIsOperator(operatorList, words[i - 1])) {
                words[i] = words[i] + words[i + 1];
                words.splice(i + 1, 1);
            }
        }
        var innerExpression = wrapInnerExpressions(words);
        if (innerExpression.rest.length)
            throw new Error('interpretExpression: syntax error: parentheses don\'t add up in "' + expr + '".');
        if (innerExpression.inner.length % 2 !== 1)
            throw new Error('interpretExpression: operands & operators don\'t add up: "' + innerExpression.inner.join(' ') + '".');
        var expression = words2Expression(operatorList, innerExpression.inner);
        validateExpression(operatorList, expression);
        return expression;
    }
    else {
        return expr;
    }
}
exports.interpretExpression = interpretExpression;
/** Try to simplify an expression, this includes:
 * * Combine constant operands, using arithmetic operators
 * ...more to come?
 */
function simplifyExpression(expr0) {
    var expr = (_.isString(expr0) ?
        interpretExpression(expr0) :
        expr0);
    if (!expr)
        return expr;
    if (isExpressionObject(expr)) {
        var l = simplifyExpression(expr.l);
        var o = expr.o;
        var r = simplifyExpression(expr.r);
        if (lib_1.isConstant(l) &&
            lib_1.isConstant(r) &&
            _.isNumber(l) &&
            _.isNumber(r)) {
            // The operands can be combined:
            return (o === '+' ?
                l + r :
                o === '-' ?
                    l - r :
                    o === '*' ?
                        l * r :
                        o === '/' ?
                            l / r :
                            o === '%' ?
                                l % r :
                                { l: l, o: o, r: r });
        }
        return { l: l, o: o, r: r };
    }
    return expr;
}
exports.simplifyExpression = simplifyExpression;
function isExpressionObject(expr) {
    return (typeof expr === 'object' &&
        _.has(expr, 'l') &&
        _.has(expr, 'o') &&
        _.has(expr, 'r'));
}
function wordIsOperator(operatorList, word) {
    if (operatorList.indexOf(word) !== -1)
        return true;
    return false;
}
// Turns ['a', '(', 'b', 'c', ')'] into ['a', ['b', 'c']]
// or ['a', '&', '!', 'b'] into ['a', '&', ['', '!', 'b']]
function wrapInnerExpressions(words) {
    for (var i = 0; i < words.length; i++) {
        if (words[i] === '(') {
            var tmp = wrapInnerExpressions(words.slice(i + 1));
            // insert inner expression and remove tha
            words[i] = tmp.inner;
            words.splice.apply(words, [i + 1, 99999].concat(tmp.rest));
        }
        else if (words[i] === ')') {
            return {
                inner: words.slice(0, i),
                rest: words.slice(i + 1)
            };
        }
        else if (words[i] === '!') {
            var tmp = wrapInnerExpressions(words.slice(i + 1));
            // insert inner expression after the '!'
            words[i] = ['', '!'].concat(tmp.inner);
            words.splice.apply(words, [i + 1, 99999].concat(tmp.rest));
        }
    }
    return {
        inner: words,
        rest: []
    };
}
exports.wrapInnerExpressions = wrapInnerExpressions;
function words2Expression(operatorList, words) {
    if (!words || !words.length)
        throw new Error('words2Expression: syntax error: unbalanced expression');
    while (words.length === 1 && _.isArray(words[0]))
        words = words[0];
    if (words.length === 1)
        return words[0];
    // Find the operator with the highest priority:
    var operatorI = -1;
    _.each(operatorList, function (operator) {
        if (operatorI === -1) {
            operatorI = words.lastIndexOf(operator);
        }
    });
    if (operatorI !== -1) {
        var l = words.slice(0, operatorI);
        var r = words.slice(operatorI + 1);
        var expr = {
            l: words2Expression(operatorList, l),
            o: words[operatorI],
            r: words2Expression(operatorList, r)
        };
        return expr;
    }
    else
        throw new Error('words2Expression: syntax error: operator not found: "' + (words.join(' ')) + '"');
}
function validateExpression(operatorList, expr0, breadcrumbs) {
    if (!breadcrumbs)
        breadcrumbs = 'ROOT';
    if (_.isObject(expr0) && !_.isArray(expr0)) {
        var expr = expr0;
        if (!_.has(expr, 'l'))
            throw new Error("validateExpression: " + breadcrumbs + ".l missing in " + JSON.stringify(expr));
        if (!_.has(expr, 'o'))
            throw new Error("validateExpression: " + breadcrumbs + ".o missing in " + JSON.stringify(expr));
        if (!_.has(expr, 'r'))
            throw new Error("validateExpression: " + breadcrumbs + ".r missing in " + JSON.stringify(expr));
        if (!_.isString(expr.o))
            throw new Error("validateExpression: " + breadcrumbs + ".o not a string");
        if (!wordIsOperator(operatorList, expr.o))
            throw new Error(breadcrumbs + '.o not valid: "' + expr.o + '"');
        validateExpression(operatorList, expr.l, breadcrumbs + '.l');
        validateExpression(operatorList, expr.r, breadcrumbs + '.r');
    }
    else if (!_.isNull(expr0) && !_.isString(expr0) && !_.isNumber(expr0)) {
        throw new Error("validateExpression: " + breadcrumbs + " is of invalid type");
    }
}
//# sourceMappingURL=expression.js.map