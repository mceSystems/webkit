/*
 * Copyright (C) 2017 Apple Inc. All rights reserved.
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

WI.CanvasContentView = class CanvasContentView extends WI.ContentView
{
    constructor(representedObject)
    {
        console.assert(representedObject instanceof WI.Canvas);

        super(representedObject);

        this.element.classList.add("canvas");

        this._progressView = null;
        this._previewContainerElement = null;
        this._previewImageElement = null;
        this._errorElement = null;
        this._memoryCostElement = null;
        this._pendingContent = null;
        this._pixelSize = null;
        this._pixelSizeElement = null;
        this._canvasNode = null;

        if (this.representedObject.contextType === WI.Canvas.ContextType.Canvas2D || this.representedObject.contextType === WI.Canvas.ContextType.BitmapRenderer || this.representedObject.contextType === WI.Canvas.ContextType.WebGL) {
            const toolTip = WI.UIString("Start recording canvas actions.\nShift-click to record a single frame.");
            const altToolTip = WI.UIString("Stop recording canvas actions");
            this._recordButtonNavigationItem = new WI.ToggleButtonNavigationItem("record-start-stop", toolTip, altToolTip, "Images/Record.svg", "Images/Stop.svg", 13, 13);
            this._recordButtonNavigationItem.visibilityPriority = WI.NavigationItem.VisibilityPriority.High;
            this._recordButtonNavigationItem.addEventListener(WI.ButtonNavigationItem.Event.Clicked, this._toggleRecording, this);
        }

        this._canvasElementButtonNavigationItem = new WI.ButtonNavigationItem("canvas-element", WI.UIString("Canvas Element"), "Images/Markup.svg", 16, 16);
        this._canvasElementButtonNavigationItem.visibilityPriority = WI.NavigationItem.VisibilityPriority.Low;
        this._canvasElementButtonNavigationItem.addEventListener(WI.ButtonNavigationItem.Event.Clicked, this._canvasElementButtonClicked, this);

        this._refreshButtonNavigationItem = new WI.ButtonNavigationItem("refresh", WI.UIString("Refresh"), "Images/ReloadFull.svg", 13, 13);
        this._refreshButtonNavigationItem.visibilityPriority = WI.NavigationItem.VisibilityPriority.Low;
        this._refreshButtonNavigationItem.addEventListener(WI.ButtonNavigationItem.Event.Clicked, this.refresh, this);

        this._showGridButtonNavigationItem = new WI.ActivateButtonNavigationItem("show-grid", WI.UIString("Show Grid"), WI.UIString("Hide Grid"), "Images/NavigationItemCheckers.svg", 13, 13);
        this._showGridButtonNavigationItem.addEventListener(WI.ButtonNavigationItem.Event.Clicked, this._showGridButtonClicked, this);
        this._showGridButtonNavigationItem.visibilityPriority = WI.NavigationItem.VisibilityPriority.Low;
        this._showGridButtonNavigationItem.activated = !!WI.settings.showImageGrid.value;
    }

    // Public

    get navigationItems()
    {
        // The toggle recording NavigationItem isn't added to the ContentBrowser's NavigationBar.
        // It's added to the "quick access" NavigationBar shown when hovering the canvas in the overview.
        return [this._refreshButtonNavigationItem, this._showGridButtonNavigationItem];
    }

    refresh()
    {
        this._pendingContent = null;

        this.representedObject.requestContent().then((content) => {
            this._pendingContent = content;
            if (!this._pendingContent) {
                this._showError();
                return;
            }

            this.needsLayout();
        });
    }

    // Protected

    initialLayout()
    {
        super.initialLayout();

        let header = this.element.appendChild(document.createElement("header"));
        header.addEventListener("click", (event) => { event.stopPropagation(); });

        let titles = header.appendChild(document.createElement("div"));
        titles.className = "titles";

        let title = titles.appendChild(document.createElement("span"));
        title.className = "title";
        title.textContent = this.representedObject.displayName;

        let subtitle = titles.appendChild(document.createElement("span"));
        subtitle.className = "subtitle";
        subtitle.textContent = WI.Canvas.displayNameForContextType(this.representedObject.contextType);

        let navigationBar = new WI.NavigationBar;
        if (this._recordButtonNavigationItem)
            navigationBar.addNavigationItem(this._recordButtonNavigationItem);
        navigationBar.addNavigationItem(this._canvasElementButtonNavigationItem);
        navigationBar.addNavigationItem(this._refreshButtonNavigationItem);

        header.append(navigationBar.element);

        this._previewContainerElement = this.element.appendChild(document.createElement("div"));
        this._previewContainerElement.className = "preview";

        let footer = this.element.appendChild(document.createElement("footer"));
        footer.addEventListener("click", (event) => { event.stopPropagation(); });

        this._viewRelatedItemsContainer = footer.appendChild(document.createElement("div"));
        this._viewRelatedItemsContainer.classList.add("view-related-items");

        this._viewShaderButton = document.createElement("img");
        this._viewShaderButton.classList.add("view-shader");
        this._viewShaderButton.title = WI.UIString("View Shader");
        this._viewShaderButton.addEventListener("click", this._handleViewShaderButtonClicked.bind(this));

        this._viewRecordingButton = document.createElement("img");
        this._viewRecordingButton.classList.add("view-recording");
        this._viewRecordingButton.title = WI.UIString("View Recording");
        this._viewRecordingButton.addEventListener("click", this._handleViewRecordingButtonClicked.bind(this));

        this._updateViewRelatedItems();

        let flexibleSpaceElement = footer.appendChild(document.createElement("div"));
        flexibleSpaceElement.className = "flexible-space";

        let metrics = footer.appendChild(document.createElement("div"));
        this._pixelSizeElement = metrics.appendChild(document.createElement("span"));
        this._pixelSizeElement.className = "pixel-size";
        this._memoryCostElement = metrics.appendChild(document.createElement("span"));
        this._memoryCostElement.className = "memory-cost";

        if (this._errorElement)
            this._showError();
    }

    layout()
    {
        super.layout();

        if (!this._pendingContent)
            return;

        if (this._errorElement) {
            this._errorElement.remove();
            this._errorElement = null;
        }

        if (!this._previewImageElement) {
            this._previewImageElement = document.createElement("img");
            this._previewImageElement.addEventListener("error", this._showError.bind(this));
        }

        this._previewImageElement.src = this._pendingContent;
        this._pendingContent = null;

        if (!this._previewImageElement.parentNode)
            this._previewContainerElement.appendChild(this._previewImageElement);

        this._updateImageGrid();

        this._refreshPixelSize();
        this._updateMemoryCost();
    }

    shown()
    {
        super.shown();

        this.refresh();

        this._updateRecordNavigationItem();
        this._updateProgressView();
    }

    attached()
    {
        super.attached();

        this.representedObject.addEventListener(WI.Canvas.Event.MemoryChanged, this._updateMemoryCost, this);

        this.representedObject.requestNode().then((node) => {
            console.assert(!this._canvasNode || this._canvasNode === node);
            if (this._canvasNode === node)
                return;

            this._canvasNode = node;
            this._canvasNode.addEventListener(WI.DOMNode.Event.AttributeModified, this._refreshPixelSize, this);
            this._canvasNode.addEventListener(WI.DOMNode.Event.AttributeRemoved, this._refreshPixelSize, this);
        });

        WI.canvasManager.addEventListener(WI.CanvasManager.Event.RecordingStarted, this._recordingStarted, this);
        WI.canvasManager.addEventListener(WI.CanvasManager.Event.RecordingProgress, this._recordingProgress, this);
        WI.canvasManager.addEventListener(WI.CanvasManager.Event.RecordingStopped, this._recordingStopped, this);
        WI.canvasManager.addEventListener(WI.CanvasManager.Event.ShaderProgramAdded, this._shaderProgramAdded, this);
        WI.canvasManager.addEventListener(WI.CanvasManager.Event.ShaderProgramRemoved, this._shaderProgramRemoved, this);

        WI.settings.showImageGrid.addEventListener(WI.Setting.Event.Changed, this._updateImageGrid, this);
    }

    detached()
    {
        this.representedObject.removeEventListener(null, null, this);

        if (this._canvasNode) {
            this._canvasNode.removeEventListener(null, null, this);
            this._canvasNode = null;
        }

        WI.canvasManager.removeEventListener(null, null, this);
        WI.settings.showImageGrid.removeEventListener(null, null, this);

        super.detached();
    }

    // Private

    _showError()
    {
        if (this._previewImageElement)
            this._previewImageElement.remove();

        if (!this._errorElement) {
            const isError = true;
            this._errorElement = WI.createMessageTextView(WI.UIString("No Preview Available"), isError);
        }

        if (this._previewContainerElement)
            this._previewContainerElement.appendChild(this._errorElement);
    }

    _toggleRecording(event)
    {
        if (this.representedObject.isRecording)
            WI.canvasManager.stopRecording();
        else if (!WI.canvasManager.recordingCanvas) {
            let singleFrame = event.data.nativeEvent.shiftKey;
            WI.canvasManager.startRecording(this.representedObject, singleFrame);
        }
    }

    _recordingStarted(event)
    {
        this._updateRecordNavigationItem();
        this._updateProgressView();
    }

    _recordingProgress(event)
    {
        let {canvas, frameCount, bufferUsed} = event.data;
        if (canvas !== this.representedObject)
            return;

        this._updateProgressView(frameCount, bufferUsed);
    }

    _recordingStopped(event)
    {
        this._updateRecordNavigationItem();

        let {canvas} = event.data;
        if (canvas !== this.representedObject)
            return;

        this._updateProgressView();

        this._updateViewRelatedItems();
    }

    _shaderProgramAdded(event)
    {
        let {shaderProgram} = event.data;
        if (!shaderProgram || shaderProgram.canvas !== this.representedObject)
            return;

        this._updateViewRelatedItems();
    }

    _shaderProgramRemoved(event)
    {
        let {shaderProgram} = event.data;
        if (!shaderProgram || shaderProgram.canvas !== this.representedObject)
            return;

        this._updateViewRelatedItems();
    }

    _refreshPixelSize()
    {
        this._pixelSize = null;

        this.representedObject.requestSize().then((size) => {
            this._pixelSize = size;
            this._updatePixelSize();
        }).catch((error) => {
            this._updatePixelSize();
        });
    }

    _canvasElementButtonClicked(event)
    {
        let contextMenu = WI.ContextMenu.createFromEvent(event.data.nativeEvent);

        if (this._canvasNode)
            WI.appendContextMenuItemsForDOMNode(contextMenu, this._canvasNode);

        contextMenu.appendSeparator();

        contextMenu.appendItem(WI.UIString("Log Canvas Context"), () => {
            WI.RemoteObject.resolveCanvasContext(this.representedObject, WI.RuntimeManager.ConsoleObjectGroup, (remoteObject) => {
                if (!remoteObject)
                    return;

                const text = WI.UIString("Selected Canvas Context");
                const addSpecialUserLogClass = true;
                WI.consoleLogViewController.appendImmediateExecutionWithResult(text, remoteObject, addSpecialUserLogClass);
            });
        });

        contextMenu.show();
    }

    _showGridButtonClicked()
    {
        WI.settings.showImageGrid.value = !this._showGridButtonNavigationItem.activated;
    }

    _updateImageGrid()
    {
        let activated = WI.settings.showImageGrid.value;
        this._showGridButtonNavigationItem.activated = activated;

        if (this._previewImageElement)
            this._previewImageElement.classList.toggle("show-grid", activated);
    }

    _updateMemoryCost()
    {
        if (!this._memoryCostElement)
            return;

        let memoryCost = this.representedObject.memoryCost;
        if (isNaN(memoryCost))
            this._memoryCostElement.textContent = emDash;
        else {
            const higherResolution = false;
            let bytesString = Number.bytesToString(memoryCost, higherResolution);
            this._memoryCostElement.textContent = `(${bytesString})`;
        }
    }

    _updatePixelSize()
    {
        if (!this._pixelSizeElement)
            return;

        if (this._pixelSize)
            this._pixelSizeElement.textContent = `${this._pixelSize.width} ${multiplicationSign} ${this._pixelSize.height}`;
        else
            this._pixelSizeElement.textContent = emDash;
    }

    _updateRecordNavigationItem()
    {
        if (!this._recordButtonNavigationItem)
            return;

        let isRecording = this.representedObject.isRecording;
        this._recordButtonNavigationItem.enabled = isRecording || !WI.canvasManager.recordingCanvas;
        this._recordButtonNavigationItem.toggled = isRecording;

        this._refreshButtonNavigationItem.enabled = !isRecording;

        this.element.classList.toggle("is-recording", isRecording);
    }

    _updateProgressView(frameCount, bufferUsed)
    {
        if (!this.representedObject.isRecording) {
            if (this._progressView && this._progressView.parentView) {
                this.removeSubview(this._progressView);
                this._progressView = null;
            }
            return;
        }

        if (!this._progressView) {
            this._progressView = new WI.ProgressView;
            this.element.insertBefore(this._progressView.element, this._previewContainerElement);
            this.addSubview(this._progressView);
        }

        let title;
        if (frameCount) {
            let formatString = frameCount === 1 ? WI.UIString("%d Frame") : WI.UIString("%d Frames");
            title = formatString.format(frameCount);
        } else
            title = WI.UIString("Waiting for frames…");

        this._progressView.title = title;
        this._progressView.subtitle = bufferUsed ? Number.bytesToString(bufferUsed) : "";
    }

    _updateViewRelatedItems()
    {
        this._viewRelatedItemsContainer.removeChildren();

        if (this.representedObject.shaderProgramCollection.size)
            this._viewRelatedItemsContainer.appendChild(this._viewShaderButton);

        if (this.representedObject.recordingCollection.size)
            this._viewRelatedItemsContainer.appendChild(this._viewRecordingButton);
    }

    _handleViewShaderButtonClicked(event)
    {
        let shaderPrograms = this.representedObject.shaderProgramCollection;
        console.assert(shaderPrograms.size);
        if (!shaderPrograms.size)
            return;

        if (shaderPrograms.size === 1) {
            WI.showRepresentedObject(Array.from(shaderPrograms)[0]);
            return;
        }

        let contextMenu = WI.ContextMenu.createFromEvent(event);

        for (let shaderProgram of shaderPrograms) {
            contextMenu.appendItem(shaderProgram.displayName, (event) => {
                WI.showRepresentedObject(shaderProgram);
            });
        }

        contextMenu.show();
    }

    _handleViewRecordingButtonClicked(event)
    {
        let recordings = this.representedObject.recordingCollection;
        console.assert(recordings.size);
        if (!recordings.size)
            return;

        if (recordings.size === 1) {
            WI.showRepresentedObject(Array.from(recordings)[0]);
            return;
        }

        let contextMenu = WI.ContextMenu.createFromEvent(event);

        for (let recording of recordings) {
            contextMenu.appendItem(recording.displayName, (event) => {
                WI.showRepresentedObject(recording);
            });
        }

        contextMenu.show();
    }
};
