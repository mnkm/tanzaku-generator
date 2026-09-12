$(async function () {
    const fontFamily = "Zen Kurenaido";
    const urlFamilyName = fontFamily.replace(/ /g, "+"); // URLでは空白を+に置き換える
        const googleApiUrl = `https://fonts.googleapis.com/css?family=${urlFamilyName}`;

        try {
            const response = await fetch(googleApiUrl);
            if (response.ok) {
                const cssFontFace = await response.text();
                const matchUrls = cssFontFace.match(/url\(.+?\)/g);
                if (!matchUrls) throw new Error("フォントが見つかりませんでした");

                for (const url of matchUrls) {
                    const font = new FontFace(fontFamily, url);
                    await font.load();
                    document.fonts.add(font);
                }
            }
        } catch (error) {
            console.warn('Webフォントを読み込めないため、代替フォントを使用します。', error);
        }

        const $modal = $('#modal');
        const $deleteConfirm = $('#deleteConfirm');
        const $textCanvas = $('#textCanvas');
        const $baseImage = $('#baseImage');
        const $textBoxes = $('#textBoxes');

        let nextTextBoxId = 1;
        let activeTextBoxId = null;
        let pendingTextBoxId = null;
        const textBoxes = [];

        function getTextBox(id) {
            return textBoxes.find(textBox => textBox.id === id);
        }

        function getCanvasScale() {
            const canvas = $textCanvas[0];
            const rect = canvas.getBoundingClientRect();
            return {
                x: canvas.width / Math.max(1, rect.width),
                y: canvas.height / Math.max(1, rect.height)
            };
        }

        function syncTextBox(textBox) {
            const canvas = $textCanvas[0];
            const rect = canvas.getBoundingClientRect();
            const areaRect = $textBoxes[0].parentElement.getBoundingClientRect();
            const scaleX = rect.width / Math.max(1, canvas.width);
            const scaleY = rect.height / Math.max(1, canvas.height);
            const $element = textBox.element;

            $element.css({
                left: (rect.left - areaRect.left + textBox.x * scaleX) + 'px',
                top: (rect.top - areaRect.top + textBox.y * scaleY) + 'px',
                width: (textBox.width * scaleX) + 'px',
                height: (textBox.height * scaleY) + 'px'
            });
            $element.toggleClass('active', textBox.id === activeTextBoxId);
        }

        function syncAllTextBoxes() {
            textBoxes.forEach(syncTextBox);
        }

        function wrapVerticalText(text, font, maxHeight) {
            const columns = [];
            let column = '';

            for (const char of (text || ' ')) {
                const candidate = column + char;
                const size = measureVerticalTextCanvasSize(candidate, font);

                if (column && size.height > maxHeight) {
                    columns.push(column);
                    column = char;
                } else {
                    column = candidate;
                }
            }

            if (column) {
                columns.push(column);
            }

            return columns;
        }

        function getWrappedColumns(textBox, font) {
            const columns = textBox.text
                .split('\n')
                .flatMap(text => wrapVerticalText(text, font, textBox.height));
            const maxColumns = Math.max(1, Math.floor(textBox.width / (textBox.fontSize * textBox.lineHeight)));
            return columns.slice(0, maxColumns);
        }

        function resizeTextBoxToText(textBox) {
            const font = 'normal ' + textBox.fontSize + 'px Zen Kurenaido, sans-serif';
            const lines = textBox.text.split('\n').map(text => text || ' ');
            const sizes = lines.map(text => measureVerticalTextCanvasSize(text, font));
            const lineSpacing = textBox.fontSize * textBox.lineHeight;
            const image = $baseImage[0];
            const maxWidth = image.naturalWidth || Infinity;
            const maxHeight = image.naturalHeight || Infinity;

            textBox.width = Math.min(
                maxWidth,
                Math.max(30, sizes.reduce((width, size) => width + size.width, 0) + lineSpacing * (sizes.length - 1))
            );
            textBox.height = Math.min(
                maxHeight,
                Math.max(30, ...sizes.map(size => size.height))
            );
        }

        function drawText(ctx) {
            textBoxes.forEach(textBox => {
                const font = 'normal ' + textBox.fontSize + 'px Zen Kurenaido, sans-serif';
                getWrappedColumns(textBox, font).forEach(function (text, index) {
                    const textObj = createVerticalTextCanvas(text, font);
                    const lineOffset = textBox.fontSize * textBox.lineHeight * index;
                    ctx.drawImage(
                        textObj,
                        textBox.x + textBox.width - textObj.width - lineOffset,
                        textBox.y
                    );
                });
            });
        }

        function updateCanvas() {
            const canvas = $textCanvas[0];
            const img = $baseImage[0];
            if (!img.naturalWidth || !img.naturalHeight) {
                return;
            }

            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawText(ctx);
            syncAllTextBoxes();
        }

        function selectTextBox(textBox) {
            activeTextBoxId = textBox.id;
            $('#fontSizeSlider').val(textBox.fontSize);
            $('#lineHeightSlider').val(textBox.lineHeight);
            syncAllTextBoxes();
        }

        function bindTextBoxInteractions(textBox) {
            const $element = textBox.element;

            $element.on('pointerdown', () => selectTextBox(textBox));

            interact($element[0])
                .draggable({
                    listeners: {
                        move(event) {
                            const scale = getCanvasScale();
                            textBox.x += event.dx * scale.x;
                            textBox.y += event.dy * scale.y;
                            syncTextBox(textBox);
                            updateCanvas();
                        }
                    }
                })
                .resizable({
                    edges: { top: true, left: true, bottom: true, right: true },
                    modifiers: [
                        interact.modifiers.restrictSize({ min: { width: 30, height: 30 } })
                    ],
                    listeners: {
                        move(event) {
                            const scale = getCanvasScale();
                            textBox.x += event.deltaRect.left * scale.x;
                            textBox.y += event.deltaRect.top * scale.y;
                            textBox.width = event.rect.width * scale.x;
                            textBox.height = event.rect.height * scale.y;
                            syncTextBox(textBox);
                            updateCanvas();
                        }
                    }
                });
        }

        function createTextBox() {
            const textBox = {
                id: nextTextBoxId++,
                text: '',
                x: 90,
                y: 130,
                width: 200,
                height: 700,
                fontSize: 36,
                lineHeight: 1.5,
                element: $('<div class="text-box" aria-label="文字の描画エリア"></div>')
            };

            textBoxes.push(textBox);
            $textBoxes.append(textBox.element);
            bindTextBoxInteractions(textBox);
            selectTextBox(textBox);
            return textBox;
        }

        function openTextModal(text) {
            $('#textInput').val(text);
            $modal.css('display', 'flex');
        }

        $('#settingsBtn').on('click', () => {
            const activeTextBox = getTextBox(activeTextBoxId);
            if (activeTextBox) {
                openTextModal(activeTextBox.text);
            }
        });

        $('#addBtn').on('click', () => {
            const textBox = createTextBox();
            pendingTextBoxId = textBox.id;
            openTextModal(textBox.text);
            updateCanvas();
        });

        $('#applyText').on('click', () => {
            const activeTextBox = getTextBox(activeTextBoxId);
            if (!activeTextBox) {
                $modal.hide();
                return;
            }

            const text = $('#textInput').val();
            if (pendingTextBoxId === activeTextBox.id && !text.trim()) {
                const index = textBoxes.findIndex(textBox => textBox.id === activeTextBox.id);
                activeTextBox.element.remove();
                textBoxes.splice(index, 1);
                activeTextBoxId = textBoxes[index - 1]?.id ?? textBoxes[0]?.id ?? null;
                pendingTextBoxId = null;
                $modal.hide();
                updateCanvas();
                return;
            }

            activeTextBox.text = text;
            const isPendingTextBox = pendingTextBoxId === activeTextBox.id;
            pendingTextBoxId = null;
            $modal.hide();

            if (isPendingTextBox) {
                document.fonts.ready.then(() => {
                    resizeTextBoxToText(activeTextBox);
                    updateCanvas();
                });
                return;
            }

            document.fonts.ready.then(updateCanvas);
        });

        $('#deleteBtn').on('click', () => {
            if (getTextBox(activeTextBoxId)) {
                $deleteConfirm.css('display', 'flex');
            }
        });

        $('#confirmDelete').on('click', () => {
            const index = textBoxes.findIndex(textBox => textBox.id === activeTextBoxId);
            const activeTextBox = getTextBox(activeTextBoxId);
            if (index === -1 || !activeTextBox) {
                $deleteConfirm.hide();
                return;
            }

            activeTextBox.element.remove();
            textBoxes.splice(index, 1);
            const nextTextBox = textBoxes[index - 1] ?? textBoxes[0] ?? null;
            activeTextBoxId = nextTextBox?.id ?? null;
            if (nextTextBox) {
                selectTextBox(nextTextBox);
            }
            if (pendingTextBoxId === activeTextBox.id) {
                pendingTextBoxId = null;
            }
            $deleteConfirm.hide();
            updateCanvas();
        });

        $('#cancelDelete').on('click', () => $deleteConfirm.hide());

        $('#fontSizeSlider').on('input', function () {
            const activeTextBox = getTextBox(activeTextBoxId);
            if (!activeTextBox) {
                return;
            }

            activeTextBox.fontSize = parseInt(this.value);
            document.fonts.ready.then(updateCanvas);
        });

        $('#lineHeightSlider').on('input', function () {
            const activeTextBox = getTextBox(activeTextBoxId);
            if (!activeTextBox) {
                return;
            }

            activeTextBox.lineHeight = parseFloat(this.value);
            document.fonts.ready.then(updateCanvas);
        });

        $('#downloadBtn').on('click', function () {
            const canvas = document.createElement('canvas');
            const img = $baseImage[0];
            if (!img.complete || !img.naturalWidth || !img.naturalHeight) {
                return;
            }

            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            drawText(ctx);

            const link = document.createElement('a');
            link.download = 'output.png';
            link.href = canvas.toDataURL();
            link.click();
        });

        $baseImage.on('load', function () {
            const img = this;
            $textCanvas
                .attr('width', img.naturalWidth)
                .attr('height', img.naturalHeight)
                .css({
                    width: '100%',
                    height: 'auto'
                });
            updateCanvas();
        });

        if ($baseImage[0].complete && $baseImage[0].naturalWidth) {
            updateCanvas();
        }

        $modal.css('display', 'flex');
});