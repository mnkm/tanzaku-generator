$(function () {
    // モーダル初期表示
    $('#modalOverlay').show();

    // モーダル反映ボタン
    $('#applyText').click(function () {
        const inputText = $('#textInput').val().replace(/\n/g, '\n');
        $('#textLayer').text(inputText).attr('contenteditable', false);
        $('#modalOverlay').hide();
    });

    // スライダー連動
    $('#fontSizeSlider').on('input', function () {
        const size = $(this).val();
        $('#textLayer').css({
            'font-size': size + 'px',
            'letter-spacing': size * 0.1 + 'px'
        });
    });

    $('#lineHeightSlider').on('input', function () {
        const height = $(this).val();
        $('#textLayer').css('line-height', height);
    });

    // ドラッグ機能
    let isDragging = false;
    let offset = { x: 0, y: 0 };

    $('#textLayer').on('mousedown touchstart', function (e) {
        isDragging = true;
        const ev = e.type === 'touchstart' ? e.touches[0] : e;
        const pos = $(this).position();
        offset.x = ev.pageX - pos.left;
        offset.y = ev.pageY - pos.top;
    });

    $(document).on('mousemove touchmove', function (e) {
        if (isDragging) {
            const ev = e.type === 'touchmove' ? e.touches[0] : e;
            $('#textLayer').css({
                left: ev.pageX - offset.x,
                top: ev.pageY - offset.y
            });
        }
    }).on('mouseup touchend', function () {
        isDragging = false;
    });

    // 設定ボタンで再表示
    $('#settingsBtn').click(() => {
        $('#modalOverlay').show();
    });

    // ダウンロード処理
    $('#downloadBtn').click(function () {
        html2canvas($('.image-container')[0], {useCORS: true}).then(canvas => {
            const link = document.createElement('a');
            link.download = 'tanzaku.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    });

    function updateTextLayerSize() {
        const $img = $('#bgImage');
        const $textLayer = $('#textLayer');

        const imgWidth = $img.width();
        const imgHeight = $img.height();

        // テキストレイヤーを画像に合わせる
        $textLayer.css({
            width: imgWidth + 'px',
            height: imgHeight + 'px',
            maxWidth: imgWidth + 'px',
            maxHeight: imgHeight + 'px',
        });
    }

    // ページロード & リサイズ時に実行
    $(window).on('load resize', updateTextLayerSize);
    $('#bgImage').on('load', updateTextLayerSize);

});
