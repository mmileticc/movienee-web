// Applies the saved theme before Angular starts, so the page never flashes the wrong colors.
// A separate file (not an inline script) so the Content-Security-Policy can forbid inline scripts.
try {
  var theme = localStorage.getItem('movienee.theme');
  if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;
} catch (e) {}
