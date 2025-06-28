$(async function () {
    const exampleFontFamilyName = "Zen Kurenaido";
    const urlFamilyName = exampleFontFamilyName.replace(/ /g, "+"); // URLでは空白を+に置き換える
    const googleApiUrl = `https://fonts.googleapis.com/css?family=${urlFamilyName}`; // Google Fonts APIのURL

    const response = await fetch(googleApiUrl);
    if (response.ok) {
        // url()の中身のURLだけ抽出
        const cssFontFace = await response.text();
        const matchUrls = cssFontFace.match(/url\(.+?\)/g);
        if (!matchUrls) throw new Error("フォントが見つかりませんでした");

        for (const url of matchUrls) {
            // 後は普通にFontFaceを追加
            const font = new FontFace(exampleFontFamilyName, url);
            await font.load();
            document.fonts.add(font);
        }
    }

    const $modal = $('#modal');
    const $textCanvas = $('#textCanvas');
    const $baseImage = $('#baseImage');

    let inputText = "";
    let fontSize = 36;
    let lineHeight = 1.5;
    let offsetX = 0;
    let offsetY = 0;

    function updateCanvas() {
        const canvas = $textCanvas[0];
        const img = $baseImage[0];
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const textAry = inputText.split('\n');
        textAry.forEach(function (text, index) {
            const textObj = createVerticalTextCanvas(text == '' ? ' ' : text, 'normal ' + fontSize + 'px Zen Kurenaido, sans-serif');
            const lineOffset = fontSize * lineHeight * index;
            ctx.drawImage(textObj, canvas.width / 2 + offsetX - lineOffset, canvas.height * 0.15 + offsetY)
        });
    }

    $('#settingsBtn').on('click', () => $modal.show());

    $('#applyText').on('click', () => {
        inputText = $('#textInput').val();
        $modal.hide();
        // Webフォントの読み込みを待ってから描画
        document.fonts.ready.then(() => {
            updateCanvas();
        });
    });

    $('#fontSizeSlider').on('input', function () {
        fontSize = parseInt(this.value);
        // Webフォントの読み込みを待ってから描画
        document.fonts.ready.then(() => {
            updateCanvas();
        });
    });

    $('#lineHeightSlider').on('input', function () {
        lineHeight = parseFloat(this.value);
        // Webフォントの読み込みを待ってから描画
        document.fonts.ready.then(() => {
            updateCanvas();
        });
    });

    $('#downloadBtn').on('click', function () {
        const canvas = document.createElement('canvas');
        const img = $baseImage[0];
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const textAry = inputText.split('\n');
        textAry.forEach(function (text, index) {
            const textObj = createVerticalTextCanvas(text == '' ? ' ' : text, 'normal ' + fontSize + 'px Zen Kurenaido, sans-serif');
            const lineOffset = fontSize * lineHeight * index;
            ctx.drawImage(textObj, canvas.width / 2 + offsetX - lineOffset, canvas.height * 0.15 + offsetY)
        });

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

    $modal.show();

    // ドラッグ機能
    interact('#textCanvas').draggable({
        listeners: {
            move(event) {

                offsetX = offsetX + event.dx;
                offsetY = offsetY + event.dy;

                updateCanvas();
            }
        }
    });
});