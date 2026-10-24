$(function () {
    // 短冊の文字の書体。index.html で読み込む Google Fonts の CSS は文字の範囲ごとにファイルが分かれていて、
    // 使う文字の分だけ読み込まれる。Canvas への描画では読み込みが始まらないので、描く前に loadFontsFor で読む
    const FONT_FAMILY = 'Zen Kurenaido';

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

    // テキストボックスの文字を描くときの font の指定
    function fontFor(textBox) {
        return 'normal ' + textBox.fontSize + 'px ' + FONT_FAMILY + ', sans-serif';
    }

    // テキストボックスの文字に必要な書体のファイルを読み込む。読み込めないときは代替の書体で描く
    function loadFontsFor(boxes) {
        return Promise.all(boxes.map(textBox => document.fonts.load(fontFor(textBox), textBox.text || ' ')))
            .catch(error => console.warn('Webフォントを読み込めないため、代替フォントを使用します。', error));
    }

    // 書体を読み込んでから、全ボックスを描き直す
    function redraw() {
        return loadFontsFor(textBoxes).then(updateCanvas);
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

    // 改行ごとに、高さ maxHeight で折り返した縦列に分ける(列は切り捨てず、入力文字をすべて描く)
    function wrapColumns(text, font, maxHeight) {
        return text
            .split('\n')
            .flatMap(line => wrapVerticalText(line, font, maxHeight));
    }

    function getRenderedColumns(textBox, font) {
        // text/font/heightが同じ間は再計測・再描画を省略する。
        // 書体の読み込み前(代替の書体)に描いたものを読み込み後に使い回さないよう、読み込み済みかもキーに含める
        const fontReady = document.fonts.check(font, textBox.text || ' ');
        const cacheKey = textBox.text + ' ' + font + ' ' + textBox.height + ' ' + fontReady;
        if (textBox._columnsCache && textBox._columnsCache.key === cacheKey) {
            return textBox._columnsCache.textObjs;
        }

        // 折り返しはボックス自身の高さのみで決める（表示位置による揺れを避ける）
        const textObjs = wrapColumns(textBox.text, font, Math.max(1, textBox.height))
            .map(text => createVerticalTextCanvas(text, font));
        textBox._columnsCache = { key: cacheKey, textObjs };
        return textObjs;
    }

    function resizeTextBoxToText(textBox) {
        // 追加直後だけ、入力内容と画像の描画可能領域から枠を自動サイズ化する
        const font = fontFor(textBox);
        const lines = textBox.text.split('\n').map(text => text || ' ');
        const sizes = lines.map(text => measureVerticalTextCanvasSize(text, font));
        const lineSpacing = textBox.fontSize * textBox.lineHeight;
        const image = $baseImage[0];
        const maxWidth = Math.max(30, (image.naturalWidth || Infinity) - textBox.x);
        const maxHeight = Math.max(30, (image.naturalHeight || Infinity) - textBox.y);
        const contentHeight = Math.max(30, ...sizes.map(size => size.height));

        textBox.height = Math.min(maxHeight, contentHeight);
        const columns = wrapColumns(textBox.text, font, textBox.height);

        textBox.width = Math.min(
            maxWidth,
            Math.max(30, columns.length * lineSpacing)
        );

        textBox.x = Math.max(0, (image.naturalWidth - textBox.width) / 2);
    }

    // 書体を読み込んでから、枠を文字に合わせて描き直す(追加直後のボックス)
    function fitAndRedraw(textBox) {
        return loadFontsFor(textBoxes).then(() => {
            resizeTextBoxToText(textBox);
            updateCanvas();
        });
    }

    function drawText(ctx) {
        // プレビューとダウンロードで共通利用する文字描画処理
        textBoxes.forEach(textBox => {
            const font = fontFor(textBox);

            // 枠外の文字は状態として保持したまま、描画時だけ非表示にする
            ctx.save();
            ctx.beginPath();
            ctx.rect(textBox.x, textBox.y, textBox.width, textBox.height);
            ctx.clip();

            getRenderedColumns(textBox, font).forEach(function (textObj, index) {
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

    function syncSheetControls(textBox) {
        // 設定パネルのスライダーと数値表示を選択中ボックスの値に合わせる
        $('#sheetFontSizeSlider').val(textBox.fontSize);
        $('#sheetFontSizeValue').text(textBox.fontSize);
        $('#sheetLineHeightSlider').val(textBox.lineHeight);
        $('#sheetLineHeightValue').text(textBox.lineHeight);
    }

    function selectTextBox(textBox) {
        activeTextBoxId = textBox.id;
        syncSheetControls(textBox);
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

        interact(textBox.element[0]).unset();
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

    // スライダーで、選択中ボックスのフォントサイズ・行間を変える
    function bindSlider(sliderSelector, valueSelector, property, parse) {
        $(sliderSelector).on('input', function () {
            const activeTextBox = getTextBox(activeTextBoxId);
            if (!activeTextBox) {
                return;
            }

            activeTextBox[property] = parse(this.value);
            redraw();
            $(valueSelector).text(this.value);
        });
    }
    bindSlider('#sheetFontSizeSlider', '#sheetFontSizeValue', 'fontSize', value => parseInt(value, 10));
    bindSlider('#sheetLineHeightSlider', '#sheetLineHeightValue', 'lineHeight', parseFloat);

    // Escで、開いているメニュー・確認を閉じる
    $(document).on('keydown', event => {
        if (event.key === 'Escape') {
            $deleteConfirm.hide();
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
            fitAndRedraw(newTextBox);
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
            fitAndRedraw(activeTextBox);
            return;
        }

        redraw();
    });

    // 削除は確認モーダルで確定してから実行する
    $('#deleteBtn').on('click', () => {
        if (getTextBox(activeTextBoxId)) {
            $deleteConfirm.css('display', 'flex');
        }
    });

    $('#confirmDelete').on('click', () => {
        const activeTextBox = getTextBox(activeTextBoxId);
        $deleteConfirm.hide();
        if (activeTextBox && removeTextBox(activeTextBox.id)) {
            updateCanvas();
        }
    });

    $('#cancelDelete').on('click', () => $deleteConfirm.hide());

    // 背景画像と全テキストボックスを合成してPNGとして出力する
    $('#downloadBtn').on('click', async function () {
        const img = $baseImage[0];
        if (!img.complete || !img.naturalWidth || !img.naturalHeight) {
            return;
        }

        // 書体の読み込みが終わる前に押されても、プレビューと同じ書体で書き出す
        await loadFontsFor(textBoxes);
        const canvas = document.createElement('canvas');
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
