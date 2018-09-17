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
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. AND ITS CONTRIBUTORS ``AS IS''
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL APPLE INC. OR ITS CONTRIBUTORS
 * BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF
 * THE POSSIBILITY OF SUCH DAMAGE.
 */

#include "config.h"
#include "FloatBox.h"

#if ENABLE(LAYOUT_FORMATTING_CONTEXT)

#include <wtf/IsoMallocInlines.h>

namespace WebCore {
namespace Layout {

WTF_MAKE_ISO_ALLOCATED_IMPL(FloatBox);

FloatBox::FloatBox(const Box& layoutBox, const FloatingState& floatingState, const LayoutContext& layoutContext)
    : FloatAvoider(layoutBox, floatingState, layoutContext)
{
}

Display::Box::Rect FloatBox::rect() const
{
    auto rect = displayBox().rect();
    return { rect.top() - marginTop(), rect.left() - marginLeft(), marginLeft() + rect.width() + marginRight(), marginTop() + rect.height() + marginBottom() };
}

PositionInContextRoot FloatBox::horizontalPositionCandidate(HorizontalConstraints horizontalConstraints)
{
    auto positionCandidate = isLeftAligned() ? *horizontalConstraints.left : *horizontalConstraints.right - rect().width();
    positionCandidate += marginLeft();

    return positionCandidate;
}

PositionInContextRoot FloatBox::verticalPositionCandidate(PositionInContextRoot verticalConstraint)
{
    return verticalConstraint + marginTop();
}

PositionInContextRoot FloatBox::initialVerticalPosition() const
{
    // Incoming float cannot be placed higher than existing floats (margin box of the last float).
    // Take the static position (where the box would go if it wasn't floating) and adjust it with the last float.
    auto top = FloatAvoider::initialVerticalPosition() - marginTop();
    if (auto lastFloat = floatingState().last())
        top = std::max(top, lastFloat->rectWithMargin().top());
    top += marginTop();

    return top;
}

}
}
#endif
