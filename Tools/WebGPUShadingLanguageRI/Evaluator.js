/*
 * Copyright (C) 2018 Apple Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL APPLE INC. OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
 * OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. 
 */
"use strict";

let _lastInvocationDidTrap;

// This is a combined LHS/RHS evaluator that passes around EPtr's to everything.
class Evaluator extends Visitor {
    constructor(program)
    {
        super();
        this._program = program;
        _lastInvocationDidTrap = false;
    }

    static lastInvocationDidTrap()
    {
        return lastInvocationDidTrap;
    }
    
    // You must snapshot if you use a value in rvalue context. For example, a call expression will
    // snapshot all of its arguments immediately upon executing them. In general, it should not be
    // possible for a pointer returned from a visit method in rvalue context to live across any effects.
    _snapshot(type, dstPtr, srcPtr)
    {
        if (!srcPtr)
            return null;
        let size = type.size;
        if (size == null)
            throw new Error("Cannot get size of type: " + type + " (size = " + size + ", constructor = " + type.constructor.name + ")");
        if (!dstPtr)
            dstPtr = new EPtr(new EBuffer(size), 0);
        dstPtr.copyFrom(srcPtr, size);
        return dstPtr;
    }
    
    runFunc(func)
    {
        return EBuffer.disallowAllocation(
            () => this._runBody(func.returnType, func.returnEPtr, func.body, func.isEntryPoint));
    }
    
    _runBody(type, ptr, block, isEntryPoint)
    {
        if (!ptr)
            throw new Error("Null ptr");
        try {
            block.visit(this);
            // FIXME: We should have a check that there is no way to drop out of a function without
            // returning unless the function returns void.
            return null;
        } catch (e) {
            if (e == BreakException || e == ContinueException)
                throw new Error("Should not see break/continue at function scope");
            if (e instanceof ReturnException)
                return this._snapshot(type, ptr, e.value);
            if (e instanceof WTrapError) {
                if (isEntryPoint) {
                    _lastInvocationDidTrap = true;
                    type.populateDefaultValue(ptr.buffer, ptr.offset);
                    return ptr;
                }
            }
            throw e;
        }
    }

    _evaluateArguments(argumentList, parameterList)
    {
        const callArguments = [];
        for (let i = argumentList.length; i--;) {
            const argument = argumentList[i];
            const type = parameterList[i].type;
            if (!type || !argument)
                throw new Error("Cannot get type or argument; i = " + i + ", argument = " + argument + ", type = " + type);
            let argumentValue = argument.visit(this);
            if (!argumentValue)
                throw new Error("Null argument value, i = " + i + ", node = " + node);
            callArguments.unshift(EBuffer.allowAllocation(() => this._snapshot(type, null, argumentValue)));
        }
        return callArguments;
    }

    _evaluateFunction(node, argumentList, parameterList, funcBody, returnType, returnEPtr, isEntryPoint)
    {
        const argumentValues = this._evaluateArguments(argumentList, parameterList);
        for (let i = 0; i < node.argumentList.length; ++i)
            parameterList[i].ePtr.copyFrom(argumentValues[i], parameterList[i].type.size);
        return EBuffer.allowAllocation(() => this._runBody(returnType, returnEPtr, funcBody, isEntryPoint));
    }

    visitFunctionLikeBlock(node)
    {
        return this._evaluateFunction(node, node.argumentList, node.parameters, node.body, node.returnType, node.returnEPtr, false);
    }
    
    visitReturn(node)
    {
        throw new ReturnException(node.value ? node.value.visit(this) : null);
    }
    
    visitVariableDecl(node)
    {
        if (!node.ePtr.buffer)
            throw new Error("eptr without buffer in " + node);
        node.type.populateDefaultValue(node.ePtr.buffer, node.ePtr.offset);
        if (node.initializer)
            node.ePtr.copyFrom(node.initializer.visit(this), node.type.size);
    }
    
    visitAssignment(node)
    {
        let target = node.lhs.visit(this);
        let source = node.rhs.visit(this);
        target.copyFrom(source, node.type.size);
        return target;
    }
    
    visitIdentityExpression(node)
    {
        return node.target.visit(this);
    }
    
    visitDereferenceExpression(node)
    {
        let ptr = node.ptr.visit(this).loadValue();
        if (!ptr)
            throw new WTrapError(node.origin.originString, "Null dereference");
        return ptr;
    }
    
    visitMakePtrExpression(node)
    {
        let ptr = node.lValue.visit(this);
        return node.ePtr.box(ptr);
    }
    
    visitMakeArrayRefExpression(node)
    {
        return node.ePtr.box(new EArrayRef(node.lValue.visit(this), node.numElements.visit(this).loadValue()));
    }
    
