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

#pragma once

#if USE(VIDEOTOOLBOX)

#include "IntSize.h"
#include <wtf/RetainPtr.h>

typedef struct OpaqueVTPixelTransferSession* VTPixelTransferSessionRef;
typedef struct __CVBuffer *CVPixelBufferRef;
typedef struct __CVPixelBufferPool *CVPixelBufferPoolRef;
typedef struct opaqueCMSampleBuffer *CMSampleBufferRef;

namespace WebCore {

class PixelBufferResizer {
public:
    PixelBufferResizer(IntSize, OSType);

    RetainPtr<CVPixelBufferRef> resize(CVPixelBufferRef);
    RetainPtr<CMSampleBufferRef> resize(CMSampleBufferRef);
    bool canResizeTo(IntSize size) { return size == m_size; }

private:
    RetainPtr<VTPixelTransferSessionRef> m_transferSession;
    RetainPtr<CVPixelBufferPoolRef> m_bufferPool;
    IntSize m_size;
};

}

#endif // USE(VIDEOTOOLBOX)
