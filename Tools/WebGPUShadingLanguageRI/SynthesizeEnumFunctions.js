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

function synthesizeEnumFunctions(program)
{
    for (let type of program.types.values()) {
        if (!(type instanceof EnumType))
            continue;

        let nativeFunc;
        let isCast = false;
        let shaderType;

        nativeFunc = new NativeFunc(
            type.origin, "operator==", new TypeRef(type.origin, "bool"),
            [
                new FuncParameter(type.origin, null, new TypeRef(type.origin, type.name)),
                new FuncParameter(type.origin, null, new TypeRef(type.origin, type.name))
            ],
            isCast, shaderType);
        nativeFunc.implementation = ([left, right]) => EPtr.box(left.loadValue() == right.loadValue());
        program.add(nativeFunc);

        nativeFunc = new NativeFunc(
            type.origin, "operator.value", type.baseType.visit(new Rewriter()),
            [new FuncParameter(type.origin, null, new TypeRef(type.origin, type.name))],
            isCast, shaderType);
        nativeFunc.implementation = ([value]) => value;
        program.add(nativeFunc);

        nativeFunc = new NativeFunc(
            type.origin, "operator cast", type.baseType.visit(new Rewriter()),
            [new FuncParameter(type.origin, null, new TypeRef(type.origin, type.name))],
            isCast, shaderType);
        nativeFunc.implementation = ([value]) => value;
        program.add(nativeFunc);

        nativeFunc = new NativeFunc(
            type.origin, "operator cast", new TypeRef(type.origin, type.name),
            [new FuncParameter(type.origin, null, type.baseType.visit(new Rewriter()))],
            isCast, shaderType);
        nativeFunc.implementation = ([value]) => value;
        program.add(nativeFunc);
    }
}
