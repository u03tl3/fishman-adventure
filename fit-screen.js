/* Keep the Fishman game within the visible iOS Safari viewport. */
(() => {
  function fitVisibleScreen() {
    if (!(matchMedia('(pointer:coarse)').matches || matchMedia('(any-pointer:coarse)').matches)) return;
    const height = window.visualViewport?.height || window.innerHeight;
    if (Number.isFinite(height) && height > 180) {
      document.documentElement.style.setProperty('--fishman-viewport-height', Math.floor(height) + 'px');
    }
  }
  fitVisibleScreen();
  window.addEventListener('resize', fitVisibleScreen);
  window.addEventListener('orientationchange', () => {
    window.dispatchEvent(new Event('blur'));
    fitVisibleScreen();
    setTimeout(fitVisibleScreen, 300);
  });
  window.visualViewport?.addEventListener('resize', fitVisibleScreen);
})();