    visitConvertPtrToArrayRefExpression(node)
    {
        return node.ePtr.box(new EArrayRef(node.lValue.visit(this).loadValue(), 1));
    }
    
    visitCommaExpression(node)
    {
        let result;
        for (let expression of node.list)
            result = expression.visit(this);
        // This should almost snapshot, except that tail-returning a pointer is totally OK.
        return result;
    }

    visitTernaryExpression(node)
    {
        if (node.predicate.visit(this).loadValue())
            return node.bodyExpression.visit(this);
        return node.elseExpression.visit(this);
    }
    
    visitVariableRef(node)
    {
        return node.variable.ePtr;
    }
    
    visitGenericLiteral(node)
    {
        return node.ePtr.box(node.valueForSelectedType);
    }
    
    visitNullLiteral(node)
    {
        return node.ePtr.box(null);
    }
    
    visitBoolLiteral(node)
    {
        return node.ePtr.box(node.value);
    }
    
    visitEnumLiteral(node)
    {
        return node.ePtr.box(node.member.value.unifyNode.valueForSelectedType);
    }

    visitLogicalNot(node)
    {
        let result = !node.operand.visit(this).loadValue();
        return node.ePtr.box(result);
    }

    visitLogicalExpression(node)
    {
        let lhs = node.left.visit(this).loadValue();
        let result;
        switch (node.text) {
        case "&&":
            result = lhs && node.right.visit(this).loadValue();
            break;
        case "||":
            result = lhs || node.right.visit(this).loadValue();
            break;
        default:
            throw new Error("Unknown type of logical expression");
        }
        return node.ePtr.box(result);
    }

    visitIfStatement(node)
    {
        if (node.conditional.visit(this).loadValue())
            return node.body.visit(this);
        else if (node.elseBody)
            return node.elseBody.visit(this);
    }

    visitWhileLoop(node)
    {
        while (node.conditional.visit(this).loadValue()) {
            try {
                node.body.visit(this);
            } catch (e) {
                if (e == BreakException)
                    break;
                if (e == ContinueException)
                    continue;
                throw e;
            }
        }
    }

    visitDoWhileLoop(node)
    {
        do {
            try {
                node.body.visit(this);
            } catch (e) {
                if (e == BreakException)
                    break;
                if (e == ContinueException)
                    continue;
                throw e;
            }
        } while (node.conditional.visit(this).loadValue());
    }

    visitForLoop(node)
    {
        for (node.initialization ? node.initialization.visit(this) : true;
            node.condition ? node.condition.visit(this).loadValue() : true;
            node.increment ? node.increment.visit(this) : true) {
            try {
                node.body.visit(this);
            } catch (e) {
                if (e == BreakException)
                    break;
                if (e == ContinueException)
                    continue;
                throw e;
            }
        }
    }
    
    visitSwitchStatement(node)
    {
        let findAndRunCast = predicate => {
            for (let i = 0; i < node.switchCases.length; ++i) {
                let switchCase = node.switchCases[i];
                if (predicate(switchCase)) {
                    try {
                        for (let j = i; j < node.switchCases.length; ++j)
                            node.switchCases[j].visit(this);
                    } catch (e) {
                        if (e != BreakException)
                            throw e;
                    }
                    return true;
                }
            }
            return false;
        };
        
        let value = node.value.visit(this).loadValue();
        
        let found = findAndRunCast(switchCase => {
            if (switchCase.isDefault)
                return false;
            return node.type.unifyNode.valuesEqual(
                value, switchCase.value.unifyNode.valueForSelectedType);
        });
        if (found)
            return;
        
        found = findAndRunCast(switchCase => switchCase.isDefault);
        if (!found)
            throw new Error("Switch statement did not find case");
    }

    visitBreak(node)
    {
        throw BreakException;
    }

    visitContinue(node)
    {
        throw ContinueException;
    }

    visitTrapStatement(node)
    {
        throw new WTrapError(node.origin.originString, "Trap statement");
    }
    
    visitAnonymousVariable(node)
    {
        node.type.populateDefaultValue(node.ePtr.buffer, node.ePtr.offset);
    }
    
    visitCallExpression(node)
    {
        if (node.func instanceof NativeFunc) {
            const callArguments = this._evaluateArguments(node.argumentList, node.func.parameters);
            return EBuffer.allowAllocation(() => this._snapshot(node.func.returnType, node.resultEPtr, node.func.implementation(callArguments, node)));
        } else
            return this._evaluateFunction(node, node.argumentList, node.func.parameters, node.func.body, node.func.returnType, node.resultEPtr, false);
    }
}

