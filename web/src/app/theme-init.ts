// Выполняется до загрузки CSS и React, чтобы избежать вспышки светлого фона.
{
  type InitialTheme = 'system' | 'light' | 'dark';

  let theme: InitialTheme = 'system';

  try {
    const stored = localStorage.getItem('humidifier-theme');

    if (stored === 'light' || stored === 'dark') {
      theme = stored;
    }
  } catch {
    // Системная тема доступна и при запрете хранилища.
  }

  const isDark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);

  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
}
