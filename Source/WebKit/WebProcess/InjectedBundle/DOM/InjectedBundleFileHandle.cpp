/*
 * Copyright (C) 2015 Apple Inc. All rights reserved.
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
#include "InjectedBundleFileHandle.h"

#include <WebCore/File.h>
#include <wtf/HashMap.h>
#include <wtf/NeverDestroyed.h>

namespace WebKit {
using namespace WebCore;

typedef HashMap<File*, InjectedBundleFileHandle*> DOMFileHandleCache;

static DOMFileHandleCache& domFileHandleCache()
{
    static NeverDestroyed<DOMFileHandleCache> cache;
    return cache;
}

RefPtr<InjectedBundleFileHandle> InjectedBundleFileHandle::create(const String& path)
{
    auto file = File::create(path);
    return adoptRef(new InjectedBundleFileHandle(file.get()));
}

RefPtr<InjectedBundleFileHandle> InjectedBundleFileHandle::getOrCreate(File* file)
{
    if (!file)
        return nullptr;

    DOMFileHandleCache::AddResult result = domFileHandleCache().add(file, nullptr);
    if (!result.isNewEntry)
        return RefPtr<InjectedBundleFileHandle>(result.iterator->value);

    RefPtr<InjectedBundleFileHandle> fileHandle = adoptRef(new InjectedBundleFileHandle(*file));
    result.iterator->value = fileHandle.get();
    return fileHandle;
}

InjectedBundleFileHandle::InjectedBundleFileHandle(File& file)
    : m_file(file)
{
}

InjectedBundleFileHandle::~InjectedBundleFileHandle()
{
    domFileHandleCache().remove(m_file.ptr());
}

File* InjectedBundleFileHandle::coreFile()
{
    return m_file.ptr();
}

} // namespace WebKit
