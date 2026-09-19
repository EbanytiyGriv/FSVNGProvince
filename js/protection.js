// Базовая защита от DevTools (помните: полная защита невозможна)

(function() {
  'use strict';

  // Отключение контекстного меню
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });

  // Блокировка стандартных комбинаций клавиш
  document.addEventListener('keydown', (e) => {
    // F12
    if (e.keyCode === 123) {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+I
    if (e.ctrlKey && e.shiftKey && e.keyCode === 73) {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+J
    if (e.ctrlKey && e.shiftKey && e.keyCode === 74) {
      e.preventDefault();
      return false;
    }
    // Ctrl+U (просмотр исходного кода)
    if (e.ctrlKey && e.keyCode === 85) {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+C
    if (e.ctrlKey && e.shiftKey && e.keyCode === 67) {
      e.preventDefault();
      return false;
    }
  });

  // Детект открытия DevTools (не 100% надежно)
  const devtoolsDetector = () => {
    const threshold = 160;
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;

    if (widthThreshold || heightThreshold) {
      // DevTools, возможно, открыты
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0d0f0a;color:#eef0e2;font-family:monospace;text-align:center;padding:20px;"><div><h1 style="font-size:2rem;margin-bottom:1rem;">Доступ ограничен</h1><p>Пожалуйста, закройте инструменты разработчика</p></div></div>';
    }
  };

  // Проверка каждые 1000ms
  setInterval(devtoolsDetector, 1000);

  // Детект через console
  let devtools = { open: false };
  const element = new Image();
  Object.defineProperty(element, 'id', {
    get: function() {
      devtools.open = true;
      throw new Error('DevTools detected');
    }
  });

  setInterval(() => {
    devtools.open = false;
    console.log(element);
    if (devtools.open) {
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0d0f0a;color:#eef0e2;font-family:monospace;text-align:center;padding:20px;"><div><h1 style="font-size:2rem;margin-bottom:1rem;">Доступ ограничен</h1><p>Пожалуйста, закройте инструменты разработчика</p></div></div>';
    }
  }, 1000);

  // Защита от debugger
  setInterval(() => {
    (function() {
      return false;
    }
    ['constructor']('debugger')
    ['call']());
  }, 50);

})();

// Обфускация критичных данных
window.addEventListener('load', () => {
  // Удаляем комментарии из исходного кода (если есть)
  const scripts = document.querySelectorAll('script');
  scripts.forEach(script => {
    if (script.src) return;
    const content = script.textContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    script.textContent = content;
  });
});
