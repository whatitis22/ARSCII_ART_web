(function () {
  // =========================
  // ① Supabase 설정
  // =========================
  const SUPABASE_URL = 'https://fsqzjyyqewhqorgabodu.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzcXpqeXlxZXdocW9yZ2Fib2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMzM0OTMsImV4cCI6MjA3NzgwOTQ5M30.hRdyF_uySB6ddpWeZ2Jc4kM35ETRxALsEnWDOjDHqPE';

  const sb =
    typeof window.supabase !== 'undefined' &&
    SUPABASE_URL &&
    SUPABASE_ANON_KEY
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      : null;

  const app = document.getElementById('app');
  const connStateEl = document.getElementById('connState');

  function setConnState(msg) {
    if (connStateEl) connStateEl.textContent = msg;
  }

  async function checkConnection() {
    if (!sb) {
      setConnState('연결 미설정');
      return;
    }
    try {
      const { error } = await sb.from('posts').select('id').limit(1);
      if (error) throw error;
      setConnState('온라인');
    } catch (e) {
      console.warn(e);
      setConnState('오프라인(읽기 전용)');
    }
  }

  // =========================
  // 클릭 사운드 (모든 버튼 공용)
  // =========================
  const clickSound = new Audio('click.mp3'); // 같은 폴더에 있는 mp3
  clickSound.preload = 'auto';

  function playClick() {
    try {
      // 같은 소리를 연속으로 낼 수 있도록 항상 처음부터 재생
      clickSound.currentTime = 0;
      clickSound.play();
    } catch (e) {
      // 일부 브라우저 정책이나 에러는 무시
      console.warn('click sound error', e);
    }
  }

  // 모든 버튼 클릭에 대해 전역으로 소리 재생
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;            // 버튼이 아니면 무시
    if (btn.disabled) return;    // 비활성화 버튼은 소리 X
    playClick();
  });



  // =========================
  // ② 설정 저장
  // =========================
  const defaultSettings = {
    width: 120,
    charset: '@#$Y!=+~- ',
    invert: false,
    aspect: 0.5,
    kindOptions: ['기타', '인물', '풍경', '동물', '텍스처', '문자아트'],
  };

  let settings =
    JSON.parse(localStorage.getItem('ascii_settings_v1') || 'null') ||
    defaultSettings;

  function saveSettings() {
    localStorage.setItem('ascii_settings_v1', JSON.stringify(settings));
  }

  // =========================
  // ③ 라우터
  // =========================
  function render() {
    const hash = location.hash.replace(/^#/, '') || '/';
    if (hash.startsWith('/post/')) {
      const id = hash.split('/')[2];
      renderPost(id);
    } else if (hash.startsWith('/list')) {
      renderList();
    } else {
      renderHome();
    }
  }

  function initRouter() {
    const navHome = document.getElementById('navHome');
    const navList = document.getElementById('navList');
    const navLogo = document.getElementById('navLogo');

    if (navHome) navHome.addEventListener('click', () => (location.hash = '#/'));
    if (navList)
      navList.addEventListener('click', () => (location.hash = '#/list'));
    if (navLogo)
      navLogo.addEventListener('click', (e) => {
        e.preventDefault();
        playClick();            // 🔊 로고(홈) 클릭 시 소리
        location.hash = '#/';
      });


    window.addEventListener('hashchange', render);
    render();
  }

  // =========================
  // ④ 유틸 함수
  // =========================
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node[k] = v;
      else node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      if (c == null) continue;
      node.appendChild(
        typeof c === 'string' ? document.createTextNode(c) : c,
      );
    }
    return node;
  }

  function copyText(text) {
    if (!navigator.clipboard) {
      const ta = el('textarea', {
        style: 'position:fixed;left:-9999px;top:-9999px',
      });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return Promise.resolve();
    }
    return navigator.clipboard.writeText(text);
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  // =========================
  // ⑤ 이미지 → ASCII
  // =========================
  async function fileToImage(file) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = URL.createObjectURL(file);
    });
  }

  function imageToAscii(img, width, charset, invert, aspect) {
    const canvas = document.getElementById('work');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const scale = img.width / width;
    const h = Math.max(1, Math.round((img.height / scale) * aspect));

    canvas.width = width;
    canvas.height = h;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, width, h);

    const { data } = ctx.getImageData(0, 0, width, h);
    const chars = [...charset];
    const n = chars.length;
    const out = [];

    for (let y = 0; y < h; y++) {
      let line = '';
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        let idx = Math.floor((lum / 256) * n);
        if (idx >= n) idx = n - 1;
        if (!invert) idx = n - 1 - idx;
        line += chars[idx];
      }
      out.push(line);
    }
    return out.join('\n');
  }

  // =========================
  // ⑥ Supabase 데이터 액세스
  // =========================
  const store = {
    async listPosts({ q = '', kind = '전체', limit = 20 } = {}) {
      if (!sb) return { data: [], error: new Error('Supabase 미설정') };
      let req = sb
        .from('posts')
        .select(
          'id,title,kind,ascii,created_at,author,width,params',
        )
        .order('created_at', { ascending: false })
        .limit(limit);
      if (kind && kind !== '전체') req = req.eq('kind', kind);
      if (q) req = req.or(`title.ilike.%${q}%,ascii.ilike.%${q}%`);
      return req;
    },

    async getPost(id) {
      if (!sb) return { data: null, error: new Error('Supabase 미설정') };
      return sb
        .from('posts')
        .select(
          'id,title,kind,ascii,created_at,author,width,params',
        )
        .eq('id', id)
        .single();
    },

    async createPost(post) {
      if (!sb) return { data: null, error: new Error('Supabase 미설정') };
      return sb.from('posts').insert([post]).select().single();
    },

    async listComments(postId) {
      if (!sb) return { data: [], error: new Error('Supabase 미설정') };
      return sb
        .from('comments')
        .select(
          'id,post_id,parent_id,text,nickname,created_at',
        )
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
    },

    async addComment(c) {
      if (!sb) return { data: null, error: new Error('Supabase 미설정') };
      return sb.from('comments').insert([c]).select().single();
    },
  };

  // =========================
  // ⑦ ASCII 자동 폰트 조정 (폭 + 높이 둘 다)
  // =========================
  function fitAsciiToWidth(preEl, text, options = {}) {
    if (!preEl) return;

    const ascii = text || '';
    preEl.textContent = ascii;

    // 컨테이너 폭/패딩 계산
    const cs = getComputedStyle(preEl);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);

    const rawW = preEl.clientWidth - padX;
    const contentW = Math.max(40, rawW);

    // 줄 정보
    const lines = ascii.split('\n');
    const L = Math.max(
      1,
      lines.reduce((m, line) => Math.max(m, line.length), 0),
    );
    const N = Math.max(1, lines.length);

    // 문자 폭 측정 (100px 기준)
    const meas = document.createElement('span');
    meas.style.position = 'absolute';
    meas.style.visibility = 'hidden';
    meas.style.whiteSpace = 'pre';
    meas.style.fontFamily = cs.fontFamily;
    meas.style.letterSpacing = cs.letterSpacing;
    meas.textContent = '0'.repeat(L || 1);
    document.body.appendChild(meas);
    meas.style.fontSize = '100px';
    const W100 = meas.getBoundingClientRect().width || 1;
    document.body.removeChild(meas);

    // 가로 기준 폰트 크기
    const fsByWidth = Math.floor(((contentW - 2) * 100) / W100);

    // 사용할 최대 높이 계산
    let maxH = options.maxHeight || 0;

    if (!maxH) {
      if (options.context === 'post') {
        // 게시글 상세: 헤더 + 타이틀 카드 높이를 제외한 나머지
        const header = document.querySelector('header');
        const headCard = document
          .getElementById('headWrap')
          ?.closest('.card');
        const topHeights =
          (header ? header.offsetHeight : 0) +
          (headCard ? headCard.offsetHeight : 0) +
          48; // 여유
        maxH = Math.max(200, window.innerHeight - topHeights);
      } else {
        // 기본: 화면 60% 정도만 사용 (생성기 미리보기 등)
        maxH = Math.max(200, Math.floor(window.innerHeight * 0.6));
      }
    }

    preEl.style.maxHeight = maxH + 'px';
    preEl.style.overflow = 'auto';
    preEl.style.width = '100%';

    const lineHeightFactor = 1.05; // .ascii line-height와 맞춤
    const fsByHeight = Math.floor(
      (maxH - padY) / (N * lineHeightFactor),
    );

    let fs = Math.min(fsByWidth, fsByHeight);
    const MIN_FS = 4;
    const MAX_FS = 26;

    if (!isFinite(fs) || fs <= 0) fs = 12;
    fs = Math.max(MIN_FS, Math.min(MAX_FS, fs));
    preEl.style.fontSize = fs + 'px';
    preEl.style.letterSpacing = cs.letterSpacing; // 기본 유지

    // 1차 미세 조정 (폭/높이 모두 만족할 때까지 줄이기)
    let guard = 60;
    while (
      guard-- > 0 &&
      (preEl.scrollWidth > preEl.clientWidth ||
        preEl.scrollHeight > preEl.clientHeight)
    ) {
      fs -= 0.5;
      if (fs <= MIN_FS) break;
      preEl.style.fontSize = fs + 'px';
    }

    // 여전히 가로가 넘치면 letter-spacing을 줄여서 한 번 더 맞춰보기
    if (preEl.scrollWidth > preEl.clientWidth) {
      preEl.style.letterSpacing = '0px';
      guard = 40;
      while (
        guard-- > 0 &&
        (preEl.scrollWidth > preEl.clientWidth ||
          preEl.scrollHeight > preEl.clientHeight)
      ) {
        fs -= 0.5;
        if (fs <= MIN_FS) break;
        preEl.style.fontSize = fs + 'px';
      }
    }
  }

  let previewResizeHandler = null;
  let postResizeHandler = null;

  // =========================
  // ⑧ 화면: 생성기
  // =========================
  function renderHome() {
    app.className = 'grid cols-2';
    app.innerHTML = '';

    // 변환기 (왼쪽)
    const left = el('section', { class: 'card' }, [
      el('h2', { style: 'margin:0 0 8px 0' }, ['이미지 → ASCII 변환기']),
      el('p', { class: 'hint' }, [
        '이미지를 올리고, 해상도/문자셋을 조정한 뒤 생성하세요.',
      ]),
      el('div', { class: 'grid' }, [
        el('div', {}, [
          el('label', {}, ['이미지 파일']),
          el('input', {
            type: 'file',
            accept: 'image/*',
            id: 'file',
          }),
        ]),
        el('div', {}, [
          el('label', {}, ['가로 문자 수 (해상도)']),
          el('input', {
            type: 'range',
            min: '40',
            max: '240',
            value: settings.width,
            id: 'rangeW',
          }),
          el('div', { class: 'hint', id: 'wHint' }, [
            `${settings.width} chars`,
          ]),
        ]),
        el('div', {}, [
          el('label', {}, ['문자셋 (어두움→밝음)']),
          el('input', {
            type: 'text',
            value: settings.charset,
            id: 'charset',
          }),
          el('div', { class: 'hint' }, [
            '예: @#$Y!=+~-␠ (끝에 공백 포함 권장)',
          ]),
        ]),
        el('div', {}, [
          el('label', {}, ['세로 압축(문자 비율)']),
          el('input', {
            type: 'range',
            min: '0.35',
            max: '1.00',
            step: '0.01',
            value: settings.aspect,
            id: 'rangeA',
          }),
          el('div', { class: 'hint', id: 'aHint' }, [
            `${settings.aspect}`,
          ]),
        ]),
        el('div', { class: 'row' }, [
          el('label', {}, [
            el('input', {
              type: 'checkbox',
              id: 'invert',
              checked: settings.invert,
            }),
            ' 밝기 반전(밝은 배경)',
          ]),
        ]),
        el('div', { class: 'row' }, [
          el('button', { class: 'btn accent', id: 'btnGen' }, [
            'ASCII 생성',
          ]),
          el('button', { class: 'btn', id: 'btnCopy', disabled: true }, [
            '복사',
          ]),
          el(
            'button',
            { class: 'btn secondary', id: 'btnDownload', disabled: true },
            ['.txt 저장'],
          ),
        ]),
      ]),
    ]);

    // 미리보기 (위쪽 메뉴 폭에 맞게, 변환기 아래)
    const previewSection = el('section', { class: 'card span-2' }, [
      el('div', {
        class: 'row',
        style: 'justify-content:space-between; align-items:center',
      }, [
        el('h2', { style: 'margin:0' }, ['미리보기']),
        el('div', { class: 'row' }, [
          el('button', {
            class: 'btn',
            id: 'btnPost',
            disabled: true,
          }, ['이걸로 게시 하기']),
        ]),
      ]),
      el('pre', { class: 'ascii', id: 'preview' }, [
        '(여기에 결과가 표시됩니다)',
      ]),
    ]);

    app.append(left, previewSection);

    const $file = left.querySelector('#file');
    const $rangeW = left.querySelector('#rangeW');
    const $rangeA = left.querySelector('#rangeA');
    const $wHint = left.querySelector('#wHint');
    const $aHint = left.querySelector('#aHint');
    const $charset = left.querySelector('#charset');
    const $invert = left.querySelector('#invert');
    const $btnGen = left.querySelector('#btnGen');
    const $btnCopy = left.querySelector('#btnCopy');
    const $btnDownload = left.querySelector('#btnDownload');
    const $btnPost = previewSection.querySelector('#btnPost');
    const $preview = previewSection.querySelector('#preview');

    let currentAscii = '';

    function refitPreview() {
      fitAsciiToWidth($preview, currentAscii, { context: 'preview' });
    }


    if (previewResizeHandler) {
      window.removeEventListener('resize', previewResizeHandler);
    }
    previewResizeHandler = () => refitPreview();
    window.addEventListener('resize', previewResizeHandler, {
      passive: true,
    });

    $rangeW.oninput = (e) => {
      $wHint.textContent = e.target.value + ' chars';
      settings.width = +e.target.value;
      saveSettings();
      if (currentAscii) refitPreview();
    };
    $rangeA.oninput = (e) => {
      $aHint.textContent = e.target.value;
      settings.aspect = +e.target.value;
      saveSettings();
    };
    $charset.onchange = () => {
      settings.charset = $charset.value;
      saveSettings();
    };
    $invert.onchange = () => {
      settings.invert = $invert.checked;
      saveSettings();
    };

    $btnGen.onclick = async () => {
      if (!$file.files[0]) {
        alert('이미지 파일을 선택하세요.');
        return;
      }
      $btnGen.disabled = true;
      $btnGen.textContent = '생성 중...';
      try {
        const img = await fileToImage($file.files[0]);
        currentAscii = imageToAscii(
          img,
          +$rangeW.value,
          $charset.value || settings.charset,
          $invert.checked,
          +$rangeA.value,
        );
        fitAsciiToWidth($preview, currentAscii);
        $btnCopy.disabled = false;
        $btnDownload.disabled = false;
        $btnPost.disabled = false;
      } catch (err) {
        console.error(err);
        alert('변환 중 오류가 발생했습니다.');
      } finally {
        $btnGen.disabled = false;
        $btnGen.textContent = 'ASCII 생성';
      }
    };

    $btnCopy.onclick = () => {
      copyText(currentAscii).then(() => {
        $btnCopy.textContent = '복사됨!';
        setTimeout(() => ($btnCopy.textContent = '복사'), 900);
      });
    };

    $btnDownload.onclick = () =>
      downloadText('ascii-art.txt', currentAscii);

    $btnPost.onclick = () => {
      if (!currentAscii) {
        alert('먼저 ASCII를 생성하세요.');
        return;
      }
      openPostDialog(currentAscii);
    };
  }

  // =========================
  // ⑨ 게시 모달
  // =========================
  function openPostDialog(ascii) {
    const modal = el('div', {
      style:
        'position:fixed;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.45);z-index:50',
    });
    const kinds = settings.kindOptions || ['기타'];

    const card = el('div', {
      class: 'card',
      style: 'max-width:640px; width:92vw',
    }, [
      el('h3', { style: 'margin-top:0' }, ['게시글 만들기']),
      el('div', { class: 'grid' }, [
        el('div', {}, [
          el('label', {}, ['제목']),
          el('input', {
            type: 'text',
            id: 't',
            placeholder: '예: 첫 ASCII 시도',
          }),
        ]),
        el('div', {}, [
          el('label', {}, ['분류(아스키 종류)']),
          (() => {
            const s = el('select', { id: 'k' });
            kinds.forEach((k) =>
              s.appendChild(el('option', { value: k }, [k])),
            );
            return s;
          })(),
        ]),
        el('div', {}, [
          el('label', {}, ['작성자(선택)']),
          el('input', {
            type: 'text',
            id: 'n',
            placeholder: '닉네임 없으면 비워두기',
          }),
        ]),
      ]),
      el('div', { class: 'divider' }),
      el('div', {
        class: 'row',
        style: 'justify-content:flex-end',
      }, [
        el('button', {
          class: 'btn ghost',
          onclick: () => modal.remove(),
        }, ['취소']),
        el('button', { class: 'btn accent', id: 'ok' }, ['게시']),
      ]),
    ]);

    modal.appendChild(card);
    document.body.appendChild(modal);

    card.querySelector('#ok').onclick = async () => {
      const title =
        card.querySelector('#t').value.trim() || '제목 없음';
      const kind = card.querySelector('#k').value;
      const author = card.querySelector('#n').value.trim();

      const post = {
        title,
        kind,
        ascii,
        author: author || null,
        width: settings.width,
        params: {
          charset: settings.charset,
          invert: settings.invert,
          aspect: settings.aspect,
        },
      };

      if (!sb) {
        alert('Supabase 미설정. 설정 후 다시 시도하세요.');
        return;
      }

      const { data, error } = await store.createPost(post);
      if (error) {
        alert('게시 실패: ' + error.message);
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row || !row.id) {
        alert('게시 실패: 응답에 ID가 없습니다.');
        return;
      }

      modal.remove();
      location.hash = '#/post/' + row.id;
    };
  }

  // =========================
  // ⑩ 화면: 목록
  // =========================
  function renderList() {
    app.className = 'grid cols-1';
    app.innerHTML = '';

    const search = el('section', { class: 'card' }, [
      el('div', { class: 'row' }, [
        el('div', { style: 'flex:1' }, [
          el('label', {}, ['검색']),
          el('input', {
            type: 'search',
            id: 'q',
            placeholder: '제목/내용',
          }),
        ]),
        el('div', {}, [
          el('label', {}, ['분류']),
          (() => {
            const s = el('select', { id: 'fk' });
            ['전체', ...settings.kindOptions].forEach((k) =>
              s.appendChild(el('option', { value: k }, [k])),
            );
            return s;
          })(),
        ]),
      ]),
      el('div', {
        class: 'row',
        style: 'justify-content:space-between; margin-top:8px',
      }, [
        el('span', { class: 'hint' }, [
          '※ 전 세계와 공유되는 멀티유저 게시판입니다. 불쾌한 콘텐츠를 신고/차단하는 기능은 이후 추가 예정.',
        ]),
      ]),
    ]);

    const list = el('section', { class: 'grid', id: 'list' });
    app.append(search, list);

    const $q = search.querySelector('#q');
    const $fk = search.querySelector('#fk');

    async function draw() {
      list.innerHTML = '';
      const q = ($q.value || '').trim();
      const filterKind = $fk.value;

      const { data, error } = await store.listPosts({
        q,
        kind: filterKind,
        limit: 40,
      });

      if (error) {
        list.appendChild(
          el('div', { class: 'empty' }, [
            '불러오기 실패: ',
            error.message,
          ]),
        );
        return;
      }
      if (!data.length) {
        list.appendChild(
          el('div', { class: 'empty' }, [
            '게시글이 없습니다. 생성기에서 게시해 보세요.',
          ]),
        );
        return;
      }

          data.forEach((p) => {
      const item = el(
        'div',
        {
          class: 'post-item',
          onclick: () => {
            // 박스를 클릭하면 소리 + 해당 게시글로 이동
            playClick();
            location.hash = '#/post/' + p.id;
          },
        },
        [
          // 좌측: 제목/메타
          el('div', { style: 'flex:1' }, [
            el(
              'div',
              {
                class: 'row',
                style:
                  'justify-content:space-between; align-items:center',
              },
              [
                el('div', {}, [
                  // 🔹 a 태그 대신 span 사용 (더 이상 개별 링크 아님)
                  el('span', { class: 'post-title' }, [p.title]),
                  ' ',
                  el('span', { class: 'badge' }, [p.kind]),
                ]),
                el('div', { class: 'hint' }, [
                  new Date(p.created_at).toLocaleString(),
                ]),
              ],
            ),
          ]),

          // 우측: 복사 버튼만 남김 (열기 버튼 삭제)
          el(
            'div',
            {
              class: 'row',
              style: 'flex-direction:column; gap:8px',
            },
            [
              el(
                'button',
                {
                  class: 'btn secondary',
                  onclick: (ev) => {
                    // 복사 눌렀을 때 박스 클릭 이벤트(이동) 막기
                    ev.stopPropagation();
                    copyText(p.ascii);
                  },
                },
                ['복사'],
              ),
            ],
          ),
        ],
      );

      list.appendChild(item);
    });

    }

    $q.oninput = debounce(draw, 250);
    $fk.onchange = draw;
    draw();
  }

  // =========================
  // ⑪ 화면: 게시글 상세
  // =========================
  async function renderPost(id) {
    app.className = 'grid cols-1';
    app.innerHTML = '';

    const head = el('section', { class: 'card' }, [
      el('div', { id: 'headWrap' }),
    ]);
    const body = el('section', { class: 'card' }, [
      el('pre', { class: 'ascii', id: 'ascii' }),
    ]);
    const commentsSec = el('section', { class: 'card' }, [
      el('h3', {}, ['댓글']),
      el('div', { id: 'comments' }),
      el('div', { class: 'divider' }),
      el('div', {}, [
        el('label', {}, ['닉네임(선택)']),
        el('input', {
          type: 'text',
          id: 'nick',
          placeholder: '비우면 익명1, 익명2...',
        }),
        el('label', { style: 'margin-top:8px' }, ['내용']),
        el('textarea', {
          id: 'cbody',
          rows: '3',
          placeholder: '칭찬과 피드백을 남겨보세요.',
        }),
        el('div', {
          class: 'row',
          style: 'justify-content:flex-end; margin-top:8px',
        }, [
          el('button', { class: 'btn accent', id: 'csubmit' }, [
            '댓글 등록',
          ]),
        ]),
      ]),
    ]);

    app.append(head, body, commentsSec);

    const { data: p, error } = await store.getPost(id);
    if (error || !p) {
      app.replaceChildren(
        el('div', { class: 'empty' }, [
          '게시글을 찾을 수 없습니다.',
        ]),
      );
      return;
    }

    const headWrap = document.getElementById('headWrap');
    const preEl = document.getElementById('ascii');

    headWrap.replaceChildren(
      el('div', {
        class: 'row',
        style: 'justify-content:space-between; align-items:center',
      }, [
        el('div', {}, [
          el('div', {
            class: 'row',
            style: 'gap:8px; align-items:center',
          }, [
            el('h2', { style: 'margin:0' }, [p.title]),
            el('span', { class: 'badge' }, [p.kind]),
          ]),
          el('div', { class: 'hint' }, [
            '작성: ',
            new Date(p.created_at).toLocaleString(),
            p.author ? ' · 작성자: ' + p.author : '',
          ]),
        ]),
        el('div', { class: 'row' }, [
          el('button', {
            class: 'btn',
            onclick: () => {
              copyText(p.ascii);
            },
          }, ['복사']),
          el('button', {
            class: 'btn secondary',
            onclick: () =>
              downloadText((p.title || 'ascii') + '.txt', p.ascii),
          }, ['.txt 저장']),
          el('button', {
            class: 'btn ghost',
            onclick: () => {
              location.hash = '#/list';
            },
          }, ['목록']),
        ]),
      ]),
    );

    // ASCII 폭에 맞게 폰트 조정
        // ASCII 폭/높이에 맞게 폰트 조정
    function refitPost() {
      fitAsciiToWidth(preEl, p.ascii || '', { context: 'post' });
    }

    preEl.textContent = p.ascii || '';
    refitPost();


    if (postResizeHandler) {
      window.removeEventListener('resize', postResizeHandler);
    }
    postResizeHandler = () => refitPost();
    window.addEventListener('resize', postResizeHandler, {
      passive: true,
    });

    // 댓글
    async function drawComments() {
      const wrap = commentsSec.querySelector('#comments');
      wrap.innerHTML = '';

      const { data: list, error: ce } = await store.listComments(id);
      if (ce) {
        wrap.appendChild(
          el('div', { class: 'empty' }, [
            '댓글 불러오기 실패: ',
            ce.message,
          ]),
        );
        return;
      }
      if (!list.length) {
        wrap.appendChild(
          el('div', { class: 'empty' }, ['아직 댓글이 없습니다.']),
        );
        return;
      }

      const byParent = new Map();
      list.forEach((c) => {
        const k = c.parent_id || 'root';
        if (!byParent.has(k)) byParent.set(k, []);
        byParent.get(k).push(c);
      });

      function displayName(c) {
        if (c.nickname && c.nickname.trim()) return c.nickname.trim();
        const roots = byParent.get('root') || [];
        let idx = 0;
        for (const r of roots) {
          if (r === c) break;
          if (!r.nickname || !r.nickname.trim()) idx++;
        }
        return '익명' + (idx + 1);
      }

      function openReply(parentId) {
        const modal = el('div', {
          style:
            'position:fixed;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.45);z-index:50',
        });
        const card = el('div', {
          class: 'card',
          style: 'max-width:560px; width:92vw',
        }, [
          el('h3', { style: 'margin:0 0 8px 0' }, ['답글 달기']),
          el('label', {}, ['닉네임(선택)']),
          el('input', { type: 'text', id: 'n' }),
          el('label', { style: 'margin-top:8px' }, ['내용']),
          el('textarea', { id: 't', rows: '3' }),
          el('div', {
            class: 'row',
            style: 'justify-content:flex-end; margin-top:8px',
          }, [
            el('button', {
              class: 'btn ghost',
              onclick: () => modal.remove(),
            }, ['취소']),
            el('button', {
              class: 'btn accent',
              onclick: async () => {
                const txt =
                  card.querySelector('#t').value.trim();
                const name =
                  card.querySelector('#n').value.trim();
                if (!txt) return;
                const { error } = await store.addComment({
                  post_id: id,
                  parent_id: parentId,
                  text: txt,
                  nickname: name || null,
                });
                if (error) {
                  alert('등록 실패: ' + error.message);
                  return;
                }
                modal.remove();
                drawComments();
              },
            }, ['등록']),
          ]),
        ]);
        modal.appendChild(card);
        document.body.appendChild(modal);
      }

      function node(c, depth) {
        const who = displayName(c);
        const box = el(
          'div',
          { class: 'comment' + (depth ? ' indent' : '') },
          [
            el('div', { class: 'meta' }, [
              who,
              ' · ',
              new Date(c.created_at).toLocaleString(),
            ]),
            el('div', {
              style: 'white-space:pre-wrap; margin-top:6px',
            }, [c.text]),
          ],
        );
        const actions = el('div', {
          class: 'row',
          style: 'gap:8px; margin-top:6px',
        }, [
          el('button', {
            class: 'btn ghost',
            onclick: () => openReply(c.id),
          }, ['답글']),
        ]);
        box.appendChild(actions);

        (byParent.get(c.id) || []).forEach((k) =>
          box.appendChild(node(k, depth + 1)),
        );
        return box;
      }

      (byParent.get('root') || []).forEach((c) =>
        wrap.appendChild(node(c, 0)),
      );
    }

    commentsSec.querySelector('#csubmit').onclick = async () => {
      const nick =
        commentsSec.querySelector('#nick').value.trim();
      const text =
        commentsSec.querySelector('#cbody').value.trim();
      if (!text) return;
      const { error } = await store.addComment({
        post_id: id,
        parent_id: null,
        text,
        nickname: nick || null,
      });
      if (error) {
        alert('등록 실패: ' + error.message);
        return;
      }
      commentsSec.querySelector('#cbody').value = '';
      drawComments();
    };

    drawComments();
  }

  // =========================
  // ⑫ 시작
  // =========================
  checkConnection();
  initRouter();
})();
