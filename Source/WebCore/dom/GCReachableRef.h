/*
 * Copyright (C) 2013-2018 Apple Inc. All rights reserved.
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

#pragma once

#include <wtf/DumbPtrTraits.h>
#include <wtf/HashCountedSet.h>
#include <wtf/Ref.h>

namespace WebCore {

class Node;

class GCReachableRefMap {
public:
    static inline bool contains(Node& node) { return map().contains(&node); }
    static inline void add(Node& node) { map().add(&node); }
    static inline void remove(Node& node) { map().remove(&node); }

private:
    static HashCountedSet<Node*>& map();
};

template <typename T, typename = std::enable_if_t<std::is_same<T, typename std::remove_const<T>::type>::value>>
class GCReachableRef {
    WTF_MAKE_NONCOPYABLE(GCReachableRef);
public:

    template<typename = std::enable_if_t<std::is_base_of<Node, T>::value>>
    GCReachableRef(T& object)
        : m_ref(object)
    {
        GCReachableRefMap::add(m_ref.get());
    }

    ~GCReachableRef()
    {
        if (!isNull())
            GCReachableRefMap::remove(m_ref.get());
    }

    template<typename X, typename Y, typename = std::enable_if_t<std::is_base_of<Node, T>::value>>
    GCReachableRef(Ref<X, Y>&& other)
        : m_ref(WTFMove(other.m_ref))
    {
        if (!isNull())
            GCReachableRefMap::add(m_ref.get());
    }

    GCReachableRef(GCReachableRef&& other)
        : m_ref(WTFMove(other.m_ref))
    {
    }

    template<typename X, typename Y> GCReachableRef(const GCReachableRef<X, Y>& other) = delete;

    T* operator->() const { ASSERT(!isNull()); return m_ref.ptr(); }
    T* ptr() const RETURNS_NONNULL { ASSERT(!isNull()); return m_ref.ptr(); }
    T& get() const { ASSERT(!isNull()); return m_ref.get(); }
    operator T&() const { ASSERT(!isNull()); return m_ref.get(); }
    bool operator!() const { ASSERT(!isNull()); return !m_ref.get(); }

private:
    bool isNull() const { return m_ref.isHashTableEmptyValue(); }

    Ref<T> m_ref;
};

}
