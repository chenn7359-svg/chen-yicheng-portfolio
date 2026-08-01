(function () {
  const dialog = document.querySelector('dialog.lightbox');
  const dialogImage = dialog && dialog.querySelector('img');
  const dialogCaption = dialog && dialog.querySelector('[data-lightbox-caption]');

  document.querySelectorAll('img[data-zoom]').forEach((image) => {
    image.addEventListener('click', () => {
      if (!dialog || !dialogImage) return;
      dialogImage.src = image.currentSrc || image.src;
      dialogImage.alt = image.alt;
      if (dialogCaption) dialogCaption.textContent = image.closest('figure')?.querySelector('figcaption')?.textContent || image.alt;
      dialog.showModal();
    });
  });

  dialog?.querySelector('[data-close-lightbox]')?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  document.querySelector('[data-back-top]')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();
