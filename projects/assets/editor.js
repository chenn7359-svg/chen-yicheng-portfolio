(function () {
  const page = decodeURIComponent(location.pathname.split('/').pop() || 'index.html');
  const allowedPages = new Set(['index.html', 'canyin.html', 'aigc-huoshi.html', 'aigc-humanities.html']);
  if (!allowedPages.has(page)) return;

  const apiOrigin = 'http://127.0.0.1:8766';
  const localPage = location.protocol === 'file:' || ['127.0.0.1', 'localhost'].includes(location.hostname);

  const textSelector = [
    '.hero-copy h1', '.hero-lede', '.hero-note',
    '.section-head h2', '.section-head p', '.lead',
    '.statement h3', '.statement p',
    '.decision h3', '.decision p',
    '.process-step h3', '.process-step p',
    '.project-card h3', '.project-card p', '.project-card-link',
    '.fact-list dd', '.metric span', 'figcaption', '.quote',
    '.next-inner h2', '.next-inner p'
  ].join(',');

  const textNodes = Array.from(document.querySelectorAll(textSelector));
  const imageNodes = Array.from(document.querySelectorAll('main img'));
  const saved = window.__PROJECT_EDITOR_CONTENT__?.[page] || { text: {}, images: {} };
  let editing = false;
  let imageTarget = null;

  textNodes.forEach((node, index) => {
    const key = `text-${index}`;
    node.dataset.editorTextKey = key;
    if (saved.text?.[key] !== undefined) node.innerHTML = saved.text[key];
  });

  imageNodes.forEach((node, index) => {
    const key = `image-${index}`;
    node.dataset.editorImageKey = key;
    if (saved.images?.[key]) {
      node.src = saved.images[key];
      node.dataset.editorOverride = saved.images[key];
    }
  });

  // 公网页面也要应用已保存内容，但只有本地页面显示编辑工具。
  if (!localPage) return;

  const toolbar = document.createElement('div');
  toolbar.className = 'editor-toolbar';
  toolbar.innerHTML = `
    <button type="button" class="editor-toggle" title="编辑当前页面">编辑</button>
    <label class="editor-image-replace" for="editor-image-input" hidden aria-disabled="true">替换图片</label>
    <button type="button" class="editor-save" hidden>保存</button>
    <button type="button" class="editor-exit" hidden>退出</button>
    <span class="editor-status" role="status"></span>
  `;
  document.body.appendChild(toolbar);

  const fileInput = document.createElement('input');
  fileInput.id = 'editor-image-input';
  fileInput.type = 'file';
  fileInput.accept = 'image/png,image/jpeg,image/webp,image/gif';
  fileInput.hidden = true;
  document.body.appendChild(fileInput);

  const toggleButton = toolbar.querySelector('.editor-toggle');
  const replaceImageLabel = toolbar.querySelector('.editor-image-replace');
  const saveButton = toolbar.querySelector('.editor-save');
  const exitButton = toolbar.querySelector('.editor-exit');
  const status = toolbar.querySelector('.editor-status');

  function setStatus(message, kind = '') {
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function clearImageSelection() {
    imageTarget = null;
    imageNodes.forEach((node) => node.classList.remove('editor-image-selected'));
    replaceImageLabel.dataset.ready = 'false';
    replaceImageLabel.setAttribute('aria-disabled', 'true');
  }

  function selectImage(image) {
    imageTarget = image;
    imageNodes.forEach((node) => node.classList.toggle('editor-image-selected', node === image));
    replaceImageLabel.dataset.ready = 'true';
    replaceImageLabel.setAttribute('aria-disabled', 'false');
    fileInput.value = '';
    setStatus('图片已选中，点击“替换图片”选择新文件');
  }

  function setEditing(next, preserveStatus = false) {
    editing = next;
    document.body.classList.toggle('editor-active', editing);
    textNodes.forEach((node) => {
      node.contentEditable = editing ? 'true' : 'false';
      node.spellcheck = editing;
    });
    toggleButton.hidden = editing;
    replaceImageLabel.hidden = !editing;
    saveButton.hidden = !editing;
    exitButton.hidden = !editing;
    if (!editing) clearImageSelection();
    if (!preserveStatus) setStatus(editing ? '文字可直接修改；先点图片，再点“替换图片”' : '');
  }

  document.addEventListener('click', (event) => {
    if (!editing || !(event.target instanceof Element)) return;
    if (event.target.closest('a')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  async function post(path, body) {
    const response = await fetch(`${apiOrigin}${path}`, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `HTTP ${response.status}`);
    return response.json();
  }

  async function checkServer() {
    try {
      const response = await fetch(`${apiOrigin}/api/ping`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return true;
    } catch (error) {
      setStatus('保存服务未启动，请双击“启动网页编辑器.bat”', 'error');
      return false;
    }
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  imageNodes.forEach((image) => {
    const selectImageFromPointer = (event) => {
      if (!editing) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      selectImage(image);
    };
    image.addEventListener('pointerdown', selectImageFromPointer, true);
    image.addEventListener('click', selectImageFromPointer, true);
  });

  replaceImageLabel.addEventListener('click', (event) => {
    if (editing && imageTarget) return;
    event.preventDefault();
    setStatus('请先点击要替换的图片', 'error');
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file || !imageTarget) return;
    if (file.size > 12 * 1024 * 1024) {
      setStatus('单张图片请小于 12MB', 'error');
      return;
    }
    setStatus('正在保存图片…');
    try {
      const result = await post('/api/upload', {
        page,
        filename: file.name,
        mime: file.type,
        data: await readFile(file)
      });
      imageTarget.src = result.path;
      imageTarget.dataset.editorOverride = result.path;
      setStatus('图片已替换，点击“保存”固定到页面', 'success');
    } catch (error) {
      setStatus(`图片保存失败：${error.message}`, 'error');
    }
  });

  toggleButton.addEventListener('click', () => {
    setEditing(true);
    checkServer();
  });
  exitButton.addEventListener('click', () => setEditing(false));

  saveButton.addEventListener('click', async () => {
    const state = { text: {}, images: {} };
    textNodes.forEach((node) => { state.text[node.dataset.editorTextKey] = node.innerHTML; });
    imageNodes.forEach((node) => {
      if (node.dataset.editorOverride) state.images[node.dataset.editorImageKey] = node.dataset.editorOverride;
    });
    saveButton.disabled = true;
    setStatus('正在保存…');
    try {
      await post('/api/save', { page, state });
      window.__PROJECT_EDITOR_CONTENT__ = window.__PROJECT_EDITOR_CONTENT__ || {};
      window.__PROJECT_EDITOR_CONTENT__[page] = state;
      setEditing(false, true);
      setStatus('已保存；刷新页面仍会保留', 'success');
    } catch (error) {
      setStatus(`保存失败：${error.message}`, 'error');
    } finally {
      saveButton.disabled = false;
    }
  });

  if (new URLSearchParams(location.search).get('edit') === '1') {
    setEditing(true);
    checkServer();
  }
})();
