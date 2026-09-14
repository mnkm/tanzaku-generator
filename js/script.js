$(async function () {
    // Canvas描画用フォントを読み込み、失敗時はCSSの代替フォントを使う
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

        const $deleteConfirm = $('#deleteConfirm');
        const $bottomSheet = $('#bottomSheet');
        const $textCanvas = $('#textCanvas');
        const $baseImage = $('#baseImage');
        const $textBoxes = $('#textBoxes');

        // textBoxesが描画データ、DOM要素が操作用の枠を担当する
        let nextTextBoxId = 1;
        let activeTextBoxId = null;
        let pendingTextBoxId = null;
        const textBoxes = [];

        function getTextBox(id) {
            return textBoxes.find(textBox => textBox.id === id);
        }

        function getCanvasScale() {
            // 表示Canvasの座標を、自然サイズのCanvas座標へ変換する倍率
            const canvas = $textCanvas[0];
            const rect = canvas.getBoundingClientRect();
            return {
                x: canvas.width / Math.max(1, rect.width),
                y: canvas.height / Math.max(1, rect.height)
            };
        }

        function syncTextBox(textBox) {
            // レスポンシブ表示後も、自然サイズの座標を枠のCSS座標へ変換する
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
            // 文字ごとの高さを計測し、描画可能な高さを超えたら次の縦列へ送る
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
            const image = $baseImage[0];
            const availableHeight = Math.max(1, Math.min(
                textBox.height,
                image.naturalHeight - textBox.y
            ));
            const columns = textBox.text
                .split('\n')
                .flatMap(text => wrapVerticalText(text, font, availableHeight));
            // 列を切り捨てず、入力文字をすべて描画する
            return columns;
        }

        function resizeTextBoxToText(textBox) {
            // 追加直後だけ、入力内容と画像の描画可能領域から枠を自動サイズ化する
            const font = 'normal ' + textBox.fontSize + 'px Zen Kurenaido, sans-serif';
            const lines = textBox.text.split('\n').map(text => text || ' ');
            const sizes = lines.map(text => measureVerticalTextCanvasSize(text, font));
            const lineSpacing = textBox.fontSize * textBox.lineHeight;
            const image = $baseImage[0];
            const maxWidth = Math.max(30, (image.naturalWidth || Infinity) - textBox.x);
            const maxHeight = Math.max(30, (image.naturalHeight || Infinity) - textBox.y);
            const contentHeight = Math.max(30, ...sizes.map(size => size.height));

            textBox.height = Math.min(maxHeight, contentHeight);
            const columns = textBox.text
                .split('\n')
                .flatMap(text => wrapVerticalText(text, font, textBox.height));

            textBox.width = Math.min(
                maxWidth,
                Math.max(30, columns.length * lineSpacing)
            );

            textBox.x = Math.max(0, (image.naturalWidth - textBox.width) / 2);
        }

        function drawText(ctx) {
            // プレビューとダウンロードで共通利用する文字描画処理
            textBoxes.forEach(textBox => {
                const font = 'normal ' + textBox.fontSize + 'px Zen Kurenaido, sans-serif';

                // 枠外の文字は状態として保持したまま、描画時だけ非表示にする
                ctx.save();
                ctx.beginPath();
                ctx.rect(textBox.x, textBox.y, textBox.width, textBox.height);
                ctx.clip();

                getWrappedColumns(textBox, font).forEach(function (text, index) {
                    const textObj = createVerticalTextCanvas(text, font);
                    const lineOffset = textBox.fontSize * textBox.lineHeight * index;
                    ctx.drawImage(
                        textObj,
                        textBox.x + textBox.width - textObj.width - lineOffset,
                        textBox.y
                    );
                });

                ctx.restore();
            });
        }

        function updateCanvas() {
            // 背景画像の自然サイズでCanvasを再生成して全ボックスを描画する
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
            // 枠ごとに移動・リサイズ操作を登録する
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
            // 新規ボックスの状態と操作用DOMを同時に作成する
            const initialWidth = 200;
            const imageWidth = $baseImage[0].naturalWidth;
            const textBox = {
                id: nextTextBoxId++,
                text: '',
                x: imageWidth ? Math.max(0, (imageWidth - initialWidth) / 2) : 90,
                y: 130,
                width: initialWidth,
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

        function openBottomSheet() {
            const activeTextBox = getTextBox(activeTextBoxId);
            $('#textInput').val(activeTextBox?.text ?? '');
            $bottomSheet.addClass('is-open').attr('aria-hidden', 'false');
            $('#textInput').trigger('focus');
        }

        function closeBottomSheet() {
            const pendingTextBox = getTextBox(pendingTextBoxId);
            if (pendingTextBox && !$('#textInput').val().trim()) {
                removeTextBox(pendingTextBox.id);
                updateCanvas();
            }

            $bottomSheet.removeClass('is-open').attr('aria-hidden', 'true');
        }

        function removeTextBox(id) {
            // 状態配列と画面上の操作枠を同時に削除する
            const index = textBoxes.findIndex(textBox => textBox.id === id);
            const textBox = getTextBox(id);
            if (index === -1 || !textBox) {
                return false;
            }

            textBox.element.remove();
            textBoxes.splice(index, 1);
            const nextTextBox = textBoxes[index - 1] ?? textBoxes[0] ?? null;
            activeTextBoxId = nextTextBox?.id ?? null;
            pendingTextBoxId = null;
            if (nextTextBox) {
                selectTextBox(nextTextBox);
            }

            return true;
        }

        // 設定アイコンから下部メニューを開く
        $('#settingsBtn').on('click', () => {
            if (!textBoxes.length) {
                return;
            }

            openBottomSheet();
        });

        $('#closeSheet, [data-close-sheet]').on('click', closeBottomSheet);

        $('#sheetFontSizeSlider').on('input', function () {
            const activeTextBox = getTextBox(activeTextBoxId);
            if (!activeTextBox) {
                return;
            }

            activeTextBox.fontSize = parseInt(this.value);
            document.fonts.ready.then(updateCanvas);
            $('#sheetFontSizeValue').text(this.value);
        });

        $('#sheetLineHeightSlider').on('input', function () {
            const activeTextBox = getTextBox(activeTextBoxId);
            if (!activeTextBox) {
                return;
            }

            activeTextBox.lineHeight = parseFloat(this.value);
            document.fonts.ready.then(updateCanvas);
            $('#sheetLineHeightValue').text(this.value);
        });

        $(document).on('keydown', event => {
            if (event.key === 'Escape') {
                closeBottomSheet();
            }
        });

        // 空欄のまま反映された新規ボックスは後で取り除く
        $('#addBtn').on('click', () => {
            const textBox = createTextBox();
            pendingTextBoxId = textBox.id;
            openBottomSheet();
            updateCanvas();
        });

        $('#applyText').on('click', () => {
            const activeTextBox = getTextBox(activeTextBoxId);
            const text = $('#textInput').val();

            if (!activeTextBox) {
                if (!text.trim()) {
                    closeBottomSheet();
                    return;
                }

                const newTextBox = createTextBox();
                newTextBox.text = text;
                document.fonts.ready.then(() => {
                    resizeTextBoxToText(newTextBox);
                    updateCanvas();
                });
                closeBottomSheet();
                return;
            }

            if (!text.trim()) {
                removeTextBox(activeTextBox.id);
                closeBottomSheet();
                updateCanvas();
                return;
            }

            activeTextBox.text = text;
            const isPendingTextBox = pendingTextBoxId === activeTextBox.id;
            pendingTextBoxId = null;
            closeBottomSheet();

            if (isPendingTextBox) {
                document.fonts.ready.then(() => {
                    resizeTextBoxToText(activeTextBox);
                    updateCanvas();
                });
                return;
            }

            document.fonts.ready.then(updateCanvas);
        });

        // 削除は確認モーダルで確定してから実行する
        $('#deleteBtn').on('click', () => {
            if (getTextBox(activeTextBoxId)) {
                $deleteConfirm.css('display', 'flex');
            }
        });

        $('#confirmDelete').on('click', () => {
            const activeTextBox = getTextBox(activeTextBoxId);
            if (!activeTextBox || !removeTextBox(activeTextBox.id)) {
                $deleteConfirm.hide();
                return;
            }

            $deleteConfirm.hide();
            updateCanvas();
        });

        $('#cancelDelete').on('click', () => $deleteConfirm.hide());

        // 背景画像と全テキストボックスを合成してPNGとして出力する
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

        // 画像の読み込み後に自然サイズと表示サイズを初期化する
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

        // 初期表示時は追加ボタンと同じ処理でメニューを開く
        $('#addBtn').trigger('click');
});