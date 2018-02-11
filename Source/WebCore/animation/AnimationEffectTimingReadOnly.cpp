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

#include "config.h"
#include "AnimationEffectTimingReadOnly.h"

namespace WebCore {

Ref<AnimationEffectTimingReadOnly> AnimationEffectTimingReadOnly::create()
{
    return adoptRef(*new AnimationEffectTimingReadOnly(AnimationEffectTimingReadOnlyClass));
}

AnimationEffectTimingReadOnly::AnimationEffectTimingReadOnly(ClassType classType)
    : m_classType(classType)
    , m_timingFunction(LinearTimingFunction::create())
{
}

AnimationEffectTimingReadOnly::~AnimationEffectTimingReadOnly()
{
}

ExceptionOr<void> AnimationEffectTimingReadOnly::setProperties(std::optional<Variant<double, KeyframeEffectOptions>>&& options)
{
    if (!options)
        return { };

    auto optionsValue = options.value();
    Variant<double, String> bindingsDuration;
    if (WTF::holds_alternative<double>(optionsValue))
        bindingsDuration = WTF::get<double>(optionsValue);
    else {
        auto keyframeEffectOptions = WTF::get<KeyframeEffectOptions>(optionsValue);
        bindingsDuration = keyframeEffectOptions.duration;
        setBindingsDelay(keyframeEffectOptions.delay);
        setBindingsEndDelay(keyframeEffectOptions.endDelay);
        setFill(keyframeEffectOptions.fill);

        auto setIterationStartResult = setIterationStart(keyframeEffectOptions.iterationStart);
        if (setIterationStartResult.hasException())
            return setIterationStartResult.releaseException();

        auto setIterationsResult = setIterations(keyframeEffectOptions.iterations);
        if (setIterationsResult.hasException())
            return setIterationsResult.releaseException();

        setDirection(keyframeEffectOptions.direction);
        auto setEasingResult = setEasing(keyframeEffectOptions.easing);
        if (setEasingResult.hasException())
            return setEasingResult.releaseException();
    }

    auto setBindingsDurationResult = setBindingsDuration(WTFMove(bindingsDuration));
    if (setBindingsDurationResult.hasException())
        return setBindingsDurationResult.releaseException();

    return { };
}

ExceptionOr<void> AnimationEffectTimingReadOnly::setIterationStart(double iterationStart)
{
    // https://drafts.csswg.org/web-animations-1/#dom-animationeffecttiming-iterationstart
    // If an attempt is made to set this attribute to a value less than zero, a TypeError must
    // be thrown and the value of the iterationStart attribute left unchanged.
    if (iterationStart < 0)
        return Exception { TypeError };

    m_iterationStart = iterationStart;
    return { };
}

ExceptionOr<void> AnimationEffectTimingReadOnly::setIterations(double iterations)
{
    // https://drafts.csswg.org/web-animations-1/#dom-animationeffecttiming-iterations
    // If an attempt is made to set this attribute to a value less than zero or a NaN value, a
    // TypeError must be thrown and the value of the iterations attribute left unchanged.
    if (iterations < 0 || std::isnan(iterations))
        return Exception { TypeError };

    m_iterations = iterations;
    return { };
}

Variant<double, String> AnimationEffectTimingReadOnly::bindingsDuration() const
{
    if (m_iterationDuration == 0_s)
        return "auto";
    return secondsToWebAnimationsAPITime(m_iterationDuration);
}

ExceptionOr<void> AnimationEffectTimingReadOnly::setBindingsDuration(Variant<double, String>&& duration)
{
    // https://drafts.csswg.org/web-animations-1/#dom-animationeffecttimingreadonly-duration
    // The iteration duration which is a real number greater than or equal to zero (including positive infinity)
    // representing the time taken to complete a single iteration of the animation effect.
    // In this level of this specification, the string value auto is equivalent to zero. This is a forwards-compatiblity
    // measure since a future level of this specification will introduce group effects where the auto value expands to
    // include the duration of the child effects.

    if (WTF::holds_alternative<double>(duration)) {
        auto durationAsDouble = WTF::get<double>(duration);
        if (durationAsDouble < 0 || std::isnan(durationAsDouble))
            return Exception { TypeError };
        m_iterationDuration = Seconds::fromMilliseconds(durationAsDouble);
        return { };
    }

    if (WTF::get<String>(duration) != "auto")
        return Exception { TypeError };

    m_iterationDuration = 0_s;

    return { };
}

ExceptionOr<void> AnimationEffectTimingReadOnly::setEasing(const String& easing)
{
    auto timingFunctionResult = TimingFunction::createFromCSSText(easing);
    if (timingFunctionResult.hasException())
        return timingFunctionResult.releaseException();
    m_timingFunction = timingFunctionResult.returnValue();
    return { };
}

Seconds AnimationEffectTimingReadOnly::endTime() const
{
    // 3.5.3 The active interval
    // https://drafts.csswg.org/web-animations-1/#end-time

    // The end time of an animation effect is the result of evaluating max(start delay + active duration + end delay, 0).
    auto endTime = m_delay + activeDuration() + m_endDelay;
    return endTime > 0_s ? endTime : 0_s;
}

Seconds AnimationEffectTimingReadOnly::activeDuration() const
{
    // 3.8.2. Calculating the active duration
    // https://drafts.csswg.org/web-animations-1/#calculating-the-active-duration

    // The active duration is calculated as follows:
    // active duration = iteration duration × iteration count
    // If either the iteration duration or iteration count are zero, the active duration is zero.
    if (!m_iterationDuration || !m_iterations)
        return 0_s;
    return m_iterationDuration * m_iterations;
}

} // namespace WebCore
